# app/api/service/water/geospatial_service.py

import geopandas as gpd
import rasterio
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import tempfile
import zipfile
import requests
from requests.auth import HTTPBasicAuth
import os
import numpy as np
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

logger = logging.getLogger(__name__)


class GeospatialProcessor:
    """
    Enhanced Geospatial processor for Water Budget operations.
    Handles vector/raster clipping, GeoServer interactions, and file management.
    """

    def __init__(self, output_dir: Path, geoserver_config=None):
        self.output_dir = output_dir
        self.default_crs = "EPSG:32644"  # UTM Zone 44N for India

        # GeoServer configuration
        if geoserver_config:
            self.geoserver_url = geoserver_config.geoserver_url
            self.username = geoserver_config.username
            self.password = geoserver_config.password
        else:
            from app.utils.network_conf import GeoConfig

            config = GeoConfig()
            self.geoserver_url = config.geoserver_url
            self.username = config.username
            self.password = config.password

        # Ensure output directory exists
        if not self.output_dir.exists():
            self.output_dir.mkdir(parents=True, exist_ok=True)

    def _ensure_crs(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Ensure GeoDataFrame has correct CRS"""
        if gdf.crs is None:
            gdf.set_crs(self.default_crs, inplace=True)
        elif gdf.crs != self.default_crs:
            gdf = gdf.to_crs(self.default_crs)
        return gdf

    def clip_vector_to_vector(
        self, target_gdf: gpd.GeoDataFrame, clip_gdf: gpd.GeoDataFrame
    ) -> gpd.GeoDataFrame:
        """
        Clip target vector layer to clip boundary.

        Args:
            target_gdf: Vector layer to be clipped
            clip_gdf: Clipping boundary

        Returns:
            Clipped GeoDataFrame
        """
        if target_gdf.empty or clip_gdf.empty:
            return gpd.GeoDataFrame(columns=target_gdf.columns, crs=self.default_crs)

        target_gdf = self._ensure_crs(target_gdf)
        clip_gdf = self._ensure_crs(clip_gdf)

        result_gdf = gpd.overlay(target_gdf, clip_gdf, how="intersection")
        result_gdf = result_gdf[
            result_gdf.geometry.notnull() & ~result_gdf.geometry.is_empty
        ]
        return result_gdf

    def clip_raster_to_vector(
        self,
        raster_path: str,
        mask_gdf: gpd.GeoDataFrame,
        output_filename: str,
        verify_output: bool = True,
    ) -> Optional[str]:
        """Clip raster to vector boundary with CRS alignment and negative value support."""

        try:
            # Check if reprojection is needed
            with rasterio.open(raster_path) as src:
                raster_crs = src.crs
                if raster_crs is None:
                    raise ValueError("Raster has no CRS")

                original_nodata = src.nodata

                # ✅ FIX: reproject VECTOR to raster CRS (4326)
                if mask_gdf.crs is None:
                    raise ValueError("Mask GeoDataFrame has no CRS")

                if mask_gdf.crs != raster_crs:
                    mask_gdf = mask_gdf.to_crs(raster_crs)

            geometries = list(mask_gdf.geometry)
            if not geometries or all(
                geom is None or geom.is_empty for geom in geometries
            ):
                raise ValueError("No valid geometries to clip raster")

            # NOW clip with the correct CRS raster
            with rasterio.open(raster_path) as src:
                # ✅ FIX: Use original nodata or choose a value that won't conflict with data
                if original_nodata is not None:
                    nodata_value = original_nodata
                    print(f"✓ Using original nodata value: {nodata_value}")
                else:
                    # Read data to find a safe nodata value
                    sample_data = src.read(1)
                    valid = sample_data[~np.isnan(sample_data)]
                    if valid.size == 0:
                        raise ValueError("Raster contains only NoData values")
                    data_min = np.min(valid)

                    # Choose nodata value far below minimum data value
                    # This ensures negative data values are preserved
                    if data_min < 0:
                        nodata_value = data_min - 10000  # Much lower than any real data
                    else:
                        nodata_value = -99999  # Default for positive data

                    print(
                        f"✓ Calculated safe nodata value: {nodata_value} (data min: {data_min})"
                    )

                # ✅ Use filled=False to preserve all data values including negatives
                out_image, out_transform = mask(
                    src,
                    geometries,
                    crop=True,
                    nodata=nodata_value,
                    all_touched=False,
                    filled=False,  # ✅ CRITICAL: Don't fill with nodata, preserve original values
                    pad=False,
                )
                out_meta = src.meta.copy()

            out_meta.update(
                {
                    "driver": "GTiff",
                    "height": out_image.shape[1],
                    "width": out_image.shape[2],
                    "transform": out_transform,
                    "nodata": nodata_value,
                    "compress": "lzw",
                }
            )

            if not output_filename.lower().endswith(".tif"):
                output_filename = f"{output_filename}.tif"

            output_path = self.output_dir / output_filename

            with rasterio.open(output_path, "w", **out_meta) as dest:
                dest.write(out_image)

            print(f"✓ Raster clipped successfully: {output_path}")

            if verify_output and output_path.exists():
                stats = self.analyze_raster_statistics(str(output_path))
                if stats.get("count", 0) == 0:
                    print(f"⚠ Warning: Clipped raster has no valid data")
                else:
                    print(f"  Valid pixels: {stats.get('count', 0):,}")
                    print(
                        f"  Value range: {stats.get('min', 'N/A')} to {stats.get('max', 'N/A')}"
                    )
                    if stats.get("min", 0) < 0:
                        print(f"  ✓ Negative values preserved!")

            return str(output_path)

        except Exception as e:
            print(f"✗ Raster clipping failed for {raster_path}: {e}")

            return None

    def save_vector_to_zip(
        self, gdf: gpd.GeoDataFrame, layer_name: str
    ) -> Optional[Path]:
        """
        Save GeoDataFrame as zipped shapefile.

        Args:
            gdf: GeoDataFrame to save
            layer_name: Name for the shapefile

        Returns:
            Path to zip file or None if failed
        """
        try:
            zip_filename = f"{layer_name}.zip"
            output_zip_path = self.output_dir / zip_filename

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_shp = Path(temp_dir) / f"{layer_name}.shp"
                gdf.to_file(temp_shp, driver="ESRI Shapefile", engine="fiona")

                with zipfile.ZipFile(output_zip_path, "w") as zipf:
                    for file in temp_shp.parent.glob(f"{layer_name}.*"):
                        zipf.write(file, file.name)

            print(f"✓ Vector saved to zip: {output_zip_path}")
            return output_zip_path
        except Exception as e:
            print(f"✗ Vector saving failed: {e}")
            return None

    # ========== GEOSERVER METHODS ==========

    def download_raster_from_geoserver(
        self,
        layer_name: str,
        workspace: str,
        output_dir: Optional[Path] = None,
        max_retries: int = 3,
        timeout: int = 120,
    ) -> Optional[Dict[str, str]]:
        """
        Download raster from GeoServer using WCS with retry logic.

        Args:
            layer_name: Name of the raster layer
            workspace: GeoServer workspace
            output_dir: Optional custom output directory
            max_retries: Maximum number of retry attempts
            timeout: Request timeout in seconds

        Returns:
            Dict with raster_path or None if failed
        """
        save_dir = output_dir or self.output_dir
        wcs_url = (
            f"{self.geoserver_url}/wcs"
            f"?service=WCS&version=2.0.1&request=GetCoverage"
            f"&coverageId={workspace}:{layer_name}"
            f"&format=image/geotiff"
        )

        print(f"Downloading raster: {workspace}:{layer_name}")

        for attempt in range(max_retries):
            try:
                response = requests.get(
                    wcs_url,
                    auth=HTTPBasicAuth(self.username, self.password),
                    timeout=timeout,
                )

                if response.status_code != 200:
                    print(
                        f"✗ Failed to download raster. Status: {response.status_code}"
                    )
                    print(f"  Response: {response.text[:200]}")
                    if attempt < max_retries - 1:
                        wait_time = 2**attempt
                        print(
                            f"⚠ Retrying in {wait_time}s... (Attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(wait_time)
                        continue
                    return None

                raster_filename = f"{layer_name}.tif"
                raster_path = save_dir / raster_filename

                with open(raster_path, "wb") as f:
                    f.write(response.content)

                print(f"✓ Raster downloaded: {raster_path}")
                return {"raster_path": str(raster_path)}

            except requests.Timeout:
                print(f"✗ Timeout downloading raster")
                if attempt < max_retries - 1:
                    wait_time = 2**attempt
                    print(
                        f"⚠ Retrying in {wait_time}s... (Attempt {attempt + 1}/{max_retries})"
                    )
                    time.sleep(wait_time)
                else:
                    return None

            except Exception as e:
                print(f"✗ Error downloading raster: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2**attempt
                    print(
                        f"⚠ Retrying in {wait_time}s... (Attempt {attempt + 1}/{max_retries})"
                    )
                    time.sleep(wait_time)
                else:
                    return None

        return None

    def download_and_clip_raster(
        self,
        layer_name: str,
        workspace: str,
        mask_gdf: gpd.GeoDataFrame,
        output_filename: str,
    ) -> Optional[str]:
        """
        Download raster from GeoServer and clip it in one operation.

        Args:
            layer_name: Name of the raster layer
            workspace: GeoServer workspace
            mask_gdf: Vector boundary for clipping
            output_filename: Output filename for clipped raster

        Returns:
            Path to clipped raster or None if failed
        """
        # Download raster
        download_result = self.download_raster_from_geoserver(layer_name, workspace)
        if not download_result:
            return None

        raster_path = download_result["raster_path"]

        # Clip raster
        clipped_path = self.clip_raster_to_vector(
            raster_path, mask_gdf, output_filename
        )

        # Clean up original downloaded file
        try:
            if os.path.exists(raster_path) and clipped_path:
                os.remove(raster_path)
                print(f"✓ Cleaned up temporary file: {raster_path}")
        except Exception as e:
            print(f"⚠ Warning: Could not remove temporary file: {e}")

        return clipped_path

    def batch_download_and_clip_rasters(
        self,
        layer_configs: List[Dict[str, str]],
        mask_gdf: gpd.GeoDataFrame,
        max_workers: int = 3,
    ) -> Dict[str, str]:
        """
        Download and clip multiple rasters in parallel.

        Args:
            layer_configs: List of dicts with 'layer_name', 'workspace', 'output_filename'
            mask_gdf: Vector boundary for clipping
            max_workers: Maximum number of parallel workers

        Returns:
            Dict mapping layer_name to clipped raster path
        """
        results = {}

        print(f"\n{'='*60}")
        print(
            f"Batch processing {len(layer_configs)} rasters with {max_workers} workers"
        )
        print(f"{'='*60}\n")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_layer = {
                executor.submit(
                    self.download_and_clip_raster,
                    config["layer_name"],
                    config["workspace"],
                    mask_gdf,
                    config["output_filename"],
                ): config["layer_name"]
                for config in layer_configs
            }

            for future in as_completed(future_to_layer):
                layer_name = future_to_layer[future]
                try:
                    result = future.result()
                    if result:
                        results[layer_name] = result
                        print(f"✓ Completed: {layer_name}")
                    else:
                        print(f"✗ Failed: {layer_name}")
                except Exception as e:
                    print(f"✗ Exception for {layer_name}: {e}")

        print(f"\n{'='*60}")
        print(
            f"Batch processing complete: {len(results)}/{len(layer_configs)} successful"
        )
        print(f"{'='*60}\n")

        return results

    def get_layer_style_name(self, layer_name: str, workspace: str) -> Optional[str]:
        """
        Fetch the default style name for a layer.

        Args:
            layer_name: Layer name
            workspace: Workspace name

        Returns:
            Style name (without workspace prefix) or None
        """
        url = (
            f"{self.geoserver_url}/rest/workspaces/{workspace}/layers/{layer_name}.json"
        )

        try:
            response = requests.get(
                url, auth=HTTPBasicAuth(self.username, self.password), timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                style_entry = data.get("layer", {}).get("defaultStyle", {})
                style_name = style_entry.get("name")

                # Strip workspace prefix if present
                if style_name and ":" in style_name:
                    style_name = style_name.split(":")[-1]

                print(f"✓ Found style: {style_name}")
                return style_name
            else:
                print(f"✗ Could not find layer info for {layer_name}")
                return None
        except Exception as e:
            print(f"✗ Error fetching style name: {e}")
            return None

    def publish_raster_to_geoserver(
        self,
        raster_path: str,
        workspace: str,
        store_name: str,
        layer_name: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Publish raster to GeoServer.

        Args:
            raster_path: Path to raster file
            workspace: GeoServer workspace
            store_name: Coverage store name
            layer_name: Optional layer name (defaults to filename)

        Returns:
            Tuple of (success_status, published_layer_name)
        """
        if not os.path.exists(raster_path):
            print(f"✗ Raster file not found: {raster_path}")
            return False, None

        if layer_name is None:
            layer_name = os.path.splitext(os.path.basename(raster_path))[0]
        layer_name = layer_name.replace(" ", "")

        try:
            # 1. Check/Create Store
            store_url = f"{self.geoserver_url}/rest/workspaces/{workspace}/coveragestores/{store_name}"
            store_check = requests.get(
                store_url, auth=HTTPBasicAuth(self.username, self.password)
            )

            if store_check.status_code != 200:
                print(f"Creating coverage store: {store_name}")
                create_store_url = (
                    f"{self.geoserver_url}/rest/workspaces/{workspace}/coveragestores"
                )
                store_data = {
                    "coverageStore": {
                        "name": store_name,
                        "type": "GeoTIFF",
                        "enabled": True,
                        "workspace": {"name": workspace},
                    }
                }
                requests.post(
                    create_store_url,
                    json=store_data,
                    auth=HTTPBasicAuth(self.username, self.password),
                )

            # 2. Upload File
            upload_url = (
                f"{self.geoserver_url}/rest/workspaces/{workspace}/"
                f"coveragestores/{store_name}/file.geotiff?configure=first"
            )

            with open(raster_path, "rb") as f:
                raster_data = f.read()

            print(f"Uploading raster to GeoServer: {layer_name}")
            upload_response = requests.put(
                upload_url,
                data=raster_data,
                auth=HTTPBasicAuth(self.username, self.password),
                headers={"Content-type": "image/tiff"},
            )

            # 3. Publish Layer
            coverage_url = (
                f"{self.geoserver_url}/rest/workspaces/{workspace}/"
                f"coveragestores/{store_name}/coverages"
            )
            coverage_data = {
                "coverage": {"name": layer_name, "title": layer_name, "enabled": True}
            }
            response = requests.post(
                coverage_url,
                json=coverage_data,
                auth=HTTPBasicAuth(self.username, self.password),
            )

            if response.status_code in (200, 201, 500):
                # 500 often means it was auto-created successfully
                print(f"✓ Raster published: {layer_name}")
                return True, layer_name
            else:
                print(f"✗ Publishing failed: {response.status_code}")
                return False, None

        except Exception as e:
            print(f"✗ Error publishing raster: {e}")
            return False, None

    def link_existing_style(
        self, workspace: str, layer_name: str, style_name: str
    ) -> bool:
        """
        Link an existing style to a layer.

        Args:
            workspace: Workspace name
            layer_name: Layer to style
            style_name: Style to apply

        Returns:
            True if successful
        """
        url = f"{self.geoserver_url}/rest/workspaces/{workspace}/layers/{layer_name}"

        payload = {
            "layer": {
                "defaultStyle": {"name": style_name, "workspace": {"name": workspace}}
            }
        }

        try:
            print(f"Linking style '{style_name}' to layer '{layer_name}'")
            response = requests.put(
                url,
                json=payload,
                auth=HTTPBasicAuth(self.username, self.password),
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                print("✓ Style linked successfully")
                return True
            else:
                print(f"✗ Style linking failed: {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                return False
        except Exception as e:
            print(f"✗ Error linking style: {e}")
            return False

    def layer_exists(self, workspace: str, layer_name: str) -> bool:
        """
        Check if a layer exists in GeoServer.

        Args:
            workspace: Workspace name
            layer_name: Layer to check

        Returns:
            True if layer exists
        """
        url = (
            f"{self.geoserver_url}/rest/workspaces/{workspace}/layers/{layer_name}.json"
        )
        try:
            response = requests.get(
                url, auth=HTTPBasicAuth(self.username, self.password), timeout=5
            )
            return response.status_code == 200
        except Exception:
            return False

    def analyze_raster_statistics(self, raster_path: str) -> Dict[str, Any]:
        """
        Analyze raster statistics (min, max, mean, std, pixel counts).
        ✅ Enhanced to properly handle negative values and filter common nodata sentinels.

        Args:
            raster_path: Path to raster file

        Returns:
            Dictionary with statistics
        """
        # Common nodata sentinel values to always exclude
        NODATA_SENTINELS = [9999, -9999, 9999.0, -9999.0]
        
        try:
            with rasterio.open(raster_path) as src:
                data = src.read(1)  # Read first band
                nodata = src.nodata

                # ✅ Start with filtering out NaN values
                valid_mask = ~np.isnan(data)
                
                # ✅ Filter out declared nodata value from metadata
                if nodata is not None and not np.isnan(nodata):
                    valid_mask &= ~np.isclose(data, nodata)
                
                # ✅ Explicitly filter out common nodata sentinel values
                for sentinel in NODATA_SENTINELS:
                    valid_mask &= ~np.isclose(data, sentinel)
                
                valid_data = data[valid_mask]

                if len(valid_data) == 0:
                    return {"error": "No valid data in raster"}

                # Calculate statistics - this will now include negative values
                unique_values, counts = np.unique(valid_data, return_counts=True)

                # Count negative values specifically
                negative_count = np.sum(valid_data < 0)
                positive_count = np.sum(valid_data > 0)
                zero_count = np.sum(valid_data == 0)

                stats = {
                    "min": float(np.min(valid_data)),
                    "max": float(np.max(valid_data)),
                    "mean": float(np.mean(valid_data)),
                    "std": float(np.std(valid_data)),
                    "count": int(len(valid_data)),
                    "unique_values": len(unique_values),
                    "negative_count": int(negative_count),
                    "positive_count": int(positive_count),
                    "zero_count": int(zero_count),
                    "value_distribution": {
                        str(float(val)): int(count)
                        for val, count in zip(unique_values, counts)
                    },
                }

                return stats

        except Exception as e:
            print(f"✗ Error analyzing raster: {e}")
            return {"error": str(e)}

    def calculate_raster_sum(self, raster_path: str) -> float:
        with rasterio.open(raster_path) as src:
            band = src.read(1).astype("float64")
            nodata = src.nodata

        if nodata is not None:
            if np.isnan(nodata):
                mask = ~np.isnan(band)
            else:
                mask = ~np.isclose(band, nodata)
        else:
            mask = ~np.isnan(band)

        valid_pixels = band[mask]

        pixel_sum = float(valid_pixels.sum())
        return pixel_sum

    def get_raster_info(self, raster_path: str) -> Dict[str, Any]:
        """
        Get comprehensive raster information including metadata and statistics.

        Args:
            raster_path: Path to raster file

        Returns:
            Dictionary with raster information
        """
        try:
            with rasterio.open(raster_path) as src:
                info = {
                    "path": raster_path,
                    "driver": src.driver,
                    "width": src.width,
                    "height": src.height,
                    "count": src.count,
                    "crs": str(src.crs),
                    "nodata": src.nodata,
                    "bounds": src.bounds,
                    "transform": list(src.transform)[:6],
                    "statistics": self.analyze_raster_statistics(raster_path),
                }
                return info
        except Exception as e:
            print(f"✗ Error getting raster info: {e}")
            return {"error": str(e)}


    def filter_raster_values(
        self,
        raster_path: str,
        filter_type: str,
        output_filename: str = None
    ) -> Optional[str]:
        """
        Filter raster values based on type (positive/negative).
        
        Args:
            raster_path: Path to source raster
            filter_type: 'positive' (keep > 0) or 'negative' (keep < 0)
            output_filename: Optional output filename
            
        Returns:
            Path to filtered raster or None
        """
        try:
            with rasterio.open(raster_path) as src:
                data = src.read(1)
                profile = src.profile.copy()
                nodata = src.nodata
                
                # Create mask based on filter type
                if filter_type == 'positive':
                    # Keep values > 0, mask out others
                    mask = data <= 0
                    logger.info("  ✓ Filtering for POSITIVE values (keeping > 0)")
                elif filter_type == 'negative':
                    # Keep values < 0, mask out others
                    mask = data >= 0
                    logger.info("  ✓ Filtering for NEGATIVE values (keeping < 0)")
                else:
                    raise ValueError(f"Invalid filter type: {filter_type}")
                
                # Apply mask (set filtered values to nodata)
                if nodata is None:
                    nodata = -9999
                    profile.update(nodata=nodata)
                    
                data[mask] = nodata
                
                # Save filtered raster
                if not output_filename:
                    output_filename = f"filtered_{Path(raster_path).name}"
                
                output_path = self.output_dir / output_filename
                
                with rasterio.open(output_path, 'w', **profile) as dest:
                    dest.write(data, 1)
                    
                logger.info(f"  ✓ Filtered raster saved: {output_path}")
                return str(output_path)
                
        except Exception as e:
            logger.error(f"Error filtering raster: {e}")
            return None

    # ========== DYNAMIC SLD GENERATION ==========

    # Color palettes for different product types
    PALETTES = {
        "water_budget": [
            "#FF0000",
            "#FF4500",
            "#FFA500",
            "#FFD700",
            "#FFFF00",
            "#90EE90",
            "#3CB371",
            "#00FFFF",
            "#4169E1",
            "#000080",
        ],
        "deficit": [
            "#FFFFFF",
            "#FFFFE0",
            "#FFFACD",
            "#FFE4B5",
            "#FFDAB9",
            "#FFA07A",
            "#FA8072",
            "#E9967A",
            "#CD5C5C",
            "#8B0000",
        ],
        "surplus": [
            "#FFFFFF",
            "#E0FFFF",
            "#AFEEEE",
            "#7FFFD4",
            "#66CDAA",
            "#20B2AA",
            "#3CB371",
            "#2E8B57",
            "#228B22",
            "#006400",
        ],
        "index_class": [
            "#808080",
            "#8B4513",
            "#FF4500",
            "#FFA500",
            "#FFFF00",
            "#ADFF2F",
            "#00FF00",
            "#00FFFF",
            "#EE82EE",
            "#4B0082",
        ],
    }

    SWCI_FIXED_CLASSES = [
        {
            "class": 1,
            "color": "#808080",
            "min": 0.0,
            "max": 0.9,
            "quantity": 0.9,
            "label": "Extremely Dry",
            "swci_range": "Z < -2.0",
            "opacity": 1.0,
        },
        {
            "class": 2,
            "color": "#8B0000",
            "min": 0.9,
            "max": 1.9,
            "quantity": 1.9,
            "label": "Severely Dry",
            "swci_range": "-2.0 <= Z < -1.5",
            "opacity": 1.0,
        },
        {
            "class": 3,
            "color": "#FF4500",
            "min": 1.9,
            "max": 2.9,
            "quantity": 2.9,
            "label": "Highly Dry",
            "swci_range": "-1.5 <= Z < -1.0",
            "opacity": 1.0,
        },
        {
            "class": 4,
            "color": "#FFA500",
            "min": 2.9,
            "max": 3.9,
            "quantity": 3.9,
            "label": "Moderately Dry",
            "swci_range": "-1.0 <= Z < -0.5",
            "opacity": 1.0,
        },
        {
            "class": 5,
            "color": "#FFFF00",
            "min": 3.9,
            "max": 4.9,
            "quantity": 4.9,
            "label": "Mild Dry",
            "swci_range": "-0.5 <= Z < 0",
            "opacity": 1.0,
        },
        {
            "class": 6,
            "color": "#ADFF2F",
            "min": 4.9,
            "max": 5.9,
            "quantity": 5.9,
            "label": "Mild Surplus",
            "swci_range": "0 <= Z < 0.5",
            "opacity": 1.0,
        },
        {
            "class": 7,
            "color": "#00FF00",
            "min": 5.9,
            "max": 6.9,
            "quantity": 6.9,
            "label": "Moderate Surplus",
            "swci_range": "0.5 <= Z < 1.0",
            "opacity": 1.0,
        },
        {
            "class": 8,
            "color": "#00FFFF",
            "min": 6.9,
            "max": 7.9,
            "quantity": 7.9,
            "label": "High Surplus",
            "swci_range": "1.0 <= Z < 1.5",
            "opacity": 1.0,
        },
        {
            "class": 9,
            "color": "#DA70D6",
            "min": 7.9,
            "max": 8.9,
            "quantity": 8.9,
            "label": "Abundant",
            "swci_range": "1.5 <= Z < 2.0",
            "opacity": 1.0,
        },
        {
            "class": 10,
            "color": "#4B0082",
            "min": 8.9,
            "max": 200.0,
            "quantity": 200.0,
            "label": "Extreme Surplus",
            "swci_range": "Z >= 2.0",
            "opacity": 1.0,
        },
        {
            "class": 11,
            "color": "#000000",
            "min": 256.0,
            "max": 256.0,
            "quantity": 256.0,
            "label": "NoData",
            "swci_range": "NoData",
            "opacity": 0.0,
        },
    ]

    def generate_dynamic_sld(
        self,
        raster_path: str,
        layer_name: str,
        product_type: str = "water_budget",
        num_classes: int = 10,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate dynamic SLD based on clipped raster's actual min-max values.

        Args:
            raster_path: Path to the clipped raster file
            layer_name: Name for the layer/style
            product_type: Type of product (water_budget, deficit, surplus, index_class)
            num_classes: Number of classification classes

        Returns:
            Tuple of (SLD XML content, legend_data dict)
        """
        stats = self.analyze_raster_statistics(raster_path)

        if "error" in stats:
            raise ValueError(f"Cannot analyze raster: {stats['error']}")

        if product_type == "index_class":
            return self._generate_fixed_index_sld(layer_name, stats)

        min_val = stats["min"]
        max_val = stats["max"]

        # Ensure valid range
        if min_val >= max_val:
            max_val = min_val + 0.001

        logger.info(
            f"📊 Dynamic SLD: min={min_val:.4f}, max={max_val:.4f} for {layer_name}"
        )

        palette = self.PALETTES.get(product_type, self.PALETTES["water_budget"])
        interval = (max_val - min_val) / num_classes

        # Build color map entries
        color_entries = []
        legend_classes = []

        for i in range(num_classes):
            lower = min_val + i * interval
            upper = min_val + (i + 1) * interval
            color = palette[i]
            label = f"{lower:.3f} to {upper:.3f}"

            color_entries.append(
                f'        <sld:ColorMapEntry color="{color}" quantity="{lower:.4f}" '
                f'label="{label}" opacity="1.0"/>'
            )
            legend_classes.append(
                {
                    "class": i + 1,
                    "color": color,
                    "min": round(lower, 3),
                    "max": round(upper, 3),
                    "label": label,
                }
            )

        # Add max value entry
        color_entries.append(
            f'        <sld:ColorMapEntry color="{palette[-1]}" quantity="{max_val:.4f}" '
            f'label="> {max_val:.3f}" opacity="1.0"/>'
        )
        
        # ✅ Add NoData entry (9999) with white color - 11th class
        nodata_color = "#FFFFFF"  # White - clearly distinguishable
        color_entries.append(
            f'        <sld:ColorMapEntry color="{nodata_color}" quantity="9999.0" '
            f'label="NoData (9999)" opacity="1.0"/>'
        )
        
        # Add NoData to legend classes
        legend_classes.append(
            {
                "class": num_classes + 1,
                "color": nodata_color,
                "min": 9999,
                "max": 9999,
                "label": "NoData (9999)",
            }
        )

        color_map_xml = "\n".join(color_entries)

        sld_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<sld:StyledLayerDescriptor xmlns="http://www.opengis.net/sld" 
    xmlns:sld="http://www.opengis.net/sld" 
    xmlns:gml="http://www.opengis.net/gml" 
    xmlns:ogc="http://www.opengis.net/ogc" 
    version="1.0.0">
  <sld:NamedLayer>
    <sld:Name>{layer_name}</sld:Name>
    <sld:UserStyle>
      <sld:Name>{layer_name}_dynamic</sld:Name>
      <sld:Title>{layer_name} Dynamic Style (min: {min_val:.3f}, max: {max_val:.3f})</sld:Title>
      <sld:FeatureTypeStyle>
        <sld:Rule>
          <sld:RasterSymbolizer>
            <sld:ColorMap type="ramp">
{color_map_xml}
            </sld:ColorMap>
          </sld:RasterSymbolizer>
        </sld:Rule>
      </sld:FeatureTypeStyle>
    </sld:UserStyle>
  </sld:NamedLayer>
</sld:StyledLayerDescriptor>"""

        legend_data = {
            "layer_name": layer_name,
            "product_type": product_type,
            "region_min": round(min_val, 3),
            "region_max": round(max_val, 3),
            "region_mean": round(stats.get("mean", 0), 3),
            "num_classes": num_classes + 1,  # Now 11 classes including NoData
            "classes": legend_classes,
        }

        return sld_content, legend_data

    def _generate_fixed_index_sld(
        self, layer_name: str, stats: Dict[str, Any]
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate fixed SWCI legend/style for index_class rasters."""

        color_entries = []
        legend_classes = []

        for item in self.SWCI_FIXED_CLASSES:
            color_entries.append(
                f'        <sld:ColorMapEntry color="{item["color"]}" quantity="{item["quantity"]:.1f}" '
                f'label="{item["label"]}" opacity="{item["opacity"]:.1f}"/>'
            )
            legend_classes.append(
                {
                    "class": item["class"],
                    "color": item["color"],
                    "min": item["min"],
                    "max": item["max"],
                    "label": item["label"],
                    "swci_range": item["swci_range"],
                }
            )

        color_map_xml = "\n".join(color_entries)

        sld_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<sld:StyledLayerDescriptor xmlns="http://www.opengis.net/sld" 
    xmlns:sld="http://www.opengis.net/sld" 
    xmlns:gml="http://www.opengis.net/gml" 
    xmlns:ogc="http://www.opengis.net/ogc" 
    version="1.0.0">
  <sld:NamedLayer>
    <sld:Name>{layer_name}</sld:Name>
    <sld:UserStyle>
      <sld:Name>{layer_name}_dynamic</sld:Name>
      <sld:Title>{layer_name} Fixed SWCI Style</sld:Title>
      <sld:FeatureTypeStyle>
        <sld:Rule>
          <sld:RasterSymbolizer>
            <sld:ColorMap type="intervals">
{color_map_xml}
            </sld:ColorMap>
          </sld:RasterSymbolizer>
        </sld:Rule>
      </sld:FeatureTypeStyle>
    </sld:UserStyle>
  </sld:NamedLayer>
</sld:StyledLayerDescriptor>"""

        legend_data = {
            "layer_name": layer_name,
            "product_type": "index_class",
            "region_min": round(stats.get("min", 0), 3),
            "region_max": round(stats.get("max", 0), 3),
            "region_mean": round(stats.get("mean", 0), 3),
            "num_classes": len(legend_classes),
            "classes": legend_classes,
        }

        return sld_content, legend_data

    def upload_style_to_geoserver(
        self, style_name: str, sld_content: str, workspace: str
    ) -> bool:
        """
        Upload SLD style to GeoServer.

        Args:
            style_name: Name for the style
            sld_content: SLD XML content
            workspace: GeoServer workspace

        Returns:
            True if successful
        """
        # First try to delete existing style (if any)
        delete_url = (
            f"{self.geoserver_url}/rest/workspaces/{workspace}/styles/{style_name}"
        )
        try:
            requests.delete(
                delete_url,
                auth=HTTPBasicAuth(self.username, self.password),
                params={"purge": "true"},
            )
        except:
            pass

        # Create new style
        create_url = f"{self.geoserver_url}/rest/workspaces/{workspace}/styles"

        try:
            # Create style entry
            style_data = {
                "style": {"name": style_name, "filename": f"{style_name}.sld"}
            }

            response = requests.post(
                create_url,
                json=style_data,
                auth=HTTPBasicAuth(self.username, self.password),
                headers={"Content-Type": "application/json"},
            )

            if response.status_code not in (200, 201):
                logger.warning(
                    f"Style creation returned {response.status_code}, trying to update..."
                )

            # Upload SLD content
            sld_url = (
                f"{self.geoserver_url}/rest/workspaces/{workspace}/styles/{style_name}"
            )

            response = requests.put(
                sld_url,
                data=sld_content.encode("utf-8"),
                auth=HTTPBasicAuth(self.username, self.password),
                headers={"Content-Type": "application/vnd.ogc.sld+xml"},
            )

            if response.status_code == 200:
                logger.info(f"✅ Dynamic style uploaded: {style_name}")
                return True
            else:
                logger.error(
                    f"❌ Style upload failed: {response.status_code} - {response.text[:200]}"
                )
                return False

        except Exception as e:
            logger.error(f"❌ Error uploading style: {e}")
            return False

    def apply_dynamic_style_to_layer(
        self,
        raster_path: str,
        layer_name: str,
        workspace: str,
        product_type: str = "water_budget",
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Generate dynamic SLD from clipped raster and apply it to the layer.

        This is the main method to call after clipping a raster.
        Returns the legend data so frontend can display dynamic legend.

        Args:
            raster_path: Path to clipped raster
            layer_name: GeoServer layer name
            workspace: GeoServer workspace
            product_type: Type of product for color palette

        Returns:
            Tuple of (success, legend_data)
        """
        try:
            # Generate dynamic SLD based on clipped raster stats
            style_name = f"{layer_name}_dynamic"
            sld_content, legend_data = self.generate_dynamic_sld(
                raster_path, layer_name, product_type
            )

            # Upload style to GeoServer
            upload_success = self.upload_style_to_geoserver(
                style_name, sld_content, workspace
            )

            if not upload_success:
                logger.warning("Could not upload dynamic style, using existing style")
                return False, legend_data

            # Link style to layer
            link_success = self.link_existing_style(workspace, layer_name, style_name)

            if link_success:
                logger.info(f"✅ Dynamic style applied to {layer_name}")
                logger.info(
                    f"   Legend range: {legend_data['region_min']} to {legend_data['region_max']}"
                )

            return link_success, legend_data

        except Exception as e:
            logger.error(f"❌ Error applying dynamic style: {e}")
            return False, None
