import requests
from requests.auth import HTTPBasicAuth
from app.conf.settings import Settings
import os


setting=Settings()

geoserver_url = setting.GEOSERVER_URL
username = setting.GEOSERVER_USERNAME
password = setting.GEOSERVER_PASSWORD  
geoserver_extenal_url=setting.GEOSERVER_EX_URL

def geoserver_response(check_url:str):
    return requests.get(
            check_url,
            auth=HTTPBasicAuth(username, password)
        )

def geoserver_post(url:str,data:dict):
    headers = {"Content-type": "application/json"}
    return requests.post(
            url,
            auth=HTTPBasicAuth(username, password),
            json=data,
            headers=headers
        )

def geoserver_put(url:str,data:dict):
    headers = {"Content-type": "application/zip"}
    return requests.put(
        url,
        auth=HTTPBasicAuth(username, password),
        data=data,
        headers=headers
        )

def geoserver_put_service(url:str,data:dict):
    headers = {"Content-type": "application/json"}
    return requests.put(
        url,
        auth=HTTPBasicAuth(username, password),
        json=data,
        headers=headers
        )
def create_workspace(workspace_name):
    try:
        check_url = f"{geoserver_url}/rest/workspaces/{workspace_name}"
        check_response = geoserver_response(check_url)
        if check_response.status_code == 200:
            print(f"Workspace '{workspace_name}' already exists")
            return True

        workspace_url = f"{geoserver_url}/rest/workspaces"
        data = {"workspace": {"name": workspace_name}}

        response = geoserver_post(url=workspace_url,data=data)
        if response.status_code == 201:
            print("workspace is created successfully")
            wfs_url = f"{geoserver_url}/rest/services/wfs/workspaces/{workspace_name}/settings"
            wfs_data = {
                "wfs": {
                    "enabled": True,
                    "name": f"{workspace_name}_WFS",
                    "workspace": {"name": workspace_name}
                }
            }
            wfs_response = geoserver_put_service(url=wfs_url,data=wfs_data)
                
            if wfs_response.status_code in (200, 201):
                print(f"WFS service enabled for workspace '{workspace_name}'")
            else:
                print(f"Failed to enable WFS service. Status code: {wfs_response.status_code}")
                print(f"Response: {wfs_response.text}")
            
            wms_url = f"{geoserver_url}/rest/services/wms/workspaces/{workspace_name}/settings"
            headers = {"Content-type": "application/json"}
            wms_data = {
                "wms": {
                    "enabled": True,
                    "name": f"{workspace_name}_WMS",
                    "workspace": {"name": workspace_name}
                }
            }
                
            wms_response =  geoserver_put_service(url=wms_url,data=wms_data)
                
            if wms_response.status_code in (200, 201):
                print(f"WMS service enabled for workspace '{workspace_name}'")
            else:
                print(f"Failed to enable WMS service. Status code: {wms_response.status_code}")
                print(f"Response: {wms_response.text}")
            
            return True
        else:
            print("Failed to create workspace")
            return False
    except Exception as e:  
       print(e)
       return False

def create_vector_stores(workspace_name, store_name):
    check_url = f"{geoserver_url}/rest/workspaces/{workspace_name}/datastores/{store_name}"
    check_response = geoserver_response(check_url)
    
    if check_response.status_code == 200:
        print(f"Store '{store_name}' already exists in workspace '{workspace_name}'")
        return True
    
    create_shapefile_store(workspace_name,store_name,geoserver_url)

def create_shapefile_store(workspace_name, store_name, geoserver_url):
    store_url = f"{geoserver_url}/rest/workspaces/{workspace_name}/datastores"
    data = {
        "dataStore": {
            "name": store_name,
            "type": "Shapefile",
            "enabled": True,
            "connectionParameters": {
                    "url": "file:data",  
                    "charset": "UTF-8"
                }
        }
    }
    response = geoserver_post(url=store_url,data=data)
    
    if response.status_code == 201:
        print(f"Shapefile store '{store_name}' created successfully in workspace '{workspace_name}'")
        return True
    else:
        print(f"Failed to create shapefile store. Status code: {response.status_code}")
        print(f"Response: {response.text}")
        return False

def upload_shapefile(workspace_name, store_name, shapefile_path, layer_name):
    
    try:

        check_url = f"{geoserver_url}/rest/workspaces/{workspace_name}/datastores/{store_name}"    
        check_response =geoserver_response(check_url)
        if check_response.status_code != 200:
            print(f"Store '{store_name}' does not exist in workspace '{workspace_name}'")
            return False

        
        delete_url = f"{geoserver_url}/rest/workspaces/{workspace_name}/datastores/{store_name}/featuretypes/{layer_name}?recurse=true"
        delete_response = requests.delete(
            delete_url,
            auth=HTTPBasicAuth(username, password)
        )
        if delete_response.status_code == 200:
            print(f"Existing layer '{layer_name}' deleted for overwrite")

        # Use configure=all to auto-publish the feature type
        upload_url = f"{geoserver_url}/rest/workspaces/{workspace_name}/datastores/{store_name}/file.shp?configure=all"
        if layer_name:
            upload_url += f"&name={layer_name}"

        with open(shapefile_path, 'rb') as f:
            data = f.read() 
        response = geoserver_put(url=upload_url,data=data)
        
        if response.status_code in (200, 201):
            print(f"Shapefile uploaded and published as layer '{layer_name}'")
            return True
        else:
            print(f"Failed to upload shapefile. Status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error uploading shapefile: {str(e)}")
        return False