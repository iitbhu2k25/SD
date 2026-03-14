"""
Geometry Processor Service
Step 4 & 5: Geometry validation, type detection, and buffer creation

Responsibilities:
- Detect geometry type (LineString = river, Polygon = buffer)
- Fix invalid geometries
- Remove empty geometries
- Create 200m buffer for river geometries
- Save processed shapefile
"""

import os
from pathlib import Path
from typing import Optional, Tuple
from dataclasses import dataclass
from enum import Enum

import geopandas as gpd
from shapely.validation import make_valid
from shapely.geometry import MultiPolygon, Polygon


class GeometryType(Enum):
    """Detected geometry classification"""
    RIVER = "river"           # LineString/MultiLineString
    BUFFER = "buffer"         # Polygon/MultiPolygon
    UNKNOWN = "unknown"       # Unsupported type


@dataclass
class ProcessingResult:
    """Result of geometry processing"""
    success: bool
    geometry_type: Optional[GeometryType] = None
    output_path: Optional[Path] = None
    feature_count: int = 0
    buffer_created: bool = False
    bbox: Optional[list] = None  # [minx, miny, maxx, maxy] in EPSG:4326
    error_message: Optional[str] = None


class GeometryProcessor:
    """
    Processes shapefile geometries: type detection, validation, and buffer creation.
    
    Usage:
        processor = GeometryProcessor(output_dir="/path/to/output")
        result = processor.process(gdf, output_name="river_buffer")
        if result.success:
            # Buffer shapefile saved to result.output_path
    """
    
    # Buffer distance in meters
    BUFFER_DISTANCE_M = 200
    
    # Geometry type mappings
    LINE_TYPES = {'LineString', 'MultiLineString'}
    POLYGON_TYPES = {'Polygon', 'MultiPolygon'}
    
    # CRS for buffer calculation (needs to be in meters)
    BUFFER_CRS = "EPSG:32644"  # UTM Zone 44N (covers India)
    OUTPUT_CRS = "EPSG:4326"   # WGS84 for GeoServer
    
    def __init__(self, output_dir: Path):
        """
        Initialize processor with output directory.
        
        Args:
            output_dir: Directory to save processed shapefiles
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def process(self, gdf: gpd.GeoDataFrame, output_name: str) -> ProcessingResult:
        """
        Process a GeoDataFrame: detect type, validate, and create buffer if needed.
        
        Args:
            gdf: GeoDataFrame loaded from shapefile
            output_name: Base name for output shapefile
            
        Returns:
            ProcessingResult with processed shapefile path
        """
        try:
            # Step 1: Detect geometry type
            geom_type = self._detect_geometry_type(gdf)
            
            if geom_type == GeometryType.UNKNOWN:
                return ProcessingResult(
                    success=False,
                    geometry_type=geom_type,
                    error_message="Unsupported geometry type. Only LineString (river) or Polygon (buffer) are accepted."
                )
            
            # Step 2: Fix invalid geometries
            gdf = self._fix_geometries(gdf)
            
            # Step 3: Remove empty geometries
            gdf = self._remove_empty_geometries(gdf)
            
            if len(gdf) == 0:
                return ProcessingResult(
                    success=False,
                    geometry_type=geom_type,
                    error_message="No valid geometries remaining after cleanup"
                )
            
            # Step 4: Process based on type
            if geom_type == GeometryType.RIVER:
                # Create 200m buffer
                gdf_output = self._create_buffer(gdf)
                buffer_created = True
            else:
                # It's already a buffer polygon - validate if it looks like ~200m buffer
                is_valid_buffer, warning_msg = self._validate_buffer_width(gdf)
                
                if not is_valid_buffer:
                    return ProcessingResult(
                        success=False,
                        geometry_type=geom_type,
                        error_message=f"Buffer validation failed: {warning_msg}"
                    )
                
                # Use as-is
                gdf_output = gdf
                buffer_created = False
            
            # Step 5: Ensure output CRS
            if gdf_output.crs != self.OUTPUT_CRS:
                gdf_output = gdf_output.to_crs(self.OUTPUT_CRS)
            
            # Step 6: Save to output directory
            output_path = self._save_shapefile(gdf_output, output_name)
            
            # Step 7: Get bounding box for frontend zoom
            bounds = gdf_output.total_bounds  # [minx, miny, maxx, maxy]
            bbox = [float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])]
            
            return ProcessingResult(
                success=True,
                geometry_type=geom_type,
                output_path=output_path,
                feature_count=len(gdf_output),
                buffer_created=buffer_created,
                bbox=bbox
            )
            
        except Exception as e:
            return ProcessingResult(
                success=False,
                error_message=f"Processing failed: {str(e)}"
            )
    
    def _detect_geometry_type(self, gdf: gpd.GeoDataFrame) -> GeometryType:
        """
        Detect if geometry is river (line) or buffer (polygon).
        """
        # Get unique geometry types
        geom_types = set(gdf.geometry.geom_type.dropna().unique())
        
        # Check for line types
        if geom_types.intersection(self.LINE_TYPES):
            return GeometryType.RIVER
        
        # Check for polygon types
        if geom_types.intersection(self.POLYGON_TYPES):
            return GeometryType.BUFFER
        
        return GeometryType.UNKNOWN
    
    def _fix_geometries(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        Fix invalid geometries using make_valid and buffer(0) trick.
        """
        def fix_geom(geom):
            if geom is None:
                return None
            if not geom.is_valid:
                # Try make_valid first
                geom = make_valid(geom)
                # If still invalid, try buffer(0)
                if not geom.is_valid:
                    geom = geom.buffer(0)
            return geom
        
        gdf = gdf.copy()
        gdf['geometry'] = gdf['geometry'].apply(fix_geom)
        return gdf
    
    def _remove_empty_geometries(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        Remove empty and null geometries.
        """
        gdf = gdf.copy()
        # Remove null geometries
        gdf = gdf[~gdf.geometry.isna()]
        # Remove empty geometries
        gdf = gdf[~gdf.geometry.is_empty]
        return gdf.reset_index(drop=True)
    
    def _validate_buffer_width(self, gdf: gpd.GeoDataFrame) -> tuple:
        """
        Validate if the uploaded polygon buffer is approximately 200m wide.
        
        Uses a heuristic: for a buffer around a line, the approximate width 
        can be estimated as: width ≈ 2 * area / perimeter
        
        This is because for a buffer of width W around a line of length L:
        - Area ≈ 2 * W * L (approximately rectangular)
        - Perimeter ≈ 2 * L + 2 * 2W = 2L + 4W
        - For long lines, perimeter ≈ 2L
        - So width ≈ 2 * Area / Perimeter
        
        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        # Target buffer width (200m from center = ~400m total width, with margin = 500m)
        TARGET_WIDTH_M = 500
        # Tolerance: allow ±30% deviation
        TOLERANCE_PERCENT = 30
        MIN_WIDTH = TARGET_WIDTH_M * (1 - TOLERANCE_PERCENT / 100)  # 350m
        MAX_WIDTH = TARGET_WIDTH_M * (1 + TOLERANCE_PERCENT / 100)  # 650m
        
        try:
            # Reproject to UTM for accurate measurements
            gdf_utm = gdf.to_crs(self.BUFFER_CRS)
            
            # Calculate estimated width for each polygon
            widths = []
            for geom in gdf_utm.geometry:
                if geom is None or geom.is_empty:
                    continue
                
                area = geom.area
                perimeter = geom.length
                
                if perimeter > 0:
                    # Estimate width using area/perimeter ratio
                    # For a buffer: width ≈ 2 * area / perimeter
                    estimated_width = 2 * area / perimeter
                    widths.append(estimated_width)
            
            if not widths:
                return (False, "Could not calculate buffer width - no valid geometries found.")
            
            # Use median width (more robust to outliers)
            import statistics
            median_width = statistics.median(widths)
            avg_width = sum(widths) / len(widths)
            
            # Check if within tolerance
            if median_width < MIN_WIDTH:
                return (
                    False, 
                    f"Buffer appears too narrow (~{median_width:.0f}m). Expected ~200m buffer. "
                    f"Please upload a 200m buffer or provide the river centerline instead."
                )
            
            if median_width > MAX_WIDTH:
                return (
                    False, 
                    f"Buffer appears too wide (~{median_width:.0f}m). Expected ~200m buffer. "
                    f"Please upload a 200m buffer or provide the river centerline instead."
                )
            
            # Valid buffer
            return (True, f"Buffer width validated: ~{median_width:.0f}m (within tolerance)")
            
        except Exception as e:
            # On error, allow the buffer through with a warning (don't block)
            return (True, f"Could not validate buffer width: {str(e)}")
    
    def _create_buffer(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        Create 200m buffer around river geometry.
        
        Process:
        1. Reproject to UTM for accurate meter-based buffer
        2. Create buffer
        3. Union/dissolve to create single polygon
        4. Reproject back to output CRS
        """
        # Store original CRS
        original_crs = gdf.crs
        
        # Reproject to UTM for accurate distance calculation
        gdf_utm = gdf.to_crs(self.BUFFER_CRS)
        
        # Create buffer
        gdf_utm['geometry'] = gdf_utm.geometry.buffer(self.BUFFER_DISTANCE_M)
        
        # Dissolve all buffers into single polygon (optional, depends on use case)
        # For now, keep individual features
        
        # Convert any MultiPolygon to single schema
        # (buffer of MultiLineString may create MultiPolygon)
        
        return gdf_utm
    
    def _save_shapefile(self, gdf: gpd.GeoDataFrame, name: str) -> Path:
        """
        Save GeoDataFrame as shapefile.
        """
        # Create subdirectory for this shapefile
        output_subdir = self.output_dir / name
        output_subdir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_subdir / f"{name}.shp"
        gdf.to_file(output_path, driver='ESRI Shapefile')
        
        return output_path
    
    def create_zip_from_shapefile(self, shp_path: Path) -> Path:
        """
        Create a ZIP file from shapefile components for GeoServer upload.
        
        Args:
            shp_path: Path to .shp file
            
        Returns:
            Path to created ZIP file
        """
        import zipfile
        
        shp_dir = shp_path.parent
        base_name = shp_path.stem
        zip_path = shp_dir / f"{base_name}.zip"
        
        # Get all shapefile components
        extensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg']
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for ext in extensions:
                component_path = shp_dir / f"{base_name}{ext}"
                if component_path.exists():
                    zf.write(component_path, f"{base_name}{ext}")
        
        return zip_path
