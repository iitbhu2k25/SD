import { GeoJSONResponse, APIEndpoint } from './type';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Helper function to extract URL string from imports
export const getImageUrl = (image: any): string => {
  return typeof image === 'string' ? image : image.src || image.default || image;
};

// Function to validate GeoJSON
export const isValidGeoJSON = (data: any): data is GeoJSONResponse => {
  return (
    data &&
    typeof data === 'object' &&
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features) &&
    data.features.every(
      (feature: any) =>
        feature.type === 'Feature' &&
        feature.geometry &&
        ['Point', 'LineString', 'Polygon', 'MultiLineString', 'MultiPolygon'].includes(feature.geometry.type)
    )
  );
};

// Function to transform data into GeoJSON
export const transformToGeoJSON = (data: any, endpoint: APIEndpoint): GeoJSONResponse | null => {
  if (endpoint === 'flowpath_api') {
    if (data && data.rivers && isValidGeoJSON(data.rivers)) {
      return data.rivers;
    }
    return null;
  }
  if (isValidGeoJSON(data)) {
    return data;
  }
  // Handle single Feature
  if (data && data.type === 'Feature' && data.geometry) {
    return {
      type: 'FeatureCollection',
      features: [data]
    };
  }
  // Handle raw geometry
  if (data && data.type && ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(data.type)) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: data,
          properties: {} as any
        }
      ]
    };
  }
  return null;
};

// Function to fetch data from an API endpoint via proxy
export const fetchData = async (endpoint: APIEndpoint, lat: number, lng: number) => {
  const url = `/api/watershed?endpoint=${endpoint}&lat=${lat}&lng=${lng}&precision=high`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Bad request: Check your latitude and longitude values.');
      } else if (response.status === 404) {
        throw new Error('Could not process: The point may be over ocean or invalid terrain.');
      } else if (response.status === 500) {
        throw new Error('Server error: Please try again later.');
      } else {
        throw new Error(`Error: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log(`API response for ${endpoint}:`, data);

    // Validate or transform the data
    const validData = transformToGeoJSON(data, endpoint);
    if (!validData) {
      throw new Error('Invalid GeoJSON response from API');
    }

    return { data: validData, message: data.message };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('An unknown error occurred');
  }
};

// Function to fetch India base map from GeoServer
export const fetchIndiaBaseMap = async (): Promise<GeoJSONResponse | null> => {
  try {
    const WFS_URL = '/geoserver/api/dss_vector/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=dss_vector:India&outputFormat=application/json';
    
    const response = await fetch(WFS_URL, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch base map from GeoServer: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('India base map data from GeoServer:', data);
    
    // Validate and return the base map data
    if (isValidGeoJSON(data)) {
      return data;
    } else {
      console.log('Invalid GeoJSON data received from GeoServer');
      return null;
    }
  } catch (error) {
    console.log('Error fetching India base map from GeoServer:', error);
    return null;
  }
};

// Export map as PNG
export const exportMapAsPNG = async (mapElement: HTMLElement, filename: string = 'watershed-map.png') => {
  try {
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (element) => {
        // Ignore elements that might cause issues
        return element.classList?.contains('leaflet-control-attribution') || false;
      },
      onclone: (clonedDoc) => {
        // Remove any problematic styles from cloned document
        const elements = clonedDoc.querySelectorAll('*');
        elements.forEach((el: any) => {
          if (el.style) {
            // Remove lab() color functions that html2canvas can't parse
            const bgColor = el.style.backgroundColor;
            const color = el.style.color;
            if (bgColor && bgColor.includes('lab(')) {
              el.style.backgroundColor = '';
            }
            if (color && color.includes('lab(')) {
              el.style.color = '';
            }
          }
        });
      }
    });
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error exporting map as PNG:', error);
    throw new Error('Failed to export map as PNG');
  }
};

// Export map as PDF
export const exportMapAsPDF = async (mapElement: HTMLElement, filename: string = 'watershed-map.pdf') => {
  try {
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (element) => {
        return element.classList?.contains('leaflet-control-attribution') || false;
      },
      onclone: (clonedDoc) => {
        const elements = clonedDoc.querySelectorAll('*');
        elements.forEach((el: any) => {
          if (el.style) {
            const bgColor = el.style.backgroundColor;
            const color = el.style.color;
            if (bgColor && bgColor.includes('lab(')) {
              el.style.backgroundColor = '';
            }
            if (color && color.includes('lab(')) {
              el.style.color = '';
            }
          }
        });
      }
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting map as PDF:', error);
    throw new Error('Failed to export map as PDF');
  }
};

// Export GeoJSON data
export const exportGeoJSON = (data: GeoJSONResponse, filename: string = 'watershed-data.geojson') => {
  try {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting GeoJSON:', error);
    throw new Error('Failed to export GeoJSON');
  }
};

// Get user's current location
export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        reject(new Error('Unable to retrieve your location'));
      }
    );
  });
};

// Format coordinate display
export const formatCoordinate = (value: number, type: 'lat' | 'lng'): string => {
  const direction = type === 'lat' 
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'W');
  return `${Math.abs(value).toFixed(5)}° ${direction}`;
};