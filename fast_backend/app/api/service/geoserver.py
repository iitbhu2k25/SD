import requests
from requests.auth import HTTPBasicAuth
import os
from app.conf.settings import Settings
import rasterio
import numpy as np
import colorsys
from xml.dom import minidom
from xml.etree import ElementTree as ET
from datetime import datetime
from app.utils.network_conf import GeoConfig
import time

input_path=f"{Settings().BASE_DIR}"+"/temp/input"
output_path=f"{Settings().BASE_DIR}"+"/temp/output"
raster_workspace="vector_work"
raster_store="stp_raster_store"


class Geoserver:
    def __init__(self, config: GeoConfig =GeoConfig()):

        self.geoserver_url = config.geoserver_url
        self.username = config.username
        self.password = config.password
        self.geoserver_external_url = config.geoserver_external_url  # Corrected the typo
        self.wcs_url = f"{self.geoserver_url}/wcs"
        self.wms_url = f"{self.geoserver_url}/wms"
        self.wfs_url = f"{self.geoserver_url}/wfs"
        self.temp_dir = config.output_path

    def raster_download(self,temp_path,layer_name):
        geoserver_wcs_url = (f"{self.wcs_url}"
                    f"?service=WCS"
                    f"&version=2.0.1"
                    f"&request=GetCoverage"
                    f"&coverageId=raster_work:{layer_name}"
                    f"&format=image/geotiff"
                )

        r = requests.get(geoserver_wcs_url
                    , auth=HTTPBasicAuth(self.username, self.password),cookies={})
        name_part = "_".join(layer_name.split("_")[:-1])
        filename = name_part + ".tif"
        file_path = os.path.join(temp_path, filename)
            
        if r.status_code == 200:
            with open(file_path, "wb") as f:
                f.write(r.content)

        sld_url = f"{self.geoserver_url}/rest/workspaces/raster_work/styles/{layer_name}"
        sld_response = requests.get(sld_url, auth=HTTPBasicAuth(self.username, self.password),headers={"Accept": "application/vnd.ogc.sld+xml"})
        print("sld resp",sld_response)
        if sld_response.status_code == 200:
            name_part = "_".join(layer_name.split("_")[:-1])
            sld_file_path = os.path.join(temp_path, name_part + ".sld")
            with open(sld_file_path, "wb") as f:
                f.write(sld_response.content)

        return {
            "raster_path": file_path,
            "sld_path": sld_file_path
        }
            
            
    def apply_sld_to_layer(self,workspace_name, layer_name, sld_content, sld_name=None):
        if sld_name is None:
            sld_name = layer_name+datetime.now().strftime("%Y%m%d%H%M%S")

        new_sld_content=""
        with open(sld_content, "r") as f:
            new_sld_content = f.read()
        
        styles_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/styles"
        style_data = {
            "style": {
                "name": sld_name,
                "filename": f"{sld_name}.sld"
            }
        }
        
        style_url = f"{styles_url}/{sld_name}"
        check_response = requests.get(
            style_url,
            auth=HTTPBasicAuth(self.username, self.password)
        )
        
        if check_response.status_code != 200:
            # Style doesn't exist, create it
            print(f"Creating new style metadata: {sld_name}")
            create_response = requests.post(
                styles_url,
                json=style_data,
                auth=HTTPBasicAuth(self.username, self.password),
                headers={"Content-Type": "application/json"}
            )
            
            if create_response.status_code not in [200, 201]:
                print(f"Failed to create style metadata: {create_response.status_code}, {create_response.text}")
                return False
        
        # Now upload the SLD content 
        print(f"Uploading SLD content for style: {sld_name}")
        upload_response = requests.put(
            style_url,
            data=new_sld_content,
            auth=HTTPBasicAuth(self.username, self.password),
            headers={"Content-Type": "application/vnd.ogc.sld+xml"}
        )
        
        if upload_response.status_code not in [200, 201]:
            print(f"Failed to upload SLD content: {upload_response.status_code}, {upload_response.text}")
            return False
        
        print(f"Successfully uploaded SLD content")
        
        # Now apply the style to the layer
        layer_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/layers/{layer_name}"
        payload = {
        "layer": {
            "defaultStyle": {
                "name": sld_name
            }
        }
        }

        apply_response = requests.put(
            layer_url,
            json=payload,  # This will serialize the payload as JSON
            auth=HTTPBasicAuth(self.username, self.password),
            headers={"Content-Type": "application/json"}
        )
            
        if apply_response.status_code not in [200, 201]:
            print(f"Failed to apply style to layer: {apply_response.status_code}, {apply_response.text}")
            return False
        print(f"Successfully applied style to layer")
        return True
  
    
    def publish_raster(self, workspace_name, store_name, raster_path,layer_name=None):
        try:
            if layer_name is None:
                layer_name = os.path.splitext(os.path.basename(raster_path))[0]
            layer_name=layer_name.replace(" ","_")

            content_type = "image/tiff"
            store_type = "GeoTIFF"
            api_extension = "file.geotiff"
            
            # Check if workspace exists, create if not
            check_workspace_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}"
            check_workspace_response = requests.get(
                check_workspace_url,
                auth=HTTPBasicAuth(self.username, self.password)
            )
            
            if check_workspace_response.status_code != 200:
                print(f"Workspace '{workspace_name}' does not exist. Creating it...")
                create_workspace_url = f"{self.geoserver_url}/rest/workspaces"
                create_workspace_data = {
                    "workspace": {
                        "name": workspace_name
                    }
                }
                
                create_workspace_response = requests.post(
                    create_workspace_url,
                    auth=HTTPBasicAuth(self.username, self.password),
                    json=create_workspace_data,
                    headers={"Content-type": "application/json"}
                )
                
                if create_workspace_response.status_code not in (200, 201):
                    print(f"Failed to create workspace. Status code: {create_workspace_response.status_code}")
                    print(f"Response: {create_workspace_response.text}")
                    return False
                
                print(f"Workspace '{workspace_name}' created successfully")

                # Ensure WMS service is enabled for the workspace
                wms_settings_url = f"{self.geoserver_url}/rest/services/wms/workspaces/{workspace_name}/settings"
                wms_settings_data = {
                    "wms": {
                        "enabled": True,
                        "name": f"{workspace_name}_wms"
                    }
                }
                
                wms_settings_response = requests.put(
                    wms_settings_url,
                    auth=HTTPBasicAuth(self.username, self.password),
                    json=wms_settings_data,
                    headers={"Content-type": "application/json"}
                )
                
                if wms_settings_response.status_code not in (200, 201):
                    print(f"Warning: Failed to enable WMS for workspace. Status code: {wms_settings_response.status_code}")
                    print(f"Response: {wms_settings_response.text}")

            # Check if coverage store exists
            check_store_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/coveragestores/{store_name}"    
            check_store_response = requests.get(
                check_store_url,
                auth=HTTPBasicAuth(self.username, self.password)
            )
            
            # If store exists, delete it completely to avoid duplicates
            if check_store_response.status_code == 200:
                print(f"Coverage store '{store_name}' exists. Deleting it to avoid duplicates...")
                delete_store_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/coveragestores/{store_name}?recurse=true"
                delete_store_response = requests.delete(
                    delete_store_url,
                    auth=HTTPBasicAuth(self.username, self.password)
                )
                
                if delete_store_response.status_code == 200:
                    print(f"Existing coverage store '{store_name}' deleted successfully")
                else:
                    print(f"Warning: Failed to delete existing store. Status code: {delete_store_response.status_code}")

            # Create new coverage store
            print(f"Creating new coverage store '{store_name}' in workspace '{workspace_name}'...")
            create_store_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/coveragestores"
            create_store_data = {
                "coverageStore": {
                    "name": store_name,
                    "type": store_type,
                    "enabled": True,
                    "workspace": {
                        "name": workspace_name
                    }
                }
            }
            
            create_response = requests.post(
                create_store_url,
                auth=HTTPBasicAuth(self.username, self.password),
                json=create_store_data,
                headers={"Content-type": "application/json"}
            )
            
            if create_response.status_code not in (200, 201):
                print(f"Failed to create coverage store. Status code: {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return False
                
            print(f"Coverage store '{store_name}' created successfully")

            # Upload raster file with configure=first to avoid auto-creation of duplicate coverages
            upload_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/coveragestores/{store_name}/{api_extension}?configure=first"
            
            headers = {"Content-type": content_type}
            with open(raster_path, 'rb') as f:
                data = f.read()
            
            print("Data size:", len(data))
            print(f"Uploading raster to store '{store_name}'...")
            
            response = requests.put(
                upload_url,
                auth=HTTPBasicAuth(self.username, self.password),
                data=data,
                headers=headers
            )
            
            if response.status_code in (200, 201):
                print(f"Raster file uploaded successfully to store '{store_name}'")
                
                # Now create the coverage/layer explicitly
                configure_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/coveragestores/{store_name}/coverages"
                
                coverage_data = {
                    "coverage": {
                        "name": layer_name,
                        "title": layer_name,
                        "enabled": True,
                        "metadata": {
                            "entry": [
                                {
                                    "@key": "wms.published",
                                    "$": "true"
                                }
                            ]
                        }
                    }
                }
                
                configure_response = requests.post(
                    configure_url,
                    auth=HTTPBasicAuth(self.username, self.password),
                    json=coverage_data,
                    headers={"Content-type": "application/json"}
                )
                
                if configure_response.status_code in (200, 201):
                    print(f"Coverage layer '{layer_name}' created and configured successfully")
                else:
                    print(f"Warning: Failed to create coverage layer. Status code: {configure_response.status_code}")
                    print(f"Response: {configure_response.text}")
                    
                    # Try to get automatically created coverage if manual creation failed
                    auto_coverage_url = f"{self.geoserver_url}/rest/workspaces/{workspace_name}/coveragestores/{store_name}/coverages"
                    auto_coverage_response = requests.get(
                        auto_coverage_url,
                        auth=HTTPBasicAuth(self.username, self.password)
                    )
                    
                    if auto_coverage_response.status_code == 200:
                        coverages = auto_coverage_response.json()
                        if 'coverage' in coverages or 'coverages' in coverages:
                            print(f"Found automatically created coverage in store '{store_name}'")
                
                # Verify the layer exists and is accessible
                verify_url = f"{self.geoserver_url}/rest/layers/{workspace_name}:{layer_name}"
                verify_response = requests.get(
                    verify_url,
                    auth=HTTPBasicAuth(self.username, self.password)
                )
                
                if verify_response.status_code == 200:
                    print(f"Layer '{layer_name}' has been published and is available via WMS")
                    
                    # Output WMS endpoint info
                    wms_url = f"{self.geoserver_url}/wms?service=WMS&version=1.1.0&request=GetMap&layers={workspace_name}:{layer_name}"
                    print(f"WMS endpoint: {wms_url}")
                    
                    return True, layer_name
                else:
                    print(f"Warning: Could not verify layer configuration: {verify_response.status_code}")
                    return True, layer_name  # Upload was successful even if verification failed
                    
            else:
                print(f"Failed to upload raster file. Status code: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"Error uploading raster file: {str(e)}")
            return False