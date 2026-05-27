import os
import asyncio
import numpy as np
import geopandas as gpd
import rasterio
from sqlalchemy.orm import Session
from app.api.service.geoserver_svc.geoserver import Geoserver
from app.utils.network_conf import GeoConfig
from app.database.crud.stp_crud import STP_suitability_crud
from app.conf.redis_conf import async_redis_manager

geo = Geoserver()


class Unique_name:
    @staticmethod
    def unique_name(prefix: str) -> str:
        import uuid
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    @staticmethod
    def unique_name_with_ext(prefix: str, ext: str) -> str:
        import uuid
        return f"{prefix}_{uuid.uuid4().hex[:8]}.{ext}"


class ManualSTPMapper:
    """
    All manual-mode methods extracted from STPsuitabilityMapper.
    Add these 4 methods into your existing STPsuitabilityMapper class
    in app/api/service/river_water_management/stp_operation.py
    """

    async def confirm_manual_area(self, geometry_geojson: dict) -> dict:
        """Parse an input GeoJSON geometry, create a 5 km buffer, find villages in buffer,
        upload both the village buffer layer and the drawn polygon (cluster) layer to GeoServer."""
        from shapely.geometry import shape
        import geopandas as gpd_local

        geom_wgs84 = shape(geometry_geojson)
        centroid_wgs84 = geom_wgs84.centroid
        centroid_lat = centroid_wgs84.y
        centroid_lon = centroid_wgs84.x

        poly_gdf = gpd_local.GeoDataFrame(geometry=[geom_wgs84], crs="EPSG:4326")
        poly_projected = poly_gdf.to_crs("EPSG:32644")
        geom_projected = poly_projected.geometry.iloc[0]

        buffer_projected = geom_projected.buffer(5000)

        village = self.processor.village  # already in EPSG:32644
        villages_intersect = village[village.geometry.intersects(buffer_projected)].copy()

        if villages_intersect.empty:
            buf_gdf = gpd_local.GeoDataFrame(geometry=[buffer_projected], crs="EPSG:32644")
            buf_wgs84_geom = buf_gdf.to_crs("EPSG:4326").geometry.iloc[0]
            village_wgs84 = village.to_crs("EPSG:4326")
            villages_intersect = village_wgs84[village_wgs84.geometry.intersects(buf_wgs84_geom)].copy()
            if not villages_intersect.empty:
                villages_intersect = villages_intersect.to_crs("EPSG:32644")

        if villages_intersect.empty:
            villages_intersect = gpd_local.GeoDataFrame(geometry=[buffer_projected], crs="EPSG:32644")
        else:
            villages_intersect = villages_intersect[villages_intersect.geometry.is_valid].copy()
            villages_intersect["geometry"] = villages_intersect.geometry.buffer(0)
            if "ID" in villages_intersect.columns:
                villages_intersect = villages_intersect.rename(columns={"ID": "village_id"})

        temp_vill_name = Unique_name.unique_name("manual_vill")
        village_temp_path = os.path.join(self.TEMP_DIR, temp_vill_name + ".shp")
        villages_intersect.to_file(str(village_temp_path), driver="ESRI Shapefile")
        vector_name = await self._temporory_vector(vector_temp_file=villages_intersect)
        await async_redis_manager.setex(vector_name, 10800, str(village_temp_path))

        polygon_gdf = gpd_local.GeoDataFrame({"geometry": [geom_projected], "label": ["Selected STP Area"]}, crs="EPSG:32644")
        polygon_layer = await self._temporory_vector(vector_temp_file=polygon_gdf)

        buf_bbox_gdf = gpd_local.GeoDataFrame(geometry=[buffer_projected], crs="EPSG:32644")
        buf_bbox_wgs84 = buf_bbox_gdf.to_crs("EPSG:4326").geometry.iloc[0]
        minx, miny, maxx, maxy = buf_bbox_wgs84.bounds
        print(f"[confirm_manual_area] centroid=({centroid_lat:.4f},{centroid_lon:.4f}) buffer_bbox=[{minx:.4f},{miny:.4f},{maxx:.4f},{maxy:.4f}]", flush=True)

        return {
            "vector_name": vector_name,
            "polygon_layer": polygon_layer,
            "centroid_lat": centroid_lat,
            "centroid_lon": centroid_lon,
            "buffer_bbox": [minx, miny, maxx, maxy],
        }

    async def create_manual_suitability_raster(self, vector_layer_name: str) -> str:
        """Convert the manual area vector (stored in Redis) into a binary suitability raster.
        Every pixel inside the polygon = 1.0 (fully suitable), outside = NaN."""
        from rasterio.features import rasterize as rio_rasterize
        from shapely.geometry import mapping

        village_path = await async_redis_manager.get(vector_layer_name)
        area_gdf = gpd.read_file(village_path).to_crs("EPSG:32644")

        ref_raster_path = str(self.config.constraint_raster_path)
        with rasterio.open(ref_raster_path) as ref:
            ref_transform = ref.transform
            ref_crs = ref.crs
            ref_width = ref.width
            ref_height = ref.height
            ref_meta = ref.meta.copy()

        shapes_iter = ((mapping(geom), 1) for geom in area_gdf.geometry if geom is not None)
        burned = rio_rasterize(
            shapes=shapes_iter,
            out_shape=(ref_height, ref_width),
            transform=ref_transform,
            fill=0,
            dtype=np.float32,
        )

        burned = np.where(burned == 1, 1.0, np.nan).astype(np.float32)

        output_name = Unique_name.unique_name_with_ext("manual_suitability", "tif")
        output_path = os.path.join(self.config.output_path, output_name)
        ref_meta.update({
            "driver": "GTiff",
            "dtype": "float32",
            "nodata": np.nan,
            "count": 1,
            "crs": ref_crs,
            "transform": ref_transform,
            "width": ref_width,
            "height": ref_height,
        })
        with rasterio.open(output_path, "w", **ref_meta) as dst:
            dst.write(burned, 1)

        raster_key = Unique_name.unique_name("manual_raster")
        await async_redis_manager.setex(raster_key, 10800, str(output_path))
        return raster_key

    async def find_manual_path(self, polygon_geojson: dict | None, polygon_layer: str | None, location: list, drain_points: list | None = None, cluster_layer: str | None = None, cluster_rank: int | None = None, buffer_bbox: list | None = None) -> dict:
        """Find road network path from cluster/polygon centroid to nearest drains via road network."""
        print(f"[find_manual_path] buffer_bbox={buffer_bbox}, drain_count={len(drain_points) if drain_points else 0}, cluster_rank={cluster_rank}", flush=True)
        from shapely.geometry import shape
        import geopandas as gpd_local
        from app.api.service.celery.stp_area.stp_area import STP_Area
        import aiohttp

        async def _fetch_layer_features(layer_name: str):
            """Return list of GeoJSON features from a GeoServer WFS layer."""
            cfg = GeoConfig()
            wfs_url = (
                f"{cfg.geoserver_url}/wfs?service=WFS&version=2.0.0&request=GetFeature"
                f"&typeName=vector_work:{layer_name}&outputFormat=application/json&srsname=EPSG:4326"
            )
            async with aiohttp.ClientSession() as session:
                async with session.get(wfs_url, auth=aiohttp.BasicAuth(cfg.username, cfg.password)) as resp:
                    fc = await resp.json(content_type=None)
            return fc.get("features", [])

        async def _fetch_layer_geom(layer_name: str):
            features = await _fetch_layer_features(layer_name)
            from shapely.ops import unary_union
            geoms = [shape(f["geometry"]) for f in features if f.get("geometry")]
            return unary_union(geoms) if geoms else None

        if cluster_layer is not None:
            features = await _fetch_layer_features(cluster_layer)
            if not features:
                return {"suitable_path": None}

            # If a specific cluster rank is requested, filter to that feature.
            # The backend stores rank as a feature property (set by find_suitable_area).
            # Property name may be "rank", "cluster_rank", or index order — try all.
            if cluster_rank is not None:
                # Try matching by 'rank' or 'cluster_rank' property
                matched = [
                    f for f in features
                    if f.get("properties", {}).get("rank") == cluster_rank
                    or f.get("properties", {}).get("cluster_rank") == cluster_rank
                ]
                if not matched:
                    # Fall back: treat features as rank-ordered (rank 1 = index 0)
                    idx = cluster_rank - 1
                    matched = [features[idx]] if 0 <= idx < len(features) else features
                selected_features = matched
            else:
                selected_features = features

            from shapely.ops import unary_union
            geoms = [shape(f["geometry"]) for f in selected_features if f.get("geometry")]
            if not geoms:
                return {"suitable_path": None}
            cluster_geom = unary_union(geoms)

            # If still multi (shouldn't be after rank filter), use the largest sub-polygon
            if cluster_geom.geom_type in ("MultiPolygon", "GeometryCollection"):
                geom = max(cluster_geom.geoms, key=lambda g: g.area)
            else:
                geom = cluster_geom
        elif polygon_geojson is not None:
            geom = shape(polygon_geojson)
        elif polygon_layer is not None:
            geom = await _fetch_layer_geom(polygon_layer)
            if geom is None:
                return {"suitable_path": None}
        else:
            return {"suitable_path": None}

        poly_gdf = gpd_local.GeoDataFrame(
            {"cluster_id": [0], "area_ha": [geom.area / 10_000]},
            geometry=[geom],
            crs="EPSG:4326",
        )
        poly_projected = poly_gdf.to_crs("EPSG:32644")
        crs = str(poly_projected.crs)

        centroid_projected = poly_projected.geometry.iloc[0].centroid
        src_point = (centroid_projected.x, centroid_projected.y)

        if not drain_points:
            print("[find_manual_path] no drain points provided — cannot find path", flush=True)
            return {"suitable_path": None}

        if buffer_bbox and len(buffer_bbox) == 4:
            bb_minlon, bb_minlat, bb_maxlon, bb_maxlat = buffer_bbox
            active_drains = [
                dp for dp in drain_points
                if bb_minlat <= dp["latitude"] <= bb_maxlat and bb_minlon <= dp["longitude"] <= bb_maxlon
            ]
            if not active_drains:
                active_drains = drain_points
            print(f"[find_manual_path] bbox drain filter: {len(drain_points)} → {len(active_drains)}", flush=True)
        else:
            active_drains = drain_points

        from pyproj import Transformer
        transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

        if buffer_bbox and len(buffer_bbox) == 4:
            bb_minlon, bb_minlat, bb_maxlon, bb_maxlat = buffer_bbox
            _tr = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
            bbox_minx_m, bbox_miny_m = _tr.transform(bb_minlon, bb_minlat)
            bbox_maxx_m, bbox_maxy_m = _tr.transform(bb_maxlon, bb_maxlat)
        else:
            bbox_minx_m = bbox_miny_m = bbox_maxx_m = bbox_maxy_m = None

        drain_projected = [
            (transformer.transform(dp["longitude"], dp["latitude"]), dp["Drain_No"])
            for dp in active_drains
        ]

        stp_areas = STP_Area()
        print(f"[find_manual_path] crs={crs}, src={src_point}, drains={len(drain_projected)}", flush=True)

        def _find_paths_to_all_drains():
            import numpy as np
            import networkx as nx
            from shapely.geometry import LineString
            from shapely.ops import unary_union as _unary_union
            G = stp_areas._build_graph(crs)
            if not G.nodes:
                return None, []

            if bbox_minx_m is not None:
                pad = 2000
                local_nodes = {
                    n for n in G.nodes
                    if bbox_minx_m - pad <= n[0] <= bbox_maxx_m + pad
                    and bbox_miny_m - pad <= n[1] <= bbox_maxy_m + pad
                }
                G = G.subgraph(local_nodes).copy()
                if not G.nodes:
                    return None, []

            node_list = list(G.nodes)
            nodes = np.array(node_list)
            src_arr = np.array(src_point)
            src_node = node_list[int(np.argmin(np.linalg.norm(nodes - src_arr, axis=1)))]

            all_lines = []
            drain_road_distances = []

            for (dx, dy), drain_no in drain_projected:
                tgt_arr = np.array([dx, dy])
                tgt_node = node_list[int(np.argmin(np.linalg.norm(nodes - tgt_arr, axis=1)))]

                if src_node == tgt_node:
                    drain_road_distances.append({"Drain_No": drain_no, "distance_m": 0.0})
                    continue
                try:
                    path_nodes = nx.shortest_path(G, src_node, tgt_node, weight="weight")
                    road_dist = nx.shortest_path_length(G, src_node, tgt_node, weight="weight")
                except Exception:
                    drain_road_distances.append({"Drain_No": drain_no, "distance_m": round(float(np.linalg.norm(src_arr - tgt_arr)), 1)})
                    continue

                drain_road_distances.append({"Drain_No": drain_no, "distance_m": round(float(road_dist), 1)})
                road_coords = list(path_nodes)

                first_node = np.array(road_coords[0])
                if np.linalg.norm(first_node - src_arr) < 5000 and road_coords[0] != src_point:
                    road_coords = [src_point] + road_coords

                last_node = np.array(road_coords[-1])
                drain_arr = np.array([dx, dy])
                if np.linalg.norm(last_node - drain_arr) < 5000 and road_coords[-1] != (dx, dy):
                    road_coords = road_coords + [(dx, dy)]

                all_lines.append(LineString(road_coords))

            if not all_lines:
                return None, drain_road_distances

            import geopandas as _gpd
            combined = _unary_union(all_lines)
            return _gpd.GeoDataFrame(geometry=[combined], crs=crs), drain_road_distances

        road_path, drain_road_distances = await asyncio.get_event_loop().run_in_executor(None, _find_paths_to_all_drains)
        print(f"[find_manual_path] road_path={'found' if road_path is not None else None}", flush=True)

        road_path_layer = None
        if road_path is not None and not road_path.empty:
            road_path_name = Unique_name.unique_name("road_path")
            import tempfile as _tempfile
            import zipfile as _zipfile
            from pathlib import Path as _Path
            output_zip_path = os.path.join(stp_areas.TEMP_DIR, f"{road_path_name}.zip")
            with _tempfile.TemporaryDirectory() as tmp_dir:
                tmp_shp = _Path(tmp_dir) / f"{road_path_name}.shp"
                road_path.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
                with _zipfile.ZipFile(output_zip_path, "w") as zf:
                    for f in _Path(tmp_dir).glob(f"{road_path_name}.*"):
                        zf.write(f, f.name)
            await geo.upload_vector("vector_work", output_zip_path, road_path_name)
            road_path_layer = road_path_name

        polygon_area_ha = round(float(poly_projected.geometry.iloc[0].area) / 10_000, 4)
        cluster_distances_result = [
            {
                "cluster_rank": 1,
                "area_ha": polygon_area_ha,
                "dist_to_polygon_m": 0.0,
                "drains": drain_road_distances,
            }
        ] if drain_road_distances else None

        return {"suitable_path": road_path_layer, "cluster_distances": cluster_distances_result}

    async def check_constraints(self, polygon_geojson: dict, db: Session) -> dict:
        """Check which constraint rasters have non-zero pixels inside the drawn polygon."""
        from shapely.geometry import shape
        from rasterio.mask import mask as rasterio_mask
        from rasterio.warp import transform_geom
        import numpy as np
        import concurrent.futures

        constraint_rows = STP_suitability_crud(db).get_suitability_category("constraint", all_data=True)

        def _check_one(file_path: str, file_name: str) -> str | None:
            try:
                with rasterio.open(file_path) as src:
                    poly_reproj = transform_geom("EPSG:4326", src.crs, polygon_geojson)
                    from shapely.geometry import shape as _shape, box
                    raster_box = box(*src.bounds)
                    if not _shape(poly_reproj).intersects(raster_box):
                        return None
                    out_image, _ = rasterio_mask(src, [poly_reproj], crop=True, filled=False)
                    band = out_image[0]
                    valid_pixels = band.data[~band.mask]
                    if valid_pixels.size == 0:
                        return None
                    if np.any(valid_pixels == 0):
                        return file_name
            except Exception as e:
                print(f"[check_constraints] error on {file_name}: {e}", flush=True)
            return None

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            tasks = [
                loop.run_in_executor(pool, _check_one, row.file_path, row.file_name)
                for row in constraint_rows
            ]
            results = await asyncio.gather(*tasks)

        violations = [r for r in results if r is not None]
        return {"constraint_violations": violations, "can_proceed": len(violations) == 0}
