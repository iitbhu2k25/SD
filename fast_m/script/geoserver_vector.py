import sys
import os
from app.api.service.script_svc.geoserver_svc import create_workspace,create_vector_stores,upload_shapefile
from app.api.service.geoserver import Geoserver
import pandas as pd
import uuid
BASE_DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR_NEW = os.path.join(BASE_DIR,'media', 'Gaurav_Data')
sys.path.append(BASE_DIR_NEW)


catchment_zip = os.path.join(BASE_DIR_NEW,  'shape_file','Catchments', 'Catchment.zip')
stretch_zip = os.path.join(BASE_DIR_NEW,  'shape_file', 'Stretches', 'Stretches.zip')
drain_zip = os.path.join(BASE_DIR_NEW,  'shape_file','Drains', 'Drain.zip')
water_Availability = os.path.join(BASE_DIR_NEW,  "csv_file_water", "all_seasonal_rasters_combined.csv")

csv_files_new = [
    water_Availability
]

visual_raster=Geoserver()
try:
    create_workspace("vector_files")
    create_workspace("water_Availability")
    create_vector_stores("vector_files","vector_store")
    upload_shapefile("vector_files","vector_store",stretch_zip,"Stretches")
    upload_shapefile("vector_files","vector_store",drain_zip,"Drain")
    upload_shapefile("vector_files","vector_store",catchment_zip,"Catchment")

    all_layers = pd.concat(
    (
        pd.read_csv(f)[["layer_name", "file_path", "sld_path"]]
        .assign(
            file_path=lambda df: df["file_path"].apply(lambda x: os.path.join(BASE_DIR, x.lstrip("/"))),
            sld_path=lambda df: df["sld_path"].apply(lambda x: os.path.join(BASE_DIR, x.lstrip("/")))
        )
        for f in csv_files_new
    ),
    ignore_index=True
    )
    all_layers = all_layers.drop_duplicates(subset=["layer_name"], keep="first")
    for i in all_layers.iterrows():
        visual_raster.publish_raster(workspace_name="water_Availability", store_name=uuid.uuid4().hex, raster_path=i[1]["file_path"],layer_name=i[1]["layer_name"])
        visual_raster.apply_sld_to_layer(workspace_name="water_Availability", layer_name=i[1]["layer_name"], sld_content=i[1]["sld_path"], sld_name=uuid.uuid4().hex)

except Exception as e:
    print(e)
