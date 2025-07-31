"""
🚀 FREE & OPEN SOURCE: TIFF → Satellite Image
Just provide .tif file path, get beautiful map image!

No servers, no setup, no complex configuration needed.
"""

import rasterio
import folium
from folium import raster_layers
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.colors import LinearSegmentedColormap
import io
import base64
from PIL import Image
import tempfile
import os
import webbrowser

# ==========================================
# METHOD 1: FOLIUM (Most Popular & Reliable)
# ==========================================

import folium
import rasterio
import numpy as np
import matplotlib.pyplot as plt
from rasterio.warp import transform_bounds
from PIL import Image
import os

def tiff_to_folium_map(tiff_path, output_html="map.html", colormap="RdYlGn_r", 
                      basemap="satellite", zoom_start=None, opacity=0.7):
    """
    🎯 EASIEST METHOD: Convert TIFF to interactive web map with satellite basemap
    
    Parameters:
    -----------
    tiff_path : str
        Path to your .tif file
    output_html : str  
        Output HTML file name
    colormap : str
        Color scheme: "RdYlGn_r", "viridis", "plasma", "coolwarm"
    basemap : str
        "satellite", "openstreetmap", "terrain"
    zoom_start : int
        Initial zoom level (auto-calculated if None)
    opacity : float
        Transparency (0.0 = invisible, 1.0 = opaque)
    
    Returns:
    --------
    str : Path to generated HTML file
    """
    
    print(f"🚀 Processing TIFF: {tiff_path}")
    
    with rasterio.open(tiff_path) as src:
        data = src.read(1, masked=True)  # Read as MaskedArray
        bounds = src.bounds
        print(f"📊 Bounds: {bounds}")
        
        # Convert center to EPSG:4326
        center_x = (bounds.left + bounds.right) / 2
        center_y = (bounds.top + bounds.bottom) / 2
        center_lonlat = transform_bounds(src.crs, "EPSG:4326", center_x, center_y, center_x, center_y)
        center = [center_lonlat[1], center_lonlat[0]]
        print(f"📍 Center: {center}")

        # Transform bounds to EPSG:4326
        latlon_bounds = transform_bounds(src.crs, "EPSG:4326", *bounds)
        img_bounds = [[latlon_bounds[1], latlon_bounds[0]], [latlon_bounds[3], latlon_bounds[2]]]

        # Zoom logic
        if zoom_start is None:
            lat_range = abs(latlon_bounds[3] - latlon_bounds[1])
            lon_range = abs(latlon_bounds[2] - latlon_bounds[0])
            max_range = max(lat_range, lon_range)
            if max_range > 10:
                zoom_start = 6
            elif max_range > 5:
                zoom_start = 8
            elif max_range > 1:
                zoom_start = 10
            elif max_range > 0.1:
                zoom_start = 12
            else:
                zoom_start = 14
        print(f"🔍 Zoom level: {zoom_start}")
        
        # Fill masked values
        data_filled = data.filled(np.nan)

        # Normalize and apply colormap
        min_val = np.nanmin(data_filled)
        max_val = np.nanmax(data_filled)
        norm_data = (data_filled - min_val) / (max_val - min_val)
        cmap = plt.get_cmap(colormap)
        rgba_img = cmap(norm_data)
        rgb_img = np.uint8(rgba_img[:, :, :3] * 255)  # Drop alpha

        # Save temporary PNG
        temp_png = tiff_path.replace(".tif", "_overlay.png")
        Image.fromarray(rgb_img).save(temp_png)

    # Create map
    basemap_tiles = {
        "satellite": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        "openstreetmap": "OpenStreetMap",
        "terrain": "Stamen Terrain"
    }

    if basemap == "satellite":
        m = folium.Map(location=center, zoom_start=zoom_start, tiles=None)
        folium.TileLayer(
            tiles=basemap_tiles["satellite"],
            attr="Esri WorldImagery",
            name="Satellite",
            overlay=False,
            control=True
        ).add_to(m)
    else:
        m = folium.Map(location=center, zoom_start=zoom_start, tiles=basemap_tiles.get(basemap, "OpenStreetMap"))
    
    # Add overlay
    folium.raster_layers.ImageOverlay(
        name="Raster Overlay",
        image=temp_png,
        bounds=img_bounds,
        opacity=opacity,
        interactive=True,
        cross_origin=False,
        zindex=1
    ).add_to(m)

    folium.LayerControl().add_to(m)
    m.save(output_html)
    print(f"✅ Interactive map saved: {output_html}")

    # Clean up temp PNG if needed
    if os.path.exists(temp_png):
        os.remove(temp_png)

    return output_html

