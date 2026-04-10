import asyncio

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
from app.api.service.geoserver_svc.geoserver import Geoserver
from app.conf.settings import Settings
from pathlib import Path
from app.utils.name import Unique_name
from fastapi import HTTPException,status
from rasterio.warp import calculate_default_transform, reproject, Resampling
from app.conf.redis.redis_manager import redis_manager
from celery import group, chord
from app.conf.celery import app
import math
SQRT3 = math.sqrt(3)

geo_config=GeoConfig() 

def celery_status(task_id: str, status: str):
    data={
        "task_id": task_id,
        "status": status
    }
    payload = json.dumps(data)
    channel = f"opr_updates:{task_id}" 
    redis_manager.setex(f"opr_status:{task_id}", 3600, payload)
    redis_manager.publish(channel, payload)

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

class RasterProcess(VectorProcess):

    def __init__(self):
        super().__init__()
        self.output_dir=Path(self.output_path) / "SLD" 
        os.makedirs(self.output_dir, exist_ok=True)
    def _save_raster(self,profile,raster_path:str,result:np.ndarray,raster_name:str):
        folder_path = os.path.dirname(raster_path)
        name = Unique_name.unique_name_with_ext(name=raster_name,extension="tif")
        new_raster_path = f"{folder_path}/{name}"
        with rasterio.open(new_raster_path, "w", **profile) as dst:
            dst.write(result.astype(np.float32), 1)
        return new_raster_path
    
    def _generate_colors(self,num_classes):
        colors = []
        for i in range(num_classes):
            t = i / max(1, num_classes - 1)
            
            if t < 0.5:
                # Blue to Green transition (first half)
                r = int(0 + t * 2 * 255)  # 0 to 255
                g = int(0 + t * 2 * 255)  # 0 to 255
                b = 255                   # Stay at 255
            else:
                # Green to Red transition (second half)
                r = 255                               # Stay at 255
                g = int(255 - (t - 0.5) * 2 * 255)    # 255 to 0
                b = int(255 - (t - 0.5) * 2 * 255)    # 255 to 0
                
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            colors.append(hex_color.upper())
        return colors

    def _generate_sld_xml(self, intervals, colors,overlay:bool=False):
       
        # Create the XML document with proper namespaces
        root = ET.Element("sld:StyledLayerDescriptor")
        root.set("xmlns:sld", "http://www.opengis.net/sld")
        root.set("xmlns", "http://www.opengis.net/sld")
        root.set("xmlns:gml", "http://www.opengis.net/gml")
        root.set("xmlns:ogc", "http://www.opengis.net/ogc")
        root.set("version", "1.0.0")
        
        # Create the named layer
        named_layer = ET.SubElement(root, "sld:NamedLayer")
        layer_name = ET.SubElement(named_layer, "sld:Name")
        layer_name.text = "raster"
        
        # Create the user style
        user_style = ET.SubElement(named_layer, "sld:UserStyle")
        style_name = ET.SubElement(user_style, "sld:Name")
        style_name.text = "raster"
        
        title = ET.SubElement(user_style, "sld:Title")
        title.text = f"{len(colors)}-Class Raster Style with Ranges"
        
        abstract = ET.SubElement(user_style, "sld:Abstract")
        abstract.text = "SLD with explicit value ranges for raster styling"
        
        # Create feature type style
        feature_type_style = ET.SubElement(user_style, "sld:FeatureTypeStyle")
        rule = ET.SubElement(feature_type_style, "sld:Rule")
        
        # Create raster symbolizer
        raster_symbolizer = ET.SubElement(rule, "sld:RasterSymbolizer")
        
        # Create color map - using type="ramp" as in the example
        color_map = ET.SubElement(raster_symbolizer, "sld:ColorMap",
                              type="ramp")
        color_map.set("type", "ramp")
        
        # Define class labels
        level_class = ["  Very low", "  Low", "  Moderate", "  High", "  Very high"]
        
        # Add color map entries
        for i in range(len(intervals)-1):
            entry = ET.SubElement(color_map, "sld:ColorMapEntry")
            entry.set("color", colors[i])
            entry.set("quantity", str(intervals[i]))
            if overlay:
                entry.set("label", str(level_class[i]))
            else:
                entry.set("label", "   " + str(round(intervals[i], 2)))
        
        rough_string = ET.tostring(root, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ")
        
        
        xml_lines = pretty_xml.split('\n')
        xml_lines[0] = '<?xml version="1.0" encoding="UTF-8"?>'
        pretty_xml = '\n'.join(xml_lines)
        
        return pretty_xml

    def _generate_dynamic_sld(self,raster_path:str,num_classes:int,reverse:bool=False,overlay:bool=False):
        with rasterio.open(raster_path) as src:
            data = src.read(1, masked=True)
            valid_data = data[~data.mask]
            if len(valid_data) == 0:
                raise ValueError("Raster contains no valid data")
            min_val = float(np.min(valid_data))
            max_val = float(np.max(valid_data))

        if min_val == max_val:
            intervals = [min_val] * num_classes
        else:
            intervals = np.linspace(min_val-1, max_val+1, num_classes+1)

        
        colors = self._generate_colors(num_classes)

        if reverse:
            colors = colors[::-1]
       
        sld_content = self._generate_sld_xml(intervals, colors,overlay=overlay)
        unique_name = f"style_{uuid.uuid4().hex}.sld"
        output_sld_path = os.path.join(self.output_dir, unique_name)        
        with open(output_sld_path, 'w', encoding='utf-8') as f:
            f.write(sld_content)
        return output_sld_path
    
    def sld_path(self,file_path:str,reverse:bool=False,overlay:bool=False):
        try:
            sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,overlay=overlay)
            sld_name = os.path.basename(sld_path).split('.')[0]
            return sld_path,sld_name
        except Exception as e:
            print("exceprion",e)
            return False


