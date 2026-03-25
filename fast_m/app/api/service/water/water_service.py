import geopandas as gpd
import csv
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import urllib.parse
import hashlib
import logging
import rasterio
from rasterio.mask import mask
import numpy as np
from requests import Session
from app.utils.network_conf import GeoConfig
from app.utils.name import Unique_name
from app.api.service.script_svc.geoserver_svc import upload_shapefile
from app.api.service.water.geospatial_service import GeospatialProcessor
from app.database.crud.water_crud import Drain_crud, River_crud, Stretches_crud, Stp_Villages_crud, Stp_District_crud, Stp_State_crud, Stp_towns_crud, Stp_SubDistrict_crud

logger = logging.getLogger(__name__)


class WaterAvailabilityMapper:
    """
    Water availability mapper with DETAILED LOGGING and EDGE FILTERING.
    Edge filtering: Include pixels with >=70% coverage, exclude pixels with <=30% coverage.
    """
    
    # Product type to time scale mapping
    PRODUCT_TIME_SCALE_MAP = {
        "Water Budget": "SUM",
        "Surplus": "MEAN",
        "Deficit": "MEAN",
        "Index": "MEAN"
    }
    
    # GeoServer layer name mapping for SEASONAL
    PRODUCT_LAYER_PREFIX = {
        "Water Budget": "Water_Budget",
        "Surplus": "Surplus",
        "Deficit": "Deficit",
        "Index": "Index_Class"
    }
    
    # GeoServer layer name mapping for YEARLY                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
    PRODUCT_LAYER_PREFIX_YEARLY = {
        "Water Budget": "Water_budget",
        "Surplus": "Surplus",
        "Deficit": "Deficit",
        "Index": "Index_class"
    }
    
    # Edge coverage thresholds
    EDGE_COVERAGE_MIN = 70  # Include pixels with >=70% coverage
    EDGE_COVERAGE_MAX = 30  # Exclude pixels with <=30% coverage
    
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.output_path = Path(self.config.output_path)
        self.processor = GeospatialProcessor(self.output_path)
        
        # GeoServer configuration
        self.vector_workspace = "dss_vector"
        self.raster_workspace = "dss_raster"
        self.vector_store_name = "vector_store"
        
        # Vector layer configuration
        self.layer_subdistrict = "STP_subdistrict"
        self.subdistrict_code_column = "subdis_cod"
        
        self.layer_catchment = "Catchment"
        self.col_drain = "Drain_No"
        
    def _get_time_scale_for_product(self, product_type: str) -> str:
        """Get the appropriate time scale (SUM/MEAN) for a product type."""
        time_scale = self.PRODUCT_TIME_SCALE_MAP.get(product_type)
        if not time_scale:
            raise ValueError(
                f"Unknown product type: '{product_type}'. "
                f"Valid options: {list(self.PRODUCT_TIME_SCALE_MAP.keys())}"
            )
        return time_scale
    
    def _build_layer_name(
        self, 
        product_type: str, 
        year: int, 
        time_scale: str,
        season: Optional[str] = None
    ) -> str:
        """Build GeoServer layer name based on product type, year, and time scale."""
        
        logger.info(f"\n{'='*70}")
        logger.info(f"🔨 BUILDING LAYER NAME")
        logger.info(f"{'='*70}")
        logger.info(f"Input Parameters:")
        logger.info(f"  product_type: {product_type}")
        logger.info(f"  year: {year}")
        logger.info(f"  time_scale: {time_scale}")
        logger.info(f"  season: {season}")
        
        if time_scale == "seasonal":
            if not season:
                raise ValueError("Season is required for seasonal time scale")
            
            product_prefix = self.PRODUCT_LAYER_PREFIX.get(
                product_type, 
                product_type.replace(" ", "_")
            )
            
            aggregation = self._get_time_scale_for_product(product_type)
            layer_name = f"{product_prefix}_Seasonal_{aggregation}_{season}_{year}"
            
            logger.info(f"Building SEASONAL layer name:")
            logger.info(f"  product_prefix: {product_prefix}")
            logger.info(f"  aggregation: {aggregation}")
            logger.info(f"  season: {season}")
            
        else:  # yearly
            product_prefix = self.PRODUCT_LAYER_PREFIX_YEARLY.get(
                product_type, 
                product_type.replace(" ", "_").lower()
            )
            
            layer_name = f"{product_prefix}_Entire-year_{year}"
            
            logger.info(f"Building YEARLY layer name:")
            logger.info(f"  product_prefix: {product_prefix}")
            logger.info(f"  using template: {product_prefix}_Entire-year_{year}")
        
        logger.info(f"\n✅ FINAL LAYER NAME: {layer_name}")
        logger.info(f"{'='*70}\n")
        
        return layer_name
    
    def _generate_study_area_name(self, codes: List[Any], prefix: str = "water_study_area") -> str:
        """Generate deterministic study area name based ONLY on subdistrict codes."""
        sorted_codes = sorted(codes)
        codes_str = "_".join(map(str, sorted_codes))
        
        base_name = f"{prefix}_{codes_str}"
        
        if len(base_name) > 60:
            codes_hash = hashlib.md5(codes_str.encode()).hexdigest()[:12]
            base_name = f"{prefix}_{codes_hash}"
        
        return base_name
    
    def _fetch_vector_layer(
        self, 
        layer_name: str, 
        cql_filter: str
    ) -> gpd.GeoDataFrame:
        """Fetch vector layer from GeoServer using WFS."""
        encoded_filter = urllib.parse.quote(cql_filter) if cql_filter else ""
        
        wfs_url = (
            f"{self.config.geoserver_url}/{self.vector_workspace}/ows"
            f"?service=WFS&version=2.0.0&request=GetFeature"
            f"&typeName={self.vector_workspace}:{layer_name}"
            f"&outputFormat=application/json"
            f"&maxFeatures=1000"
        )
        
        if encoded_filter:
            wfs_url += f"&CQL_FILTER={encoded_filter}"
        
        logger.debug(f"Fetching WFS: {layer_name}")
        
        try:
            gdf = gpd.read_file(wfs_url)
            
            if gdf.empty:
                raise ValueError(f"No features found for layer '{layer_name}'")
            
            logger.info(f"✅ Fetched {len(gdf)} features from {layer_name}")
            
            if gdf.crs is None:
                gdf.set_crs("EPSG:32644", inplace=True)
            else:
                gdf = gdf.to_crs("EPSG:32644")
            
            return gdf
            
        except Exception as e:
            logger.error(f"Error fetching vector layer {layer_name}: {str(e)}")
            raise ValueError(f"Failed to fetch vector layer '{layer_name}': {str(e)}")

    def _load_local_vector_layer(
        self,
        layer_name: str,
        col_name: str,
        id_list: List[Any],
    ) -> gpd.GeoDataFrame:
        """Fallback to bundled local shapefiles when GeoServer data is missing."""
        layer_paths = {
            self.layer_subdistrict: [
                Path(__file__).resolve().parents[4] / "media" / "Gaurav_Data" / "shape_stp" / "subdistrict" / "STP_subdistrict.shp",
                Path(__file__).resolve().parents[4] / "media" / "Rajat_data" / "shape_stp" / "subdistrict" / "STP_subdistrict.shp",
            ],
            self.layer_catchment: [
                Path(__file__).resolve().parents[4] / "media" / "Gaurav_Data" / "shape_stp" / "Drain_stp" / "Catchment" / "Catchment.shp",
                Path(__file__).resolve().parents[4] / "media" / "Rajat_data" / "shape_stp" / "Drain_stp" / "Catchment" / "Catchment.shp",
            ],
        }

        candidate_paths = layer_paths.get(layer_name, [])
        requested_ids = {str(value).strip() for value in id_list if value is not None}

        for local_path in candidate_paths:
            if not local_path.exists():
                continue

            try:
                gdf = gpd.read_file(local_path)
            except Exception as exc:
                logger.warning("Failed to read local vector fallback %s: %s", local_path, exc)
                continue

            matched_column = next(
                (column for column in gdf.columns if column.lower() == col_name.lower()),
                None,
            )
            if matched_column is None:
                logger.warning("Column %s not found in local vector fallback %s", col_name, local_path)
                continue

            filtered_gdf = gdf[gdf[matched_column].astype(str).str.strip().isin(requested_ids)].copy()
            if filtered_gdf.empty:
                logger.warning("No local %s features found in %s for ids %s", layer_name, local_path, sorted(requested_ids))
                continue

            logger.warning("Using local vector fallback %s for layer %s", local_path, layer_name)

            if filtered_gdf.crs is None:
                filtered_gdf.set_crs("EPSG:32644", inplace=True)
            else:
                filtered_gdf = filtered_gdf.to_crs("EPSG:32644")

            return filtered_gdf

        raise ValueError(
            f"Failed to load local fallback for layer '{layer_name}' with {col_name}={sorted(requested_ids)}"
        )
    
    def _get_or_create_generic_study_area(
        self, 
        id_list: List[Any], 
        layer_name: str, 
        col_name: str,
        area_prefix: str
    ) -> Tuple[str, gpd.GeoDataFrame]:
        """Get existing study area or create new one."""
        study_area_name = self._generate_study_area_name(id_list, prefix=area_prefix)
        
        cql_ids = ",".join(f"'{x}'" if isinstance(x, str) else str(x) for x in id_list)
        cql_filter = f"{col_name} IN ({cql_ids})"

        try:
            source_gdf = self._fetch_vector_layer(layer_name, cql_filter)
        except ValueError as fetch_error:
            try:
                source_gdf = self._load_local_vector_layer(layer_name, col_name, id_list)
            except ValueError:
                raise fetch_error
        
        if source_gdf.empty:
            raise ValueError(f"No geometries found in {layer_name}")
        
        study_area_gdf = source_gdf.dissolve()
        
        if study_area_gdf.empty:
            raise ValueError("Study area is empty after dissolve operation")
        
        if self.processor.layer_exists(self.vector_workspace, study_area_name):
            logger.info(f"✅ Reusing study area: {study_area_name}")
        else:
            logger.info(f"✅ Creating study area: {study_area_name}")
            self._publish_vector(study_area_gdf, study_area_name)
        
        return study_area_name, study_area_gdf
    
    def _publish_vector(
        self, 
        gdf: gpd.GeoDataFrame, 
        layer_name: str
    ) -> str:
        """Publish vector layer to GeoServer."""
        zip_path = self.processor.save_vector_to_zip(gdf, layer_name)
        
        if not zip_path:
            raise ValueError(f"Failed to save vector layer: {layer_name}")
        
        try:
            upload_shapefile(
                self.vector_workspace,
                self.vector_store_name,
                zip_path,
                layer_name=layer_name,
            )
            logger.info(f"✅ Published vector layer: {layer_name}")
            return layer_name
            
        except Exception as e:
            logger.error(f"Failed to publish vector: {str(e)}")
            raise ValueError(f"Failed to publish vector layer: {str(e)}")
    
    def _apply_edge_coverage_filter(
    self,
    data: np.ndarray,
    raster_path: str 
) -> np.ndarray:
        """
        SIMPLIFIED: Return NO edge exclusions.
        All edge filtering is now handled in the main stats function.
        Returns zeros (no exclusions) for all pixels.
        """
        logger.info("ℹ️  Edge filtering DISABLED - using all pixels after invalid filtering")
        return np.zeros(data.shape, dtype=bool)

    
    def _calculate_clipped_raster_stats(self, raster_path: str) -> Dict[str, float]:
        """Return EXACT SAME LOGIC as ArcGIS validation."""
        try:
            if not Path(raster_path).exists():
                raise FileNotFoundError(f"Raster file not found: {raster_path}")

            with rasterio.open(raster_path) as src:
                data = src.read(1)
                nodata = src.nodata
                
                logger.info(f"Total pixels: {data.size:,}")
                
                # EXACT ARC GIS LOGIC - ONE LINE MASK
                invalid = (
                    np.isnan(data) | 
                    (nodata is not None and data == nodata) | 
                    (data >= 9999)
                )
                
                valid_data = data[~invalid]
                pixel_count = len(valid_data)
                
                total_volume_MLD = float(np.sum(valid_data))
                
                logger.info(f"Valid pixels: {pixel_count:,}")
                logger.info(f"TOTAL SUM (MLD): {total_volume_MLD:,.6f}")
                
                return {
                    "volume_MLD": total_volume_MLD,
                    "pixel_count": pixel_count,
                    "invalid_count": int(np.sum(invalid))
                }
                
        except Exception as e:
            logger.error(f"Error calculating stats: {str(e)}", exc_info=True)
            raise

    def _calculate_index_class_counts(self, raster_path: str) -> List[Dict[str, Any]]:
        """Calculate per-class pixel counts for fixed index classes."""
        try:
            with rasterio.open(raster_path) as src:
                data = src.read(1)
                nodata = src.nodata

                invalid = (
                    np.isnan(data)
                    | ((nodata is not None) & (data == nodata))
                    | (data >= 9999)
                    | (data == 256)
                )
                valid_data = data[~invalid]
                total_valid = int(valid_data.size)

                class_counts: List[Dict[str, Any]] = []
                swci_classes = [
                    item
                    for item in getattr(self.processor, "SWCI_FIXED_CLASSES", [])
                    if 1 <= int(item.get("class", 0)) <= 10
                ]

                for item in swci_classes:
                    class_id = int(item["class"])
                    lower = float(item["min"])
                    upper = float(item["max"])

                    if class_id == 10:
                        class_mask = (valid_data >= lower) & (valid_data < 256)
                    else:
                        class_mask = (valid_data >= lower) & (valid_data < upper)

                    pixel_count = int(np.sum(class_mask))
                    percentage = round((pixel_count / total_valid) * 100, 2) if total_valid else 0.0

                    class_counts.append(
                        {
                            "class": class_id,
                            "color": item["color"],
                            "label": item["label"],
                            "swci_range": item.get("swci_range"),
                            "min": lower,
                            "max": upper,
                            "pixel_count": pixel_count,
                            "percentage": percentage,
                        }
                    )

                return class_counts
        except Exception as e:
            logger.error(f"Error calculating index class counts: {str(e)}", exc_info=True)
            return []

    def _process_single_layer(
        self,
        layer_type: str,
        year: int,
        time_scale: str,
        study_area_gdf: gpd.GeoDataFrame,
        season: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Process a single raster layer."""
        try:
            # ⭐ EXCLUSIVE LOGIC: If Surplus/Deficit, FORCE source to "Water Budget"
            real_source_type = layer_type
            filter_mode = None
            
            if layer_type in ["Surplus", "Deficit"]:
                real_source_type = "Water Budget"
                filter_mode = "positive" if layer_type == "Surplus" else "negative"
                logger.info(f"ℹ️  {layer_type} requested -> Fetching 'Water Budget' and filtering for {filter_mode} values")

            source_layer_name = self._build_layer_name(
                real_source_type, year, time_scale, season
            )
            
            logger.info(f"\n{'#'*80}")
            logger.info(f"🔄 PROCESSING LAYER FOR YEAR {year}")
            logger.info(f"{'#'*80}")
            logger.info(f"Requested Type: {layer_type}")
            logger.info(f"Source Layer: {source_layer_name}")
            logger.info(f"{'#'*80}\n")

            # Fetch original style
            original_style_name = self.processor.get_layer_style_name(
                layer_name=source_layer_name,
                workspace=self.raster_workspace
            )

            # ⭐⭐⭐ CRITICAL: Log which layer we're downloading
            logger.info(f"\n{'='*70}")
            logger.info(f"⬇️  DOWNLOADING RASTER FROM GEOSERVER")
            logger.info(f"{'='*70}")
            logger.info(f"Workspace: {self.raster_workspace}")
            logger.info(f"Layer Name: {source_layer_name}")
            logger.info(f"Year: {year}")
            logger.info(f"{'='*70}\n")
            
            download_result = self.processor.download_raster_from_geoserver(
                source_layer_name,
                self.raster_workspace
            )

            if not download_result:
                logger.error(f"❌ Failed to download raster for year {year}")
                return None

            original_raster_path = download_result["raster_path"]
            
            # ⭐⭐⭐ Log the downloaded file details
            logger.info(f"\n{'='*70}")
            logger.info(f"✅ RASTER DOWNLOADED")
            logger.info(f"{'='*70}")
            logger.info(f"File: {Path(original_raster_path).name}")
            logger.info(f"Full Path: {original_raster_path}")
            logger.info(f"File Size: {Path(original_raster_path).stat().st_size:,} bytes")
            logger.info(f"Year: {year}")
            logger.info(f"{'='*70}\n")
            
            # Generate unique names
            unique_suffix = Unique_name.unique_name("")
            
            # Use requested layer type in output name (e.g., Surplus_Seasonal_...)
            target_layer_prefix = self._build_layer_name(layer_type, year, time_scale, season)
            layer_unique = f"{target_layer_prefix}_clipped_{unique_suffix}"

            # Clip raster
            logger.info(f"✂️  Clipping raster...")
            clipped_path = self.processor.clip_raster_to_vector(
                raster_path=original_raster_path,
                mask_gdf=study_area_gdf,
                output_filename=layer_unique,
            )

            if not clipped_path:
                logger.error(f"❌ Failed to clip raster")
                return None

            logger.info(f"✅ Clipped: {Path(clipped_path).name}")
            
            # ⭐⭐⭐ APPLY FILTER IF NEEDED (Surplus/Deficit)
            final_raster_path = clipped_path
            
            if filter_mode:
                logger.info(f"\n{'='*70}")
                logger.info(f"🔍 FILTERING RASTER VALUES ({filter_mode})")
                logger.info(f"{'='*70}")
                
                filtered_path = self.processor.filter_raster_values(
                    raster_path=clipped_path,
                    filter_type=filter_mode
                )
                
                if filtered_path:
                    final_raster_path = filtered_path
                    logger.info(f"✅ Filtered raster ready: {Path(final_raster_path).name}")
                else:
                    logger.error("❌ Raster filtering failed, using clipped raster as fallback")

            # Calculate statistics WITH EDGE FILTERING
            logger.info(f"\n{'='*70}")
            logger.info(f"📊 CALCULATING STATISTICS FOR YEAR {year}")
            logger.info(f"{'='*70}")
            
            stats = self._calculate_clipped_raster_stats(
                final_raster_path
            )
            
            logger.info(f"✅ YEAR {year} RESULTS:")
            logger.info(f"   Volume MLD: {stats['volume_MLD']:,.6f}")
            logger.info(f"   Valid pixels: {stats['pixel_count']:,}")
            logger.info(f"   Invalid pixels: {stats['invalid_count']:,}")
            logger.info(f"{'='*70}\n")

            # Publish clipped raster
            logger.info(f"📤 Publishing raster...")
            store_unique = f"{target_layer_prefix}_store_{unique_suffix}"
            
            status_ok, pub_layer_name = self.processor.publish_raster_to_geoserver(
                raster_path=final_raster_path,
                workspace=self.raster_workspace,
                store_name=store_unique,
                layer_name=layer_unique,
            )

            if not status_ok:
                logger.error(f"❌ Failed to publish raster")
                return None

            logger.info(f"✅ Published: {pub_layer_name}")

            # ⭐⭐⭐ DYNAMIC SLD: Generate style based on clipped raster's actual min-max
            logger.info(f"\n{'='*70}")
            logger.info(f"🎨 APPLYING DYNAMIC SLD (based on clipped region)")
            logger.info(f"{'='*70}")
            
            # Map product_type to dynamic SLD product type
            sld_product_map = {
                'Water Budget': 'water_budget',
                'Deficit': 'deficit',
                'Surplus': 'surplus',
                'Index': 'index_class'
            }
            # Use requested layer_type for style mapping
            sld_product_type = sld_product_map.get(layer_type, 'water_budget')
            
            # Generate & apply dynamic style based on clipped raster's actual values
            style_success, legend_data = self.processor.apply_dynamic_style_to_layer(
                raster_path=final_raster_path,
                layer_name=pub_layer_name,
                workspace=self.raster_workspace,
                product_type=sld_product_type
            )
            
            if style_success and legend_data:
                logger.info(f"✅ Dynamic SLD applied!")
                logger.info(f"   Region Min: {legend_data['region_min']}")
                logger.info(f"   Region Max: {legend_data['region_max']}")
                logger.info(f"   Mean: {legend_data['region_mean']}")
            else:
                # Fallback to original static style
                logger.warning(f"⚠️ Dynamic SLD failed, using static style: {original_style_name}")
                if original_style_name:
                    self.processor.link_existing_style(
                        workspace=self.raster_workspace,
                        layer_name=pub_layer_name,
                        style_name=original_style_name,
                    )
                legend_data = None

            class_pixel_counts: List[Dict[str, Any]] = []
            if layer_type == "Index":
                class_pixel_counts = self._calculate_index_class_counts(final_raster_path)
                if legend_data and class_pixel_counts:
                    count_lookup = {item["class"]: item for item in class_pixel_counts}
                    legend_data["classes"] = [
                        {
                            **legend_class,
                            "pixel_count": count_lookup.get(legend_class.get("class"), {}).get("pixel_count", 0),
                            "percentage": count_lookup.get(legend_class.get("class"), {}).get("percentage", 0.0),
                        }
                        for legend_class in legend_data.get("classes", [])
                    ]

            raster_bbox: Optional[List[float]] = None
            try:
                with rasterio.open(final_raster_path) as src:
                    bounds = src.bounds
                    raster_bbox = [
                        float(bounds.left),
                        float(bounds.bottom),
                        float(bounds.right),
                        float(bounds.top),
                    ]
            except Exception as bbox_error:
                logger.warning(f"Could not read raster bounds for year {year}: {bbox_error}")

            logger.info(f"{'='*70}\n")

            aggregation = self._get_time_scale_for_product(layer_type)

            # ⭐ RESULT WITH DYNAMIC LEGEND
            return {
                "original_name": source_layer_name,
                "layer_name": pub_layer_name,
                "layer_type": layer_type,
                "workspace": self.raster_workspace,
                "style": f"{pub_layer_name}_dynamic" if style_success else original_style_name,
                "year": year,
                "time_scale": time_scale,
                "aggregation": aggregation,
                "season": season,
                
                # ⭐ Main statistics
                "volume_MLD": round(stats["volume_MLD"], 6),
                
                # ⭐ Filtering statistics
                "pixel_count": stats["pixel_count"],
                "invalid_count": stats["invalid_count"],
                "bbox": raster_bbox,
                
                # ⭐⭐⭐ DYNAMIC LEGEND DATA for frontend
                "legend_data": legend_data,
                "class_pixel_counts": class_pixel_counts if layer_type == "Index" else [],
            }

        except Exception as e:
            logger.error(f"❌ Error processing layer for year {year}: {e}", exc_info=True)
            return None

    def process_water_budget_map(
        self,
        subdistrict_codes: List[int],
        year: List[int],
        product_type: str,
        time_scale: str,
        season: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process water budget map for selected subdistricts."""
        if not subdistrict_codes:
            raise ValueError("subdistrict_codes cannot be empty")
        
        if product_type not in self.PRODUCT_TIME_SCALE_MAP:
            raise ValueError(f"Invalid product_type: '{product_type}'")
        
        if time_scale == "seasonal" and not season:
            raise ValueError("season is required for seasonal time scale")
        
        logger.info(
            f"\n{'#'*80}\n"
            f"🚀 WATER BUDGET PROCESSING FOR YEAR {year}\n"
            f"Subdistricts: {subdistrict_codes}\n"
            f"Product: {product_type}\n"
            f"Time Scale: {time_scale}\n"
            f"Edge Filtering: ≥{self.EDGE_COVERAGE_MIN}% include, ≤{self.EDGE_COVERAGE_MAX}% exclude\n"
            f"{'#'*80}\n"
        )
        
        study_area_name, study_area_gdf = self._get_or_create_generic_study_area(
            id_list=subdistrict_codes,
            layer_name=self.layer_subdistrict,
            col_name=self.subdistrict_code_column,
            area_prefix="water_study_area"
        )
        
        return self._execute_processing(
            study_area_name, study_area_gdf, year, product_type, time_scale, season
        )
        
    def process_drain_budget_map(
        self,
        drain_no: int,
        year: List[int], 
        product_type: str,
        time_scale: str,
        season: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process water budget map for a specific drain/catchment."""
        if product_type not in self.PRODUCT_TIME_SCALE_MAP:
            raise ValueError(f"Invalid product_type: '{product_type}'")
        
        if time_scale == "seasonal" and not season:
            raise ValueError("season is required for seasonal time scale")

        logger.info(
            f"\n{'#'*80}\n"
            f"🚀 DRAIN PROCESSING FOR YEAR {year}\n"
            f"Drain: {drain_no}\n"
            f"Edge Filtering: ≥{self.EDGE_COVERAGE_MIN}% include, ≤{self.EDGE_COVERAGE_MAX}% exclude\n"
            f"{'#'*80}\n"
        )
        
        study_area_name, study_area_gdf = self._get_or_create_generic_study_area(
            id_list=[drain_no],
            layer_name=self.layer_catchment,
            col_name=self.col_drain,
            area_prefix="drain_study_area"
        )
        
        return self._execute_processing(
            study_area_name, study_area_gdf, year, product_type, time_scale, season
        )

    # def _execute_processing(
    #     self,
    #     study_area_name: str,
    #     study_area_gdf: gpd.GeoDataFrame,
    #     years: List[int],
    #     product_type: str,
    #     time_scale: str,
    #     season: Optional[str]
    # ) -> Dict[str, Any]:
    #     """Execute the core processing workflow."""
    #     processed_layers = []

    #     result = self._process_single_layer(
    #         layer_type=product_type,
    #         year=year,
    #         time_scale=time_scale,
    #         study_area_gdf=study_area_gdf,
    #         season=season
    #     )
        
    #     if result:
    #         processed_layers.append(result)

    #     if not processed_layers:
    #         raise ValueError("Processing failed")

    #     return {
    #         "status": "success",
            
    #         "study_area_vector": {
    #             "workspace": self.vector_workspace,
    #             "layer_name": study_area_name,
    #         },
            
    #         "clipped_rasters": processed_layers,

    #         # "statistics": {
    #         #     "volume_MLD": round(processed_layers[0]["volume_MLD"], 6),
    #         #     "pixel_count": processed_layers[0]["pixel_count"],
    #         #     "invalid_count": processed_layers[0].get("invalid_count", 0),
    #         # },

    #         "metadata": {
    #             "year": year,
    #             "product_type": product_type,
    #             "time_scale": time_scale,
    #             "season": season,
    #             "layers_processed": len(processed_layers),
    #             "edge_filter_min": self.EDGE_COVERAGE_MIN,
    #             "edge_filter_max": self.EDGE_COVERAGE_MAX,
    #         },
            
    #         # ⭐⭐⭐ DYNAMIC LEGEND for frontend (based on clipped region's actual min-max)
    #         "legend_data": processed_layers[0].get("legend_data"),
    #     }
    
    
    def _execute_processing(
        self,
        study_area_name: str,
        study_area_gdf: gpd.GeoDataFrame,
        years: List[int],  # <--- Changed input to List[int]
        product_type: str,
        time_scale: str,
        season: Optional[str]
    ) -> Dict[str, Any]:
        """Execute the core processing workflow for multiple years."""
        processed_layers = []

        # Iterate over each year in the list
        for single_year in years:
            try:
                result = self._process_single_layer(
                    layer_type=product_type,
                    year=single_year,
                    time_scale=time_scale,
                    study_area_gdf=study_area_gdf,
                    season=season
                )
                
                if result:
                    processed_layers.append(result)
            except Exception as e:
                logger.error(f"Failed to process year {single_year}: {e}")
                # We continue to the next year even if one fails
                continue

        if not processed_layers:
            raise ValueError("Processing failed for all requested years")

        study_area_bbox: Optional[List[float]] = None
        try:
            minx, miny, maxx, maxy = study_area_gdf.total_bounds
            if not any(np.isnan(value) for value in (minx, miny, maxx, maxy)):
                study_area_bbox = [float(minx), float(miny), float(maxx), float(maxy)]
        except Exception as bbox_error:
            logger.warning(f"Could not derive study area bbox: {bbox_error}")

        # Prepare metadata
        return {
            "status": "success",
            
            "study_area_vector": {
                "workspace": self.vector_workspace,
                "layer_name": study_area_name,
            },
            
            "clipped_rasters": processed_layers,
            "bbox": study_area_bbox,

            # Note: Top-level statistics usually represent the aggregate or the first layer. 
            # Since we now have multiple years, the frontend should ideally look inside 'clipped_rasters' 
            # for specific data. Here we can provide the stats of the LATEST year or just the first one processed.
            # I will default to the first one processed to maintain structure compatibility.
            "metadata": {
                "years_processed": years,
                "product_type": product_type,
                "time_scale": time_scale,
                "season": season,
                "total_layers": len(processed_layers),
                "edge_filter_min": self.EDGE_COVERAGE_MIN,
                "edge_filter_max": self.EDGE_COVERAGE_MAX,
            }
        }

class Stp_location:
    _river_name_map: Optional[Dict[int, str]] = None

    @classmethod
    def _load_river_name_map(cls) -> Dict[int, str]:
        if cls._river_name_map is not None:
            return cls._river_name_map

        river_name_map: Dict[int, str] = {}
        river_csv = Path(__file__).resolve().parents[4] / "media" / "Gaurav_Data" / "csv_file_stp" / "stp_river.csv"

        if river_csv.exists():
            try:
                with river_csv.open("r", encoding="utf-8-sig", newline="") as csv_file:
                    for row in csv.DictReader(csv_file):
                        try:
                            river_name_map[int(row["River_Code"])] = row["River_Name"].strip()
                        except (KeyError, TypeError, ValueError):
                            continue
            except OSError as exc:
                logger.warning("Failed to load river name map from %s: %s", river_csv, exc)

        cls._river_name_map = river_name_map
        return cls._river_name_map

    def get_state(db:Session,all_data: bool = False):
        states=Stp_State_crud(db).get_states(all_data)
        states=[{'id': state.state_code,'name':state.state_name} for state in states]
        return states

    def get_district(db:Session,payload:dict):
        districts=Stp_District_crud(db).get_district(payload.state,payload.all_data)
        districts=[{'id': district.district_code,'name':district.district_name} for district in districts]
        return districts
    
    def get_district_all(db:Session):
        districts=Stp_District_crud(db).get_district_all()
        districts=[{'id': district.district_code,'name':district.district_name,'stateId':district.state_code} for district in districts]
        return districts

    def get_sub_district(db:Session,payload:dict):
        SubDistricts=Stp_SubDistrict_crud(db).get_subdistrict(payload.districts,payload.all_data)
        SubDistricts=[{'id': SubDistrict.subdistrict_code,'name':SubDistrict.subdistrict_name} for SubDistrict in SubDistricts]
        return SubDistricts
    
    def get_sub_district_all(db:Session):
        SubDistricts=Stp_SubDistrict_crud(db).get_subdistrict_all()
        SubDistricts=[{'id': SubDistrict.subdistrict_code,'name':SubDistrict.subdistrict_name,'districtId':SubDistrict.district_code} for SubDistrict in SubDistricts]
        return SubDistricts
    
    def get_villages(db:Session,payload:dict):
        Villages=Stp_Villages_crud(db).get_villages(payload.subdis_code,payload.all_data)
        Villages=[{'id': Village.id,'name':Village.village_name} for Village in Villages]
        return Villages

    def get_town(db:Session,payload:dict):
        return Stp_towns_crud(db).get_towns(payload.subdis_code, payload.all_data)

    def get_all_town(db:Session,all_data:bool=True):
        return Stp_towns_crud(db).get_all_towns(all_data)

    @classmethod
    def get_river(cls, db: Session, all_data: bool = False):
        river_name_map = cls._load_river_name_map()
        river_codes = River_crud(db).get_rivers(all_data=all_data)
        return [
            {
                "River_Code": river_code,
                "River_Name": river_name_map.get(river_code, f"River {river_code}"),
            }
            for river_code in river_codes
        ]

class StretchLocation:
    """Helper class for database operations."""
    
    @staticmethod
    def get_stretch(db: Session, river_code: int = None):
        return Stretches_crud(db).get_stretches(river_code)
    
    @staticmethod
    def get_drain(db: Session, stretch_id: int | list[int] | None = None):
        return Drain_crud(db).get_drains(stretch_id)
