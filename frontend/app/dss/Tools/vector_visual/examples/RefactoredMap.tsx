// // Example: Refactored Map Component
// // This shows how to use the modular utilities and components

// import React, { useEffect, useState, useRef, useCallback } from 'react';
// import 'leaflet/dist/leaflet.css';
// import 'leaflet-draw/dist/leaflet.draw.css';

// // Import types
// import { MapProps, Coordinates } from '../types/map.types';

// // Import constants
// import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, PDF_EXPORT_DEFAULTS } from '../constants/app.constants';

// // Import utilities
// import { 
//   initializeLeaflet, 
//   createBaseLayers, 
//   getDefaultLayerStyle 
// } from '../utils/leaflet.utils';
// import { exportMapToPDF } from '../utils/pdf.utils';
// import { collectMapGeoJSON } from '../utils/geojson.utils';
// import { downloadTextFile, waitForAllLayersReady } from '../utils/helpers';

// // Import hooks
// import { useManagedLayers, useNotification } from '../hooks/useMap';

// // Import services
// import { fetchGeoJSON, uploadShapefileToBackend } from '../services/api.service';

// // Import components
// import {
//   LayersPanel,
//   MapControls,
//   BufferTool,
//   ExportModal,
//   CoordinatesDisplay,
//   Compass,
//   LoadingOverlay,
// } from '../components';

// // Import the intersection modal (assumed to exist)
// import IntersectionModal from '../components/IntersectionModal';

// // Declare global window interface
// declare global {
//   interface Window {
//     toggleBufferTool?: () => void;
//     changeBasemap?: (basemapId: string) => void;
//     loadGeoJSON?: (category: string, subcategory: string) => Promise<any | null>;
//     updateMapStyles?: () => void;
//     uploadShapefile?: (files: FileList) => Promise<any>;
//     openIntersectionModal?: () => void;
//   }
// }

// export default function Map(props: MapProps) {
//   const { 
//     sidebarCollapsed, 
//     onFeatureClick, 
//     currentLayer, 
//     activeFeature, 
//     compassVisible, 
//     gridVisible, 
//     showNotification 
//   } = props;

//   // Refs
//   const mapRef = useRef<HTMLDivElement>(null);
//   const mapInstanceRef = useRef<any>(null);
//   const drawnItemsRef = useRef<any>(null);
//   const baseLayersRef = useRef<{ [key: string]: any }>({});
//   const currentBaseLayerRef = useRef<any>(null);

//   // State
//   const [geoJsonLayer, setGeoJsonLayer] = useState<any>(null);
//   const [uploadedLayer, setUploadedLayer] = useState<any>(null);
//   const [coordinates, setCoordinates] = useState<Coordinates>({ lat: 0, lng: 0 });
//   const [loading, setLoading] = useState(false);
//   const [bufferDistance, setBufferDistance] = useState(100);
//   const [bufferToolVisible, setBufferToolVisible] = useState(false);
//   const [exportModalOpen, setExportModalOpen] = useState(false);
//   const [intersectionModalOpen, setIntersectionModalOpen] = useState(false);
//   const [currentBasemap, setCurrentBasemap] = useState('traffic');
//   const [mapReady, setMapReady] = useState(false);
//   const [layersDropdownOpen, setLayersDropdownOpen] = useState(false);

//   // PDF Export settings
//   const [pdfHeading, setPdfHeading] = useState(PDF_EXPORT_DEFAULTS.heading);
//   const [pdfDPI, setPdfDPI] = useState(PDF_EXPORT_DEFAULTS.dpi);
//   const [pdfFormat, setPdfFormat] = useState(PDF_EXPORT_DEFAULTS.format);
//   const [pdfOrientation, setPdfOrientation] = useState(PDF_EXPORT_DEFAULTS.orientation);

//   // Custom hooks
//   const { managedLayers, addManagedLayer, toggleLayerVisibility, removeLayer } = useManagedLayers(mapInstanceRef);