class HydroChartService:

    # ── Constants ──────────────────────────────────────────────────────────
    _EW = {
        "Ca":   20.04, "Mg":  12.15, "Na":  22.99, "K":   39.10,
        "HCO3": 61.02, "CO3": 30.00, "Cl":  35.45, "SO4": 48.03,
    }
    _SQRT3 = math.sqrt(3)

    _PCA_FEATURES = [
        "pH", "EC", "Hardness",
        "Ca", "Mg", "Na", "K",
        "HCO3", "CO3", "Cl", "SO4",
    ]
    _RDA_RESPONSE_FEATURES    = ["Ca", "Mg", "Na", "K", "HCO3", "CO3", "Cl", "SO4"]
    _RDA_EXPLANATORY_FEATURES = ["pH", "EC", "Hardness"]

    # ── Preprocessing ──────────────────────────────────────────────────────

    def _to_meq(self, well: Well_response) -> dict:
        """Convert mg/L → meq/L for all major ions."""
        EW = self._EW
        return {
            "Ca":   well.Calcium     / EW["Ca"],
            "Mg":   well.Magnesium   / EW["Mg"],
            "Na":   well.Sodium      / EW["Na"],
            "K":    well.Potassium   / EW["K"],
            "HCO3": well.Bicarbonate / EW["HCO3"],
            "CO3":  well.Carbonate   / EW["CO3"],
            "Cl":   well.Chloride    / EW["Cl"],
            "SO4":  well.Sulfate     / EW["SO4"],
        }

    def _ion_percentages(self, meq: dict) -> dict:
        """Compute cation% and anion% for each ion."""
        total_cat = meq["Ca"] + meq["Mg"] + meq["Na"] + meq["K"]
        total_ani = meq["HCO3"] + meq["CO3"] + meq["Cl"] + meq["SO4"]

        tc = total_cat if total_cat > 0 else 1e-9
        ta = total_ani if total_ani > 0 else 1e-9

        return {
            "Ca_pct":        meq["Ca"]   / tc * 100,
            "Mg_pct":        meq["Mg"]   / tc * 100,
            "Na_pct":        meq["Na"]   / tc * 100,
            "K_pct":         meq["K"]    / tc * 100,
            "HCO3_pct":      meq["HCO3"] / ta * 100,
            "CO3_pct":       meq["CO3"]  / ta * 100,
            "Cl_pct":        meq["Cl"]   / ta * 100,
            "SO4_pct":       meq["SO4"]  / ta * 100,
            "total_cat_meq": total_cat,
            "total_ani_meq": total_ani,
        }

    def _preprocess(self, wells: List[Well_response]) -> List[dict]:
        """Steps 1 & 2: convert to meq and compute ion percentages for every well."""
        result = []
        for w in wells:
            meq = self._to_meq(w)
            pct = self._ion_percentages(meq)
            result.append({
                "location":  w.Location,
                "latitude":  w.Latitude,
                "longitude": w.Longitude,
                "raw": {
                    "Ca": w.Calcium, "Mg": w.Magnesium, "Na": w.Sodium,
                    "K": w.Potassium, "HCO3": w.Bicarbonate, "CO3": w.Carbonate,
                    "Cl": w.Chloride, "SO4": w.Sulfate,
                    "EC": w.Electrical_Conductivity, "pH": w.pH_Level,
                    "Hardness": w.Hardness,
                },
                "meq": meq,
                "pct": pct,
            })
        return result

    # ── Chart helpers ──────────────────────────────────────────────────────

    def _piper_point(self, pct: dict, D: float = 120.0) -> dict:
        """
        Project one sample onto the Piper diagram.

        Cation triangle (left):
            X = 0.5 * (200 - 2*Ca% - Mg%)
            Y = (√3/2) * Mg%

        Anion triangle (right, offset by D):
            X = D + 0.5 * (200 - 2*(HCO3%+CO3%) - SO4%)
            Y = (√3/2) * SO4%

        Central diamond:
            X_dim = 0.5 * (X_cat + X_ani + (Y_cat - Y_ani) / √3)
            Y_dim = Y_cat + √3 * (X_dim - X_cat)
        """
        Ca   = pct["Ca_pct"]
        Mg   = pct["Mg_pct"]
        SO4  = pct["SO4_pct"]
        HCO3 = pct["HCO3_pct"]
        CO3  = pct["CO3_pct"]

        x_cat = 0.5 * (200 - 2 * Ca - Mg)
        y_cat = (self._SQRT3 / 2) * Mg

        x_ani = D + 0.5 * (200 - 2 * (HCO3 + CO3) - SO4)
        y_ani = (self._SQRT3 / 2) * SO4

        x_dim = 0.5 * (x_cat + x_ani + (y_cat - y_ani) / self._SQRT3)
        y_dim = y_cat + self._SQRT3 * (x_dim - x_cat)

        return {
            "cation":  {"x": round(x_cat, 4), "y": round(y_cat, 4)},
            "anion":   {"x": round(x_ani, 4), "y": round(y_ani, 4)},
            "diamond": {"x": round(x_dim, 4), "y": round(y_dim, 4)},
        }

    def _durov_point(self, pct: dict) -> dict:
        """
        Left triangle (cations):
            X = -(Na%+K%) * (√3/2)
            Y =  Mg% + 0.5*(Na%+K%)

        Top triangle (anions):
            X = Cl% + 0.5*SO4%
            Y = 100 + SO4%*(√3/2)

        Central square intersection:
            X_sq = X_ani
            Y_sq = Y_cat
        """
        Mg  = pct["Mg_pct"]
        Na  = pct["Na_pct"]
        K   = pct["K_pct"]
        Cl  = pct["Cl_pct"]
        SO4 = pct["SO4_pct"]

        nak   = Na + K
        x_cat = -nak * (self._SQRT3 / 2)
        y_cat =  Mg + 0.5 * nak
        x_ani = Cl + 0.5 * SO4
        y_ani = 100 + SO4 * (self._SQRT3 / 2)

        return {
            "cation_tri": {"x": round(x_cat, 4), "y": round(y_cat, 4)},
            "anion_tri":  {"x": round(x_ani, 4), "y": round(y_ani, 4)},
            "square":     {"x": round(x_ani, 4), "y": round(y_cat, 4)},
        }

    def _gibbs_point(self, w: dict) -> dict:
        """
        TDS  = EC * 0.64
        Cation ratio = Na / (Na + Ca)
        Anion  ratio = Cl / (Cl + HCO3)
        """
        raw  = w["raw"]
        Na   = raw["Na"]
        Ca   = raw["Ca"]
        Cl   = raw["Cl"]
        HCO3 = raw["HCO3"]
        EC   = raw["EC"]

        tds          = EC * 0.64
        cation_ratio = Na / (Na + Ca)   if (Na + Ca)   > 0 else 0.0
        anion_ratio  = Cl / (Cl + HCO3) if (Cl + HCO3) > 0 else 0.0

        def _classify(tds_val, _):
            if tds_val < 100:
                return "Precipitation dominance"
            elif tds_val > 1000:
                return "Evaporation dominance"
            return "Rock-water interaction"

        return {
            "tds":              round(tds, 3),
            "cation_ratio":     round(cation_ratio, 4),
            "anion_ratio":      round(anion_ratio,  4),
            "mechanism_cation": _classify(tds, cation_ratio),
            "mechanism_anion":  _classify(tds, anion_ratio),
        }

    def _build_feature_matrix(self, wells: List[Well_response]) -> np.ndarray:
        """Build (n_samples, 11) raw feature matrix for PCA."""
        rows = [
            [
                w.pH_Level, w.Electrical_Conductivity, w.Hardness,
                w.Calcium, w.Magnesium, w.Sodium, w.Potassium,
                w.Bicarbonate, w.Carbonate, w.Chloride, w.Sulfate,
            ]
            for w in wells
        ]
        return np.array(rows, dtype=float)

    @staticmethod
    def _standardise(M: np.ndarray) -> np.ndarray:
        mu = M.mean(axis=0)
        sd = M.std(axis=0, ddof=1)
        sd[sd == 0] = 1e-9
        return (M - mu) / sd

    # ── Public chart methods ───────────────────────────────────────────────

    def calculate_piper(self, _db: session, payload: WQIOperation) -> dict:
        """Returns Piper trilinear diagram projection coordinates for every well."""
        processed = self._preprocess(payload.data)
        points = []
        for w in processed:
            proj = self._piper_point(w["pct"])
            points.append({
                "location":  w["location"],
                "latitude":  w["latitude"],
                "longitude": w["longitude"],
                **proj,
                "ion_pct": {k: round(v, 2) for k, v in w["pct"].items()
                            if k.endswith("_pct")},
            })
        return {"chart": "piper", "gap_D": 120.0, "points": points}

    def calculate_durov(self, _db: session, payload: WQIOperation) -> dict:
        processed = self._preprocess(payload.data)
        points = []
        for w in processed:
            proj = self._durov_point(w["pct"])
            points.append({
                "location":  w["location"],
                "latitude":  w["latitude"],
                "longitude": w["longitude"],
                **proj,
                "ion_pct": {k: round(v, 2) for k, v in w["pct"].items()
                            if k.endswith("_pct")},
            })
        return {"chart": "durov", "points": points}

    def calculate_gibbs(self, _db: session, payload: WQIOperation) -> dict:
        processed = self._preprocess(payload.data)
        points = []
        for w in processed:
            g = self._gibbs_point(w)
            points.append({
                "location":  w["location"],
                "latitude":  w["latitude"],
                "longitude": w["longitude"],
                **g,
            })
        return {"chart": "gibbs", "points": points}

    def calculate_pca(self, _db: session, payload: WQIOperation,
                      n_components: int = 2) -> dict:
        """
        Steps:
        1. Z-score normalise  →  X_std = (X - μ) / σ
        2. Covariance matrix  →  C = Xᵀ X / (n-1)
        3. SVD               →  eigenvalues + eigenvectors (loadings)
        4. Scores            →  X_std @ V  (V = eigenvector matrix)
        """
        wells = payload.data
        X     = self._build_feature_matrix(wells)
        n     = X.shape[0]

        X_std = self._standardise(X)
        C     = (X_std.T @ X_std) / (n - 1)

        _, s, Vt    = np.linalg.svd(C)
        eigenvalues  = s
        eigenvectors = Vt.T

        loadings        = eigenvectors[:, :n_components]
        scores          = X_std @ loadings
        explained_var   = eigenvalues / eigenvalues.sum() * 100
        cumulative_var  = np.cumsum(explained_var)

        score_list = [
            {
                "location":  w.Location,
                "latitude":  w.Latitude, "longitude": w.Longitude,
                "PC1": round(float(scores[i, 0]), 5),
                "PC2": round(float(scores[i, 1]), 5),
            }
            for i, w in enumerate(wells)
        ]
        loading_list = [
            {
                "feature": feat,
                "PC1": round(float(loadings[fi, 0]), 5),
                "PC2": round(float(loadings[fi, 1]), 5),
            }
            for fi, feat in enumerate(self._PCA_FEATURES)
        ]

        return {
            "chart": "pca",
            "n_components": n_components,
            "explained_variance_pct":  [round(float(v), 3) for v in explained_var[:n_components]],
            "cumulative_variance_pct": [round(float(v), 3) for v in cumulative_var[:n_components]],
            "eigenvalues": [round(float(v), 5) for v in eigenvalues[:n_components]],
            "loadings":    loading_list,
            "scores":      score_list,
        }

    def calculate_rda(self, _db: session, payload: WQIOperation,
                      n_components: int = 2) -> dict:
        """
        Steps:
        1. Standardise both Y (response ions) and X (explanatory env. vars)
        2. Regress each Y column on X  →  fitted values  Ŷ = X(XᵀX)⁻¹Xᵀ Y
        3. PCA on Ŷ  →  constrained axes (RDA axes)
        4. Scores = Ŷ @ eigenvectors
        5. Loadings for Y and X vectors mapped onto RDA space
        """
        wells = payload.data

        Y_raw = np.array([[
            w.Calcium, w.Magnesium, w.Sodium, w.Potassium,
            w.Bicarbonate, w.Carbonate, w.Chloride, w.Sulfate,
        ] for w in wells], dtype=float)

        X_raw = np.array([[
            w.pH_Level, w.Electrical_Conductivity, w.Hardness,
        ] for w in wells], dtype=float)

        Y = self._standardise(Y_raw)
        X = self._standardise(X_raw)

        XtX_inv = np.linalg.pinv(X.T @ X)
        Y_hat   = X @ XtX_inv @ X.T @ Y

        U, s, Vt    = np.linalg.svd(Y_hat, full_matrices=False)
        explained   = (s ** 2) / (s ** 2).sum() * 100
        site_scores = U[:, :n_components] * s[:n_components]

        response_loadings = Vt.T[:, :n_components]

        explanatory_loadings = [
            {
                "variable": xname,
                "RDA1": round(float(np.corrcoef(X[:, xi], site_scores[:, 0])[0, 1]), 5),
                "RDA2": round(float(np.corrcoef(X[:, xi], site_scores[:, 1])[0, 1]), 5)
                        if n_components > 1 else 0.0,
            }
            for xi, xname in enumerate(self._RDA_EXPLANATORY_FEATURES)
        ]

        response_loading_list = [
            {
                "ion":  yname,
                "RDA1": round(float(response_loadings[yi, 0]), 5),
                "RDA2": round(float(response_loadings[yi, 1]), 5) if n_components > 1 else 0.0,
            }
            for yi, yname in enumerate(self._RDA_RESPONSE_FEATURES)
        ]

        site_score_list = [
            {
                "location":  w.Location, 
                "latitude":  w.Latitude, "longitude": w.Longitude,
                "RDA1": round(float(site_scores[i, 0]), 5),
                "RDA2": round(float(site_scores[i, 1]), 5) if n_components > 1 else 0.0,
            }
            for i, w in enumerate(wells)
        ]

        return {
            "chart": "rda",
            "n_components": n_components,
            "explained_variance_pct": [round(float(v), 3) for v in explained[:n_components]],
            "response_loadings":      response_loading_list,
            "explanatory_loadings":   explanatory_loadings,
            "site_scores":            site_score_list,
        }

    def calculate_all_charts(self, _db: session, payload: WQIOperation) -> dict:
        """Run all 5 charts in one call and return a combined response."""
        return {
            "piper": self.calculate_piper(_db, payload),
            "durov": self.calculate_durov(_db, payload),
            "gibbs": self.calculate_gibbs(_db, payload),
            "pca":   self.calculate_pca(_db, payload),
            "rda":   self.calculate_rda(_db, payload),
        }


