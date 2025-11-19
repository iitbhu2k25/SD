from app.api.schema.wqi import WQIOperation, Well_input,Well_response
from app.database.config.dependency import PostgresDb
from typing import List,Tuple
from io import StringIO
from sqlalchemy.orm import session
from app.database.crud.gwpz_crud import WQI,WQI_threshold
import os
import json
from xml.dom import minidom
from xml.etree import ElementTree as ET
import numpy as np
import pandas as pd
import rasterio
from rasterio.warp import  reproject
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.io import MemoryFile
from rasterio.mask import mask

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
redis_client = Settings().redis_client
from celery import group, chord
from app.conf.celery import app


geo=Geoserver()
geo_config=GeoConfig() 


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
       
        self.vector_work=VectorProcess()
        self.idw_cell_size = 30.0

    def get_well(self,db: session,payload:Well_input):
        return WQI(db).get_wqi(payload.subdis_cod,payload.year)
    
    def _save_raster(self,profile,raster_path:str,result:np.ndarray,raster_name:str):
        folder_path = os.path.dirname(raster_path)
        name = Unique_name.unique_name_with_ext(name=raster_name,extension="tif")
        new_raster_path = f"{folder_path}/{name}"
        with rasterio.open(new_raster_path, "w", **profile) as dst:
            dst.write(result.astype(np.float32), 1)
        return new_raster_path
        
    def _correct_pandas(self,payload_path:str):
        with open(payload_path, "r") as f:
            raw_data = json.load(f)

        payload = WQIOperation(**raw_data)
        params = list(set(payload.params))
        data_rows = [item.model_dump() for item in payload.data]

        df = pd.DataFrame(data_rows)[params]
        df = df.apply(pd.to_numeric, errors="coerce")
        df_json = df.to_json(orient="records")
        return df_json

    def _arcgis_style_idw_ckdtree(self,coords_xy, values, grid_transform, grid_shape,
                              power=2.0, search_mode="variable", n_neighbors=12, radius=None):
        
        if isinstance(grid_shape, (tuple, list)) and len(grid_shape) == 2:
            rows, cols = grid_shape
        else:
            raise ValueError(f"grid_shape must be (rows, cols), got: {grid_shape}")
        
        rows, cols = int(rows), int(cols)

        xs = (np.arange(cols, dtype=np.float64) * grid_transform.a) + grid_transform.c + (grid_transform.a / 2.0)
        ys = (np.arange(rows, dtype=np.float64) * grid_transform.e) + grid_transform.f + (grid_transform.e / 2.0)
        grid_x, grid_y = np.meshgrid(xs, ys)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])

        coords_xy = np.asarray(coords_xy, dtype=np.float64)
        values = np.asarray(values, dtype=np.float64)
        
        k = int(n_neighbors) if n_neighbors is not None else 12
        k = max(1, min(k, coords_xy.shape[0]))

        tree = cKDTree(coords_xy)
        dists, idxs = tree.query(xi, k=k)
        if k == 1:
            dists = dists[:, np.newaxis]
            idxs = idxs[:, np.newaxis]
        
        dists[dists == 0] = 1e-10
        weights = 1.0 / (dists ** float(power))
        numer = np.sum(weights * values[idxs], axis=1)
        denom = np.sum(weights, axis=1)
        vals = numer / denom

        grid = vals.reshape(rows, cols).astype(np.float32)    
        return grid

    def _vector_area(self,df:pd.DataFrame):
        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df['Longitude'], df['Latitude'], crs="EPSG:4326")
        )
        points_utm = points_gdf.to_crs("EPSG:32644")
        coords_xy_utm = np.array([(geom.x, geom.y) for geom in points_utm.geometry], dtype=np.float64)
        
        
        selected_area=self.vector_work.get_sub_village(clip=[990,991])
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
  
    def get_output_path(self):
        unique_name=Unique_name().unique_name('wqi')
        output_path=Path(Settings().TEMP_DIR,unique_name)
        output_path.mkdir(exist_ok=True)
        return output_path
    
    def calculate_GWQI(self,db:session,payload:WQIOperation):
        output_folder=self.get_output_path()
        file_id=Unique_name.unique_name_with_ext("gwi_data","json")
        temp_path=output_folder / file_id
        with open(temp_path, "w") as f:
            json.dump(payload.model_dump(), f, default=str)

        task_id=start_Interpolation.delay(output_folder=str(output_folder),payload_path=str(temp_path),sub_dis=payload.sub_dis)
        redis_client.setex(f"{str(task_id.id)}", 3600, "Working on Interpolation ")
        return task_id.id

wqi_obj=WQ_Index() 