//   // Initialize map
//   useEffect(() => {
//     if (!mapRef.current || mapInstanceRef.current) return;
    
//     const L = initializeLeaflet();
//     if (!L) return;

//     const initTimer = setTimeout(() => {
//       try {
//         if (!mapRef.current) return;
//         const container = mapRef.current;
        
//         if (container.offsetWidth === 0 || container.offsetHeight === 0) {
//           setTimeout(() => {
//             if (mapRef.current && !mapInstanceRef.current) {
//               initMap();
//             }
//           }, 500);
//           return;
//         }
        
//         initMap();
//       } catch {
//         showNotification('Error', 'Failed to initialize map', 'error');
//       }
//     }, 100);

//     const initMap = () => {
//       if (!mapRef.current || mapInstanceRef.current) return;
      
//       const map = L.map(mapRef.current, {
//         center: DEFAULT_MAP_CENTER,
//         zoom: DEFAULT_MAP_ZOOM,
//         zoomControl: false,
//         preferCanvas: true,
//         renderer: L.canvas({ padding: 0.5 })
//       });
      
//       mapInstanceRef.current = map;

//       // Create and add basemaps
//       const baseLayers = createBaseLayers(L);
//       baseLayersRef.current = baseLayers;

//       const defaultLayer = baseLayers[currentBasemap as keyof typeof baseLayers];
//       if (defaultLayer) {
//         defaultLayer.addTo(map);
//         currentBaseLayerRef.current = defaultLayer;
//       }

//       // Add scale control
//       L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

//       // Setup drawn items layer
//       const drawnItems = new L.FeatureGroup(undefined as any, { renderer: L.canvas() } as any);
//       map.addLayer(drawnItems);
//       drawnItemsRef.current = drawnItems;

//       // Add drawing controls
//       const drawControl = new L.Control.Draw({
//         position: 'topright',
//         draw: {
//           polyline: { shapeOptions: { color: 'red', weight: 3 } },
//           polygon: {
//             allowIntersection: false,
//             drawError: { color: 'red', timeout: 1000 },
//             shapeOptions: { color: 'red' },
//           },
//           circle: { shapeOptions: { color: 'red' } },
//           marker: true,
//           rectangle: { shapeOptions: { color: 'red' } },
//         },
//         edit: { featureGroup: drawnItems, remove: true },
//       });
//       map.addControl(drawControl);

//       // Mouse move handler for coordinates
//       map.on('mousemove', (e: any) => {
//         try {
//           setCoordinates({
//             lat: parseFloat(e.latlng.lat.toFixed(5)),
//             lng: parseFloat(e.latlng.lng.toFixed(5)),
//           });
//         } catch { /* noop */ }
//       });

//       // Draw event handler
//       map.on(L.Draw.Event.CREATED, (event: any) => {
//         try {
//           const layer = event.layer;
//           drawnItems.addLayer(layer);
          
//           drawnItems.eachLayer((l: any) => { l._selected = false; });
//           layer._selected = true;

//           const layerType = event.layerType;
//           addManagedLayer(`Drawn ${layerType}`, layer, 'drawn');

//           // Calculate area for polygons
//           if (layer instanceof L.Polygon) {
//             const latlngs: any[] = (layer.getLatLngs() as any[]).flat(2);
//             let area = 0;
//             for (let i = 0; i < latlngs.length; i++) {
//               const j = (i + 1) % latlngs.length;
//               area += latlngs[i].lng * latlngs[j].lat;
//               area -= latlngs[j].lng * latlngs[i].lat;
//             }
//             area = Math.abs(area) * 0.5 * 111.32 * 111.32;
//             layer.bindPopup(`<strong>Area:</strong> ${area.toFixed(2)} sq km`).openPopup();
//           }
//         } catch { /* noop */ }
//       });

