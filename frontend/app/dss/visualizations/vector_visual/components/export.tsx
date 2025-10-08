// import React, { useState, useRef, useEffect } from 'react';
// import type { Feature, GeoJsonProperties, Geometry } from 'geojson';

// interface CustomFeature extends Feature {
//   properties: {
//     type?: string;
//     radius?: number;
//     popupContent?: string;
//     [key: string]: any;
//   };
// }



// type ExportModalProps = {
//   isOpen: boolean;
//   onClose: () => void;
//   mapInstanceRef: React.RefObject<any>; // Replace `any` with your actual map type if available
//   drawnItemsRef: React.RefObject<any>;
//   geoJsonLayer: any; // Replace with proper type if available
//   showNotification: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
// };

// const ExportModal: React.FC<ExportModalProps> = ({
//   isOpen,
//   onClose,
//   mapInstanceRef,
//   drawnItemsRef,
//   geoJsonLayer,
//   showNotification,
// }) => {
//   const [exportFormat, setExportFormat] = useState('pdf');
//   const [mapTitle, setMapTitle] = useState('Enter Map Title');
//   const [dpi, setDpi] = useState(100);
//   const modalRef = useRef<HTMLDivElement>(null);
//   const [position, setPosition] = useState({ x: 0, y: 0 });
//   const [isDragging, setIsDragging] = useState(false);
//   const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

//   // Position the modal at the top center when it opens
//   useEffect(() => {
//     if (isOpen && typeof window !== 'undefined') {
//       setPosition({
//         x: (window.innerWidth - 400) / 2, // Adjust width as needed
//         y: 200 // Position from top of screen
//       });
//     }
//   }, [isOpen]);

//   // Custom dragging implementation
//   const handleMouseDown = (e:any) => {
//     if (modalRef.current && e.target.closest('.modal-header')) {
//       setIsDragging(true);
//       const rect = modalRef.current.getBoundingClientRect();
//       setDragOffset({
//         x: e.clientX - rect.left,
//         y: e.clientY - rect.top
//       });
//       e.preventDefault();
//     }
//   };

//   const handleMouseMove = (e:any) => {
//     if (isDragging) {
//       setPosition({
//         x: e.clientX - dragOffset.x,
//         y: e.clientY - dragOffset.y
//       });
//       e.preventDefault();
//     }
//   };

//   const handleMouseUp = () => {
//     if (isDragging) {
//       setIsDragging(false);
//     }
//   };

//   useEffect(() => {
//     if (isDragging) {
//       document.addEventListener('mousemove', handleMouseMove);
//       document.addEventListener('mouseup', handleMouseUp);
//     } else {
//       document.removeEventListener('mousemove', handleMouseMove);
//       document.removeEventListener('mouseup', handleMouseUp);
//     }

//     return () => {
//       document.removeEventListener('mousemove', handleMouseMove);
//       document.removeEventListener('mouseup', handleMouseUp);
//     };
//   }, [isDragging, handleMouseMove, handleMouseUp]);

//   // Function to export all vector layers to a single GeoJSON
//   const exportAllLayersToGeoJSON = () => {
//     if (!mapInstanceRef.current || !drawnItemsRef.current) return null;

//     const allFeatures: GeoJSON.Feature[] = [];

//     try {
//       // We need to ensure Leaflet is available
//       const L = window.L || require('leaflet');

//       // Process drawn items with special handling for circles
//       drawnItemsRef.current.eachLayer(function (layer:any) {
//         if (layer instanceof L.Circle) {
//   const center = layer.getLatLng();
//   const radius = layer.getRadius();

//   const circleFeature: CustomFeature = {
//     type: "Feature",
//     geometry: {
//       type: "Point",
//       coordinates: [center.lng, center.lat]
//     },
//     properties: {
//       type: "Circle",
//       radius: radius
//     }
//   };

//   // ✔ Safely get popup content
//   const popup = layer.getPopup();
//   if (popup) {
//     const content = popup.getContent();