def folium_to_png(html_file, png_output="map.png", width=1200, height=800):
    """
    Convert Folium HTML to PNG image
    Requires selenium + chromedriver
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        import time
        
        options = Options()
        options.add_argument("--headless")
        options.add_argument(f"--window-size={width},{height}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        driver = webdriver.Chrome(options=options)
        
        # Open HTML file
        html_path = os.path.abspath(html_file)
        driver.get(f"file://{html_path}")
        
        # Wait for map to load
        time.sleep(8)
        
        # Take screenshot
        driver.save_screenshot(png_output)
        driver.quit()
        
        print(f"✅ PNG image saved: {png_output}")
        return png_output
        
    except ImportError:
        print("⚠️ Selenium not installed. Install with: pip install selenium")
        return None
    except Exception as e:
        print(f"❌ Screenshot failed: {e}")
        return None

# ==========================================
# METHOD 2: LEAFMAP (GIS-focused)  
# ==========================================

def tiff_to_leafmap(tiff_path, output_html="leafmap.html", colormap="RdYlGn_r", 
                   basemap="SATELLITE", opacity=0.7):
    """
    🌿 LEAFMAP METHOD: Purpose-built for geospatial data
    
    Install: pip install leafmap
    """
    try:
        import leafmap
        
        print(f"🌿 Using Leafmap for: {tiff_path}")
        
        # Create map
        m = leafmap.Map(basemap=basemap)
        
        # Add raster
        m.add_raster(
            tiff_path, 
            colormap=colormap,
            layer_name="My Raster",
            opacity=opacity
        )
        
        # Zoom to raster extent
        m.zoom_to_gdf(tiff_path)
        
        # Save
        m.to_html(output_html)
        print(f"✅ Leafmap saved: {output_html}")
        
        return output_html
        
    except ImportError:
        print("⚠️ Leafmap not installed. Install with: pip install leafmap")
        return None

# ==========================================
# METHOD 3: HVPLOT (Interactive Visualization)
# ==========================================

def tiff_to_hvplot(tiff_path, output_html="hvplot_map.html", cmap="RdYlGn_r", 
                  tiles="EsriImagery", alpha=0.7, width=800, height=600):
    """
    📊 HVPLOT METHOD: Great for scientific visualization
    
    Install: pip install hvplot geoviews datashader
    """
    try:
        import xarray as xr
        import hvplot.xarray
        import geoviews as gv
        
        print(f"📊 Using HvPlot for: {tiff_path}")
        
        # Open with xarray
        da = xr.open_rasterio(tiff_path).squeeze()
        
        # Create interactive plot
        plot = da.hvplot.image(
            cmap=cmap,
            alpha=alpha,
            width=width,
            height=height,
            tiles=tiles,
            title="Raster on Satellite Basemap"
        )
        
        # Save to HTML
        import holoviews as hv
        hv.save(plot, output_html)
        print(f"✅ HvPlot saved: {output_html}")
        
        return output_html
        
    except ImportError:
        print("⚠️ HvPlot/Xarray not installed. Install with: pip install hvplot xarray geoviews")
        return None

# ==========================================
# METHOD 4: MATPLOTLIB + CONTEXTILY (Fixed Version)
# ==========================================

def tiff_to_matplotlib_fixed(tiff_path, output_png="matplotlib_map.png", 
                            cmap="RdYlGn_r", alpha=0.8, dpi=300, figsize=(15, 15)):
    """
    🎨 MATPLOTLIB METHOD: Fixed version of original approach
    """
    try:
        import contextily as ctx
        from rasterio.plot import show
        from rasterio.warp import calculate_default_transform, reproject, Resampling
        
        print(f"🎨 Using Matplotlib (fixed) for: {tiff_path}")
        
        with rasterio.open(tiff_path) as src:
            # Check if data needs reprojection
            if src.crs != 'EPSG:3857':
                print("🔄 Reprojecting to Web Mercator...")
                
                dst_crs = 'EPSG:3857'
                transform, width, height = calculate_default_transform(
                    src.crs, dst_crs, src.width, src.height, *src.bounds)
                
                # Reproject
                destination = np.empty((height, width), dtype=src.dtypes[0])
                reproject(
                    source=src.read(1),
                    destination=destination,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear
                )
                
                # Handle nodata
                if src.nodata is not None:
                    destination = np.ma.masked_equal(destination, src.nodata)
                
                # Get bounds in Web Mercator
                from rasterio.transform import array_bounds
                bounds = array_bounds(height, width, transform)
                
            else:
                destination = src.read(1)
                if src.nodata is not None:
                    destination = np.ma.masked_equal(destination, src.nodata)
                bounds = src.bounds
            
            # Create figure
            fig, ax = plt.subplots(figsize=figsize)
            
            # Add basemap FIRST
            try:
                ctx.add_basemap(ax, crs='EPSG:3857', source=ctx.providers.Esri.WorldImagery)
            except:
                print("⚠️ Basemap failed, using raster only")
            
            # Add raster ON TOP with proper extent
            im = ax.imshow(destination, 
                          extent=bounds,
                          cmap=cmap, 
                          alpha=alpha,
                          zorder=10)  # Ensure raster is on top
            
            # Style
            ax.set_title("Raster on Satellite Basemap", fontsize=16)
            plt.colorbar(im, ax=ax, shrink=0.8)
            
            # Save
            plt.savefig(output_png, dpi=dpi, bbox_inches='tight', 
                       facecolor='white', edgecolor='none')
            plt.close()
            
            print(f"✅ Matplotlib image saved: {output_png}")
            return output_png
            
    except ImportError:
        print("⚠️ Contextily not installed. Install with: pip install contextily")
        return None

# ==========================================
# METHOD 5: QGIS PYTHON (Most Professional)
# ==========================================

def qgis_instructions():
    """
    Print QGIS Desktop instructions (most reliable method)
    """
    instructions = """
