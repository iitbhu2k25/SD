from pathlib import Path
from typing import List, Dict, Tuple, Optional
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.transform import from_origin
from scipy.spatial import cKDTree
import shutil
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# DATA CLASSES FOR TYPE SAFETY
# ============================================================================

@dataclass
class InterpolationConfig:
    """Configuration for IDW interpolation"""
    cell_size: float = 30.0
    power: float = 2.0
    search_mode: str = 'variable'
    n_neighbors: int = 12
    radius: Optional[float] = None
    source_crs: str = 'EPSG:32644'
    target_crs: str = 'EPSG:4326'
    resolution: Tuple[float, float] = (0.001, 0.001)


@dataclass
class RasterMetadata:
    """Metadata for a raster file"""
    parameter: str
    output_path: str
    wells_used: int
    raster_shape: Tuple[int, int]
    threshold_bool: bool
    value_range: Dict[str, float]


@dataclass
class GridSpec:
    """Specification for raster grid"""
    cols: int
    rows: int
    transform: rasterio.Affine
    coords_utm: np.ndarray


# ============================================================================
# DATA VALIDATION & PREPARATION
# ============================================================================

class DataValidator:
    """Validates and prepares input data"""
    
    @staticmethod
    def validate_well_data(payload: List, params: List[str]) -> pd.DataFrame:
        """Convert well data to validated DataFrame"""
        if not payload:
            raise ValueError("Empty payload provided")
        
        df = pd.DataFrame([item.model_dump() for item in payload])
        
        # Validate required columns
        required_cols = {'Latitude', 'Longitude'} | set(params)
        missing_cols = required_cols - set(df.columns)
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        df = df[['Latitude', 'Longitude'] + params]
        
        # Convert parameters to numeric
        for param in params:
            df[param] = pd.to_numeric(df[param], errors='coerce')
        
        # Validate coordinates
        DataValidator._validate_coordinates(df)
        
        return df
    
    @staticmethod
    def _validate_coordinates(df: pd.DataFrame):
        """Validate latitude and longitude ranges"""
        lat_valid = df['Latitude'].between(-90, 90)
        lon_valid = df['Longitude'].between(-180, 180)
        
        if not lat_valid.all():
            raise ValueError(f"Invalid latitude values found: {df.loc[~lat_valid, 'Latitude'].tolist()}")
        if not lon_valid.all():
            raise ValueError(f"Invalid longitude values found: {df.loc[~lon_valid, 'Longitude'].tolist()}")
    
    @staticmethod
    def validate_parameter_data(df: pd.DataFrame, param: str, min_points: int = 3) -> Tuple[np.ndarray, np.ndarray]:
        """Extract and validate parameter values"""
        valid_mask = ~df[param].isna()
        valid_values = df.loc[valid_mask, param].values.astype(float)
        
        if len(valid_values) < min_points:
            raise ValueError(
                f"Insufficient data for {param}: {len(valid_values)} points (minimum {min_points} required)"
            )
        
        return valid_values, valid_mask


# ============================================================================
# COORDINATE TRANSFORMATION
# ============================================================================

class CoordinateTransformer:
    """Handles coordinate system transformations"""
    
    @staticmethod
    def points_to_utm(df: pd.DataFrame, target_crs: str = "EPSG:32644") -> gpd.GeoDataFrame:
        """Convert lat/lon points to UTM"""
        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df['Longitude'], df['Latitude'], crs="EPSG:4326")
        )
        return points_gdf.to_crs(target_crs)
    
    @staticmethod
    def extract_coordinates(gdf: gpd.GeoDataFrame) -> np.ndarray:
        """Extract XY coordinates from GeoDataFrame"""
        return np.array([(geom.x, geom.y) for geom in gdf.geometry], dtype=np.float64)
    
    @staticmethod
    def calculate_bounds_with_buffer(
        selected_area: gpd.GeoDataFrame,
        points: np.ndarray,
        buffer: float
    ) -> Tuple[float, float, float, float]:
        """Calculate bounds that include both area and points with buffer"""
        sel_minx, sel_miny, sel_maxx, sel_maxy = selected_area.total_bounds
        pts_minx, pts_miny = points[:, 0].min(), points[:, 1].min()
        pts_maxx, pts_maxy = points[:, 0].max(), points[:, 1].max()
        
        minx = min(sel_minx, pts_minx) - buffer
        miny = min(sel_miny, pts_miny) - buffer
        maxx = max(sel_maxx, pts_maxx) + buffer
        maxy = max(sel_maxy, pts_maxy) + buffer
        
        return minx, miny, maxx, maxy


