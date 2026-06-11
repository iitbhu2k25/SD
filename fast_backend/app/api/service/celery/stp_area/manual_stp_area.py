import os
import json
import tempfile
import zipfile
import numpy as np
import geopandas as gpd
import pandas as pd
import networkx as nx
import rasterio
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape, LineString, Point, MultiLineString
from rasterio.features import shapes
from scipy.ndimage import label
from tqdm import tqdm

from app.conf.settings import Settings
from app.api.service.geoserver_svc.geoserver import Geoserver
from app.conf.celery import app as celery_app
from app.conf.redis.redis_manager import redis_manager
from app.database.config.dependency import celery_session
from app.database.crud.raster_operations import rasterOperCrud
from app.utils.name import Unique_name
from app.utils.exception import CustomException

geo = Geoserver()


class ManualSTPArea:
    """Fully self-contained STP area finder for Manual mode.
    No dependency on the admin/drain STP_Area class."""

    SUITABILITY_THRESHOLD = 0.417

    def __init__(self):
        self.road_path = Settings().road_path
        self.elivation_path = Settings().elivation_path
        self.TEMP_DIR = Settings().TEMP_DIR

    # ── GeoServer upload ──────────────────────────────────────────────────────

    def _temporory_vector(self, vector_temp_file: gpd.GeoDataFrame, name: str):
        unique_zip = f"{name}.zip"
        output_zip_path = os.path.join(self.TEMP_DIR, unique_zip)
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_shp = Path(temp_dir) / f"{name}.shp"
            vector_temp_file.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
            with zipfile.ZipFile(output_zip_path, "w") as zipf:
                for f in tmp_shp.parent.glob(f"{name}.*"):
                    zipf.write(f, f.name)
        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]
        Geoserver().celery_upload_vector("vector_work", output_zip_path, name_only)
        return name_only

    def _publish_path_sync(self, gdf: gpd.GeoDataFrame, name: str) -> str | None:
        unique_zip = f"{name}.zip"
        output_zip_path = os.path.join(self.TEMP_DIR, unique_zip)
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                tmp_shp = Path(temp_dir) / f"{name}.shp"
                gdf.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
                with zipfile.ZipFile(output_zip_path, "w") as zipf:
                    for f in Path(temp_dir).glob(f"{name}.*"):
                        zipf.write(f, f.name)
            ok = Geoserver().celery_upload_vector("vector_work", output_zip_path, name)
            return name if ok else None
        except Exception as e:
            print(f"[_publish_path_sync] error for {name}: {e}", flush=True)
            return None
        finally:
            try:
                os.remove(output_zip_path)
            except Exception:
                pass

    # ── Raster reading & cluster extraction ──────────────────────────────────

    def _read_raster(self, layer_name: str):
        raster_path = redis_manager.get(layer_name)
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

    def _apply_threshold_classification(self, data, threshold):
        mask = (~np.isnan(data)) & (data >= threshold)
        out = np.zeros_like(data, dtype=np.uint8)
        out[mask] = 1
        return out

    def _calculate_required_pixels(self, required_area_m2, res_x, res_y):
        pixel_area = res_x * res_y
        pixels_needed = int(np.ceil(required_area_m2 / pixel_area))
        kernel_size = int(np.ceil(np.sqrt(pixels_needed)))
        return kernel_size, pixels_needed

    def _find_suitable_areas(self, reclassified, kernel_size, required_pixels):
        rows, cols = reclassified.shape
        mask = np.zeros_like(reclassified, dtype=np.uint8)
        for i in tqdm(range(rows - kernel_size + 1), desc="Finding suitable areas"):
            for j in range(cols - kernel_size + 1):
                window = reclassified[i:i + kernel_size, j:j + kernel_size]
                if np.sum(window) >= required_pixels:
                    mask[i:i + kernel_size, j:j + kernel_size] = 1
        return mask

    def _extract_clusters_as_polygons(self, mask, transform, crs):
        labeled, _ = label(mask)
        polygons = []
        for geom, val in shapes(labeled.astype(np.uint8), transform=transform):
            if val > 0:
                polygons.append(shape(geom))
        gdf = gpd.GeoDataFrame(geometry=polygons, crs=crs)
        gdf["cluster_id"] = range(len(gdf))
        gdf["area_ha"] = gdf.area / 10000
        return gdf

    def _find_suitable_cluster(self, mld_capacity: float, treatment_technology: float, custom_land_per_mld: float, layer_name: str):
        req_ha = (mld_capacity * treatment_technology) + custom_land_per_mld
        req_m2 = req_ha * 10000
        data, rx, ry, transform, crs = self._read_raster(layer_name)
        threshold_mask = self._apply_threshold_classification(data, self.SUITABILITY_THRESHOLD)
        kernel_size, required_pixels = self._calculate_required_pixels(req_m2, rx, ry)
        suitable_mask = self._find_suitable_areas(threshold_mask, kernel_size, required_pixels)
        clusters_gdf = self._extract_clusters_as_polygons(suitable_mask, transform, crs)

        if len(clusters_gdf) < 10:
            all_clusters_gdf = self._extract_clusters_as_polygons(threshold_mask, transform, crs)
            if not all_clusters_gdf.empty:
                all_clusters_gdf = all_clusters_gdf.sort_values("area_ha", ascending=False).head(30)
                if clusters_gdf.empty:
                    clusters_gdf = all_clusters_gdf
                else:
                    clusters_gdf = gpd.GeoDataFrame(
                        pd.concat([clusters_gdf, all_clusters_gdf], ignore_index=True),
                        crs=crs
                    ).drop_duplicates(subset=["cluster_id"]).reset_index(drop=True)

        if clusters_gdf.empty:
            raise CustomException(status_code=404, detail="Suitable area not found")
        temp_cluster_path = os.path.join(self.TEMP_DIR, "manual_temp_cluster.shp")
        clusters_gdf.to_file(temp_cluster_path, driver="ESRI Shapefile")
        return clusters_gdf, crs

    # ── Centroid helper ───────────────────────────────────────────────────────

    def _centroid_location(self, location: list):
        lat_sum = lon_sum = 0
        for lat, lon in location:
            lat_sum += lat
            lon_sum += lon
        n = len(location)
        return lon_sum / n, lat_sum / n

    # ── Road graph ────────────────────────────────────────────────────────────

    def _build_graph(self, crs: str) -> nx.Graph:
        roads = gpd.read_file(self.road_path).to_crs(crs)
        G = nx.Graph()
        for row in roads.itertuples():
            geom = row.geometry
            lines = [geom] if geom.geom_type == "LineString" else (list(geom.geoms) if geom.geom_type == "MultiLineString" else [])
            for line in lines:
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    G.add_edge(p1, p2, weight=Point(p1).distance(Point(p2)))
        return G

    def _nearest(self, G: nx.Graph, pt: tuple):
        nodes = np.array(list(G.nodes))
        if len(nodes) == 0:
            return None
        pt_arr = np.array(pt)
        if np.any(np.isnan(pt_arr)):
            return None
        return tuple(nodes[int(np.argmin(np.linalg.norm(nodes - pt_arr, axis=1)))])

    def _road_path(self, G: nx.Graph, src: tuple, tgt: tuple):
        try:
            s = self._nearest(G, src)
            t = self._nearest(G, tgt)
            if s is None or t is None:
                return None
            path = nx.shortest_path(G, s, t, weight="weight")
            return LineString(path)
        except Exception:
            return None

    # ── Top-N clusters with drain distances ──────────────────────────────────

    def _top10_nearest_with_drain_distances(self, clusters: gpd.GeoDataFrame, crs: str, longitude: float, latitude: float, drain_points: list, num_clusters: int = 10) -> tuple:
        if clusters.empty:
            return clusters, []

        transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        src_x, src_y = transformer.transform(longitude, latitude)
        src_pt = np.array([src_x, src_y])

        centroids = np.array([(row.geometry.centroid.x, row.geometry.centroid.y) for row in clusters.itertuples()])
        dists_to_polygon = np.linalg.norm(centroids - src_pt, axis=1)

        clusters = clusters.copy()
        clusters["dist_to_polygon_m"] = dists_to_polygon
        top10 = clusters.sort_values("dist_to_polygon_m").head(num_clusters).reset_index(drop=True)
        top10["rank"] = range(1, len(top10) + 1)

        G = self._build_graph(crs)

        drain_pts_utm = []
        for dp in drain_points:
            dx, dy = transformer.transform(dp["longitude"], dp["latitude"])
            drain_pts_utm.append({"Drain_No": dp["Drain_No"], "x": dx, "y": dy, "Elevation": dp.get("Elevation", 0)})

        print(f"[manual_cluster_path] graph nodes={G.number_of_nodes()} edges={G.number_of_edges()} crs={crs}", flush=True)

        # Cache nearest road node per drain once — avoids O(N) lookup repeated per cluster
        drain_nearest_nodes = {dp["Drain_No"]: self._nearest(G, (dp["x"], dp["y"])) for dp in drain_pts_utm}

        cluster_drain_distances = []
        for rank, row in enumerate(top10.itertuples(), start=1):
            c = row.geometry.centroid
            c_src = (c.x, c.y)
            c_arr = np.array([c.x, c.y])
            c_nearest = self._nearest(G, c_src)

            drain_dists = []
            road_lines = []

            for dp in drain_pts_utm:
                d_tgt = (dp["x"], dp["y"])
                d_arr = np.array([dp["x"], dp["y"]])

                road_line = self._road_path(G, c_src, d_tgt)
                if road_line is not None and not road_line.is_empty:
                    dist_m = float(road_line.length)
                    road_lines.append(road_line)
                    t_node = drain_nearest_nodes[dp["Drain_No"]]
                    if c_nearest and tuple(c_nearest) != c_src:
                        road_lines.append(LineString([c_src, c_nearest]))
                    if t_node and tuple(t_node) != d_tgt:
                        road_lines.append(LineString([d_tgt, t_node]))
                else:
                    dist_m = float(np.linalg.norm(c_arr - d_arr))
                    road_lines.append(LineString([c_src, d_tgt]))

                drain_dists.append({"Drain_No": dp["Drain_No"], "distance_m": round(dist_m, 1), "elevation": dp.get("Elevation", 0)})

            path_layer_name = None
            if road_lines:
                try:
                    valid_lines = [ln for ln in road_lines if ln is not None and not ln.is_empty]
                    if valid_lines:
                        multi_line = MultiLineString([list(ln.coords) for ln in valid_lines])
                        path_gdf = gpd.GeoDataFrame(geometry=[multi_line], crs=crs).to_crs("EPSG:4326")
                        path_name = Unique_name.unique_name("manual_cluster_path")
                        path_layer_name = self._publish_path_sync(path_gdf, path_name)
                except Exception as e:
                    print(f"[manual_cluster_path] failed for rank {rank}: {e}", flush=True)

            cluster_drain_distances.append({
                "cluster_rank": rank,
                "area_ha": round(float(row.area_ha), 4),
                "dist_to_polygon_m": round(float(row.dist_to_polygon_m), 1),
                "drains": drain_dists,
                "path_layer": path_layer_name,
            })

        return top10, cluster_drain_distances