class WQ_Index:
    def __init__(self):
       
        self.vector_work=VectorProcess()
        self.idw_cell_size = 30.0

    def get_well(self,db: session,payload:Well_input):
        if payload.place == "Drain":
            return WQI(db).get_wqi_vill(payload.location,payload.year)
        else:
            return WQI(db).get_wqi(payload.location,payload.year)

    
        
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
        task_id=start_Interpolation.delay(output_folder=str(output_folder),payload_path=str(temp_path),sub_dis=payload.location)
        celery_status(task_id.id,"started")
        return task_id.id

wqi_obj=WQ_Index() 
raster_obj=RasterProcess()



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
    selected_area=wqi_obj.vector_work.get_sub_village(clip=sub_dis).to_crs('EPSG:4326')
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

    sld_path,sld_name=raster_obj.sld_path(file_path=str(path))
    _,layer_name=asyncio.run(Geoserver().upload_raster(workspace_name=geo_config.raster_workspace,store_name=unique_store_name,raster_path=str(path)))
    asyncio.run(Geoserver().apply_sld_to_layer(workspace_name=geo_config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name))
    redis_manager.hset(f"opr_result:{self.request.root_id}", mapping={param: layer_name})

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
            valid_mask = np.isfinite(p_array)

        numerator = p_array - raster_detail["threshold"]
        denominator = p_array + raster_detail["threshold"]
        
        ci = np.full_like(p_array, np.nan, dtype=np.float32)
        calc_mask = valid_mask & (denominator != 0)
        ci[calc_mask] = numerator[calc_mask] / denominator[calc_mask]
        profile.update(
            dtype=rasterio.float32,
            count=1,
            compress="lzw",
            nodata=np.nan
        )
        ci_raster_path =raster_obj._save_raster(profile=profile,raster_path=raster_detail["P_raster"],result=ci,raster_name=raster_detail["parameter"]+"_CI")
        return{
            "parameter":raster_detail["parameter"],
            "CI_raster":ci_raster_path,
            "threshold_bool":raster_detail["threshold_bool"]  
        }