# ============================================================================
# GRID CALCULATION
# ============================================================================

class GridCalculator:
    """Calculates grid specifications for rasterization"""
    
    @staticmethod
    def create_grid_spec(
        bounds: Tuple[float, float, float, float],
        cell_size: float,
        coords_utm: np.ndarray
    ) -> GridSpec:
        """Create grid specification from bounds"""
        minx, miny, maxx, maxy = bounds
        
        cols = int(np.ceil((maxx - minx) / cell_size))
        rows = int(np.ceil((maxy - miny) / cell_size))
        
        transform = from_origin(minx, maxy, cell_size, cell_size)
        
        logger.info(f"Grid created: {rows} rows × {cols} cols, cell size: {cell_size}m")
        
        return GridSpec(
            cols=cols,
            rows=rows,
            transform=transform,
            coords_utm=coords_utm
        )
    
    @staticmethod
    def generate_grid_coordinates(
        grid_spec: GridSpec
    ) -> np.ndarray:
        """Generate grid cell center coordinates"""
        transform = grid_spec.transform
        
        xs = (np.arange(grid_spec.cols, dtype=np.float64) * transform.a) + \
             transform.c + (transform.a / 2.0)
        ys = (np.arange(grid_spec.rows, dtype=np.float64) * transform.e) + \
             transform.f + (transform.e / 2.0)
        
        grid_x, grid_y = np.meshgrid(xs, ys)
        return np.column_stack([grid_x.ravel(), grid_y.ravel()])


# ============================================================================
# IDW INTERPOLATION
# ============================================================================

class IDWInterpolator:
    """Inverse Distance Weighting interpolation using cKDTree"""
    
    @staticmethod
    def interpolate_variable_search(
        tree: cKDTree,
        grid_points: np.ndarray,
        values: np.ndarray,
        k: int,
        power: float
    ) -> np.ndarray:
        """IDW with variable search (k nearest neighbors)"""
        dists, idxs = tree.query(grid_points, k=k)
        
        # Handle single neighbor case
        if k == 1:
            dists = dists[:, np.newaxis]
            idxs = idxs[:, np.newaxis]
        
        # Avoid division by zero
        dists[dists == 0] = 1e-10
        
        # Calculate weights
        weights = 1.0 / (dists ** power)
        
        # Weighted average
        numerator = np.sum(weights * values[idxs], axis=1)
        denominator = np.sum(weights, axis=1)
        
        return numerator / denominator
    
    @staticmethod
    def interpolate_fixed_search(
        tree: cKDTree,
        grid_points: np.ndarray,
        coords: np.ndarray,
        values: np.ndarray,
        radius: float,
        power: float
    ) -> np.ndarray:
        """IDW with fixed radius search"""
        neighbor_lists = tree.query_ball_point(grid_points, r=radius)
        result = np.empty(len(grid_points), dtype=np.float64)
        
        for i, neighbors in enumerate(neighbor_lists):
            if not neighbors:
                result[i] = np.nan
                continue
            
            distances = np.linalg.norm(coords[neighbors] - grid_points[i], axis=1)
            distances[distances == 0] = 1e-10
            
            weights = 1.0 / (distances ** power)
            result[i] = np.sum(weights * values[neighbors]) / np.sum(weights)
        
        return result
    
    @staticmethod
    def interpolate(
        coords: np.ndarray,
        values: np.ndarray,
        grid_spec: GridSpec,
        config: InterpolationConfig
    ) -> np.ndarray:
        """Main IDW interpolation function"""
        logger.info(
            f"Starting IDW: mode={config.search_mode}, "
            f"k={config.n_neighbors}, power={config.power}"
        )
        
        # Generate grid coordinates
        grid_points = GridCalculator.generate_grid_coordinates(grid_spec)
        
        # Build KDTree
        tree = cKDTree(coords)
        
        # Determine k
        k = min(config.n_neighbors, len(coords))
        
        # Interpolate based on search mode
        if config.search_mode == 'variable':
            interpolated = IDWInterpolator.interpolate_variable_search(
                tree, grid_points, values, k, config.power
            )
        elif config.search_mode == 'fixed':
            if config.radius is None or config.radius <= 0:
                raise ValueError("Fixed search mode requires positive radius")
            interpolated = IDWInterpolator.interpolate_fixed_search(
                tree, grid_points, coords, values, config.radius, config.power
            )
        else:
            raise ValueError(f"Unknown search mode: {config.search_mode}")
        
        # Reshape to grid
        grid = interpolated.reshape(grid_spec.rows, grid_spec.cols).astype(np.float32)
        
        logger.info(
            f"IDW complete: shape={grid.shape}, "
            f"range=[{np.nanmin(grid):.2f}, {np.nanmax(grid):.2f}], "
            f"mean={np.nanmean(grid):.2f}"
        )
        
        return grid