🖥️ QGIS DESKTOP METHOD (Most Reliable):

1. 📥 Download QGIS: https://qgis.org/en/site/forusers/download.html
2. 🎯 Open QGIS Desktop
3. 📂 Add your TIFF: Layer → Add Layer → Add Raster Layer
4. 🎨 Style your raster:
   - Right-click layer → Properties → Symbology
   - Choose "Singleband pseudocolor"
   - Select colormap: "RdYlGn" (reversed for priority data)
   - Adjust transparency: 70-80%
5. 🌍 Add basemap:
   - Browser panel → XYZ Tiles → OpenStreetMap (drag to map)
   - Or install QuickMapServices plugin for satellite imagery
6. 📸 Export image:
   - Project → Import/Export → Export Map to Image
   - Choose resolution, format, extent
   - Click Save!

✅ QGIS gives you the highest quality results with full control!
    """
    print(instructions)

# ==========================================
# MAIN FUNCTION: ONE-CLICK SOLUTION
# ==========================================

def tiff_to_satellite_image(tiff_path, method="folium", output_name="my_map", 
                           colormap="RdYlGn_r", basemap="satellite", opacity=0.7):
    """
    🎯 ONE-CLICK SOLUTION: TIFF → Satellite Image
    
    Parameters:
    -----------
    tiff_path : str
        Path to your .tif file
    method : str
        "folium", "leafmap", "hvplot", "matplotlib", or "qgis_instructions"
    output_name : str
        Base name for output files
    colormap : str
        "RdYlGn_r" (red-green reversed), "viridis", "plasma", "coolwarm"
    basemap : str
        "satellite", "openstreetmap", "terrain"
    opacity : float
        Raster transparency (0.0-1.0)
    
    Returns:
    --------
    str : Path to generated file
    """
    
    print(f"🚀 Converting TIFF to satellite image...")
    print(f"📁 Input: {tiff_path}")
    print(f"🛠️ Method: {method}")
    print(f"🎨 Colormap: {colormap}")
    print(f"🌍 Basemap: {basemap}")
    
    if not os.path.exists(tiff_path):
        print(f"❌ File not found: {tiff_path}")
        return None
    
    try:
        if method == "folium":
            html_file = f"{output_name}_folium.html"
            result = tiff_to_folium_map(tiff_path, html_file, colormap, basemap, opacity=opacity)
            
            # Also try to create PNG
            png_file = f"{output_name}_folium.png"
            png_result = folium_to_png(html_file, png_file)
            
            return result
            
        elif method == "leafmap":
            html_file = f"{output_name}_leafmap.html"
            return tiff_to_leafmap(tiff_path, html_file, colormap, basemap.upper(), opacity)
            
        elif method == "hvplot":
            html_file = f"{output_name}_hvplot.html"
            tiles = "EsriImagery" if basemap == "satellite" else "OSM"
            return tiff_to_hvplot(tiff_path, html_file, colormap, tiles, opacity)
            
        elif method == "matplotlib":
            png_file = f"{output_name}_matplotlib.png"
            return tiff_to_matplotlib_fixed(tiff_path, png_file, colormap, opacity)
            
        elif method == "qgis_instructions":
            qgis_instructions()
            return "Instructions printed"
            
        else:
            print(f"❌ Unknown method: {method}")
            print("Available methods: folium, leafmap, hvplot, matplotlib, qgis_instructions")
            return None
            
    except Exception as e:
        print(f"❌ Error with {method}: {e}")
        return None

# ==========================================
# EXAMPLE USAGE
# ==========================================

if __name__ == "__main__":
    
    # 🎯 YOUR TIFF FILE PATH HERE
    tiff_file = "/path/to/your/raster.tif"  # CHANGE THIS!
    
    print("🚀 FREE & OPEN SOURCE TIFF → SATELLITE IMAGE")
    print("=" * 50)
    
    if not os.path.exists(tiff_file):
        print("📁 Please update 'tiff_file' variable with your actual TIFF path")
        print("\n💡 Available methods:")
        print("   1. folium      - Interactive web map (most popular)")
        print("   2. leafmap     - GIS-focused (best for geospatial)")  
        print("   3. hvplot      - Scientific visualization")
        print("   4. matplotlib  - Static image (fixed version)")
        print("   5. qgis        - Professional desktop GIS (most reliable)")
        
        # Show QGIS instructions as backup
        print("\n" + "="*50)
        qgis_instructions()
    else:
        # Try multiple methods
        methods_to_try = ["folium", "leafmap", "matplotlib"]
        
        for method in methods_to_try:
            print(f"\n🧪 Trying method: {method}")
            result = tiff_to_satellite_image(
                tiff_path=tiff_file,
                method=method,
                output_name="my_satellite_map",
                colormap="RdYlGn_r",  # Red-green colormap (good for priority data)
                basemap="satellite",
                opacity=0.75
            )
            
            if result:
                print(f"✅ Success with {method}!")
                if method == "folium":
                    print(f"📄 Open {result} in your browser to see the interactive map")
                break
        
        # Always show QGIS as most reliable option
        print("\n" + "="*30)
        print("🖥️ For best results, try QGIS Desktop:")  
        qgis_instructions()