// Leaflet map initialization and configuration

/**
 * Initialize Leaflet library with proper icon configuration
 */
export function initializeLeaflet() {
  if (typeof window === 'undefined') return null;
  
  const L = require('leaflet');
  require('leaflet-draw');
  
  // Fix default icon paths
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
  
  return L;
}

/**
 * Create base layer configurations
 */
export function createBaseLayers(L: any) {
  return {
    streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }),
    satellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps',
      maxZoom: 20,
    }),
    terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap',
      maxZoom: 17,
    }),
    traffic: L.tileLayer('https://{s}.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Traffic',
      maxZoom: 20,
    }),
    hybrid: L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 19,
      }),
      L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.png', {
        attribution: 'Labels by Stamen',
        subdomains: 'abcd',
        maxZoom: 20,
        opacity: 0.7,
      }),
    ]),
    none: L.tileLayer('', { attribution: 'No basemap' }),
  };
}

/**
 * Get default style configuration for GeoJSON layers
 */
export function getDefaultLayerStyle() {
  const lineColorElement = document.getElementById('lineColor') as HTMLInputElement | null;
  const weightElement = document.getElementById('weight') as HTMLInputElement | null;
  const fillColorElement = document.getElementById('fillColor') as HTMLInputElement | null;
  const opacityElement = document.getElementById('opacity') as HTMLInputElement | null;

  return {
    lineColor: lineColorElement?.value || 'red',
    weight: parseInt(weightElement?.value || '2', 10),
    fillColor: fillColorElement?.value || '#78b4db',
    opacity: parseFloat(opacityElement?.value || '0.1'),
  };
}