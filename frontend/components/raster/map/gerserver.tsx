// 'use client';
// import { useEffect, useRef } from 'react';
// import Map from 'ol/Map';
// import View from 'ol/View';
// import TileLayer from 'ol/layer/Tile';
// import ImageLayer from 'ol/layer/Image';
// import OSM from 'ol/source/OSM';
// import ImageWMS from 'ol/source/ImageWMS';
// import TileWMS from 'ol/source/TileWMS';
// import { fromLonLat } from 'ol/proj';
// import { defaults as defaultControls } from 'ol/control';
// import LayerSwitcher from 'ol-layerswitcher';
// import 'ol/ol.css';
// import 'ol-layerswitcher/dist/ol-layerswitcher.css';

// // Define GeoServer connection settings
// const GEOSERVER_URL = '/geoserver/api/wms';
// const WORKSPACE = 'admin';

// const GeoServerMapComponent = () => {
//   const mapRef = useRef(null);
  
//   useEffect(() => {
//     if (!mapRef.current) return;
    
//     // 1. Basic map setup with OSM base layer
//     const map = new Map({
//       target: mapRef.current,
//       controls: defaultControls(),
//       layers: [
//         new TileLayer({
//           title: 'OpenStreetMap',
//           type: 'base',
//           visible: true,
//           source: new OSM()
//         })
//       ],
//       view: new View({
//         center: fromLonLat([78.9629, 20.5937]), // Center coordinates
//         zoom: 5
//       })
//     });
    
//     // 2. Add a WMS layer using TileWMS (tiled WMS - good for performance)
//     const tiledWmsLayer = new TileLayer({
//       title: 'Tiled WMS Layer',
//       visible: true,
//       source: new TileWMS({
//         url: GEOSERVER_URL,
//         params: {
//           'LAYERS': `${WORKSPACE}:Raster_1GB`, // Format: workspace:layer
//           'TILED': true,
//           'FORMAT': 'image/png',
//           'TRANSPARENT': true,
//           'VERSION': '1.1.1',
//           // Optional: Add custom styling using SLD
//           // 'STYLES': 'your_style_name',
//           // Optional: Add filtering using CQL
//           // 'CQL_FILTER': "property_name='value'"
//         },
//         serverType: 'geoserver',
//         // Important for tiled performance
//         tileGrid: null, // Let OpenLayers create the default grid
//         transition: 0
//       }),
//       opacity: 0.7 // Adjust opacity as needed
//     });
    
//     // 3. Add a WMS layer using ImageWMS (single image - better for dynamic data)
//     const imageWmsLayer = new ImageLayer({
//       title: 'Image WMS Layer',
//       visible: true,
//       source: new ImageWMS({
//         url: GEOSERVER_URL,
//         params: {
//           'LAYERS': `${WORKSPACE}:Raster_1GB`,
//           'FORMAT': 'image/png',
//           'TRANSPARENT': true,
//           'VERSION': '1.1.1',
//         },
//         ratio: 1, // Adjust this for better quality (higher) or performance (lower)
//         serverType: 'geoserver'
//       }),
//       opacity: 0.7
//     });
    
//     // Add WMS layers to map
//     map.addLayer(tiledWmsLayer);
//     map.addLayer(imageWmsLayer);
    
//     // 4. Add layer switcher for toggling WMS layers
//     const layerSwitcher = new LayerSwitcher({
//       tipLabel: 'Legend', // Optional label for button
//       groupSelectStyle: 'children' // Allows selecting children independently
//     });
//     map.addControl(layerSwitcher);
    
//     // 5. Handle GetFeatureInfo for WMS queries
//     map.on('singleclick', function(evt) {
//       document.getElementById('info').innerHTML = '';
      
//       // Get the view resolution
//       const viewResolution = map.getView().getResolution();
      
//       // Generate a GetFeatureInfo URL
//       const url = imageWmsLayer.getSource().getFeatureInfoUrl(
//         evt.coordinate, 
//         viewResolution, 
//         'EPSG:3857', // The projection code
//         {'INFO_FORMAT': 'application/json'} // Get response as JSON
//       );
      
//       if (url) {
//         // Fetch and display feature info
//         fetch(url)
//           .then(response => response.json())
//           .then(data => {
//             // Process the GeoServer response
//             if (data.features && data.features.length > 0) {
//               const feature = data.features[0];
//               let html = '<table>';
              
//               // Display all properties
//               for (const property in feature.properties) {
//                 html += `<tr><td>${property}</td><td>${feature.properties[property]}</td></tr>`;
//               }
              
//               html += '</table>';
//               document.getElementById('info').innerHTML = html;
//             } else {
//               document.getElementById('info').innerHTML = 'No features found at this location';
//             }
//           })
//           .catch(error => {
//             console.log('Error fetching feature info:', error);
//             document.getElementById('info').innerHTML = 'Error fetching feature info';
//           });
//       }
//     });
    
//     // 6. Handling WMS time-series data (if applicable)
//     const timeSeriesLayer = new ImageLayer({
//       title: 'Time Series Data',
//       visible: false,
//       source: new ImageWMS({
//         url: GEOSERVER_URL,
//         params: {
//           'LAYERS': `${WORKSPACE}:time_series_layer`,
//           'FORMAT': 'image/png',
//           'TRANSPARENT': true,
//           'VERSION': '1.1.1',
//           // Set initial time if layer has time dimension
//           'TIME': '2023-01-01T00:00:00.000Z'
//         },
//         serverType: 'geoserver'
//       })
//     });
    
//     // Update time parameter for time-series layer
//     const updateTime = (newTime) => {
//       timeSeriesLayer.getSource().updateParams({
//         'TIME': newTime
//       });
//     };
    
//     // Example: Update to a new time
//     // updateTime('2023-02-01T00:00:00.000Z');
    
//     map.addLayer(timeSeriesLayer);
    
//     // Cleanup on component unmount
//     return () => {
//       map.setTarget(undefined);
//     };
//   }, []);
  
//   return (
//     <div className="map-container">
//       <div 
//         ref={mapRef} 
//         className="w-full border rounded-lg shadow-sm"
//         style={{ height: '500px' }}
//       />
//       <div id="info" className="mt-4 p-2 border rounded bg-gray-50">
//         Click on the map to get feature information
//       </div>
//     </div>
//   );
// };

// export default GeoServerMapComponent;