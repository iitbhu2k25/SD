// 'use client';
// import { useEffect, useRef, useState } from 'react';
// import { useMapContext } from '@/contexts/MapContext';
// import dynamic from 'next/dynamic';

// // Define types for our component
// interface RasterLayer {
//   id: string;
//   name?: string;
//   url?: string;
//   visible: boolean;
//   opacity?: number;
//   extent?: [number, number, number, number]; // [minX, minY, maxX, maxY]
// }

// // Define the PixelInfoValue type structure
// interface PixelInfoValue {
//   coords: [number, number];
//   value: number | null;
//   loading: boolean;
//   error?: string;
// }

// // Define the pixelInfo state structure
// type PixelInfoState = Record<string, PixelInfoValue>;

// // Define the context structure we're using
// interface MapContextType {
//   selectedRasterLayers: RasterLayer[];
//   pixelInfo: PixelInfoState;
//   setPixelInfo: React.Dispatch<React.SetStateAction<PixelInfoState>>;
// }

// // Define window augmentation for our dynamically loaded libraries
// declare global {
//   interface Window {
//     L: any;
//     parseGeoraster: any;
//     GeoRasterLayer: any;
//   }
// }

// // Create a wrapper component that only renders on the client side
// const MapContent = () => {
//   const {
//     selectedRasterLayers,
//     pixelInfo,
//     setPixelInfo
//   } = useMapContext() as MapContextType;
  
//   const mapRef = useRef<HTMLDivElement>(null);
//   const [map, setMap] = useState<any>(null);
//   const [userLocationMarker, setUserLocationMarker] = useState<any>(null);
//   const [userLocationCircle, setUserLocationCircle] = useState<any>(null);
//   const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
//   const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
//   const leafletLayersRef = useRef<Record<string, any>>({});
//   const georastersRef = useRef<Record<string, any>>({});
//   const baseMapsRef = useRef<Record<string, any>>({});
//   const layerControlRef = useRef<any>(null);
  
//   // Import client-side libraries inside useEffect
//   useEffect(() => {
//     // Dynamically import Leaflet and related libraries
//     const loadLibraries = async () => {
//       const L = (await import('leaflet')).default;
//       await import('leaflet/dist/leaflet.css');
//       const parseGeoraster = (await import('georaster')).default;
//       const GeoRasterLayer = (await import('georaster-layer-for-leaflet')).default;
      
//       if (!mapRef.current || map) return;
      
//       // Fix Leaflet's icon paths
//       delete L.Icon.Default.prototype._getIconUrl;
//       L.Icon.Default.mergeOptions({
//         iconRetinaUrl: '/Images/marker-icon-2x.png',
//         iconUrl: '/Images/marker-icon.png',
//         shadowUrl: '/Images/marker-shadow.png',
//       });
      
//       // Initialize the Leaflet map
//       const initialMap = L.map(mapRef.current).setView([20.5937, 78.9629], 5); // Center on India
      
//       // Setup base maps
//       const baseMaps = {
//         "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//           attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//         }),
//         "Google Streets": L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
//           subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//           attribution: '&copy; Google Maps'
//         }),
//         "Google Hybrid": L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
//           subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//           attribution: '&copy; Google Maps'
//         }),
//         "Google Satellite": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
//           subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//           attribution: '&copy; Google Maps'
//         }),
//         "Google Terrain": L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
//           subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//           attribution: '&copy; Google Maps'
//         }),
//         "Google Traffic": L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
//           subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
//           attribution: '&copy; Google Maps'
//         })
//       };
      
//       // Add the Google Traffic layer by default
//       baseMaps["Google Traffic"].addTo(initialMap);
      
//       // Store basemaps for later reference
//       baseMapsRef.current = baseMaps;
      
//       // Create overlay layers group to hold our raster layers
//       const overlayMaps = {};
      
//       // Create a layer control and add it to the map
//       layerControlRef.current = L.control.layers(baseMaps, overlayMaps, {
//         collapsed: false
//       }).addTo(initialMap);
      
//       // Add location control button
//       const locationControl = L.control({ position: 'topleft' });
//       locationControl.onAdd = function() {
//         const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
//         div.innerHTML = `
//           <a href="#" title="Show my location" style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px;">
//             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//               <circle cx="12" cy="12" r="10"></circle>
//               <circle cx="12" cy="12" r="3"></circle>
//             </svg>
//           </a>
//         `;
        
