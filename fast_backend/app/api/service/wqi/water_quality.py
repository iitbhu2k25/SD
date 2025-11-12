from app.api.schema.wqi import Well_input,Well_response
from typing import List,Tuple
from sqlalchemy.orm import session
from app.database.crud.gwpz_crud import WQI,WQI_threshold
import os
from tqdm import tqdm
import zipfile
from xml.dom import minidom
from xml.etree import ElementTree as ET
import numpy as np
import pandas as pd
import rasterio
from rasterio.warp import  reproject
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.mask import mask
from rasterio.features import shapes
from shapely.geometry import mapping,shape
from scipy.spatial import cKDTree
import geopandas as gpd
from app.utils.network_conf import GeoConfig
import uuid
from app.api.service.geoserver import Geoserver
from app.conf.settings import Settings
from pathlib import Path
from app.utils.name import Unique_name
from fastapi import HTTPException,status
from rasterio.warp import calculate_default_transform, reproject, Resampling
from app.api.service.script_svc.geoserver_svc import upload_shapefile
from rasterstats import zonal_stats
import tempfile


geo=Geoserver()

class VectorProcess(GeoConfig):
    def __init__(self):
        super().__init__()
        self.village = self._force_to_epsg(self.villages_shapefile)
        self.basin = self._force_to_epsg(self.basin_shapefile)
        self.catchment = self._force_to_epsg(self.cachement_shapefile)
        self.drain_cachement= self._force_to_epsg(self.drain_cachement_shapefile)
        self.town=self._force_to_epsg(self.town_shapefile)
        
    def _force_to_epsg(self, gdf: str, epsg: str = "EPSG:32644") -> gpd.GeoDataFrame:
        gdf=gpd.read_file(gdf)
        if gdf.crs is None:
            gdf.set_crs(epsg, inplace=True)
            return gdf
        return gdf.to_crs(epsg)
    
    def get_village(self,clip:List[int]=None):
        return self.village[self.village['ID'].isin(clip)]
    
    def get_sub_village(self,clip:List[int]=None):
        return self.village[self.village['subdis_cod'].isin(clip)]
    
    def get_town(self,clip:List[int]=None):
        town_vector = self.town[self.town['ID'].isin(clip)].copy()
        if town_vector.empty:
            raise ValueError("No town polygon found for the provided clip ID(s)")
        buffer_map = {1: 35000, 2: 30000, 3: 25000, 4: 20000, 5: 10000}
        town_vector['buffer'] = town_vector['class'].map(buffer_map).fillna(5000)
        town_poly = town_vector.iloc[0].geometry
        cls = int(town_vector.iloc[0]['class'])
        buf = buffer_map.get(cls, 5000)
        return town_poly.buffer(buf)
        
    def get_drain(self,clip:List[int]=None):
        drain_vector = self.drain_cachement[self.drain_cachement['Drain_No'].isin(clip)].copy()
        if drain_vector.empty:
            raise ValueError("No town polygon found for the provided clip ID(s)")
        buffer_map = {1: 35000, 2: 30000, 3: 25000, 4: 20000, 5: 10000}
        drain_vector['buffer'] =drain_vector['class'].map(buffer_map).fillna(5000)
        town_poly = drain_vector.iloc[0].geometry
        cls = int(drain_vector.iloc[0]['class'])
        buf = buffer_map.get(cls, 5000)
        return town_poly.buffer(buf)
        
    def get_town_village(self,clip:List[int]=None):
        town_buff = self.get_town(clip)
        return self.village[self.village.intersects(town_buff)].copy()
        
    def get_town_buffer(self,clip:List[int]=None):
        buffered_geom = self.get_town(clip)
        buffered_gdf = gpd.GeoDataFrame(geometry=[buffered_geom], crs="EPSG:32644")
        if len(buffered_gdf) > 1:
            union_geom = buffered_gdf.geometry.union_all()
            buffered_gdf = gpd.GeoDataFrame(geometry=[union_geom], crs=buffered_gdf.crs)
        return buffered_gdf
    
    def get_drain_buffer(self,clip:List[int]=None):
        buffered_geom = self.get_drain(clip)
        buffered_gdf = gpd.GeoDataFrame(geometry=[buffered_geom], crs="EPSG:32644")
        if len(buffered_gdf) > 1:
            union_geom = buffered_gdf.geometry.union_all()
            buffered_gdf = gpd.GeoDataFrame(geometry=[union_geom], crs=buffered_gdf.crs)
        return buffered_gdf
            
    def get_basin(self):
        return self.basin