//     if (typeof content === 'string') {
//       circleFeature.properties.popupContent = content;
//     } else if (content instanceof HTMLElement) {
//       circleFeature.properties.popupContent = content.outerHTML;
//     } else if (typeof content === 'function') {
//       const resolvedContent = content(layer);
//       if (typeof resolvedContent === 'string') {
//         circleFeature.properties.popupContent = resolvedContent;
//       } else if (resolvedContent instanceof HTMLElement) {
//         circleFeature.properties.popupContent = resolvedContent.outerHTML;
//       }
//     }
//   }

//   allFeatures.push(circleFeature);
// }

//         // Handle all other geometry types (including lines and polylines)
//         else if (layer.toGeoJSON) {
//           const geojson = layer.toGeoJSON();

//           // Preserve any popup content
//           if (layer.getPopup()) {
//             if (geojson.properties === undefined) {
//               geojson.properties = {};
//             }
//             geojson.properties.popupContent = layer.getPopup().getContent();
//           }

//           // For LineString, make sure it's properly formatted
//           if (geojson.geometry && geojson.geometry.type === "LineString") {
//             // Ensure coordinates are properly formatted
//             if (!Array.isArray(geojson.geometry.coordinates) || geojson.geometry.coordinates.length < 2) {
//               console.warn("Invalid LineString detected, skipping");
//               return; // Skip this feature
//             }
//           }

//           // Handle Feature or FeatureCollection
//           if (geojson.type === "FeatureCollection") {
//             geojson.features.forEach((feature: Feature<Geometry, GeoJsonProperties>) => {
//               if (feature.geometry) {
//                 allFeatures.push(feature);
//               }
//             });
//           } else if (geojson.type === "Feature" && geojson.geometry) {
//             allFeatures.push(geojson);
//           }
//         }
//       });

//       // Add features from loaded GeoJSON layer if it exists
//       if (geoJsonLayer) {
//         geoJsonLayer.eachLayer(function (layer:any) {
//           if (layer.toGeoJSON) {
//             const geojson = layer.toGeoJSON();

//             // Add popup content to properties if available
//             if (layer.getPopup()) {
//               if (geojson.properties === undefined) {
//                 geojson.properties = {};
//               }
//               geojson.properties.popupContent = layer.getPopup().getContent();
//             }

//             if (geojson.type === "FeatureCollection") {
//               geojson.features.forEach((feature: Feature<Geometry, GeoJsonProperties>) => {
//                 if (feature.geometry) {
//                   allFeatures.push(feature);
//                 }
//               });
//             } else if (geojson.type === "Feature" && geojson.geometry) {
//               allFeatures.push(geojson);
//             }
//           }
//         });
//       }
//     } catch (error) {
//       console.log("Error processing layers:", error);
//       showNotification(
//         "Export Error",
//         "Error processing map layers",
//         "error"
//       );
//       return null;
//     }

//     // Final GeoJSON FeatureCollection
//     const exportedGeoJSON = {
//       type: "FeatureCollection",
//       features: allFeatures,
//       metadata: {
//         title: mapTitle,
//         exportedAt: new Date().toISOString(),
//         exportedFrom: "MapComponent",
//         version: "1.0"
//       }
//     };

//     return exportedGeoJSON;
//   };

//   // Handler for GeoJSON export
//   const handleExportGeoJSON = () => {
//     try {
//       const geojsonData = exportAllLayersToGeoJSON();

//       if (!geojsonData || geojsonData.features.length === 0) {
//         showNotification(
//           "Export Error",
//           "No vector data available to export",
//           "error"
//         );
//         return;
//       }

//       // Convert to string
//       const geojsonString = JSON.stringify(geojsonData, null, 2);

//       // Create a blob and download link
//       const blob = new Blob([geojsonString], { type: 'application/json' });
//       const url = URL.createObjectURL(blob);
//       const link = document.createElement('a');
//       link.href = url;
//       link.download = `${mapTitle.replace(/\s+/g, '_')}.geojson`;