//         L.DomEvent.on(div, 'click', function(e) {
//           e.preventDefault();
//           e.stopPropagation();
//           if (currentLocation) {
//             // If we already have a location, center on it
//             initialMap.setView(currentLocation, 16);
//           } else {
//             // Otherwise, try to get the location
//             startLocationTracking();
//           }
//         });
        
//         return div;
//       };
//       locationControl.addTo(initialMap);
      
//       setMap(initialMap);
      
//       // Handle map clicks to get pixel info
//       initialMap.on('click', async (event: any) => {
//         const { lat, lng } = event.latlng;
        
//         // Process each visible georaster to get pixel information
//         for (const [id, georaster] of Object.entries(georastersRef.current)) {
//           // Only process if the layer is visible and on the map
//           const layer = leafletLayersRef.current[id];
//           if (georaster && layer && initialMap.hasLayer(layer)) {
//             try {
//               setPixelInfo(prev => ({
//                 ...prev,
//                 [id]: {
//                   coords: [lng, lat],
//                   value: null,
//                   loading: true
//                 }
//               }));
              
//               // Use the georaster to get the value at this point
//               if (georaster.valueAtLatLng) {
//                 const value = await georaster.valueAtLatLng(lat, lng);
                
//                 setPixelInfo(prev => ({
//                   ...prev,
//                   [id]: {
//                     coords: [lng, lat],
//                     value: Array.isArray(value) ? value[0] : value, // Some georasters return arrays for multi-band data
//                     loading: false
//                   }
//                 }));
//               } else {
//                 // If no direct method, just log the coordinates
//                 //console.log(`Clicked at coordinates [${lng}, ${lat}] for layer ${id}`);
                
//                 setPixelInfo(prev => ({
//                   ...prev,
//                   [id]: {
//                     coords: [lng, lat],
//                     value: null,
//                     loading: false,
//                     error: 'Value extraction not supported for this layer'
//                   }
//                 }));
//               }
//             } catch (error) {
//               console.log(`Error getting value for layer ${id}:`, error);
//               setPixelInfo(prev => ({
//                 ...prev,
//                 [id]: {
//                   coords: [lng, lat],
//                   value: null,
//                   loading: false,
//                   error: error instanceof Error ? error.message : 'Unknown error'
//                 }
//               }));
//             }
//           }
//         }
//       });
      
//       // Store the libraries and map in refs for other useEffects to use
//       window.L = L;
//       window.parseGeoraster = parseGeoraster;
//       window.GeoRasterLayer = GeoRasterLayer;
      
//       // Start tracking user location
//       startLocationTracking();
      
//       return () => {
//         if (initialMap) {
//           initialMap.remove();
//         }
        
//         // Clean up location tracking when component unmounts
//         if (locationWatchId !== null) {
//           navigator.geolocation.clearWatch(locationWatchId);
//         }
//       };
//     };
    
//     loadLibraries();
    
//     // Function to start tracking the user's location
//     const startLocationTracking = () => {
//       if (!navigator.geolocation) {
//         console.log('Geolocation is not supported by your browser');
//         return;
//       }
      
//       // Get the initial position
//       navigator.geolocation.getCurrentPosition(
//         position => {
//           const { latitude, longitude, accuracy } = position.coords;
//           updateUserLocation(latitude, longitude, accuracy);
//         },
//         error => {
//           console.log('Error getting user location:', error.message);
//           showLocationError(error.message);
//         },
//         { enableHighAccuracy: true }
//       );
      
//       // Continue watching position
//       const watchId = navigator.geolocation.watchPosition(
//         position => {
//           const { latitude, longitude, accuracy } = position.coords;
//           updateUserLocation(latitude, longitude, accuracy);
//         },
//         error => {
//           console.log('Error watching user location:', error.message);
//           showLocationError(error.message);
//         },
//         { enableHighAccuracy: true }
//       );
      
//       setLocationWatchId(watchId);
//     };
    
//     // Function to update user location markers
//     const updateUserLocation = (lat: number, lng: number, accuracy: number) => {
//       if (!map) return;
      
//       const L = window.L;
//       if (!L) return;
      
//       setCurrentLocation({ lat, lng });
      
//       // Create or update marker
//       if (!userLocationMarker) {
//         // Create a custom marker with a pulsing effect
//         const locationIcon = L.divIcon({
//           html: `
//             <div class="user-location-marker">
//               <div class="pulse"></div>
//               <div class="dot"></div>
//             </div>
//           `,
//           className: '',
//           iconSize: [20, 20],
//           iconAnchor: [10, 10]
//         });
        