@app.task(bind=True,name='celery_start_Interpolation')
def celery_start_Interpolation(self, output_folder:str,param: str, df_json: str, threshold: float,sub_dis:list):
    df = pd.read_json(StringIO(df_json), orient="records")
    if param not in df.columns:
        raise HTTPException(status_code=400, detail=f"Parameter '{param}' not found")

    valid_mask = ~df[param].isna()
    values = df.loc[valid_mask, param].astype(float).values
    if len(values) < 3:
        raise HTTPException(status_code=400, detail=f"Only {len(values)} valid points for {param}")

    cols, rows, coords, transform = wqi_obj._vector_area(df)

    Z_utm = wqi_obj._arcgis_style_idw_ckdtree(
        coords_xy=coords[valid_mask], values=values,
        grid_transform=transform, grid_shape=(rows, cols),
        power=2.0, search_mode='variable', n_neighbors=12
    )

    dst_transform, w, h = calculate_default_transform(
        'EPSG:32644', 'EPSG:4326', cols, rows,
        *rasterio.transform.array_bounds(rows, cols, transform),
        resolution=(0.001, 0.001)
    )

    Z_4326 = np.empty((h, w), np.float32)

    reproject(Z_utm, Z_4326, src_transform=transform, src_crs='EPSG:32644',
            dst_transform=dst_transform, dst_crs='EPSG:4326',
            resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
    

    selected_area=wqi_obj.vector_work.get_sub_village(clip=sub_dis).to_crs("EPSG:4326")

    with MemoryFile() as memfile:
        with memfile.open(
            driver='GTiff',
            height=h, width=w, count=1,
            dtype='float32',
            crs='EPSG:4326',
            transform=dst_transform,
            nodata=np.nan
        ) as tmp_ds:
            tmp_ds.write(Z_4326, 1)

            # Perform mask/clip
            clipped_array, clipped_transform = mask(
                tmp_ds,
                crop=True,
                shapes=selected_area.geometry,
                nodata=np.nan,
                filled=True
            )
    clipped_height, clipped_width = clipped_array.shape[1], clipped_array.shape[2]

    path = Path(output_folder) / Unique_name.unique_name_with_ext(param, "tif")
    
    with rasterio.open(path, 'w', driver='GTiff', height=clipped_height, width=clipped_width, count=1,
                    dtype='float32', crs='EPSG:4326', transform=clipped_transform,
                    nodata=np.nan, compress='lzw') as dst:
        dst.write(clipped_array[0], 1)
        dst.update_tags(PARAMETER=param, METHOD='IDW_cKDTree', WELLS=str(len(values)))

    v =  clipped_array[0][~np.isnan(clipped_array[0])]
    unique_store_name =Unique_name.unique_name("wqi_store")

    status,layer_name=geo.publish_raster(workspace_name=geo_config.raster_workspace,store_name=unique_store_name,raster_path=str(path))
    redis_client.hset(self.request.root_id+"_Result", mapping={param: layer_name})

    return {
        'parameter': param,
        'output_path': str(path),
        'wells_used': len(values),
        'raster_shape': clipped_array.shape,
        'threshold_bool': float(np.mean(v)) > threshold,
        'value_range': {'min': float(np.min(v)), 'max': float(np.max(v)), 'mean': float(np.mean(v))}
    }


@app.task(bind=True,name='start_Interpolation')
def start_Interpolation(self,output_folder:str,payload_path:str,sub_dis:list):

    df_json=wqi_obj._correct_pandas(payload_path)
    df = pd.read_json(StringIO(df_json), orient="records")
    df_columns = set(df.columns)
    with PostgresDb().session() as session:
        thresholds = WQI_threshold(session).get_threshold()
    parameter_thresholds = {
        t.parameter: t.value
        for t in thresholds
        if t.parameter in df_columns
    }
    selected_parameters=df.drop(columns=['Longitude','Latitude'])
    df_json = df.to_json(orient="records")
    interpolation_group = group(
        celery_start_Interpolation.s(
            output_folder=output_folder,
            param=param,
            df_json=df_json,
            threshold=parameter_thresholds[param],
            sub_dis=sub_dis
        )
        for param in selected_parameters
    )
    job = chord(interpolation_group)(
        start_Concentration_Index.s(
            threshold=parameter_thresholds,
        )
    )

@app.task(bind=True,name='celery_concentration_Index')
def celery_concentration_Index(self,raster_detail:dict):
    with rasterio.open(raster_detail["P_raster"]) as src:
        p_array = src.read(1)
        profile = src.profile
        if hasattr(p_array, 'mask'):
            valid_mask = ~p_array.mask
            p_array = p_array.data
        else:
            valid_mask = np.isfinite(p_array) & (p_array > 0)
        numerator = p_array - raster_detail["threshold"]
        denominator = p_array + raster_detail["threshold"]
        ci = np.full_like(p_array, np.nan, dtype=np.float32)
        calc_mask = valid_mask & (denominator != 0)
        ci[calc_mask] = numerator[calc_mask] / denominator[calc_mask]
        ci = np.clip(ci, -1, 1)
        profile.update(
            dtype=rasterio.float32,
            count=1,
            compress="lzw"
        )
        ci_raster_path =wqi_obj._save_raster(profile=profile,raster_path=raster_detail["P_raster"],result=ci,raster_name=raster_detail["parameter"]+"_CI")
        return{
            "parameter":raster_detail["parameter"],
            "CI_raster":ci_raster_path,
            "threshold_bool":raster_detail["threshold_bool"]  
        }


@app.task(bind=True,name='start_Concentration_Index')
def start_Concentration_Index(self,result,threshold:list,*args, **kwargs):
    redis_client.setex("self.request.root_id", 3600,"finish interpolation")
    CI_raster=[]
    for i in result:
        CI_raster.append(
            {
            "parameter":i["parameter"],
            "P_raster":i["output_path"],
            "threshold":threshold.get(i['parameter']),
            "threshold_bool":i["threshold_bool"]  
            }
    )
    ci_group = group(
        celery_concentration_Index.s(
            raster_detail=raster_details
        )
        for raster_details in CI_raster
    )
    job = chord(ci_group)(
        start_rank_raster.s()
    )


@app.task(bind=True,name='celery_rank_raster')
def celery_rank_raster(self,raster_detail:dict):
    with rasterio.open(raster_detail["CI_raster"]) as src:
        ci_array = src.read(1)
        profile = src.profile
        valid_mask = ~np.isnan(ci_array) & np.isfinite(ci_array)
        rank = np.full_like(ci_array, np.nan, dtype=np.float32)
        valid_ci = ci_array[valid_mask]
        rank[valid_mask] = 0.5 * (valid_ci ** 2) + 4.5 * valid_ci + 5
        rank[valid_mask] = np.clip(rank[valid_mask], 1, 10)
        profile.update(
                dtype=rasterio.float32,
                count=1,
                compress="lzw"
            )
        rank_raster_path = wqi_obj._save_raster(profile=profile,raster_path=raster_detail["CI_raster"],result=rank,raster_name=raster_detail["parameter"]+"_Rank")
        return {
                "parameter":raster_detail["parameter"],
                "Rank_raster":rank_raster_path,
                "threshold_bool":raster_detail["threshold_bool"]    
        }


@app.task(bind=True,name='start_rank_raster')  
def start_rank_raster(self,result,*args, **kwargs):
    redis_client.setex("self.request.root_id", 3600,"finish Ranking")
    rank_raster=[]
    for i in result:
        rank_raster.append(
            {
            "parameter":i["parameter"],
            "CI_raster":i["CI_raster"],
            "threshold_bool":i["threshold_bool"]  
            }
    )
    rank_group = group(
        celery_rank_raster.s(
            raster_detail=raster_details
        )
        for raster_details in rank_raster
    )
    job = chord(rank_group)(
        start_weight_raster.s()
    ) 
        

@app.task(bind=True,name='start_weight_raster')
def start_weight_raster(self,result:list):
    redis_client.setex("self.request.root_id", 3600,"overlay started")
    weight_rank=[]
    output_path=result[0]["Rank_raster"]
    for i in result:
        with rasterio.open(i["Rank_raster"]) as src:
            p_array = src.read(1, masked=True).filled(np.nan)
            mean_val = np.nanmean(p_array)

            weight = mean_val + 2 if i["threshold_bool"] else mean_val
            weight_rank.append({
                "parameter": i["parameter"],
                "weight": float(weight)
            })
    weighted_arrays = []
    meta = None
    weight_map = {w["parameter"]: w["weight"] for w in weight_rank}
    for i in result:
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
        final_overlay = (final_overlay - min_val) / (max_val - min_val)
    else:
        final_overlay[:] = 0

    meta.update(dtype=rasterio.float32, count=1)
    ans=wqi_obj._save_raster(profile=meta,raster_path=output_path,result=final_overlay,raster_name="gwi_overlay")
    unique_store_name =Unique_name.unique_name("wqi_store")
    status,layer_name=geo.publish_raster(workspace_name=geo_config.raster_workspace,store_name=unique_store_name,raster_path=str(ans))
    redis_client.hset(self.request.root_id+"_Result",mapping={"GWI_overlay":layer_name})
    redis_client.setex(self.request.root_id, 3600, "Done")