//       // Append to body, trigger click and clean up
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       URL.revokeObjectURL(url);

//       showNotification(
//         "Export Successful",
//         `Exported ${geojsonData.features.length} features successfully`,
//         "success"
//       );
//     }catch (error) {
//   console.log("Export error:", error);

//   let errorMessage = "An unknown error occurred.";
//   if (error instanceof Error) {
//     errorMessage = error.message;
//   }

//   showNotification(
//     "Export Error",
//     `Failed to export GeoJSON: ${errorMessage}`,
//     "error"
//   );
// }
// }

//  // Handler for SVG export - modified to return SVG dataUrl
//   const handleExportSVG = async (download = true) => {
//     return new Promise(async (resolve, reject) => {
//       try {
//         if (!mapInstanceRef.current) {
//           showNotification("Export Error", "Map instance not found", "error");
//           reject(new Error("Map instance not found"));
//           return;
//         }

//         const { toSvg } = await import('html-to-image');

//         // Add title to the map (temporarily)
//         const titleElement = document.createElement('div');
//         titleElement.style.position = 'absolute';
//         titleElement.style.top = '10px';
//         titleElement.style.left = '50%';
//         titleElement.style.transform = 'translateX(-50%)';
//         titleElement.style.zIndex = '1000';
//         titleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
//         titleElement.style.padding = '5px 10px';
//         titleElement.style.borderRadius = '4px';
//         titleElement.style.fontWeight = 'bold';
//         titleElement.style.fontSize = '16px';
//         titleElement.innerText = mapTitle;

//         const mapContainer = mapInstanceRef.current.getContainer();
//         mapContainer.appendChild(titleElement);

//         toSvg(mapContainer, {
//           quality: 1.0,
//           width: mapContainer.offsetWidth * (dpi / 96),
//           height: mapContainer.offsetHeight * (dpi / 96)
//         })
//           .then((dataUrl) => {
//             // Remove the temporary title
//             mapContainer.removeChild(titleElement);

//             // If direct download is requested, create the download link
//             if (download) {
//               const link = document.createElement('a');
//               link.download = `${mapTitle.replace(/\s+/g, '_')}.svg`;
//               link.href = dataUrl;
//               document.body.appendChild(link);
//               link.click();
//               document.body.removeChild(link);

//               showNotification(
//                 "Export Successful",
//                 "Map exported to SVG successfully",
//                 "success"
//               );
//             }

//             // Return the SVG data URL
//             resolve(dataUrl);
//           })
//           .catch((error) => {
//             // Remove the temporary title if there was an error
//             if (mapContainer.contains(titleElement)) {
//               mapContainer.removeChild(titleElement);
//             }

//             console.log("SVG export error:", error);
//             showNotification(
//               "Export Error",
//               `Failed to export SVG: ${error.message}`,
//               "error"
//             );
//             reject(error);
//           });
//       } catch (error) {
//   console.log("SVG export error:", error);

//   let errorMessage = "An unknown error occurred.";
//   if (error instanceof Error) {
//     errorMessage = error.message;
//   }

//   showNotification(
//     "Export Error",
//     `Failed to export SVG: ${errorMessage}`,
//     "error"
//   );

//   reject(error);
// }
// });
// };


//   // Utility function to convert SVG string to Image
//   const svgStringToImage = (svgString: string, width: any, height: any) => {
//     return new Promise((resolve, reject) => {
//       try {
//         const img = new Image();
//         img.onload = () => resolve(img);
//         img.onerror = (e) => reject(new Error("Failed to load SVG as image"));
//         img.src = svgString;
//       } catch (error) {
//         reject(error);
//       }
//     });
//   };

// // Handler for JPG export using the SVG
// // const handleExportJPG = async () => {
// //     try {
// //       // Get SVG string from the SVG export function
// //       const svgString = await handleExportSVG(false); // Don't download SVG