//         const marker = L.marker([lat, lng], { icon: locationIcon }).addTo(map);
//         const circle = L.circle([lat, lng], { radius: accuracy, color: '#4285F4', fillColor: '#4285F433', Influence: 1 }).addTo(map);
        
//         setUserLocationMarker(marker);
//         setUserLocationCircle(circle);
        
//         // Center map on first location
//         map.setView([lat, lng], 16);
//       } else {
//         // Update existing marker positions
//         userLocationMarker.setLatLng([lat, lng]);
//         userLocationCircle.setLatLng([lat, lng]).setRadius(accuracy);
//       }
//     };
    
//     // Function to display location errors
//     const showLocationError = (message: string) => {
//       if (!map) return;
      
//       const L = window.L;
//       if (!L) return;
      
//       L.popup()
//         .setLatLng(map.getCenter())
//         .setContent(`<div style="color: red;">Location error: ${message}</div>`)
//         .openOn(map);
//     };
//   }, [map, setPixelInfo, userLocationMarker, userLocationCircle, locationWatchId, currentLocation]);
  
//   // Handle raster layers changes
//   useEffect(() => {
//     if (!map || typeof window === 'undefined') return;
    
//     const L = window.L;
//     const parseGeoraster = window.parseGeoraster;
//     const GeoRasterLayer = window.GeoRasterLayer;
    
//     if (!L || !parseGeoraster || !GeoRasterLayer) return;
    
//     //console.log("Layers changed, updating map...");
//     //console.log("Current layers:", selectedRasterLayers);
    
//     // First, check for layers that need to be removed
//     const currentLayerIds = selectedRasterLayers.map(layer => layer.id);
    
//     // Remove layers that no longer exist in the selectedRasterLayers
//     Object.entries(leafletLayersRef.current).forEach(([id, layer]) => {
//       if (!currentLayerIds.includes(id)) {
//         //console.log(`Removing layer ${id} from map as it's no longer in selection`);
//         if (map.hasLayer(layer)) {
//           map.removeLayer(layer);
//         }
        
//         // Also remove from layer control if it exists
//         if (layerControlRef.current) {
//           layerControlRef.current.removeLayer(layer);
//         }
        
//         delete leafletLayersRef.current[id];
//         delete georastersRef.current[id];
//       }
//     });
    
//     // Then check for layers that need opacity updates
//     selectedRasterLayers.forEach(rasterLayer => {
//       const leafletLayer = leafletLayersRef.current[rasterLayer.id];
      
//       if (leafletLayer) {
//         // Update opacity if the layer exists
//         if (leafletLayer.setOpacity && typeof leafletLayer.setOpacity === 'function') {
//           //console.log(`Updating opacity for layer ${rasterLayer.id} to ${rasterLayer.opacity ?? 1}`);
//           leafletLayer.setOpacity(rasterLayer.opacity ?? 1);
//         }
        
//         // Handle visibility changes
//         if (rasterLayer.visible && !map.hasLayer(leafletLayer)) {
//           //console.log(`Adding layer ${rasterLayer.id} to map as it's now visible`);
//           map.addLayer(leafletLayer);
//         } else if (!rasterLayer.visible && map.hasLayer(leafletLayer)) {
//           //console.log(`Removing layer ${rasterLayer.id} from map as it's now hidden`);
//           map.removeLayer(leafletLayer);
//         }
//       }
//     });
    
//     // Find the first visible raster layer that needs to be loaded
//     const visibleRasterLayer = selectedRasterLayers.find(layer => 
//       layer.visible && 
//       layer.url && 
//       !leafletLayersRef.current[layer.id]
//     );
    
//     // If we have a visible raster layer to load, add it to the map
//     if (visibleRasterLayer) {
//       //console.log(`Loading new visible raster layer: ${visibleRasterLayer.id}`);
      
//       // Create a loading marker to show while the GeoTIFF is loading
//       const loadingMarker = L.marker(map.getCenter(), {
//         icon: L.divIcon({
//           html: `<div style="background-color: rgba(255,255,255,0.8); padding: 5px; border-radius: 4px; font-Influence: bold;">Loading ${visibleRasterLayer.name || visibleRasterLayer.id}...</div>`,
//           className: ''
//         })
//       }).addTo(map);
      