//       // Handle resize
//       const handleResize = () => {
//         if (mapInstanceRef.current) {
//           try {
//             setTimeout(() => {
//               mapInstanceRef.current?.invalidateSize();
//             }, 100);
//           } catch { /* noop */ }
//         }
//       };
//       window.addEventListener('resize', handleResize);

//       setMapReady(true);

//       return () => {
//         window.removeEventListener('resize', handleResize);
//         setMapReady(false);
//         if (mapInstanceRef.current) {
//           try { mapInstanceRef.current.remove(); } catch { /* noop */ }
//           mapInstanceRef.current = null;
//         }
//       };
//     };

//     return () => clearTimeout(initTimer);
//   }, [currentBasemap, showNotification, addManagedLayer]);

//   // Change basemap
//   const changeBasemap = useCallback((basemapId: string) => {
//     if (!mapInstanceRef.current || !baseLayersRef.current) return;
    
//     try {
//       if (currentBaseLayerRef.current && mapInstanceRef.current.hasLayer(currentBaseLayerRef.current)) {
//         mapInstanceRef.current.removeLayer(currentBaseLayerRef.current);
//       }
      
//       if (basemapId !== 'none' && baseLayersRef.current[basemapId]) {
//         const newLayer = baseLayersRef.current[basemapId];
//         if (newLayer && typeof newLayer.addTo === 'function') {
//           newLayer.addTo(mapInstanceRef.current);
//           currentBaseLayerRef.current = newLayer;
          
//           setTimeout(() => {
//             try {
//               newLayer.redraw?.();
//               mapInstanceRef.current?.invalidateSize?.();
//             } catch { /* noop */ }
//           }, 100);
//         } else {
//           currentBaseLayerRef.current = null;
//         }
//       } else {
//         currentBaseLayerRef.current = null;
//       }
      
//       setCurrentBasemap(basemapId);
//       const basemapName = basemapId.charAt(0).toUpperCase() + basemapId.slice(1);
//       showNotification('Basemap Changed', `Switched to ${basemapName} basemap`, 'info');
//     } catch {
//       showNotification('Error', 'Failed to change basemap', 'error');
//     }
//   }, [showNotification]);

//   // Load GeoJSON
//   const loadGeoJSON = useCallback(async (category: string, subcategory: string) => {
//     const waitForMap = () => new Promise<void>((resolve, reject) => {
//       const started = Date.now();
//       const check = () => {
//         if (mapInstanceRef.current) return resolve();
//         if (Date.now() - started > 10000) return reject(new Error('Map initialization timeout'));
//         setTimeout(check, 100);
//       };
//       check();
//     });

//     try {
//       setLoading(true);
//       await waitForMap();
      
//       if (!mapInstanceRef.current) throw new Error('Map not initialized after waiting');

//       const geoJsonData = await fetchGeoJSON(category, subcategory);
//       const L = require('leaflet');

//       // Remove existing layers
//       if (geoJsonLayer && mapInstanceRef.current.hasLayer(geoJsonLayer)) {
//         mapInstanceRef.current.removeLayer(geoJsonLayer);
//       }
//       if (uploadedLayer && mapInstanceRef.current.hasLayer(uploadedLayer)) {
//         mapInstanceRef.current.removeLayer(uploadedLayer);
//         setUploadedLayer(null);
//       }

//       // Get current styles
//       const style = getDefaultLayerStyle();

//       // Create new GeoJSON layer
//       const canvasRenderer = L.canvas({ padding: 0.5 });
//       const newLayer = L.geoJSON(geoJsonData, {
//         renderer: canvasRenderer,
//         style: () => ({
//           color: style.lineColor,
//           weight: style.weight,
//           opacity: 1,
//           fillColor: style.fillColor,
//           fillOpacity: style.opacity,
//         }),
//         onEachFeature: (feature: any, layer: any) => {
//           layer.on('click', (e: any) => {
//             if (onFeatureClick) {
//               L.DomEvent.stop(e);
//               onFeatureClick(feature, layer);
//             }
//           });
//         },
//       });

