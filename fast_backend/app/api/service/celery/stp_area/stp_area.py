import time

from app.conf.settings import Settings
import uuid 
import tempfile
import os
import geopandas as gpd
from app.api.service.geoserver_svc.geoserver import Geoserver
import networkx as nx
from pyproj import Transformer
from shapely.geometry import shape, LineString, Point
import zipfile
from app.utils.exception import CustomException
from pathlib import Path
import numpy as np
from tqdm import tqdm
from app.conf.redis.redis_manager import redis_manager
from app.database.config.dependency import celery_session
import rasterio
from app.database.crud.raster_operations import rasterOperCrud
from scipy.ndimage import label
from app.utils.name import Unique_name
from rasterio.features import shapes
from app.conf.celery import app
import asyncio
import json

def celery_task_update(task_id: str, status: str, progress: int=0,layer_name:str = None,result_path:str=None):
    if status =="started":
        with celery_session() as session:
            rasterOperCrud(session).start_task(task_id,task_id,"stp_area_task")
    else:
        with celery_session() as session:
            rasterOperCrud(session).update_task(task_id,status,layer_name,result_path)
    
    data = {
        "task_id": task_id,
        "status": status,
        "progress": progress,

    }
    payload = json.dumps(data)
    channel = f"opr_updates:{task_id}" 
    redis_manager.setex(f"opr_status:{task_id}", 3600, payload)
    redis_manager.publish(channel, payload)
    
