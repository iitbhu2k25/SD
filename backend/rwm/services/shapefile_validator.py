"""
Shapefile Validator Service
Step 3: Format validation for extracted shapefiles

Validates:
- Required files exist (.shp, .shx, .dbf)
- CRS is defined (.prj exists)
- Can reproject to target CRS if needed
"""

import os
from pathlib import Path
from typing import Optional, Tuple, List
from dataclasses import dataclass

import geopandas as gpd
from pyproj import CRS


@dataclass
class ValidationResult:
    """Result of shapefile validation"""
    success: bool
    shapefile_path: Optional[Path] = None
    geometry_type: Optional[str] = None
    crs: Optional[str] = None
    feature_count: int = 0
    error_message: Optional[str] = None


class ShapefileValidator:
    """
    Validates extracted shapefile components and structure.
    
    Usage:
        validator = ShapefileValidator()
        result = validator.validate(extracted_directory)
        if result.success:
            # Use result.shapefile_path, result.geometry_type
        else:
            # Handle result.error_message
    """
    
    # Required shapefile components
    REQUIRED_EXTENSIONS = {'.shp', '.shx', '.dbf'}
    OPTIONAL_EXTENSIONS = {'.prj', '.cpg', '.sbn', '.sbx', '.qix', '.fix'}
    
    # Target CRS for standardization
    TARGET_CRS = "EPSG:4326"  # WGS84
    
    def __init__(self, target_crs: str = None):
        """
        Initialize validator with optional custom target CRS.
        
        Args:
            target_crs: Target CRS for reprojection (default: EPSG:4326)
        """
        self.target_crs = target_crs or self.TARGET_CRS
    
    def validate(self, extracted_dir: Path) -> ValidationResult:
        """
        Validate shapefile in extracted directory.
        
        Args:
            extracted_dir: Path to directory containing extracted shapefile components
            
        Returns:
            ValidationResult with success status and shapefile info
        """
        extracted_dir = Path(extracted_dir)
        
        if not extracted_dir.exists() or not extracted_dir.is_dir():
            return ValidationResult(
                success=False,
                error_message="Extracted directory not found"
            )
        
        # Find .shp file(s)
        shp_files = list(extracted_dir.glob('*.shp'))
        
        if len(shp_files) == 0:
            return ValidationResult(
                success=False,
                error_message="No shapefile (.shp) found in ZIP"
            )
        
        if len(shp_files) > 1:
            return ValidationResult(
                success=False,
                error_message=f"Multiple shapefiles found. Please upload only one shapefile per ZIP."
            )
        
        shp_path = shp_files[0]
        base_name = shp_path.stem
        
        # Check required components
        missing_components = self._check_required_components(extracted_dir, base_name)
        if missing_components:
            return ValidationResult(
                success=False,
                error_message=f"Missing required shapefile components: {', '.join(missing_components)}"
            )
        
        # Check for .prj file (CRS definition)
        prj_path = extracted_dir / f"{base_name}.prj"
        has_prj = prj_path.exists()
        
        # Try to load and validate the shapefile
        try:
            return self._validate_geodataframe(shp_path, has_prj)
        except Exception as e:
            return ValidationResult(
                success=False,
                error_message=f"Failed to read shapefile: {str(e)}"
            )
    
    def _check_required_components(self, directory: Path, base_name: str) -> List[str]:
        """
        Check if all required shapefile components exist.
        
        Returns:
            List of missing component extensions (empty if all present)
        """
        missing = []
        for ext in self.REQUIRED_EXTENSIONS:
            component_path = directory / f"{base_name}{ext}"
            if not component_path.exists():
                missing.append(ext)
        return missing
    
    def _validate_geodataframe(self, shp_path: Path, has_prj: bool) -> ValidationResult:
        """
        Load and validate the shapefile using GeoPandas.
        """
        # Load the shapefile
        gdf = gpd.read_file(shp_path)
        
        # Check if empty
        if len(gdf) == 0:
            return ValidationResult(
                success=False,
                error_message="Shapefile contains no features"
            )
        
        # Check for geometry column
        if 'geometry' not in gdf.columns or gdf.geometry.isna().all():
            return ValidationResult(
                success=False,
                error_message="Shapefile contains no valid geometries"
            )
        
        # Get geometry type
        geom_types = gdf.geometry.geom_type.unique()
        # Filter out None values
        geom_types = [gt for gt in geom_types if gt is not None]
        
        if len(geom_types) == 0:
            return ValidationResult(
                success=False,
                error_message="No valid geometry types found"
            )
        
        # Get primary geometry type (first non-null)
        primary_geom_type = geom_types[0]
        
        # Check CRS
        if gdf.crs is None:
            if not has_prj:
                return ValidationResult(
                    success=False,
                    error_message="Shapefile has no coordinate reference system (.prj file missing)"
                )
            else:
                return ValidationResult(
                    success=False,
                    error_message="Could not parse coordinate reference system from .prj file"
                )
        
        # Get CRS as string
        crs_str = str(gdf.crs)
        
        return ValidationResult(
            success=True,
            shapefile_path=shp_path,
            geometry_type=primary_geom_type,
            crs=crs_str,
            feature_count=len(gdf)
        )
    
    def load_geodataframe(self, shp_path: Path, reproject: bool = True) -> gpd.GeoDataFrame:
        """
        Load shapefile as GeoDataFrame, optionally reprojecting to target CRS.
        
        Args:
            shp_path: Path to .shp file
            reproject: Whether to reproject to target CRS (default: True)
            
        Returns:
            GeoDataFrame ready for processing
        """
        gdf = gpd.read_file(shp_path)
        
        if reproject and gdf.crs and str(gdf.crs) != self.target_crs:
            gdf = gdf.to_crs(self.target_crs)
        
        return gdf