//       if (!mapInstanceRef.current) throw new Error('Map instance lost during processing');

//       newLayer.addTo(mapInstanceRef.current);

//       // Fit bounds
//       const b = (newLayer as any).getBounds?.();
//       if (b && b.isValid() && mapInstanceRef.current) {
//         try {
//           mapInstanceRef.current.fitBounds(b, { padding: [20, 20], maxZoom: 16 });
//         } catch {
//           const center = b.getCenter();
//           mapInstanceRef.current.setView([center.lat, center.lng], 10);
//         }
//       }

//       setGeoJsonLayer(newLayer);
      
//       const layerName = `${category} - ${subcategory}`;
//       addManagedLayer(layerName, newLayer, 'geojson');
      
//       showNotification('Success', 'Vector data loaded successfully', 'success');
//       return newLayer;
//     } catch (error) {
//       const message = error instanceof Error ? error.message : 'Unknown error occurred';
//       showNotification('Error', `Failed to load data: ${message}`, 'error');
//       return null;
//     } finally {
//       setLoading(false);
//     }
//   }, [geoJsonLayer, uploadedLayer, onFeatureClick, showNotification, addManagedLayer]);

//   // Update layer styles
//   const updateLayerStyles = useCallback(() => {
//     if (!geoJsonLayer && !uploadedLayer) return;
    
//     const style = getDefaultLayerStyle();

//     if (geoJsonLayer) {
//       geoJsonLayer.setStyle({ 
//         color: style.lineColor, 
//         weight: style.weight, 
//         opacity: 1, 
//         fillColor: style.fillColor, 
//         fillOpacity: style.opacity 
//       });
//     }
    
//     if (uploadedLayer) {
//       uploadedLayer.setStyle({ 
//         color: style.lineColor, 
//         weight: style.weight, 
//         opacity: 1, 
//         fillColor: style.fillColor, 
//         fillOpacity: style.opacity 
//       });
//     }
//   }, [geoJsonLayer, uploadedLayer]);

//   // Upload shapefile
//   const uploadShapefile = useCallback(async (files: FileList) => {
//     try {
//       const geojson = await uploadShapefileToBackend(files);
//       const L = require('leaflet');

//       // Remove existing layers
//       if (uploadedLayer && mapInstanceRef.current?.hasLayer(uploadedLayer)) {
//         mapInstanceRef.current.removeLayer(uploadedLayer);
//         setUploadedLayer(null);
//       }
//       if (geoJsonLayer && mapInstanceRef.current?.hasLayer(geoJsonLayer)) {
//         mapInstanceRef.current.removeLayer(geoJsonLayer);
//         setGeoJsonLayer(null);
//       }

//       const style = getDefaultLayerStyle();

//       const canvasRenderer = L.canvas({ padding: 0.5 });
//       const layer = L.geoJSON(geojson, {
//         renderer: canvasRenderer,
//         style: () => ({
//           color: style.lineColor,
//           weight: style.weight,
//           opacity: 1,
//           fillColor: style.fillColor,
//           fillOpacity: style.opacity,
//         }),
//         onEachFeature: (feature: any, lyr: any) => {
//           lyr.on('click', (e: any) => {
//             if (onFeatureClick) {
//               L.DomEvent.stop(e);
//               onFeatureClick(feature, lyr);
//             }
//           });
//         },
//       });

//       layer.addTo(mapInstanceRef.current);

//       try {
//         const b = (layer as any).getBounds?.();
//         if (b && b.isValid()) {
//           mapInstanceRef.current.fitBounds(b, { padding: [20, 20], maxZoom: 16 });
//         }
//       } catch { /* noop */ }

//       setUploadedLayer(layer);
      
//       const fileName = Array.from(files).find(f => f.name.endsWith('.shp') || f.name.endsWith('.zip'))?.name || 'Uploaded Shapefile';
//       addManagedLayer(fileName, layer, 'uploaded');
      