# ── Celery task update helper ─────────────────────────────────────────────────

def _manual_celery_task_update(task_id: str, status: str, progress: int = 0, layer_name: str = None, result_path: str = None):
    if status == "started":
        with celery_session() as session:
            rasterOperCrud(session).start_task(task_id, task_id, "manual_stp_area_task")
    else:
        with celery_session() as session:
            rasterOperCrud(session).update_task(task_id, status, layer_name, result_path)
    payload = json.dumps({"task_id": task_id, "status": status, "progress": progress})
    redis_manager.setex(f"opr_status:{task_id}", 3600, payload)
    redis_manager.publish(f"opr_updates:{task_id}", payload)


# ── Manual DSS Celery task ────────────────────────────────────────────────────

@celery_app.task(bind=True, name="manual_find_suitable_area", pydantic=True)
def manual_find_suitable_area(self, treatment_technology: float, mld_capacity: float, custom_land_per_mld: float, layer_name: str, location: list, drain_points: list = None, num_clusters: int = 10):
    """Manual-mode DSS cluster finding — completely separate from admin/drain find_suitable_area."""
    try:
        area = ManualSTPArea()
        task_id = self.request.id
        print(f"[manual_find_suitable_area] START task={task_id} layer={layer_name}", flush=True)
        raster_check = redis_manager.get(layer_name)
        print(f"[manual_find_suitable_area] redis get layer={layer_name} found={raster_check is not None}", flush=True)
        _manual_celery_task_update(task_id=task_id, status="started")

        cluster_gdf, crs = area._find_suitable_cluster(mld_capacity, treatment_technology, custom_land_per_mld, layer_name)
        _manual_celery_task_update(task_id=task_id, status="running", progress=40)

        longitude, latitude = area._centroid_location(location)
        top_gdf, cluster_drain_distances = area._top10_nearest_with_drain_distances(
            cluster_gdf, crs, longitude, latitude, drain_points or [], num_clusters=num_clusters
        )
        _manual_celery_task_update(task_id=task_id, status="running", progress=80)

        final_cluster_name = None
        if top_gdf is not None and not top_gdf.empty:
            final_cluster_name = Unique_name.unique_name("manual_final_cluster")
            area._temporory_vector(top_gdf, final_cluster_name)

        distances_json = json.dumps(cluster_drain_distances) if cluster_drain_distances else None
        _manual_celery_task_update(task_id=task_id, status="completed", progress=100, layer_name=final_cluster_name, result_path=distances_json)
    except Exception as e:
        print(f"[manual_find_suitable_area] FAILED task={task_id} layer={layer_name} error={e}", flush=True)
        _manual_celery_task_update(task_id=task_id, status="failed", progress=100)