class STP_Area:
    def __init__(self):
        self.SUITABILITY_THRESHOLD = 0.417
        self.elivation_path=Settings().elivation_path
        self.road_path=Settings().road_path
        self.TEMP_DIR=Settings().TEMP_DIR

    def _temporory_vector(self,vector_temp_file:gpd.GeoDataFrame,name:str):
        unique_village_zip = f"{name}.zip"
        output_zip_path = self.TEMP_DIR+"/"+ unique_village_zip
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"{name}.shp"
            vector_temp_file.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"{name}.*"):
                    zipf.write(file, file.name)

            name_only = os.path.splitext(os.path.basename(output_zip_path))[0]
            asyncio.run(Geoserver().upload_vector("vector_work",output_zip_path,name_only))
        return name_only
    def _centroid_location(self,location:list):
        lon_sum = 0
        lat_sum = 0

        for lon, lat in location:
            lon_sum += lon
            lat_sum += lat

        n = len(location)
        centroid_lon = lon_sum / n
        centroid_lat = lat_sum / n

        return centroid_lon, centroid_lat
    def _read_raster(self,layer_name:str):
        raster_path= redis_manager.get(layer_name)
        if raster_path is None:
            raise CustomException(status_code=404, detail="Layer not found")
        with rasterio.open(raster_path) as src:
            data = src.read(1)
            transform = src.transform
            crs = src.crs
            nodata = src.nodata
            if nodata is not None:
                data = np.where(data == nodata, np.nan, data)
            data = np.where((data < 0) | (data > 1), np.nan, data)
            res_x = abs(transform[0])
            res_y = abs(transform[4])
        return data, res_x, res_y, transform, crs
    
    def _apply_threshold_classification(self,data, threshold):
        mask = (~np.isnan(data)) & (data >= threshold)
        out = np.zeros_like(data, dtype=np.uint8)
        out[mask] = 1
        return out
    
    def _calculate_required_pixels(self,required_area_m2, res_x, res_y):
        pixel_area = res_x * res_y
        pixels_needed = int(np.ceil(required_area_m2 / pixel_area))
        kernel_size = int(np.ceil(np.sqrt(pixels_needed)))
        return kernel_size, pixels_needed
    
    def _find_suitable_areas(self,reclassified, kernel_size, required_pixels):
        rows, cols = reclassified.shape
        mask = np.zeros_like(reclassified, dtype=np.uint8)

        for i in tqdm(range(rows - kernel_size + 1), desc="Finding suitable areas"):
            for j in range(cols - kernel_size + 1):
                window = reclassified[i:i+kernel_size, j:j+kernel_size]
                if np.sum(window) >= required_pixels:
                    mask[i:i+kernel_size, j:j+kernel_size] = 1
        return mask
    
    def _extract_clusters_as_polygons(self,mask, transform, crs):
        labeled, _ = label(mask)
        polygons = []

        for geom, val in shapes(labeled.astype(np.uint8), transform=transform):
            if val > 0:
                polygons.append(shape(geom))
        gdf = gpd.GeoDataFrame(geometry=polygons, crs=crs)
        gdf["cluster_id"] = range(len(gdf))
        gdf["area_ha"] = gdf.area / 10000
        return gdf
    
    def _find_suitable_cluster(self,mld_capacity:float,treatment_technology:float,custom_land_per_mld:float,layer_name:str):
        req_ha=(mld_capacity*treatment_technology) +custom_land_per_mld
        req_m2=req_ha*10000
        data, rx, ry, transform, crs =  self._read_raster(layer_name)
        threshold_mask = self._apply_threshold_classification(data, self.SUITABILITY_THRESHOLD)
        kernel_size, required_pixels = self._calculate_required_pixels(req_m2, rx, ry)
        suitable_mask = self._find_suitable_areas(threshold_mask, kernel_size, required_pixels)
        clusters_gdf = self._extract_clusters_as_polygons(suitable_mask, transform, crs)
        if clusters_gdf.empty:
            raise CustomException(status_code=404, detail="Suitable area not found")
        temp_cluster_path=Settings().TEMP_DIR+"/temp_cluster.shp"
        clusters_gdf.to_file(temp_cluster_path,driver="ESRI Shapefile")
        return clusters_gdf,crs

    def _read_elevation(self,longitude:float,latitude:float):
        with rasterio.open(self.elivation_path) as src:
            elev = src.read(1)
            etrans = src.transform
            ecrs = src.crs

        transformer = Transformer.from_crs("EPSG:4326", ecrs, always_xy=True)
        x, y = transformer.transform(longitude, latitude)

        row, col = rasterio.transform.rowcol(etrans, x, y)
        row = np.clip(row, 0, elev.shape[0] - 1)
        col = np.clip(col, 0, elev.shape[1] - 1)

        return elev,etrans,elev[row, col]
    def _cluster_mean_elev(self,geom, elev, transform):
        vals = []
        for x, y in geom.exterior.coords:
            r, c = rasterio.transform.rowcol(transform, x, y)
            if 0 <= r < elev.shape[0] and 0 <= c < elev.shape[1]:
                vals.append(elev[r, c])
        return np.mean(vals) if vals else np.nan
    def _filter_by_elevation(self,gdf, elev, transform, ref):
        out = []
        for row in tqdm(gdf.itertuples(), total=len(gdf), desc="Elevation filter"):
            m = self._cluster_mean_elev(row.geometry, elev, transform)
            if m < ref:
                d = row._asdict()
                d["mean_elev"] = m
                out.append(d)
        return gpd.GeoDataFrame(out, crs=gdf.crs) 
    
    def _build_graph(self,crs):
        roads=gpd.read_file(self.road_path).to_crs(crs)
        G = nx.Graph()

        for row in roads.itertuples():
            geom = row.geometry

            if geom.geom_type == "LineString":
                lines = [geom]
            elif geom.geom_type == "MultiLineString":
                lines = list(geom.geoms)
            else:
                continue

            for line in lines:
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    G.add_edge(p1, p2, weight=Point(p1).distance(Point(p2)))

        return G
    def _nearest(self,G, pt):
        nodes = np.array(list(G.nodes))
        if len(nodes) == 0:
            return None

        pt = np.array(pt)
        if np.any(np.isnan(pt)):
            return None

        d = np.linalg.norm(nodes - pt, axis=1)
        return tuple(nodes[np.argmin(d)])
    
    def _road_path(self,G, src, tgt):
        try:
            s = self._nearest(G, src)
            t = self._nearest(G, tgt)

            if s is None or t is None:
                return None

            path = nx.shortest_path(G, s, t, weight='weight')
            return LineString(path)

        except:
            return None
    def _make_graph_path(self,G:nx.Graph,clusters:gpd.GeoDataFrame,longitude:float,latitude:float,crs:str):
        transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        src = transformer.transform(longitude, latitude)
        dists, road_lines = [], []
        for row in tqdm(clusters.itertuples(), total=len(clusters), desc="Routing"):
            c = row.geometry.centroid
            tgt = (c.x, c.y)

            rline = self._road_path(G, src, tgt)

            if rline is None:
                road_lines.append(None)
                dists.append(np.nan)
            else:
                road_lines.append(rline)
                dists.append(rline.length)

        dists = np.array(dists)
        dists[np.isnan(dists)] = np.nanmax(dists)
        clusters["score"] = (dists - dists.min()) / (dists.max() - dists.min() + 1e-9)
        TOP_N = 3
        final = clusters.sort_values("score").head(TOP_N)
        clean_lines = [g for g in road_lines if g is not None and not g.is_empty]
        clean_path=None
        if len(clean_lines) > 0:
            clean_path = gpd.GeoDataFrame(geometry=clean_lines, crs=crs)
        return final,clean_path
    
    def _find_suitable_path(self,clusters:gpd.GeoDataFrame,crs:str,location:list):
        longitude, latitude =self._centroid_location(location)
        elev, etrans, ref = self._read_elevation(longitude, latitude)
        clusters = self._filter_by_elevation(clusters, elev, etrans, ref)
        G = self._build_graph(crs)
        return self._make_graph_path(G,clusters,longitude, latitude, crs)
       

    

@app.task(bind=True,name='find_suitable_area',pydantic=True)  
def find_suitable_area(self, treatment_technology:float,mld_capacity:float,custom_land_per_mld: float, layer_name:str,location:list):
    try:
        stp_areas=STP_Area()
        task_id=self.request.id
        celery_task_update(task_id=task_id,status="started")
        cluster_gdf ,crs= stp_areas._find_suitable_cluster(mld_capacity,treatment_technology,custom_land_per_mld,layer_name)
        celery_task_update(task_id=task_id,status="running",progress=40)
        final_cluster,road_path=stp_areas._find_suitable_path(cluster_gdf,crs,location)
        celery_task_update(task_id=task_id,status="running",progress=80)
        final_cluster_name,road_path_name=None,None
        if final_cluster is not None:
            final_cluster_name=Unique_name.unique_name("final_cluster")
            stp_areas._temporory_vector(final_cluster,final_cluster_name)
        if road_path is not None:
            road_path_name=Unique_name.unique_name("road_path")
            stp_areas._temporory_vector(road_path,road_path_name)
        
        celery_task_update(task_id=task_id,status="completed",progress=100,layer_name=final_cluster_name,result_path=road_path_name)
    except:
        celery_task_update(task_id=task_id,status="failed",progress=100)
        

     