//       return geojson;
//     } catch (e: any) {
//       showNotification('Error', e?.message || 'Upload failed', 'error');
//       return null;
//     }
//   }, [geoJsonLayer, uploadedLayer, onFeatureClick, showNotification, addManagedLayer]);

//   // Handle intersection completion
//   const handleIntersectionComplete = useCallback((geojson: any) => {
//     if (!mapInstanceRef.current) return;
    
//     const L = require('leaflet');
//     const style = getDefaultLayerStyle();

//     try {
//       const canvasRenderer = L.canvas({ padding: 0.5 });
//       const intersectionLayer = L.geoJSON(geojson, {
//         renderer: canvasRenderer,
//         style: () => ({
//           color: style.lineColor,
//           weight: style.weight,
//           opacity: 1,
//           fillColor: style.fillColor,
//           fillOpacity: style.opacity,
//         }),
//         onEachFeature: (feature: any, layer: any) => {
//           layer.on('click', (e: any) => {
//             if (onFeatureClick) {
//               L.DomEvent.stop(e);
//               onFeatureClick(feature, layer);
//             }
//           });
//         },
//       });

//       intersectionLayer.addTo(mapInstanceRef.current);

//       const bounds = intersectionLayer.getBounds();
//       if (bounds && bounds.isValid()) {
//         mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
//       }

//       addManagedLayer('Intersection Result', intersectionLayer, 'geojson');
//       showNotification('Success', 'Intersection result added to map', 'success');
//     } catch (error: any) {
//       showNotification('Error', 'Failed to plot intersection result', 'error');
//     }
//   }, [onFeatureClick, showNotification, addManagedLayer]);

//   // Expose functions to window for sidebar access
//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       window.changeBasemap = changeBasemap;
//       window.loadGeoJSON = loadGeoJSON;
//       window.updateMapStyles = updateLayerStyles;
//       window.toggleBufferTool = () => setBufferToolVisible((prev) => !prev);
//       window.uploadShapefile = uploadShapefile;
//       window.openIntersectionModal = () => setIntersectionModalOpen(true);
//     }
    
//     return () => {
//       if (typeof window !== 'undefined') {
//         delete window.changeBasemap;
//         delete window.loadGeoJSON;
//         delete window.updateMapStyles;
//         delete window.toggleBufferTool;
//         delete window.uploadShapefile;
//         delete window.openIntersectionModal;
//       }
//     };
//   }, [changeBasemap, loadGeoJSON, updateLayerStyles, uploadShapefile]);

//   // Handle sidebar collapse
//   useEffect(() => {
//     if (mapInstanceRef.current) {
//       setTimeout(() => {
//         mapInstanceRef.current?.invalidateSize();
//       }, 300);
//     }
//   }, [sidebarCollapsed]);

//   // Handle active feature highlighting
//   useEffect(() => {
//     if (!currentLayer || !activeFeature) return;
//     const L = require('leaflet');

//     currentLayer.eachLayer((layer: any) => {
//       if (layer !== activeFeature) {
//         if (layer instanceof L.Path) currentLayer.resetStyle(layer);
//         if (layer instanceof L.Marker && layer._highlightCircle) {
//           mapInstanceRef.current?.removeLayer(layer._highlightCircle);
//           delete layer._highlightCircle;
//         }
//       }
//     });

//     if ((activeFeature as any)?.getLatLng) {
//       if (activeFeature._highlightCircle) {
//         mapInstanceRef.current?.removeLayer(activeFeature._highlightCircle);
//       }
//       const highlightCircle = L.circle(activeFeature.getLatLng(), {
//         radius: 20,
//         color: '#ff4444',
//         weight: 3,
//         opacity: 0.7,
//         fillColor: '#ff4444',
//         fillOpacity: 0.3,
//       }).addTo(mapInstanceRef.current);
//       (activeFeature as any)._highlightCircle = highlightCircle;
//     } else if (activeFeature instanceof (require('leaflet').Path)) {
//       activeFeature.setStyle({ weight: 3, color: '#ff4444', fillOpacity: 0.7 });
//     }

