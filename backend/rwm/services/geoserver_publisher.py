"""
GeoServer Publisher Service
Publishes validated shapefiles to GeoServer via REST API

Responsibilities:
- Create workspace if needed
- Create datastore for shapefile
- Publish layer
- Return WMS URL for frontend consumption
"""

import os
import requests
from pathlib import Path
from typing import Optional
from dataclasses import dataclass


@dataclass
class PublishResult:
    """Result of GeoServer publishing"""
    success: bool
    layer_name: Optional[str] = None
    wms_url: Optional[str] = None
    wfs_url: Optional[str] = None
    error_message: Optional[str] = None


class GeoServerPublisher:
    """
    Publishes shapefiles to GeoServer via REST API.
    
    Usage:
        publisher = GeoServerPublisher(
            geoserver_url="http://localhost:9090/geoserver",
            workspace="river_general"
        )
        result = publisher.publish(zip_path, layer_name="my_buffer")
        if result.success:
            # Use result.wms_url in frontend
    """
    
    def __init__(
        self,
        geoserver_url: str = None,
        workspace: str = "river_general",
        username: str = None,
        password: str = None
    ):
        """
        Initialize publisher with GeoServer connection details.
        
        Args:
            geoserver_url: GeoServer base URL (default: from env or localhost:9090)
            workspace: GeoServer workspace name
            username: GeoServer admin username
            password: GeoServer admin password
        """
        self.geoserver_url = geoserver_url or os.getenv('GEOSERVER_URL', 'http://localhost:9090/geoserver')
        self.rest_url = f"{self.geoserver_url}/rest"
        self.workspace = workspace
        self.username = username or os.getenv('GEOSERVER_USER', 'admin')
        self.password = password or os.getenv('GEOSERVER_PASSWORD', 'geoserver')
        self.auth = (self.username, self.password)
    
    def publish(self, zip_path: Path, layer_name: str) -> PublishResult:
        """
        Publish a shapefile ZIP to GeoServer.
        
        Args:
            zip_path: Path to ZIP file containing shapefile
            layer_name: Name for the GeoServer layer/store
            
        Returns:
            PublishResult with WMS URL or error
        """
        zip_path = Path(zip_path)
        
        if not zip_path.exists():
            return PublishResult(
                success=False,
                error_message="ZIP file not found"
            )
        
        try:
            # Step 1: Ensure workspace exists
            workspace_result = self._create_workspace_if_needed()
            if not workspace_result:
                return PublishResult(
                    success=False,
                    error_message="Failed to create/verify workspace"
                )
            
            # Step 2: Upload shapefile and create datastore + layer
            upload_result = self._upload_shapefile(zip_path, layer_name)
            if not upload_result[0]:
                return PublishResult(
                    success=False,
                    error_message=upload_result[1]
                )
            
            # Step 3: Build URLs
            wms_url = self._build_wms_url(layer_name)
            wfs_url = self._build_wfs_url(layer_name)
            
            return PublishResult(
                success=True,
                layer_name=layer_name,
                wms_url=wms_url,
                wfs_url=wfs_url
            )
            
        except requests.RequestException as e:
            return PublishResult(
                success=False,
                error_message=f"GeoServer connection error: {str(e)}"
            )
        except Exception as e:
            return PublishResult(
                success=False,
                error_message=f"Publishing failed: {str(e)}"
            )
    
    def _create_workspace_if_needed(self) -> bool:
        """
        Create workspace if it doesn't exist.
        
        Returns:
            True if workspace exists or was created, False on error
        """
        url = f"{self.rest_url}/workspaces"
        headers = {"Content-Type": "application/xml"}
        data = f"<workspace><name>{self.workspace}</name></workspace>"
        
        response = requests.post(
            url,
            auth=self.auth,
            headers=headers,
            data=data
        )
        
        # 201 = created, 409 = already exists
        return response.status_code in [201, 409]
    
    def _upload_shapefile(self, zip_path: Path, store_name: str) -> tuple[bool, str]:
        """
        Upload shapefile ZIP and create datastore + layer.
        
        Returns:
            Tuple of (success, error_message)
        """
        url = f"{self.rest_url}/workspaces/{self.workspace}/datastores/{store_name}/file.shp"
        headers = {"Content-Type": "application/zip"}
        
        with open(zip_path, 'rb') as f:
            response = requests.put(
                url,
                auth=self.auth,
                headers=headers,
                data=f
            )
        
        if response.status_code in [201, 202]:
            return (True, "")
        else:
            return (False, f"GeoServer error {response.status_code}: {response.text}")
    
    def _build_wms_url(self, layer_name: str) -> str:
        """Build WMS URL for the published layer."""
        return (
            f"{self.geoserver_url}/wms?"
            f"service=WMS&version=1.1.1&request=GetMap"
            f"&layers={self.workspace}:{layer_name}"
            f"&format=image/png&transparent=true"
        )
    
    def _build_wfs_url(self, layer_name: str) -> str:
        """Build WFS URL for the published layer."""
        return (
            f"{self.geoserver_url}/wfs?"
            f"service=WFS&version=1.1.0&request=GetFeature"
            f"&typeName={self.workspace}:{layer_name}"
            f"&outputFormat=application/json"
        )
    
    def get_layer_info(self, layer_name: str) -> Optional[dict]:
        """
        Get information about a published layer.
        
        Returns:
            Layer info dict or None if not found
        """
        url = f"{self.rest_url}/workspaces/{self.workspace}/layers/{layer_name}.json"
        
        response = requests.get(url, auth=self.auth)
        
        if response.status_code == 200:
            return response.json()
        return None
    
    def delete_layer(self, layer_name: str) -> bool:
        """
        Delete a layer and its datastore.
        
        Returns:
            True if deleted successfully
        """
        # Delete layer
        layer_url = f"{self.rest_url}/workspaces/{self.workspace}/layers/{layer_name}"
        requests.delete(layer_url, auth=self.auth)
        
        # Delete datastore
        store_url = f"{self.rest_url}/workspaces/{self.workspace}/datastores/{layer_name}?recurse=true"
        response = requests.delete(store_url, auth=self.auth)
        
        return response.status_code in [200, 404]  # 404 = already deleted
    
    def check_connection(self) -> bool:
        """
        Test connection to GeoServer.
        
        Returns:
            True if GeoServer is reachable and credentials are valid
        """
        try:
            url = f"{self.rest_url}/about/version.json"
            response = requests.get(url, auth=self.auth, timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False
