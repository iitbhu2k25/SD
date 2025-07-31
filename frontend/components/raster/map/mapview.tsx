// import { useRef, useEffect, useState, useCallback } from 'react';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import { fromArrayBuffer, fromUrl, Pool, GeoTIFF, GeoTIFFImage } from 'geotiff';
// import { RasterLayerProps } from '@/app/types/raster';

// interface MapLibreMapProps {
//   selectedRasters: RasterLayerProps[];
//   center?: [number, number];
//   zoom?: number;
//   onMapClick?: (coords: [number, number]) => void;
//   className?: string;
// }

// // Define the structure for loaded raster metadata
// interface LoadedRaster {
//   id: string;
//   loaded: boolean;
//   error?: string;
// }

// // Worker pool for processing GeoTIFF data
// const pool = new Pool();

// const MapLibreMap: React.FC<MapLibreMapProps> = ({
//   selectedRasters,
//   center = [78.9629, 20.5937], // Default center of India
//   zoom = 4, // Default zoom for India view
//   onMapClick,
//   className = ""
// })  => {
//   const mapContainerRef = useRef<HTMLDivElement>(null);
//   const mapRef = useRef<maplibregl.Map | null>(null);
//   const [loadedRasters, setLoadedRasters] = useState<Map<string, LoadedRaster>>(new Map());
//   const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
//   const [mapError, setMapError] = useState<string | null>(null);
  
//   // Initialize map on first render
//   useEffect(() => {
//     if (!mapContainerRef.current) return;

//     try {
//       // Create the MapLibre map
//       const map = new maplibregl.Map({
//         container: mapContainerRef.current,
//         style: {
//           version: 8,
//           sources: {
//             // Base OSM layer
//             'osm': {
//               type: 'raster',
//               tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
//                       'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
//                       'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
//               tileSize: 256,
//               attribution: '© OpenStreetMap contributors'
//             }
//           },
//           layers: [
//             {
//               id: 'osm-tiles',
//               type: 'raster',
//               source: 'osm',
//               minzoom: 0,
//               maxzoom: 19
//             }
//           ]
//         },
//         center: center,
//         zoom: zoom
//       });

//       // Set up click handler
//       if (onMapClick) {
//         map.on('click', (event) => {
//           const { lng, lat } = event.lngLat;
//           onMapClick([lng, lat]);
//         });
//       }
      
//       // Set up map loaded handler
//       map.on('load', () => {
//         setIsMapLoaded(true);
//       });
      
//       // Set up error handler
//       map.on('error', (e) => {
//         setMapError(e.error?.message || 'An unknown map error occurred');
//       });

//       // Save the map instance
//       mapRef.current = map;

//       return () => {
//         // Clean up on unmount
//         map.remove();
//       };
//     } catch (error) {
//       setMapError(error instanceof Error ? error.message : 'Failed to initialize map');
//     }
//   }, [center, zoom, onMapClick]);

//   // Function to load and process a GeoTIFF
//   const loadGeoTIFF = useCallback(async (
//     url: string |undefined,
//     id: string, 
//     visible: boolean,
//     opacity: number|undefined
//   ): Promise<void> => {
//     const map = mapRef.current;
//     if (!map || !isMapLoaded) return;

//     try {
//       // Mark this raster as loading
//       setLoadedRasters(prev => {
//         const updated = new Map(prev);
//         updated.set(id, { id, loaded: false });
//         return updated;
//       });
      
//       let tiff: GeoTIFF;
      
//       // Check if source is a URL or already loaded data buffer
//       if (typeof url === 'string') {
//         // Load GeoTIFF from URL
//         tiff = fromUrl(url);
//       } else {
//          // Assume it's an ArrayBuffer
//         // tiff = await fromArrayBuffer(url);
//       }

//       // Get the first image from the GeoTIFF
//       const image: GeoTIFFImage = await tiff.getImage();
      
//       // Get image dimensions
//       const width = image.getWidth();
//       const height = image.getHeight();
      
//       // Get geospatial information
//       const bbox = image.getBoundingBox();
//       const [west, south, east, north] = bbox;
      
//       // Read raster data
//       const data: TypedArray[] = (await image.readRasters({ pool })) as any;
      
//       // Create a canvas to render the raster data
//       const canvas = document.createElement('canvas');
//       canvas.width = width;
//       canvas.height = height;
//       const ctx = canvas.getContext('2d');
      
//       if (!ctx) {
//         throw new Error("Couldn't get canvas context");
//       }
      
//       // Create an ImageData object
//       const imageData = ctx.createImageData(width, height);
      
//       // Fill the ImageData based on the number of samples
//       const samples = image.getSamplesPerPixel();
      
//       if (samples === 1) {
//         // Single band (grayscale)
//         for (let i = 0; i < width * height; i++) {
//           const val = data[0][i];
//           imageData.data[i * 4] = val;     // R
//           imageData.data[i * 4 + 1] = val; // G
//           imageData.data[i * 4 + 2] = val; // B
//           imageData.data[i * 4 + 3] = 255; // A
//         }
//       } else if (samples >= 3) {
//         // RGB or RGBA
//         for (let i = 0; i < width * height; i++) {
//           imageData.data[i * 4] = data[0][i];     // R
//           imageData.data[i * 4 + 1] = data[1][i]; // G
//           imageData.data[i * 4 + 2] = data[2][i]; // B
//           imageData.data[i * 4 + 3] = samples >= 4 ? data[3][i] : 255; // A
//         }
//       }
      
//       // Put the image data on the canvas
//       ctx.putImageData(imageData, 0, 0);
      
//       // Convert canvas to data URL
//       const dataUrl = canvas.toDataURL();
      