//     return () => {
//       if ((activeFeature as any)?._highlightCircle) {
//         mapInstanceRef.current?.removeLayer((activeFeature as any)._highlightCircle);
//         delete (activeFeature as any)._highlightCircle;
//       }
//     };
//   }, [activeFeature, currentLayer]);

//   // Map control handlers
//   const handleHomeClick = () => {
//     mapInstanceRef.current?.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
//     showNotification('Map Reset', 'Returned to default view', 'info');
//   };
  
//   const handleLocateClick = () => {
//     if (!mapInstanceRef.current) return;
    
//     showNotification('Location', 'Finding your location...', 'info');
    
//     mapInstanceRef.current
//       .locate({ setView: true, maxZoom: 16 })
//       .on('locationfound', (e: any) => {
//         const L = require('leaflet');
//         L.circleMarker(e.latlng, {
//           radius: 8,
//           color: 'red',
//           weight: 3,
//           opacity: 1,
//           fillColor: '#3498db',
//           fillOpacity: 0.4,
//         }).addTo(mapInstanceRef.current);
//         showNotification('Location Found', 'Your location has been found', 'success');
//       })
//       .on('locationerror', () => {
//         showNotification('Location Error', 'Could not find your location', 'error');
//       });
//   };
  
//   const handleFullScreen = () => {
//     if (!document.fullscreenElement) {
//       document.documentElement.requestFullscreen().catch(() => { });
//     } else {
//       document.exitFullscreen?.();
//     }
//   };
  
//   const createBuffer = () => {
//     if (!mapInstanceRef.current || !drawnItemsRef.current) return;

//     let selectedLayer: any = null;
//     drawnItemsRef.current.eachLayer((layer: any) => {
//       if (layer._selected) selectedLayer = layer;
//     });
    
//     if (!selectedLayer) {
//       let lastLayer: any = null;
//       drawnItemsRef.current.eachLayer((layer: any) => { lastLayer = layer; });
//       selectedLayer = lastLayer;
//     }
    
//     if (!selectedLayer) {
//       showNotification('Buffer Error', 'Please draw a feature first', 'error');
//       return;
//     }

//     try {
//       const L = require('leaflet');
//       if (selectedLayer.getLatLng) {
//         const circle = L.circle(selectedLayer.getLatLng(), {
//           radius: bufferDistance,
//           color: '#9c27b0',
//           fillColor: '#9c27b0',
//           fillOpacity: 0.2,
//           weight: 2,
//         });
//         circle.addTo(drawnItemsRef.current);
//         circle.bindPopup(`Buffer: ${bufferDistance}m`);
        
//         addManagedLayer(`Buffer ${bufferDistance}m`, circle, 'drawn');
//       }
//       showNotification('Buffer Created', `${bufferDistance}m buffer created`, 'success');
//     } catch {
//       showNotification('Buffer Error', 'Failed to create buffer', 'error');
//     }
//   };

//   // Export handlers
//   const handleExportPDF = async () => {
//     if (!mapInstanceRef.current) {
//       showNotification('Error', 'Map not initialized', 'error');
//       return;
//     }
    
//     const mapEl = mapRef?.current ?? mapInstanceRef.current?._container;
//     if (!mapEl) {
//       showNotification('Error', 'Map container not found', 'error');
//       return;
//     }

//     setExportModalOpen(false);
//     showNotification('Info', 'Preparing map for export...', 'info');

//     try {
//       await waitForAllLayersReady(mapInstanceRef.current, 7000);
//       await new Promise(res => setTimeout(res, 200));
      