// //       // Convert SVG to image
// //       const imgElement = await svgStringToImage(svgString, width, height);

// //       // Create canvas for the JPG conversion
// //       const canvas = document.createElement("canvas");
// //       const scaleFactor = dpi / 96; // Standard screen is typically 96 DPI
// //       canvas.width = imgElement.width * scaleFactor;
// //       canvas.height = imgElement.height * scaleFactor;

// //       const ctx = canvas.getContext("2d");
// //       if (!ctx) throw new Error("Canvas context not found");

// //       // Draw white background
// //       ctx.fillStyle = "white";
// //       ctx.fillRect(0, 0, canvas.width, canvas.height);

// //       // Draw the SVG image
// //       ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

// //       // Convert to JPG and download
// //       canvas.toBlob((blob) => {
// //         if (!blob) {
// //           throw new Error("Failed to create image blob");
// //         }

// //         const url = URL.createObjectURL(blob);
// //         const link = document.createElement('a');
// //         link.href = url;
// //         link.download = `${mapTitle.replace(/\s+/g, '_')}.jpg`;
// //         document.body.appendChild(link);
// //         link.click();
// //         document.body.removeChild(link);
// //         URL.revokeObjectURL(url);

// //         showNotification(
// //           "Export Successful",
// //           "Map exported to JPG successfully",
// //           "success"
// //         );
// //       }, 'image/jpeg', 0.9);

// //     } catch (error) {
// //       console.log("JPG export error:", error);
// //       showNotification(
// //         "Export Error",
// //         `Failed to export JPG: ${error.message}`,
// //         "error"
// //       );
// //     }
// //   };

//   // Handler for PDF export using the SVG
// //   const handleExportPDF = async () => {
// //   try {
// //     const svgString = await handleExportSVG(false);
// //     const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
    
// //     const layout = "landscape";
// //     const width = layout === "landscape" ? 1200 : 850;
// //     const height = layout === "landscape" ? 850 : 1200;
// //     const dpi = 90;
    
// //     const imgElement = await svgStringToImage(svgString, width, height);
// //     const scaleFactor = dpi / 72;
// //     const exportCanvas = document.createElement("canvas");
// //     exportCanvas.width = width * scaleFactor;
// //     exportCanvas.height = height * scaleFactor;
// //     const ctx = exportCanvas.getContext("2d");
// //     if (!ctx) throw new Error("Canvas context not found");

// //     ctx.scale(scaleFactor, scaleFactor);
// //     ctx.fillStyle = "white";
// //     ctx.fillRect(0, 0, width, height);

// //     // Title
// //     ctx.fillStyle = "#333";
// //     ctx.font = "bold 28px Arial";
// //     ctx.textAlign = "center";
// //     ctx.fillText(mapTitle, width / 2, 50);

// //     ctx.font = "18px Arial";
// //     ctx.fillStyle = "#666";
// //     ctx.fillText(`Category: , Subcategory: `, width / 2, 80);

// //     // Map positioning
// //     const mapX = 40;
// //     const mapY = 120;
// //     const mapWidth = 1100;
// //     const mapHeight = 600;

// //     // Draw border
// //     ctx.strokeStyle = "blue";
// //     ctx.lineWidth = 2;
// //     ctx.strokeRect(mapX - 2, mapY - 2, mapWidth + 4, mapHeight + 4);
// //     ctx.drawImage(imgElement, mapX, mapY, mapWidth, mapHeight);

// //     // Dynamic bounds (you'll need to get these from your map object)
// //     const bounds = {
// //       west: 68,  // Replace with map.getBounds().getWest()
// //       east: 98,  // Replace with map.getBounds().getEast()
// //       south: 8,  // Replace with map.getBounds().getSouth()
// //       north: 38  // Replace with map.getBounds().getNorth()
// //     };

// //     // Coordinate scales
// //     const numDivisions = 5;
// //     ctx.font = "12px Arial";
// //     ctx.fillStyle = "#666";