# ============================================================================
# RASTER OPERATIONS
# ============================================================================

class RasterIO:
    """Handles raster file I/O operations"""
    
    @staticmethod
    def save_raster(
        data: np.ndarray,
        path: Path,
        transform: rasterio.Affine,
        crs: str,
        nodata: float = np.nan,
        **kwargs
    ) -> Path:
        """Save numpy array as GeoTIFF"""
        profile = {
            'driver': 'GTiff',
            'height': data.shape[0],
            'width': data.shape[1],
            'count': 1,
            'dtype': rasterio.float32,
            'crs': crs,
            'transform': transform,
            'nodata': nodata,
            'compress': 'lzw',
            **kwargs
        }
        
        with rasterio.open(path, 'w', **profile) as dst:
            dst.write(data.astype(rasterio.float32), 1)
        
        logger.info(f"Raster saved: {path}")
        return path
    
    @staticmethod
    def reproject_raster(
        src_path: Path,
        dst_path: Path,
        dst_crs: str,
        resolution: Optional[Tuple[float, float]] = None,
        resampling_method: Resampling = Resampling.bilinear
    ) -> Path:
        """Reproject raster to different CRS"""
        with rasterio.open(src_path) as src:
            transform, width, height = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds,
                resolution=resolution
            )
            
            profile = src.profile.copy()
            profile.update({
                'crs': dst_crs,
                'transform': transform,
                'width': width,
                'height': height
            })
            
            with rasterio.open(dst_path, 'w', **profile) as dst:
                reproject(
                    source=rasterio.band(src, 1),
                    destination=rasterio.band(dst, 1),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=resampling_method,
                    dst_nodata=np.nan
                )
        
        logger.info(f"Raster reprojected: {src_path} → {dst_path}")
        return dst_path
    
    @staticmethod
    def read_raster_data(path: Path) -> Tuple[np.ndarray, dict]:
        """Read raster data and profile"""
        with rasterio.open(path) as src:
            data = src.read(1)
            profile = src.profile.copy()
        return data, profile
    
    @staticmethod
    def calculate_statistics(data: np.ndarray) -> Dict[str, float]:
        """Calculate basic statistics for raster data"""
        valid_data = data[~np.isnan(data)]
        
        if len(valid_data) == 0:
            return {'min': np.nan, 'max': np.nan, 'mean': np.nan}
        
        return {
            'min': float(np.min(valid_data)),
            'max': float(np.max(valid_data)),
            'mean': float(np.mean(valid_data))
        }


# ============================================================================
# WQI CALCULATIONS
# ============================================================================