//       await exportMapToPDF({
//         mapEl,
//         mapInstance: mapInstanceRef.current,
//         heading: pdfHeading,
//         qualityDPI: Math.max(72, Math.min(600, Number(pdfDPI) || 200)),
//         pageFormat: pdfFormat,
//         orientation: pdfOrientation,
//         currentBasemapId: currentBasemap,
//       });
      
//       showNotification('Success', 'Map exported successfully!', 'success');
//     } catch (err) {
//       console.log('PDF export error:', err);
//       showNotification('Error', 'PDF export failed. Please try again.', 'error');
//     }
//   };

//   const handleExportGeoJSON = () => {
//     try {
//       if (!mapInstanceRef.current) {
//         showNotification('Error', 'Map not initialized', 'error');
//         return;
//       }
      
//       const fc = collectMapGeoJSON(mapInstanceRef.current, managedLayers, drawnItemsRef.current);
      
//       if (!fc.features.length) {
//         showNotification('Info', 'No features to export', 'info');
//         return;
//       }
      
//       const pretty = JSON.stringify(fc, null, 2);
//       downloadTextFile('map_features.geojson', pretty, 'application/geo+json');
//       setExportModalOpen(false);
//       showNotification('Success', 'GeoJSON exported', 'success');
//     } catch (e) {
//       showNotification('Error', 'Failed to export GeoJSON', 'error');
//     }
//   };

//   const handleRemoveLayer = (id: string) => {
//     removeLayer(id);
//     showNotification('Layer Removed', 'Layer has been removed from map', 'info');
//   };

//   return (
//     <div className="relative w-full h-full">
//       <div
//         ref={mapRef}
//         data-map-root
//         className="absolute inset-0 w-full h-full rounded-lg shadow-inner z-0"
//         style={{ minHeight: '400px', minWidth: '300px', backgroundColor: '#f0f0f0' }}
//       />
      
//       <div className="absolute inset-0 z-10 pointer-events-none">
//         <CoordinatesDisplay coordinates={coordinates} />
//         <Compass visible={compassVisible} />
        
//         <LayersPanel
//           managedLayers={managedLayers}
//           isOpen={layersDropdownOpen}
//           onToggle={() => setLayersDropdownOpen(!layersDropdownOpen)}
//           onToggleVisibility={toggleLayerVisibility}
//           onRemove={handleRemoveLayer}
//         />
        
//         <MapControls
//           mapInstance={mapInstanceRef.current}
//           onHomeClick={handleHomeClick}
//           onLocateClick={handleLocateClick}
//           onFullScreen={handleFullScreen}
//           onBufferToggle={() => setBufferToolVisible(!bufferToolVisible)}
//           onExportClick={() => setExportModalOpen(true)}
//         />
        
//         <BufferTool
//           visible={bufferToolVisible}
//           distance={bufferDistance}
//           onDistanceChange={setBufferDistance}
//           onCreateBuffer={createBuffer}
//         />
        
//         <ExportModal
//           isOpen={exportModalOpen}
//           onClose={() => setExportModalOpen(false)}
//           heading={pdfHeading}
//           dpi={pdfDPI}
//           format={pdfFormat}
//           orientation={pdfOrientation}
//           onHeadingChange={setPdfHeading}
//           onDpiChange={setPdfDPI}
//           onFormatChange={setPdfFormat}
//           onOrientationChange={setPdfOrientation}
//           onExportPDF={handleExportPDF}
//           onExportGeoJSON={handleExportGeoJSON}
//         />
        
//         <LoadingOverlay 
//           visible={loading || !mapReady} 
//           message={!mapReady ? 'Initializing map...' : 'Loading vector data...'}
//         />
//       </div>

//       <IntersectionModal
//         isOpen={intersectionModalOpen}
//         onOpenChange={setIntersectionModalOpen}
//         managedLayers={managedLayers}
//         showNotification={showNotification}
//         onIntersectionComplete={handleIntersectionComplete}
//       />
//     </div>
//   );
// }