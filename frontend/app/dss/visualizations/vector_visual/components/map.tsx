// import ExportModal from '../components/export';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Global type declarations
declare global {
  interface Window {
    toggleBufferTool?: () => void;
    changeBasemap?: (basemapId: string) => void;
    loadGeoJSON?: (category: string, subcategory: string) => Promise<any | null>;
    updateMapStyles?: () => void;
  }
}

interface MapProps {
  sidebarCollapsed: boolean;
  onFeatureClick: (feature: any, layer: any) => void;
  currentLayer: any;
  activeFeature: any;
  compassVisible: boolean;
  gridVisible: boolean;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

// Simple Export Modal Component
const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  mapInstanceRef: React.RefObject<any>;
  drawnItemsRef: React.RefObject<any>;
  geoJsonLayer: any;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ isOpen, onClose, mapInstanceRef, drawnItemsRef, geoJsonLayer, showNotification }) => {
  const [exportFormat, setExportFormat] = useState('geojson');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.log('Download error:', error);
      showNotification('Error', 'Failed to download file', 'error');
    }
  };

  const handleExport = () => {
    if (!mapInstanceRef.current) {
      showNotification('Error', 'Map not initialized', 'error');
      return;
    }

    setExporting(true);

    try {
      const features: any[] = [];

      // Add drawn items
      if (drawnItemsRef.current) {
        drawnItemsRef.current.eachLayer((layer: any) => {
          if (layer.toGeoJSON) {
            const feature = layer.toGeoJSON();
            if (feature) features.push(feature);
          }
        });
      }

      // Add loaded GeoJSON data
      if (geoJsonLayer) {
        geoJsonLayer.eachLayer((layer: any) => {
          if (layer.toGeoJSON) {
            const feature = layer.toGeoJSON();
            if (feature) features.push(feature);
          }
        });
      }

      if (features.length === 0) {
        showNotification('Warning', 'No data to export', 'info');
        return;
      }

      const geoJsonObject = {
        type: 'FeatureCollection',
        features: features,
      };

      const content = JSON.stringify(geoJsonObject, null, 2);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      downloadFile(content, `export_${timestamp}.geojson`, 'application/json');
      
      showNotification('Success', 'Data exported successfully', 'success');
    } catch (error) {
      console.log('Export error:', error);
      showNotification('Error', 'Export failed', 'error');
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 w-80 mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Export Data</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Format</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={exporting}
          >
            <option value="geojson">GeoJSON</option>
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            disabled={exporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Map({
  sidebarCollapsed,
  onFeatureClick,
  currentLayer,
  activeFeature,
  compassVisible,
  gridVisible,
  showNotification,
}: MapProps) {
  // State
  const [geoJsonLayer, setGeoJsonLayer] = useState<any>(null);
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [bufferDistance, setBufferDistance] = useState(100);
  const [bufferToolVisible, setBufferToolVisible] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [currentBasemap, setCurrentBasemap] = useState('traffic');
  const [mapReady, setMapReady] = useState(false);

  // Refs
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const baseLayersRef = useRef<{ [key: string]: any }>({});
  const currentBaseLayerRef = useRef<any>(null);

  // Initialize Leaflet and fix icons
  const initializeLeaflet = useCallback(() => {
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
  }, []);

  // Create base layers
  const createBaseLayers = useCallback((L: any) => {
    return {
      streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }),
      satellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
        maxZoom: 20,
      }),
      terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17,
      }),
      traffic: L.tileLayer('https://{s}.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://www.google.com/maps">Google Traffic</a>',
        maxZoom: 20,
      }),
      hybrid: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19,
        }),
        L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.png', {
          attribution: 'Labels by <a href="http://stamen.com">Stamen Design</a>',
          subdomains: 'abcd',
          maxZoom: 20,
          opacity: 0.7,
        }),
      ]),
      none: L.tileLayer('', { attribution: 'No basemap' }),
    };
  }, []);

  // Initialize map - MAIN INITIALIZATION
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const L = initializeLeaflet();
    if (!L) return;

    // Add a small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      try {
        // Double-check the ref is still valid
        if (!mapRef.current) {
          console.warn('Map ref lost during initialization delay');
          return;
        }

        // Ensure the container has dimensions
        const container = mapRef.current;
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          console.warn('Map container has no dimensions, retrying...');
          // Retry after another delay
          setTimeout(() => {
            if (mapRef.current && !mapInstanceRef.current) {
              initMap();
            }
          }, 500);
          return;
        }

        initMap();
      } catch (error) {
        console.log('Map initialization error:', error);
        showNotification('Error', 'Failed to initialize map', 'error');
      }
    }, 100);

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Create map instance with SVG renderer (more stable than Canvas)
      const map = L.map(mapRef.current, {
        center: [22.3511, 78.6677],
        zoom: 5,
        zoomControl: false,
        preferCanvas: false,
        renderer: L.svg({ padding: 0.1 }),
      });

      mapInstanceRef.current = map;

      // Create and store base layers
      const baseLayers = createBaseLayers(L);
      baseLayersRef.current = baseLayers;

      // Add default base layer
     const defaultLayer = baseLayers[currentBasemap as keyof typeof baseLayers];
      if (defaultLayer) {
        defaultLayer.addTo(map);
        currentBaseLayerRef.current = defaultLayer;
      }

      // Add scale control
      L.control.scale({
        imperial: false,
        position: 'bottomleft',
      }).addTo(map);

      // Initialize drawing tools
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      // Create draw control
      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polyline: { shapeOptions: { color: 'red', weight: 3 } },
          polygon: { 
            allowIntersection: false,
            drawError: { color: 'red', timeout: 1000 },
            shapeOptions: { color: 'red' }
          },
          circle: { shapeOptions: { color: 'red' } },
          marker: true,
          rectangle: { shapeOptions: { color: 'red' } },
        },
        edit: {
          featureGroup: drawnItems,
          remove: true
        },
      });

      map.addControl(drawControl);

      // Event handlers with error handling
      map.on('mousemove', (e: any) => {
        try {
          setCoordinates({
            lat: parseFloat(e.latlng.lat.toFixed(5)),
            lng: parseFloat(e.latlng.lng.toFixed(5)),
          });
        } catch (error) {
          console.warn('Mouse move event error:', error);
        }
      });

      map.on(L.Draw.Event.CREATED, (event: any) => {
        try {
          const layer = event.layer;
          drawnItems.addLayer(layer);
          
          // Mark as selected for buffer operations
          drawnItems.eachLayer((l: any) => { l._selected = false; });
          layer._selected = true;

          // Calculate area for polygons
          if (layer instanceof L.Polygon) {
            const latlngs = layer.getLatLngs()[0];
            let area = 0;
            for (let i = 0; i < latlngs.length; i++) {
              const j = (i + 1) % latlngs.length;
              area += latlngs[i].lng * latlngs[j].lat;
              area -= latlngs[j].lng * latlngs[i].lat;
            }
            area = Math.abs(area) * 0.5 * 111.32 * 111.32;
            layer.bindPopup(`<strong>Area:</strong> ${area.toFixed(2)} sq km`).openPopup();
          }
        } catch (error) {
          console.log('Draw event error:', error);
        }
      });

      // Add error handler for renderer issues
      map.on('error', (e: any) => {
        console.log('Map error:', e);
      });

      // Resize handler
      const handleResize = () => {
        if (mapInstanceRef.current) {
          try {
            setTimeout(() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize();
              }
            }, 100);
          } catch (error) {
            console.warn('Resize error:', error);
          }
        }
      };

      window.addEventListener('resize', handleResize);

      // Mark map as ready
      setMapReady(true);

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize);
        setMapReady(false);
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch (error) {
            console.warn('Map cleanup error:', error);
          }
          mapInstanceRef.current = null;
        }
      };
    };

    // Cleanup timer on unmount
    return () => {
      clearTimeout(initTimer);
    };
  }, [initializeLeaflet, createBaseLayers, currentBasemap, showNotification]);

  // Change basemap function
  const changeBasemap = useCallback((basemapId: string) => {
    if (!mapInstanceRef.current || !baseLayersRef.current) {
      console.warn('Map or base layers not ready for basemap change');
      return;
    }

    try {
      // Remove current base layer
      if (currentBaseLayerRef.current && mapInstanceRef.current.hasLayer(currentBaseLayerRef.current)) {
        mapInstanceRef.current.removeLayer(currentBaseLayerRef.current);
      }

      // Add new base layer (if not 'none')
      if (basemapId !== 'none' && baseLayersRef.current[basemapId]) {
        const newLayer = baseLayersRef.current[basemapId];
        
        // Check if the layer is valid before adding
        if (newLayer && typeof newLayer.addTo === 'function') {
          newLayer.addTo(mapInstanceRef.current);
          currentBaseLayerRef.current = newLayer;
          
          // Force tile refresh with error handling
          setTimeout(() => {
            try {
              if (newLayer.redraw && typeof newLayer.redraw === 'function') {
                newLayer.redraw();
              }
              if (mapInstanceRef.current && typeof mapInstanceRef.current.invalidateSize === 'function') {
                mapInstanceRef.current.invalidateSize();
              }
            } catch (refreshError) {
              console.warn('Error during tile refresh:', refreshError);
            }
          }, 100);
        } else {
          console.warn('Invalid layer for basemap:', basemapId);
          currentBaseLayerRef.current = null;
        }
      } else {
        currentBaseLayerRef.current = null;
      }

      setCurrentBasemap(basemapId);
      
      const basemapName = basemapId.charAt(0).toUpperCase() + basemapId.slice(1);
      showNotification('Basemap Changed', `Switched to ${basemapName} basemap`, 'info');
      
    } catch (error) {
      console.log('Error changing basemap:', error);
      showNotification('Error', 'Failed to change basemap', 'error');
    }
  }, [showNotification]);

  // Load GeoJSON function
  const loadGeoJSON = useCallback(async (category: string, subcategory: string) => {
    // Wait for map to be initialized
    const waitForMap = () => {
      return new Promise<void>((resolve, reject) => {
        const checkMap = () => {
          if (mapInstanceRef.current) {
            resolve();
          } else {
            setTimeout(checkMap, 100);
          }
        };
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Map initialization timeout'));
        }, 10000);
        
        checkMap();
      });
    };

    try {
      setLoading(true);
      
      // Wait for map to be ready
      await waitForMap();
      
      if (!mapInstanceRef.current) {
        throw new Error("Map not initialized after waiting");
      }

      const response = await fetch(
        `/basics/get_shapefile?category=${category}&subcategory=${subcategory}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const geoJsonData = await response.json();

      if (!geoJsonData.features || geoJsonData.features.length === 0) {
        throw new Error("No feature data received");
      }

      const L = require('leaflet');

      // Remove previous GeoJSON layer
      if (geoJsonLayer && mapInstanceRef.current.hasLayer(geoJsonLayer)) {
        mapInstanceRef.current.removeLayer(geoJsonLayer);
      }

      // Get style values
      const lineColorElement = document.getElementById('lineColor') as HTMLInputElement;
      const weightElement = document.getElementById('weight') as HTMLInputElement;
      const fillColorElement = document.getElementById('fillColor') as HTMLInputElement;
      const opacityElement = document.getElementById('opacity') as HTMLInputElement;
      
      const lineColor = lineColorElement?.value || 'red';
      const weight = parseInt(weightElement?.value || '2');
      const fillColor = fillColorElement?.value || '#78b4db';
      const opacity = parseFloat(opacityElement?.value || '0.1');

      // Create new GeoJSON layer
      const newLayer = L.geoJSON(geoJsonData, {
        style: () => ({
          color: lineColor,
          weight: weight,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: opacity
        }),
        onEachFeature: (feature: any, layer: any) => {
          layer.on('click', (e: any) => {
            if (onFeatureClick) {
              L.DomEvent.stop(e);
              onFeatureClick(feature, layer);
            }
          });
        }
      });

      // Verify map is still available before proceeding
      if (!mapInstanceRef.current) {
        throw new Error("Map instance lost during processing");
      }

      // Add to map first
      newLayer.addTo(mapInstanceRef.current);
      
      // Then fit bounds
      const bounds = newLayer.getBounds();
      if (bounds && bounds.isValid() && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.fitBounds(bounds, { 
            padding: [20, 20],
            maxZoom: 16 // Prevent excessive zoom
          });
        } catch (boundsError) {
          console.warn('Could not fit bounds:', boundsError);
          // Fallback to manual center/zoom
          const center = bounds.getCenter();
          mapInstanceRef.current.setView([center.lat, center.lng], 10);
        }
      }

      setGeoJsonLayer(newLayer);
      showNotification('Success', 'Vector data loaded successfully', 'success');
      return newLayer;

    } catch (error) {
      console.log('Error loading GeoJSON:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Error', `Failed to load data: ${message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [geoJsonLayer, onFeatureClick, showNotification]);

  // Update layer styles
  const updateLayerStyles = useCallback(() => {
    if (!geoJsonLayer) return;

    const lineColor = (document.getElementById('lineColor') as HTMLInputElement)?.value || '#000000';
    const weight = parseInt((document.getElementById('weight') as HTMLInputElement)?.value || '2');
    const fillColor = (document.getElementById('fillColor') as HTMLInputElement)?.value || '#78b4db';
    const fillOpacity = parseFloat((document.getElementById('opacity') as HTMLInputElement)?.value || '0.1');

    geoJsonLayer.setStyle({
      color: lineColor,
      weight: weight,
      opacity: 1,
      fillColor: fillColor,
      fillOpacity: fillOpacity
    });
  }, [geoJsonLayer]);

  // Expose global functions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.changeBasemap = changeBasemap;
      window.loadGeoJSON = loadGeoJSON;
      window.updateMapStyles = updateLayerStyles;
      window.toggleBufferTool = () => setBufferToolVisible(prev => !prev);
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.changeBasemap;
        delete window.loadGeoJSON;
        delete window.updateMapStyles;
        delete window.toggleBufferTool;
      }
    };
  }, [changeBasemap, loadGeoJSON, updateLayerStyles]);

  // Handle sidebar collapse
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 300);
    }
  }, [sidebarCollapsed]);

  // Handle compass visibility
  useEffect(() => {
    const compass = document.getElementById('compass');
    if (compass) {
      compass.style.display = compassVisible ? 'flex' : 'none';
    }
  }, [compassVisible]);

  // Handle active feature highlighting
  useEffect(() => {
    if (!currentLayer || !activeFeature) return;
    
    const L = require('leaflet');
    
    // Reset all features
    currentLayer.eachLayer((layer: any) => {
      if (layer !== activeFeature) {
        if (layer instanceof L.Path) {
          currentLayer.resetStyle(layer);
        }
        if (layer instanceof L.Marker && layer._highlightCircle) {
          mapInstanceRef.current?.removeLayer(layer._highlightCircle);
          delete layer._highlightCircle;
        }
      }
    });

    // Highlight active feature
    if (activeFeature instanceof L.Marker) {
      if (activeFeature._highlightCircle) {
        mapInstanceRef.current?.removeLayer(activeFeature._highlightCircle);
      }
      
      const highlightCircle = L.circle(activeFeature.getLatLng(), {
        radius: 20,
        color: '#ff4444',
        weight: 3,
        opacity: 0.7,
        fillColor: '#ff4444',
        fillOpacity: 0.3,
      }).addTo(mapInstanceRef.current);
      
      activeFeature._highlightCircle = highlightCircle;
    } else if (activeFeature instanceof L.Path) {
      activeFeature.setStyle({
        weight: 3,
        color: '#ff4444',
        fillOpacity: 0.7,
      });
    }

    return () => {
      if (activeFeature instanceof L.Marker && activeFeature._highlightCircle) {
        mapInstanceRef.current?.removeLayer(activeFeature._highlightCircle);
        delete activeFeature._highlightCircle;
      }
    };
  }, [activeFeature, currentLayer]);

  // Control handlers
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleHomeClick = () => {
    mapInstanceRef.current?.setView([22.3511, 78.6677], 5);
    showNotification("Map Reset", "Returned to default view", "info");
  };

  const handleLocateClick = () => {
    if (!mapInstanceRef.current) return;
    
    showNotification("Location", "Finding your location...", "info");
    
    mapInstanceRef.current.locate({ setView: true, maxZoom: 16 })
      .on("locationfound", (e: any) => {
        const L = require('leaflet');
        L.circleMarker(e.latlng, {
          radius: 8,
          color: "red",
          weight: 3,
          opacity: 1,
          fillColor: "#3498db",
          fillOpacity: 0.4,
        }).addTo(mapInstanceRef.current);
        showNotification("Location Found", "Your location has been found", "success");
      })
      .on("locationerror", () => {
        showNotification("Location Error", "Could not find your location", "error");
      });
  };

  const handleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen?.();
    }
  };

  const createBuffer = () => {
    if (!mapInstanceRef.current || !drawnItemsRef.current) return;

    let selectedLayer: any = null;
    drawnItemsRef.current.eachLayer((layer: any) => {
      if (layer._selected) selectedLayer = layer;
    });

    if (!selectedLayer) {
      let lastLayer: any = null;
      drawnItemsRef.current.eachLayer((layer: any) => { lastLayer = layer; });
      selectedLayer = lastLayer;
    }

    if (!selectedLayer) {
      showNotification("Buffer Error", "Please draw a feature first", "error");
      return;
    }

    try {
      const L = require('leaflet');
      
      if (selectedLayer.getLatLng) {
        // Marker
        const circle = L.circle(selectedLayer.getLatLng(), {
          radius: bufferDistance,
          color: '#9c27b0',
          fillColor: '#9c27b0',
          fillOpacity: 0.2,
          weight: 2,
        });
        circle.addTo(drawnItemsRef.current);
        circle.bindPopup(`Buffer: ${bufferDistance}m`);
      }
      
      showNotification("Buffer Created", `${bufferDistance}m buffer created`, "success");
    } catch (error) {
      console.log("Buffer creation error:", error);
      showNotification("Buffer Error", "Failed to create buffer", "error");
    }
  };

 return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="absolute inset-0 w-full h-full rounded-lg shadow-inner z-0"
        style={{ 
          minHeight: '400px',
          minWidth: '300px',
          backgroundColor: '#f0f0f0' // Fallback background
        }}
      />
      
      {/* UI Controls */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Coordinates Display */}
        <div className="absolute top-215 left-40 bg-white/90 py-1 px-3 rounded-lg shadow-md backdrop-blur-sm text-sm pointer-events-auto">
          <span className="font-medium text-gray-700">
            Lat: {coordinates.lat} | Lng: {coordinates.lng}
          </span>
        </div>

        {/* Compass */}
        {compassVisible && (
          <div id="compass" className="absolute top-10 left-10 w-24 h-24 pointer-events-auto">
            <img 
              src="/compas.png" 
              alt="Compass" 
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
        )}

        {/* Buffer Tool */}
        {bufferToolVisible && (
          <div className="absolute top-32 right-4 bg-white rounded-xl shadow-md p-4 w-64 pointer-events-auto">
            <h3 className="font-medium mb-2">Buffer Tool</h3>
            <div className="mb-3">
              <label className="block text-sm mb-1">Distance (m)</label>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={bufferDistance}
                onChange={(e) => setBufferDistance(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-center text-sm font-medium text-blue-600">
                {bufferDistance}m
              </div>
            </div>
            <button
              onClick={createBuffer}
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Buffer
            </button>
          </div>
        )}

        {/* Map Controls */}
        <div className="absolute right-4 top-120 bg-white rounded-xl shadow-md flex flex-col p-1 pointer-events-auto">
          <button onClick={handleZoomIn} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Zoom In">
            <i className="fas fa-plus"></i>
          </button>
          <button onClick={handleZoomOut} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Zoom Out">
            <i className="fas fa-minus"></i>
          </button>
          <button onClick={handleHomeClick} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Home">
            <i className="fas fa-home"></i>
          </button>
          <button onClick={handleLocateClick} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Locate">
            <i className="fas fa-location-arrow"></i>
          </button>
          <button onClick={handleFullScreen} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Fullscreen">
            <i className="fas fa-expand"></i>
          </button>
          <button onClick={() => setBufferToolVisible(!bufferToolVisible)} className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors" title="Buffer Tool">
            <i className="fas fa-circle-notch"></i>
          </button>
        </div>

        {/* Export Modal */}
        <ExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          mapInstanceRef={mapInstanceRef}
          drawnItemsRef={drawnItemsRef}
          geoJsonLayer={geoJsonLayer}
          showNotification={showNotification}
        />

        {/* Loading - Centered and responsive */}
        {(loading || !mapReady) && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 py-3 px-4 sm:py-4 sm:px-6 rounded-lg shadow-md flex items-center pointer-events-auto max-w-[calc(100vw-2rem)]">
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2 sm:mr-3"></div>
            <span className="text-sm sm:text-base">{!mapReady ? 'Initializing map...' : 'Loading vector data...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}