class WQICalculator:
    """Water Quality Index calculations"""
    
    @staticmethod
    def calculate_concentration_index(
        parameter_value: np.ndarray,
        threshold: float
    ) -> np.ndarray:
        """Calculate Concentration Index (CI)"""
        # Handle masked arrays
        if hasattr(parameter_value, 'mask'):
            valid_mask = ~parameter_value.mask
            parameter_value = parameter_value.data
        else:
            valid_mask = np.isfinite(parameter_value) & (parameter_value > 0)
        
        numerator = parameter_value - threshold
        denominator = parameter_value + threshold
        
        ci = np.full_like(parameter_value, np.nan, dtype=np.float32)
        calc_mask = valid_mask & (denominator != 0)
        
        ci[calc_mask] = numerator[calc_mask] / denominator[calc_mask]
        ci = np.clip(ci, -1, 1)
        
        return ci
    
    @staticmethod
    def calculate_ranking(ci: np.ndarray) -> np.ndarray:
        """Calculate ranking from Concentration Index"""
        valid_mask = ~np.isnan(ci) & np.isfinite(ci)
        rank = np.full_like(ci, np.nan, dtype=np.float32)
        
        valid_ci = ci[valid_mask]
        rank[valid_mask] = 0.5 * (valid_ci ** 2) + 4.5 * valid_ci + 5
        rank[valid_mask] = np.clip(rank[valid_mask], 1, 10)
        
        return rank
    
    @staticmethod
    def calculate_weight(
        rank_data: np.ndarray,
        threshold_exceeded: bool
    ) -> float:
        """Calculate weight for parameter"""
        mean_rank = np.nanmean(rank_data)
        weight = mean_rank + 2 if threshold_exceeded else mean_rank
        return float(weight)
    
    @staticmethod
    def calculate_overlay(
        rank_rasters: List[Tuple[np.ndarray, float]],
        normalize: bool = True
    ) -> np.ndarray:
        """Calculate weighted overlay of ranked parameters"""
        if not rank_rasters:
            raise ValueError("No rank rasters provided for overlay")
        
        weighted_sum = np.zeros_like(rank_rasters[0][0], dtype=np.float32)
        
        for rank_data, weight in rank_rasters:
            weighted_sum += rank_data * weight
        
        # Average
        overlay = weighted_sum / len(rank_rasters)
        
        # Invert scale (100 - value)
        overlay = 100 - overlay
        
        # Normalize to 0-1 if requested
        if normalize:
            min_val = np.nanmin(overlay)
            max_val = np.nanmax(overlay)
            
            if max_val != min_val:
                overlay = (overlay - min_val) / (max_val - min_val)
            else:
                overlay[:] = 0
        
        return overlay


# ============================================================================
# FILE MANAGEMENT
# ============================================================================