// //     // Latitude scales (left)
// //     ctx.textAlign = "right";
// //     for (let i = 0; i <= numDivisions; i++) {
// //       const lat = bounds.south + ((bounds.north - bounds.south) * i) / numDivisions;
// //       const yPos = mapY + mapHeight - (mapHeight * i) / numDivisions;
// //       const latLabel = `${lat.toFixed(1)}°N`;
// //       ctx.fillText(latLabel, mapX - 10, yPos + 4);
// //       // Tick mark
// //       ctx.beginPath();
// //       ctx.moveTo(mapX - 2, yPos);
// //       ctx.lineTo(mapX, yPos);
// //       ctx.strokeStyle = "#666";
// //       ctx.stroke();
// //     }

// //     // Longitude scales (top)
// //     ctx.textAlign = "center";
// //     for (let i = 0; i <= numDivisions; i++) {
// //       const lon = bounds.west + ((bounds.east - bounds.west) * i) / numDivisions;
// //       const xPos = mapX + (mapWidth * i) / numDivisions;
// //       const lonLabel = `${lon.toFixed(1)}°E`;
// //       ctx.fillText(lonLabel, xPos, mapY - 5);
// //       // Tick mark
// //       ctx.beginPath();
// //       ctx.moveTo(xPos, mapY - 2);
// //       ctx.lineTo(xPos, mapY);
// //       ctx.stroke();
// //     }

// //     // Add compass directions
// //     ctx.font = "bold 14px Arial";
// //     ctx.fillText("N", mapX + mapWidth/2, mapY - 15);
// //     ctx.fillText("S", mapX + mapWidth/2, mapY + mapHeight + 20);
// //     ctx.fillText("W", mapX - 15, mapY + mapHeight/2);
// //     ctx.fillText("E", mapX + mapWidth + 15, mapY + mapHeight/2);

// //     // Metadata
// //     const metadataY = mapY + mapHeight + 30;
// //     ctx.font = "14px Arial";
// //     ctx.fillStyle = "#333";
// //     ctx.textAlign = "center";
// //     ctx.fillText(`Generated on: ${new Date().toLocaleString()} | India GIS Viewer`, width / 2, metadataY);

// //     // Footer
// //     ctx.fillStyle = "#666";
// //     ctx.font = "12px Arial";
// //     ctx.fillText(`Copyright 2024 India GIS Viewer`, width / 2, height - 20);

// //     // Generate PDF
// //     const imgData = exportCanvas.toDataURL("image/jpeg", 1.0);
// //     const pdf = new jsPDF({
// //       orientation: layout,
// //       unit: "px",
// //       format: [width, height],
// //       putOnlyUsedFonts: true,
// //       floatPrecision: 16
// //     });

// //     pdf.addImage(imgData, "JPEG", 0, 0, width, height, null, "SLOW");
// //     pdf.save(`${mapTitle.replace(/\s+/g, "_")}.pdf`);

// //     showNotification("Export Successful", "Map exported to PDF successfully", "success");

// //   } catch (error) {
// //     console.log("PDF export error:", error);
// //     showNotification("Export Error", error.message, "error");
// //   }
// // };

//   // Main export handler
//   const handleExport = () => {
//     switch (exportFormat) {
//       case 'pdf':
//         handleExport();
//         break;
//       case 'jpg':
//         handleExport();
//         break;
//       case 'svg':
//         handleExportSVG(true); // true means download directly
//         break;
//       case 'geojson':
//         handleExportGeoJSON();
//         break;
//       default:
//         showNotification(
//           "Export Error",
//           "Unknown export format selected",
//           "error"
//         );
//     }
//     // Don't close the modal after export
//     // onClose();
//   };


//   if (!isOpen) return null;