class WQ_Index:
    def __init__(self):
        unique_name=Unique_name().unique_name('wqi')
        self.output=Path(Settings().TEMP_DIR,unique_name)
        self.output.mkdir(exist_ok=True)
        self.vector_work=VectorProcess()
        self.idw_cell_size = 30.0
    def _save_raster(self,profile,raster_path:str,result:np.ndarray,ext:str):
        base, _ = os.path.splitext(raster_path)
        new_raster_path = f"{base}_{ext}.tif"
        with rasterio.open(new_raster_path, "w", **profile) as dst:
            dst.write(result.astype(np.float32), 1)
        return new_raster_path
        
    def _correct_pandas(self,payload:List[Well_response],params:List[str]):
        df = pd.DataFrame([item.model_dump() for item in payload])
        df = df[params]
        for param in df:
            param_df = df[[param]].copy()
            param_df[param] = pd.to_numeric(param_df[param], errors='coerce')
        return df

    def _arcgis_style_idw_ckdtree(self,coords_xy, values, grid_transform, grid_shape,
                              power=2.0, search_mode="variable", n_neighbors=12, radius=None):
        
        if isinstance(grid_shape, (tuple, list)) and len(grid_shape) == 2:
            rows, cols = grid_shape
        else:
            raise ValueError(f"grid_shape must be (rows, cols), got: {grid_shape}")
        
        rows, cols = int(rows), int(cols)


        # Generate grid coordinates
        xs = (np.arange(cols, dtype=np.float64) * grid_transform.a) + grid_transform.c + (grid_transform.a / 2.0)
        ys = (np.arange(rows, dtype=np.float64) * grid_transform.e) + grid_transform.f + (grid_transform.e / 2.0)
        grid_x, grid_y = np.meshgrid(xs, ys)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])

        coords_xy = np.asarray(coords_xy, dtype=np.float64)
        values = np.asarray(values, dtype=np.float64)
        
        k = int(n_neighbors) if n_neighbors is not None else 12
        k = max(1, min(k, coords_xy.shape[0]))

        # Build KDTree
        tree = cKDTree(coords_xy)

        if search_mode == "variable":
            # K nearest neighbors
            dists, idxs = tree.query(xi, k=k)
            if k == 1:
                dists = dists[:, np.newaxis]
                idxs = idxs[:, np.newaxis]
            
            dists[dists == 0] = 1e-10
            weights = 1.0 / (dists ** float(power))
            numer = np.sum(weights * values[idxs], axis=1)
            denom = np.sum(weights, axis=1)
            vals = numer / denom

        elif search_mode == "fixed":
            # Fixed radius search
            if radius is None or float(radius) <= 0:
                raise ValueError("Fixed search requires positive radius")
            
            r = float(radius)
            neighbor_lists = tree.query_ball_point(xi, r=r)
            vals = np.empty(len(xi), dtype=np.float64)
            
            for i, neighbors in enumerate(neighbor_lists):
                if not neighbors:
                    vals[i] = np.nan
                    continue
                
                d = np.linalg.norm(coords_xy[neighbors] - xi[i], axis=1)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                vals[i] = np.sum(w * values[neighbors]) / np.sum(w)
        else:
            # Fallback: all points (slower)
            N = len(xi)
            chunk = 200000
            out = np.empty(N, dtype=np.float64)
            
            for s in range(0, N, chunk):
                e = min(s + chunk, N)
                xchunk = xi[s:e]
                d = np.linalg.norm(coords_xy[None, :, :] - xchunk[:, None, :], axis=2)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                numer = w.dot(values)
                denom = np.sum(w, axis=1)
                out[s:e] = numer / denom
            vals = out

        grid = vals.reshape(rows, cols).astype(np.float32)    
        return grid

    def _vector_area(self,df:pd.DataFrame):
        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df['Longitude'], df['Latitude'], crs="EPSG:4326")
        )
        points_utm = points_gdf.to_crs("EPSG:32644")
        coords_xy_utm = np.array([(geom.x, geom.y) for geom in points_utm.geometry], dtype=np.float64)
        
        
        selected_area=self.vector_work.get_basin()
        bounds_original = selected_area.total_bounds
        selected_area_utm = selected_area.to_crs("EPSG:32644")
        bounds_utm = selected_area_utm.total_bounds
        sel_minx, sel_miny, sel_maxx, sel_maxy = bounds_utm
        pts_minx, pts_miny = coords_xy_utm[:,0].min(), coords_xy_utm[:,1].min()
        pts_maxx, pts_maxy = coords_xy_utm[:,0].max(), coords_xy_utm[:,1].max()
        
        # Expand bounds to include both selected area and well points
        minx = min(sel_minx, pts_minx) - self.idw_cell_size 
        miny = min(sel_miny, pts_miny) - self.idw_cell_size 
        maxx = max(sel_maxx, pts_maxx) + self.idw_cell_size 
        maxy = max(sel_maxy, pts_maxy) + self.idw_cell_size 
        
        cols = int(np.ceil((maxx - minx) / self.idw_cell_size ))
        rows = int(np.ceil((maxy - miny) / self.idw_cell_size ))
    
        proj_transform = from_origin(minx, maxy, self.idw_cell_size , self.idw_cell_size )
        return cols,rows,coords_xy_utm,proj_transform

    def _get_interpolate(self,df:pd.DataFrame,threshold):   
        selected_parameters=df.drop(columns=['Longitude','Latitude'])  
        cols,rows,coords_xy_utm,proj_transform=self._vector_area(df)
        interpolated_rasters = []
        for param in selected_parameters:
            temp_name=Unique_name.unique_name_with_ext(param,"tif")
            param_threshold=threshold[param]
            try:
                param_df=selected_parameters
                valid_mask = ~param_df[param].isna()
                valid_values = param_df.loc[valid_mask, param].values.astype(float)
                valid_coords = coords_xy_utm[valid_mask]
                
                if len(valid_values) < 3:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Only {len(valid_values)} valid points for {param} (need 3 minimum)"
                    )                
                # Perform IDW interpolation in UTM
                Z_utm = self._arcgis_style_idw_ckdtree(
                    coords_xy=valid_coords,
                    values=valid_values,
                    grid_transform=proj_transform,
                    grid_shape=(rows, cols),
                    power=2.0,
                    search_mode='variable',
                    n_neighbors=12,
                    radius=None
                )
                temp_utm_path = self.output / f"temp_{temp_name}"

                with rasterio.open(
                    temp_utm_path,
                    'w',
                    driver='GTiff',
                    height=Z_utm.shape[0],
                    width=Z_utm.shape[1],
                    count=1,
                    dtype=rasterio.float32,
                    crs='EPSG:32644',
                    transform=proj_transform,
                    nodata=np.nan
                ) as dst:
                    dst.write(Z_utm.astype(rasterio.float32), 1)

                with rasterio.open(temp_utm_path) as src:
                    transform_4326, width_4326, height_4326 = calculate_default_transform(
                        src.crs, 'EPSG:4326', src.width, src.height, *src.bounds,
                        resolution=(0.001, 0.001)  # ~100m resolution in degrees
                    )
                    output_path = self.output/ f"{temp_name}"
                    
                    with rasterio.open(
                        output_path,
                        'w',
                        driver='GTiff',
                        height=height_4326,
                        width=width_4326,
                        count=1,
                        dtype=rasterio.float32,
                        crs='EPSG:4326',
                        transform=transform_4326,
                        nodata=np.nan,
                        compress='lzw'
                        
                    ) as dst:
                        reproject(
                            source=rasterio.band(src, 1),
                            destination=rasterio.band(dst, 1),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform_4326,
                            dst_crs='EPSG:4326',
                            resampling=Resampling.bilinear,
                            dst_nodata=np.nan
                            
                        )
                        dst.update_tags(
                            PARAMETER=param,
                            INTERPOLATION_METHOD='IDW_cKDTree',
                            WELLS_COUNT=str(len(valid_values)),
                            ORIGINAL_CRS='EPSG:32644',
                            OUTPUT_CRS='EPSG:4326'
                        )
                with rasterio.open(output_path) as src:
                    data_4326 = src.read(1)
                    valid_data = data_4326[~np.isnan(data_4326)]
                interpolated_rasters.append({
                    'parameter': param,
                    'output_path': str(output_path),
                    'wells_used': len(valid_values),
                    'raster_shape': data_4326.shape,
                    'threshold_bool': float(np.mean(valid_data))>param_threshold,
                    'value_range': {
                        'min': float(np.min(valid_data)),
                        'max': float(np.max(valid_data)),
                        'mean': float(np.mean(valid_data))
                    }
                })
            except Exception as e:
                print(f"[INTERPOLATION] ✗ {param}: {str(e)}")
        return interpolated_rasters

    def __calculate_index(self,p_array, threshold):
        if hasattr(p_array, 'mask'):
            valid_mask = ~p_array.mask
            p_array = p_array.data
        else:
            valid_mask = np.isfinite(p_array) & (p_array > 0)

        numerator = p_array - threshold
        denominator = p_array + threshold
        ci = np.full_like(p_array, np.nan, dtype=np.float32)
        calc_mask = valid_mask & (denominator != 0)
        ci[calc_mask] = numerator[calc_mask] / denominator[calc_mask]
        ci = np.clip(ci, -1, 1)
        return ci

    def __calculate_ranking(self, ci_array):
        valid_mask = ~np.isnan(ci_array) & np.isfinite(ci_array)
        rank = np.full_like(ci_array, np.nan, dtype=np.float32)
        valid_ci = ci_array[valid_mask]
        rank[valid_mask] = 0.5 * (valid_ci ** 2) + 4.5 * valid_ci + 5
        rank[valid_mask] = np.clip(rank[valid_mask], 1, 10)
        return rank
    
    def _calulate_concentration_index(self, arr,threshold):
        CI_raster=[]
        rank_raster=[]
        for i in arr:
            CI_raster.append(
                {
                "parameter":i["parameter"],
                "P_raster":i["output_path"],
                "threshold":threshold.get(i['parameter']),
                "threshold_bool":i["threshold_bool"]  
                }
            )
        for i in CI_raster:
            with rasterio.open(i["P_raster"]) as src:
                p_array = src.read(1)
                profile = src.profile
            result = self.__calculate_index(p_array, i["threshold"])

            profile.update(
                dtype=rasterio.float32,
                count=1,
                compress="lzw"
            )
            ci_raster_path=self._save_raster(profile,i["P_raster"],result,"CI")
            rank_raster.append({
                "parameter":i["parameter"],
                "CI_raster":ci_raster_path,
                "threshold_bool":i["threshold_bool"]  
            })
        return rank_raster

    def _calcluate_ranking_raster(self,arr):
        rank_raster=[]
        for i in arr:
            with rasterio.open(i["CI_raster"]) as src:
                p_array = src.read(1)
                profile = src.profile
            result=self.__calculate_ranking(p_array)
            profile.update(
                dtype=rasterio.float32,
                count=1,
                compress="lzw"
            )
            rank_raster_path=self._save_raster(profile,i["CI_raster"],result,"Rank")
            rank_raster.append({
                "parameter":i["parameter"],
                "Rank_raster":rank_raster_path,
                "threshold_bool":i["threshold_bool"]    
            })
        return rank_raster
    def _find_weight(self,arr):
        weight_rank=[]
        for i in arr:
            with rasterio.open(i["Rank_raster"]) as src:
                p_array = src.read(1, masked=True).filled(np.nan)
                mean_val = np.nanmean(p_array)

                weight = mean_val + 2 if i["threshold_bool"] else mean_val
                weight_rank.append({
                    "parameter": i["parameter"],
                    "weight": float(weight)
                })
        return weight_rank
    def _overlay(self, rank, weight):
        weighted_arrays = []
        meta = None
        weight_map = {w["parameter"]: w["weight"] for w in weight}
        for i in rank:
            param = i["parameter"]
            if param not in weight_map:
                continue
            with rasterio.open(i["Rank_raster"]) as src:
                array = src.read(1).astype(float)
                weight_val = weight_map[param]
                weighted_array = array * weight_val
                weighted_arrays.append(weighted_array)
                if meta is None:
                    meta = src.meta.copy()

        if not weighted_arrays:
            return None

        num_params = len(weighted_arrays)
        final_overlay = np.sum(weighted_arrays, axis=0) / num_params

        final_overlay = 100 - final_overlay

        min_val = np.nanmin(final_overlay)
        max_val = np.nanmax(final_overlay)

        if max_val != min_val:  # avoid division by zero
            final_overlay = (final_overlay - min_val) / (max_val - min_val + 1e-6)
        else:
            final_overlay[:] = 0
        output_path = os.path.join(self.output, f"GWI{uuid.uuid4()}.tif")
        meta.update(dtype=rasterio.float32, count=1)
        with rasterio.open(output_path, "w", **meta) as dst:
            dst.write(final_overlay.astype(rasterio.float32), 1)

        return output_path

    def calculate_GWQI(self,db:session,payload:List[Well_response]):
        df=self._correct_pandas(payload.data,payload.params)
        thresholds = WQI_threshold(db).get_threshold()
        df_columns = set(df.columns)
        parameter_thresholds = {
            t.parameter: t.value
            for t in thresholds
            if t.parameter in df_columns
        }
        result=self._get_interpolate(df,parameter_thresholds)   
        result_CI=self._calulate_concentration_index(result,parameter_thresholds)
        result_rank=self._calcluate_ranking_raster(result_CI)
        result_weight=self._find_weight(result_rank)
        overlay=self._overlay(result_rank,result_weight)
        print("overlay",overlay)


    def get_well(self,db: session,payload:Well_input):
        return WQI(db).get_wqi(payload.subdis_cod,payload.year)
        