class TempFileManager:
    """Manages temporary file creation and cleanup"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.temp_dirs: List[Path] = []
    
    def create_temp_dir(self, prefix: str = "wqi") -> Path:
        """Create a unique temporary directory"""
        unique_name = f"{prefix}_{uuid.uuid4().hex[:8]}"
        temp_dir = self.base_dir / unique_name
        temp_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dirs.append(temp_dir)
        logger.info(f"Created temp directory: {temp_dir}")
        return temp_dir
    
    def cleanup(self):
        """Remove all temporary directories"""
        for temp_dir in self.temp_dirs:
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)
                    logger.info(f"Cleaned up temp directory: {temp_dir}")
            except Exception as e:
                logger.error(f"Failed to cleanup {temp_dir}: {e}")
        
        self.temp_dirs.clear()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()
        return False


# ============================================================================
# MAIN ORCHESTRATOR CLASS
# ============================================================================

class WQ_Index:
    """Water Quality Index calculation orchestrator"""
    
    def __init__(self, config: Optional[InterpolationConfig] = None, auto_cleanup: bool = True):
        self.config = config or InterpolationConfig()
        self.auto_cleanup = auto_cleanup
        self.file_manager = TempFileManager(Settings().TEMP_DIR)
        self.output = self.file_manager.create_temp_dir()
        self.vector_work = VectorProcess()
        self._cleaned = False
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.auto_cleanup:
            self.cleanup()
        return False
    
    def __del__(self):
        if not self._cleaned and self.auto_cleanup:
            self.cleanup()
    
    def cleanup(self):
        """Clean up temporary files"""
        if self._cleaned:
            return
        self.file_manager.cleanup()
        self._cleaned = True
    
    def _prepare_grid_specification(self, df: pd.DataFrame) -> GridSpec:
        """Prepare grid specification from data and vector area"""
        # Transform points to UTM
        points_utm = CoordinateTransformer.points_to_utm(df, self.config.source_crs)
        coords_utm = CoordinateTransformer.extract_coordinates(points_utm)
        
        # Get basin and calculate bounds
        selected_area = self.vector_work.get_basin()
        selected_area_utm = selected_area.to_crs(self.config.source_crs)
        
        bounds = CoordinateTransformer.calculate_bounds_with_buffer(
            selected_area_utm,
            coords_utm,
            self.config.cell_size
        )
        
        # Create grid specification
        grid_spec = GridCalculator.create_grid_spec(
            bounds,
            self.config.cell_size,
            coords_utm
        )
        
        return grid_spec
    
    def _interpolate_parameter(
        self,
        df: pd.DataFrame,
        param: str,
        grid_spec: GridSpec,
        threshold: float
    ) -> RasterMetadata:
        """Interpolate a single parameter"""
        logger.info(f"Interpolating parameter: {param}")
        
        # Validate and extract parameter data
        valid_values, valid_mask = DataValidator.validate_parameter_data(df, param)
        valid_coords = grid_spec.coords_utm[valid_mask]
        
        # Perform IDW interpolation
        interpolated = IDWInterpolator.interpolate(
            valid_coords,
            valid_values,
            grid_spec,
            self.config
        )
        
        # Save UTM raster
        temp_utm_path = self.output / f"temp_{param}_utm.tif"
        RasterIO.save_raster(
            interpolated,
            temp_utm_path,
            grid_spec.transform,
            self.config.source_crs
        )
        
        # Reproject to target CRS
        output_path = self.output / f"{param}.tif"
        RasterIO.reproject_raster(
            temp_utm_path,
            output_path,
            self.config.target_crs,
            self.config.resolution
        )
        
        # Calculate statistics
        data_4326, _ = RasterIO.read_raster_data(output_path)
        stats = RasterIO.calculate_statistics(data_4326)
        
        # Check threshold
        threshold_exceeded = stats['mean'] > threshold
        
        return RasterMetadata(
            parameter=param,
            output_path=str(output_path),
            wells_used=len(valid_values),
            raster_shape=data_4326.shape,
            threshold_bool=threshold_exceeded,
            value_range=stats
        )
    
    def _process_all_parameters(
        self,
        df: pd.DataFrame,
        thresholds: Dict[str, float]
    ) -> List[RasterMetadata]:
        """Interpolate all parameters"""
        grid_spec = self._prepare_grid_specification(df)
        
        results = []
        parameters = [col for col in df.columns if col not in ['Latitude', 'Longitude']]
        
        for param in parameters:
            if param not in thresholds:
                logger.warning(f"No threshold for parameter: {param}, skipping")
                continue
            
            try:
                metadata = self._interpolate_parameter(
                    df, param, grid_spec, thresholds[param]
                )
                results.append(metadata)
                logger.info(f"✓ {param}: completed successfully")
            except Exception as e:
                logger.error(f"✗ {param}: {str(e)}")
        
        return results
    
    def _calculate_ci_rasters(
        self,
        interpolated: List[RasterMetadata],
        thresholds: Dict[str, float]
    ) -> List[Dict]:
        """Calculate Concentration Index rasters"""
        ci_results = []
        
        for metadata in interpolated:
            param = metadata.parameter
            threshold = thresholds[param]
            
            # Read parameter raster
            data, profile = RasterIO.read_raster_data(Path(metadata.output_path))
            
            # Calculate CI
            ci_data = WQICalculator.calculate_concentration_index(data, threshold)
            
            # Save CI raster
            ci_path = self.output / f"{param}_CI.tif"
            RasterIO.save_raster(
                ci_data,
                ci_path,
                profile['transform'],
                profile['crs']
            )
            
            ci_results.append({
                'parameter': param,
                'ci_path': ci_path,
                'threshold_exceeded': metadata.threshold_bool
            })
        
        return ci_results
    
    def _calculate_rank_rasters(self, ci_results: List[Dict]) -> List[Dict]:
        """Calculate ranking rasters from CI"""
        rank_results = []
        
        for ci_result in ci_results:
            # Read CI raster
            ci_data, profile = RasterIO.read_raster_data(ci_result['ci_path'])
            
            # Calculate rank
            rank_data = WQICalculator.calculate_ranking(ci_data)
            
            # Save rank raster
            rank_path = self.output / f"{ci_result['parameter']}_Rank.tif"
            RasterIO.save_raster(
                rank_data,
                rank_path,
                profile['transform'],
                profile['crs']
            )
            
            rank_results.append({
                'parameter': ci_result['parameter'],
                'rank_path': rank_path,
                'rank_data': rank_data,
                'threshold_exceeded': ci_result['threshold_exceeded']
            })
        
        return rank_results
    
    def _calculate_weights(self, rank_results: List[Dict]) -> Dict[str, float]:
        """Calculate weights for each parameter"""
        weights = {}
        
        for result in rank_results:
            weight = WQICalculator.calculate_weight(
                result['rank_data'],
                result['threshold_exceeded']
            )
            weights[result['parameter']] = weight
            logger.info(f"Weight for {result['parameter']}: {weight:.2f}")
        
        return weights
    
    def _create_final_overlay(
        self,
        rank_results: List[Dict],
        weights: Dict[str, float]
    ) -> Path:
        """Create final weighted overlay raster"""
        # Prepare rank rasters with weights
        rank_rasters = [
            (result['rank_data'], weights[result['parameter']])
            for result in rank_results
        ]
        
        # Calculate overlay
        overlay = WQICalculator.calculate_overlay(rank_rasters, normalize=True)
        
        # Save final raster
        output_path = self.output / f"GWQI_{uuid.uuid4().hex[:8]}.tif"
        
        # Use profile from first rank raster
        _, profile = RasterIO.read_raster_data(rank_results[0]['rank_path'])
        
        RasterIO.save_raster(
            overlay,
            output_path,
            profile['transform'],
            profile['crs']
        )
        
        logger.info(f"Final GWQI raster created: {output_path}")
        return output_path
    
    def calculate_GWQI(
        self,
        db: session,
        payload: Well_response
    ) -> Path:
        """
        Main method to calculate Ground Water Quality Index
        
        Args:
            db: Database session
            payload: Well response data with parameters
            
        Returns:
            Path to final GWQI raster
        """
        try:
            # Step 1: Validate and prepare data
            logger.info("Step 1: Validating data")
            df = DataValidator.validate_well_data(payload.data, payload.params)
            
            # Step 2: Get thresholds
            logger.info("Step 2: Loading thresholds")
            thresholds_list = WQI_threshold(db).get_threshold()
            thresholds = {
                t.parameter: t.value
                for t in thresholds_list
                if t.parameter in df.columns
            }
            
            # Step 3: Interpolate all parameters
            logger.info("Step 3: Interpolating parameters")
            interpolated = self._process_all_parameters(df, thresholds)
            
            if not interpolated:
                raise ValueError("No parameters were successfully interpolated")
            
            # Step 4: Calculate Concentration Index
            logger.info("Step 4: Calculating Concentration Index")
            ci_results = self._calculate_ci_rasters(interpolated, thresholds)
            
            # Step 5: Calculate Rankings
            logger.info("Step 5: Calculating Rankings")
            rank_results = self._calculate_rank_rasters(ci_results)
            
            # Step 6: Calculate Weights
            logger.info("Step 6: Calculating Weights")
            weights = self._calculate_weights(rank_results)
            
            # Step 7: Create Final Overlay
            logger.info("Step 7: Creating final overlay")
            final_path = self._create_final_overlay(rank_results, weights)
            
            logger.info(f"✓ GWQI calculation complete: {final_path}")
            return final_path
            
        except Exception as e:
            logger.error(f"GWQI calculation failed: {str(e)}")
            raise
    
    def get_well(self, db: session, payload: Well_input):
        """Get well data from database"""
        return WQI(db).get_wqi(payload.subdis_cod, payload.year)