//   return (
//     <div
//       ref={modalRef}
//       onMouseDown={handleMouseDown}
//       className="bg-white rounded-md shadow-lg border border-gray-300 fixed z-50"
//       style={{
//         left: `${position.x}px`,
//         top: `${position.y}px`,
//         width: '400px',
//         cursor: isDragging ? 'grabbing' : 'auto',
//         userSelect: 'none', // Prevent text selection during drag
//         pointerEvents: 'auto' // Ensure modal is clickable
//       }}
//     >
//       {/* Draggable Header */}
//       <div
//         className="modal-header bg-blue-600 text-white px-4 py-2 flex justify-between items-center rounded-t-md"
//         style={{ cursor: 'grab' }}
//       >
//         <h3 className="font-semibold text-sm">Export Map</h3>
//         <button
//           onClick={onClose}
//           className="text-white hover:text-gray-200 cursor-pointer"
//           aria-label="Close"
//         >
//           ×
//         </button>
//       </div>

//       {/* Modal Body */}
//       <div className="p-4">
//         {/* Format Selection */}
//         <div className="mb-3">
//           <label className="block text-gray-700 text-sm font-medium mb-1">Export Format:</label>
//           <div className="grid grid-cols-2 gap-2">
//             <label className="flex items-center cursor-pointer">
//               <input
//                 type="radio"
//                 name="exportFormat"
//                 value="pdf"
//                 checked={exportFormat === 'pdf'}
//                 onChange={() => setExportFormat('pdf')}
//                 className="form-radio h-3 w-3 text-blue-600"
//               />
//               <span className="ml-2 text-sm">PDF</span>
//             </label>
//             <label className="flex items-center cursor-pointer">
//               <input
//                 type="radio"
//                 name="exportFormat"
//                 value="jpg"
//                 checked={exportFormat === 'jpg'}
//                 onChange={() => setExportFormat('jpg')}
//                 className="form-radio h-3 w-3 text-blue-600"
//               />
//               <span className="ml-2 text-sm">JPG</span>
//             </label>
//             <label className="flex items-center cursor-pointer">
//               <input
//                 type="radio"
//                 name="exportFormat"
//                 value="svg"
//                 checked={exportFormat === 'svg'}
//                 onChange={() => setExportFormat('svg')}
//                 className="form-radio h-3 w-3 text-blue-600"
//               />
//               <span className="ml-2 text-sm">SVG</span>
//             </label>
//             <label className="flex items-center cursor-pointer">
//               <input
//                 type="radio"
//                 name="exportFormat"
//                 value="geojson"
//                 checked={exportFormat === 'geojson'}
//                 onChange={() => setExportFormat('geojson')}
//                 className="form-radio h-3 w-3 text-blue-600"
//               />
//               <span className="ml-2 text-sm">GeoJSON</span>
//             </label>
//           </div>
//         </div>

//         {/* Map Title */}
//         <div className="mb-3">
//           <label htmlFor="mapTitle" className="block text-gray-700 text-sm font-medium mb-1">
//             Map Title:
//           </label>
//           <input
//             type="text"
//             id="mapTitle"
//             value={mapTitle}
//             onChange={(e) => setMapTitle(e.target.value)}
//             className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//             placeholder="Enter map title"
//           />
//         </div>

//         {/* DPI Setting (not needed for GeoJSON) */}
//         {exportFormat !== 'geojson' && (
//           <div className="mb-3">
//             <label htmlFor="dpi" className="block text-gray-700 text-sm font-medium mb-1">
//               Resolution (DPI):
//             </label>
//             <input
//               type="number"
//               id="dpi"
//               value={dpi}
//               onChange={(e) => setDpi(Math.max(72, parseInt(e.target.value) || 300))}
//               min="72"
//               max="600"
//               className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
//             />
//             <p className="text-xs text-gray-500 mt-1">
//               Recommended: 150 (web), 300 (print)
//             </p>
//           </div>
//         )}
//       </div>

//       {/* Modal Footer */}
//       <div className="bg-gray-50 px-4 py-2 flex justify-end rounded-b-md">
//         <button
//           onClick={handleExport}
//           className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
//         >
//           Export
//         </button>
//       </div>
//     </div>
//   );
//     };

// export default ExportModal;