//       // Direct fetch and display of GeoTIFF using georaster and georaster-layer-for-leaflet
//       fetch(visibleRasterLayer.url as string)
//         .then(response => {
//           if (!response.ok) {
//             throw new Error(`Failed to fetch GeoTIFF: ${response.status}`);
//           }
//           return response.arrayBuffer();
//         })
//         .then(arrayBuffer => {
//           //console.log(`Successfully fetched GeoTIFF for ${visibleRasterLayer.id}, parsing...`);
//           // Parse the GeoTIFF using georaster
//           return parseGeoraster(arrayBuffer);
//         })
//         .then(georaster => {
//           //console.log(`Successfully parsed GeoTIFF for ${visibleRasterLayer.id}`);
          
//           // Store the georaster reference for pixel queries
//           georastersRef.current[visibleRasterLayer.id] = georaster;
          
//           // Create a GeoRasterLayer from the parsed georaster
//           const geoRasterLayer = new GeoRasterLayer({
//             georaster,
//             opacity: visibleRasterLayer.opacity ?? 1.0,
//             resolution: 256 // Optional: control the resolution
//           });
          
//           // Store the layer reference
//           leafletLayersRef.current[visibleRasterLayer.id] = geoRasterLayer;
          
//           // Add the layer to the layer control
//           if (layerControlRef.current) {
//             layerControlRef.current.addOverlay(geoRasterLayer, visibleRasterLayer.name || visibleRasterLayer.id);
//           }
          
//           // Remove loading marker
//           map.removeLayer(loadingMarker);
          
//           // Add layer to map only if it should be visible
//           if (visibleRasterLayer.visible) {
//             geoRasterLayer.addTo(map);
//           }
          
//           // Fit the map to the layer bounds
//           try {
//             const bounds = geoRasterLayer.getBounds();
//             if (bounds) {
//               map.fitBounds(bounds);
//             }
//           } catch (e) {
//             console.warn('Could not fit to layer bounds:', e);
            
//             // If we have extent information, use that instead
//             if (visibleRasterLayer.extent) {
//               const [minX, minY, maxX, maxY] = visibleRasterLayer.extent;
//               const bounds = L.latLngBounds(
//                 [minY, minX], // Southwest corner [lat, lng]
//                 [maxY, maxX]  // Northeast corner [lat, lng]
//               );
//               map.fitBounds(bounds);
//             }
//           }
          
//           //console.log(`Successfully added GeoTIFF layer: ${visibleRasterLayer.id}`);
//         })
//         .catch(error => {
//           console.log(`Error loading GeoTIFF for ${visibleRasterLayer.id}:`, error);
//           map.removeLayer(loadingMarker);
          
//           // Create a simple error notification instead of fallback layers
//           const errorNotification = L.popup()
//             .setLatLng(map.getCenter())
//             .setContent(`<div style="color: red;">Failed to load ${visibleRasterLayer.name || visibleRasterLayer.id}</div>`)
//             .openOn(map);
            
//           // Auto-close notification after 3 seconds
//           setTimeout(() => {
//             if (map.hasLayer(errorNotification)) {
//               map.closePopup(errorNotification);
//             }
//           }, 3000);
//         });
//     }
//   }, [map, selectedRasterLayers]);
  
//   return (
//     <div className="w-full relative">
//       <div 
//         ref={mapRef} 
//         className="w-full h-full border rounded-lg shadow-sm"
//         style={{ minHeight: '600px' }}
//       />
      
//       {/* CSS for location marker pulse effect */}
//       <style jsx global>{`
//         .user-location-marker {
//           position: relative;
//           width: 20px;
//           height: 20px;
//         }
        
//         .user-location-marker .dot {
//           position: absolute;
//           top: 7px;
//           left: 7px;
//           width: 6px;
//           height: 6px;
//           background-color: #4285F4;
//           border-radius: 50%;
//           z-index: 2;
//         }
        
//         .user-location-marker .pulse {
//           position: absolute;
//           top: 0;
//           left: 0;
//           width: 20px;
//           height: 20px;
//           background-color: #4285F4;
//           border-radius: 50%;
//           opacity: 0.6;
//           z-index: 1;
//           animation: pulse 2s infinite;
//         }
        
//         @keyframes pulse {
//           0% {
//             transform: scale(0.5);
//             opacity: 0.6;
//           }
//           70% {
//             transform: scale(2);
//             opacity: 0;
//           }
//           100% {
//             transform: scale(2);
//             opacity: 0;
//           }
//         }
//       `}</style>
//     </div>
//   );
// };

// // Use a client-only wrapper for the map component
// const MapComponent = () => {
//   return (
//     <div className="w-full border rounded-lg shadow-sm" style={{ minHeight: '600px' }}>
//       <MapContent />
//     </div>
//   );
// };

// export default MapComponent;