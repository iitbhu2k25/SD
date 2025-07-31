import geopandas as gpd
import rasterio
import numpy as np
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterstats import zonal_stats

# --- Inputs ---
vector_path = r"D:\Downloads\Area_Python\Pindra_Village.shp"       # Path to your village shapefile
raster_path = r"D:\Downloads\Area_Python\Raster.tif"   # Path to your continuous raster
output_raster_path = r"D:\Downloads\Area_Python\zonal_mean.tif"  # Output raster path

# --- Load vector data ---
gdf = gpd.read_file(vector_path)

# --- Open raster ---
with rasterio.open(raster_path) as src:
    raster_data = src.read(1)
    raster_meta = src.meta.copy()
    raster_transform = src.transform
    raster_crs = src.crs
    raster_nodata = src.nodata

# --- Reproject vector to raster CRS if needed ---
if gdf.crs != raster_crs:
    gdf = gdf.to_crs(raster_crs)

# --- Compute zonal statistics (mean) ---
stats = zonal_stats(gdf, raster_path, stats=["mean"], nodata=raster_nodata)

# --- Add mean values back to the GeoDataFrame ---
gdf["mean_val"] = [item['mean'] for item in stats]

# --- Create raster where each pixel gets the mean value of its zone (village) ---
shapes = ((geom, value) for geom, value in zip(gdf.geometry, gdf["mean_val"]))
out_array = rasterize(
    shapes=shapes,
    out_shape=raster_data.shape,
    transform=raster_transform,
    fill=raster_nodata,
    dtype='float32'
)

# --- Update metadata and save output ---
raster_meta.update({
    "dtype": "float32",
    "nodata": raster_nodata
})

with rasterio.open(output_raster_path, "w", **raster_meta) as dest:
    dest.write(out_array, 1)