//       // Add the image to the map
//       map.addSource(`raster-source-${id}`, {
//         type: 'image',
//         url: dataUrl,
//         coordinates: [
//           [west, north], // top-left
//           [east, north], // top-right
//           [east, south], // bottom-right
//           [west, south]  // bottom-left
//         ]
//       });
      
//       // Add a layer to display the image
//       map.addLayer({
//         id: `raster-layer-${id}`,
//         type: 'raster',
//         source: `raster-source-${id}`,
//         paint: {
//           'raster-opacity': opacity,
//           'raster-fade-duration': 0
//         },
//         layout: {
//           visibility: visible ? 'visible' : 'none'
//         }
//       });
      
//       // Update state to indicate this raster has been successfully loaded
//       setLoadedRasters(prev => {
//         const updated = new Map(prev);
//         updated.set(id, { id, loaded: true });
//         return updated;
//       });
      
//     } catch (error) {
//       console.log(`Error loading GeoTIFF for ${id}:`, error);
//       // Update state to indicate loading error
//       setLoadedRasters(prev => {
//         const updated = new Map(prev);
//         updated.set(id, { 
//           id, 
//           loaded: false, 
//           error: error instanceof Error ? error.message : 'Error loading GeoTIFF' 
//         });
//         return updated;
//       });
//     }
//   }, [isMapLoaded]);
  
//   // Update layers when selected rasters change
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !isMapLoaded) return;
    
//     const currentRasterIds = new Set(selectedRasters.map(r => r.id));
    
//     // Remove layers and sources that are no longer selected
//     loadedRasters.forEach((rasterInfo, id) => {
//       if (!currentRasterIds.has(id)) {
//         // Remove layer and source from map
//         if (map.getLayer(`raster-layer-${id}`)) {
//           map.removeLayer(`raster-layer-${id}`);
//         }
//         if (map.getSource(`raster-source-${id}`)) {
//           map.removeSource(`raster-source-${id}`);
//         }
        
//         // Update state
//         setLoadedRasters(prev => {
//           const updated = new Map(prev);
//           updated.delete(id);
//           return updated;
//         });
//       }
//     });
    
//     // Process each selected raster
//     selectedRasters.forEach((raster) => {
//       const rasterInfo = loadedRasters.get(raster.id);
      
//      if (!rasterInfo || (rasterInfo && !rasterInfo.loaded && !rasterInfo.error)) {
//         // Load new GeoTIFF if not already loaded or currently loading
//         loadGeoTIFF(raster.url ,raster.id, raster.visible, raster.opacity);
//       }
//     });
//   }, [selectedRasters, loadedRasters, isMapLoaded, loadGeoTIFF]);

//   // // Function to handle file uploads directly
//   // const handleFileUpload = useCallback(async (
//   //   file: File, 
//   //   id: string, 
//   //   visible: boolean = true, 
//   //   opacity: number = 1
//   // ): Promise<void> => {
//   //   try {
//   //     const arrayBuffer = await file.arrayBuffer();
//   //     await loadGeoTIFF(arrayBuffer, id, visible, opacity);
//   //   } catch (error) {
//   //     console.log('Error handling file upload:', error);
//   //   }
//   // }, [loadGeoTIFF]);

//   // Expose methods to parent component
//   // useEffect(() => {
//   //   if (mapRef.current) {
//   //     mapRef.current.handleFileUpload = handleFileUpload;
//   //   }
//   // }, [handleFileUpload]);

//   return (
//     <div className={`relative w-full h-full ${className}`}>
//       {/* Map container */}
//       <div ref={mapContainerRef} className="w-full h-full rounded-lg shadow-lg overflow-hidden" />
      
//       {/* Loading indicator */}
//       {(selectedRasters.length > 0 && !isMapLoaded) && (
//         <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-10">
//           <div className="bg-white p-4 rounded-md shadow-lg">
//             <div className="flex items-center space-x-2">
//               <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
//               <span className="text-gray-700">Loading map...</span>
//             </div>
//           </div>
//         </div>
//       )}
      
//       {/* Error message */}
//       {mapError && (
//         <div className="absolute bottom-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md shadow-md z-10">
//           <div className="flex items-start">
//             <div className="flex-shrink-0">
//               <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
//                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
//               </svg>
//             </div>
//             <div className="ml-3">
//               <p className="text-sm">{mapError}</p>
//             </div>
//             <div className="ml-auto pl-3">
//               <button
//                 onClick={() => setMapError(null)}
//                 className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
//               >
//                 <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
//                   <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
//                 </svg>
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
      
//       {/* Raster loading status indicators */}
//       <div className="absolute top-4 right-4 z-10 space-y-2">
//         {Array.from(loadedRasters.values())
//           .filter(raster => !raster.loaded)
//           .map(raster => (
//             <div key={raster.id} className="bg-white px-3 py-2 rounded-md shadow-md text-sm">
//               <div className="flex items-center space-x-2">
//                 <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
//                 <span className="text-gray-700 truncate max-w-xs">Loading {raster.id}...</span>
//               </div>
//               {raster.error && (
//                 <p className="text-red-500 text-xs mt-1">{raster.error}</p>
//               )}
//             </div>
//           ))}
//       </div>
//     </div>
//   );
// };

// // Type declaration for the extended Map class
// declare global {
//   interface Map extends maplibregl.Map {
//     handleFileUpload?: (file: File, id: string, visible?: boolean, opacity?: number) => Promise<void>;
//   }
// }

// // TypeScript type for TypedArray (used in GeoTIFF data)
// type TypedArray = 
//   | Int8Array 
//   | Uint8Array 
//   | Uint8ClampedArray 
//   | Int16Array 
//   | Uint16Array 
//   | Int32Array 
//   | Uint32Array 
//   | float32Array 
//   | float32Array;

// export default MapLibreMap;