@app.task(bind=True,name='start_Concentration_Index')
def start_Concentration_Index(self,result,threshold:list,*args, **kwargs):
    celery_status(self.request.root_id,"finish interpolation")
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
        rank_raster_path = raster_obj._save_raster(profile=profile,raster_path=raster_detail["CI_raster"],result=rank,raster_name=raster_detail["parameter"]+"_Rank")
        return {
                "parameter":raster_detail["parameter"],
                "Rank_raster":rank_raster_path,
                "threshold_bool":raster_detail["threshold_bool"]    
        }


@app.task(bind=True,name='start_rank_raster')  
def start_rank_raster(self,result,*args, **kwargs):
    celery_status(self.request.root_id,"finish Ranking")
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
    celery_status(self.request.root_id,"overlay started")
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

    if max_val != min_val: 
        final_overlay = (final_overlay - min_val) / (max_val - min_val)
    else:
        final_overlay[:] = 0

    meta.update(dtype=rasterio.float32, count=1)
    ans=raster_obj._save_raster(profile=meta,raster_path=output_path,result=final_overlay,raster_name="gwi_overlay")
    unique_store_name =Unique_name.unique_name("wqi_store")
    
    sld_path,sld_name=raster_obj.sld_path(file_path=str(ans),overlay=True)
    _,layer_name=asyncio.run(Geoserver().upload_raster(workspace_name=geo_config.raster_workspace,store_name=unique_store_name,raster_path=str(ans)))
    asyncio.run(Geoserver().apply_sld_to_layer(workspace_name=geo_config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name))
    
    redis_manager.hset(f"opr_result:{self.request.root_id}",mapping={"GWI_overlay":layer_name})
    celery_status(self.request.root_id,"completed")

   
    