// "use client";
// import React, { useState } from "react";
// import { useRiverSystem } from "@/contexts/water/users/DrainContext";
// import WholeLoading from "@/components/app_layout/newLoading";
// import { MultiSelect } from "../../admin/components/Multiselect";

// interface RiverSelectorProps {
//   onConfirm?: (selectedData: {
//     river: number;
//     stretch: number;
//     drain: number;
//     timeScale: "seasonal" | "yearly";
//     year: number [];
//     season: string;
//     productType: string;
//     rasterResult?: any;
//   }) => void;
//   onReset?: () => void;
// }

// const RiverSelector: React.FC<RiverSelectorProps> = ({
//   onConfirm,
//   onReset,
// }) => {
//   const {
//     rivers,
//     stretches,
//     drains,
//     catchments,
//     selectedRiver,
//     selectedStretch,
//     selectedDrain,
//     selectedCatchments,
//     selectionsLocked,
//     isLoading,
//     handleRiverChange,
//     setSelectedStretch,
//     setSelectedDrain,
//     setSelectedCatchments,
//     resetSelections,
//     allStretchIds,
//     setAllStretchIds,
//     allDrainIds,
//     setAllDrainIds,
//     timeScale,
//     setTimeScale,
//     selectedYears,
//     setSelectedYears,
//     selectedSeason,
//     setSelectedSeason,
//     selectedProductType,
//     setSelectedProductType,
//     fetchRasterData,
//     confirmSelections,
//     displayRaster,
//   } = useRiverSystem();

//   const [isProcessing, setIsProcessing] = useState(false);

//   const years = Array.from({ length: 10 }, (_, i) => 2015 + i);
//   const seasons = ["Pre-Monsoon", "Monsoon", "Post-Monsoon", "Winter"];
//   const productTypes = ["Water Budget", "Surplus", "Deficit", "Index"];

//   const yearItems = React.useMemo(() => {
//       return years.map((y) => ({ id: y, name: y.toString() }));
//     }, [years]);

//   // Helper function to get border color class based on selection state
//   const getBorderClass = (isSelected: boolean) => {
//     return isSelected
//       ? "border-blue-500 ring-1 ring-blue-500"
//       : "border-gray-300";
//   };

//   // ✅ NEW: Toggle River selection (click same river to deselect)
//   const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
//     if (!selectionsLocked) {
//       const value = e.target.value;
//       if (value === "") {
//         // Explicitly selecting "Choose a River" - deselect everything
//         handleRiverChange(null);
//         return;
//       }
//       const newRiverId = parseInt(value);

//       // ✅ Toggle: If same river clicked again, deselect it
//       if (selectedRiver === newRiverId) {
//         handleRiverChange(null);
//       } else {
//         handleRiverChange(newRiverId);
//       }
//     }
//   };

//   // ✅ NEW: Toggle Stretch selection
//   const handleStretchesSelect = (
//     e: React.ChangeEvent<HTMLSelectElement>,
//   ): void => {
//     if (!selectionsLocked) {
//       const val = e.target.value;
//       if (val === "") {
//         setSelectedStretch(null);
//         return;
//       }
//       const newStretchId = parseInt(val);

//       // ✅ Toggle: If same stretch clicked again, deselect it
//       if (selectedStretch === newStretchId) {
//         setSelectedStretch(null);
//       } else {
//         setSelectedStretch(newStretchId);
//       }
//     }
//   };

//   // ✅ NEW: Toggle Drain selection
//   const handleDrainsSelect = (
//     e: React.ChangeEvent<HTMLSelectElement>,
//   ): void => {
//     if (!selectionsLocked) {
//       const val = e.target.value;
//       if (val === "") {
//         setSelectedDrain(null);
//         return;
//       }
//       const newDrainId = parseInt(val);

//       // ✅ Toggle: If same drain clicked again, deselect it
//       if (selectedDrain === newDrainId) {
//         setSelectedDrain(null);
//       } else {
//         setSelectedDrain(newDrainId);
//       }
//     }
//   };

//   // ✅ REAL API CALL: Call /api/water/process_drain_raster endpoint
//   const fetchRealRasterData = async (
//     drain_no: number,
//     year: number [],
//     product_type: string,
//     time_scale: "seasonal" | "yearly",
//     season: string,
//   ): Promise<any> => {
//     try {
//       console.log("🔄 Calling real API: /api/water/process_drain_raster");

//       const payload = {
//         drain_no,
//         year,
//         product_type,
//         time_scale,
//         season: time_scale === "seasonal" ? season : "",
//       };

//       console.log("📤 API Payload:", payload);

//       const response = await fetch("/api/water/process_drain_raster", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       });

//       if (!response.ok) {
//         throw new Error(`API error: ${response.status} ${response.statusText}`);
//       }

//       const result = await response.json();
//       console.log("✅ API Response:", result);

//       // ✅ Transform API response to raster format
//       if (result && result.clipped_rasters) {
//         const rasterResult = {
//           clipped_rasters: result.clipped_rasters,
//           bbox: result.bbox || null,
//           study_area_vector: result.study_area_vector || null,
//         };

//         console.log("✅ Transformed raster result:", rasterResult);
//         return rasterResult;
//       }

//       return result;
//     } catch (error) {
//       const errorMsg = error instanceof Error ? error.message : String(error);
//       console.error("❌ Real API error:", errorMsg);
//       throw error;
//     }
//   };


//   // Update signature to accept number[]
//   const createMockRasterData = (years: number[]) => {
//     return {
//       clipped_rasters: [
//         {
//           // Just using the first year for the mock name, or iterate if needed
//           layer_name: `water_test_${years[0]}_${Date.now()}`,
//           original_name: "water_availability_clipped",
//           workspace: "water_Availability",
//           style: "default",
//           year: years[0],
//         },
//       ],
//       // ... rest of object
//     };
//   };
//   // ✅ FIXED: Corrected the condition check for rasterResult
//   const handleConfirm = async (): Promise<void> => {
//     if (selectedDrain && !selectionsLocked) {
//       setIsProcessing(true);
//       try {
//         console.log("📍 Confirm clicked - starting confirmation flow");

//         // Step 1: Confirm selections (locks the UI)
//         const lockedData = confirmSelections();
//         console.log("✓ Selections locked:", lockedData);

//         if (!lockedData) {
//           console.error("❌ Failed to lock selections");
//           setIsProcessing(false);
//           return;
//         }

//         let rasterResult = null;

//         // Step 2: Try GeoServer/OpenLayers fetch from context FIRST
//         console.log("🗺️ Step 2: Fetching from GeoServer via context...");

//         if (displayRaster && displayRaster.length > 0) {
//           console.log("✓ Display raster found in context:", displayRaster);
//           rasterResult = {
//             clipped_rasters: displayRaster,
//             bbox: null,
//             study_area_vector: null,
//           };
//         } else {
//           // Try calling fetchRasterData from context
//           console.log("⏳ displayRaster not ready, calling fetchRasterData...");
//           try {
//             rasterResult = await fetchRasterData();
//             console.log(
//               "✓ fetchRasterData (GeoServer) returned:",
//               rasterResult,
//             );
//           } catch (error) {
//             console.error("❌ fetchRasterData (GeoServer) error:", error);
//           }
//         }

//         // ✅ FIXED: Proper condition check - added missing checks
//         if (
//           !rasterResult ||
//           !rasterResult.clipped_rasters ||
//           rasterResult.clipped_rasters.length === 0
//         ) {
//           console.log(
//             "🔄 Step 3: GeoServer returned no data, trying Real API...",
//           );

//           try {
//             rasterResult = await fetchRealRasterData(
//               selectedDrain,
//               selectedYears,
//               selectedProductType,
//               timeScale as "seasonal" | "yearly",
//               selectedSeason,
//             );
//             console.log("✅ Real API returned:", rasterResult);
//           } catch (apiError) {
//             console.error("❌ Real API call failed:", apiError);
//           }
//         }

//         // Step 4: If both fail, use MOCK data as last resort
//         if (
//           !rasterResult ||
//           !rasterResult.clipped_rasters ||
//           rasterResult.clipped_rasters.length === 0
//         ) {
//           console.warn(
//             "⚠️ Both GeoServer and Real API failed - using MOCK data for testing",
//           );
//           rasterResult = createMockRasterData(selectedYears);
//           console.log("✅ Using MOCK raster data:", rasterResult);
//         }

//         // Step 5: Validate final result
//         if (
//           !rasterResult ||
//           !rasterResult.clipped_rasters ||
//           rasterResult.clipped_rasters.length === 0
//         ) {
//           console.error("❌ No raster data available from any source");
//           console.warn("⚠️ Cannot proceed without raster data");
//           setIsProcessing(false);
//           return;
//         }

//         console.log("📦 Final rasterResult before calling onConfirm:", {
//           hasClippedRasters: !!rasterResult.clipped_rasters,
//           count: rasterResult.clipped_rasters?.length || 0,
//           layers:
//             rasterResult.clipped_rasters?.map((r: any) => r.layer_name) || [],
//           hasBbox: !!rasterResult.bbox,
//           source:
//             displayRaster?.length > 0
//               ? "GeoServer/Context"
//               : "Real API or Mock",
//         });

//         // Step 6: Call parent's onConfirm with complete data
//         if (onConfirm) {
//           const confirmData = {
//             river: Number(selectedRiver),
//             stretch: Number(selectedStretch),
//             drain: Number(selectedDrain),
//             timeScale: timeScale as "seasonal" | "yearly",
//             year:selectedYears,
//             season: selectedSeason,
//             productType: selectedProductType,
//             rasterResult: rasterResult, // ✅ CRITICAL: Contains data from GeoServer, Real API, or Mock
//           };

//           console.log("✅ Calling onConfirm with merged data:", confirmData);
//           onConfirm(confirmData);
//         }
//       } catch (error) {
//         console.error("❌ Error in handleConfirm:", error);
//       } finally {
//         setIsProcessing(false);
//       }
//     }
//   };

//   const handleReset = (): void => {
//     console.log("🔄 Reset clicked");
//     resetSelections();
//     if (onReset) {
//       onReset();
//     }
//   };

//   // ✅ NEW: Toggle Time Scale (click same option to deselect)
//   const handleTimeScaleChange = (scale: "seasonal" | "yearly"): void => {
//     if (!selectionsLocked) {
//       // ✅ Toggle: If same time scale clicked again, deselect it
//       if (timeScale === scale) {
//         setTimeScale(""); // Deselect
//         setSelectedSeason(""); // Clear season when deselecting
//       } else {
//         setTimeScale(scale);
//         if (scale === "yearly") {
//           setSelectedSeason("");
//         }
//       }
//     }
//   };

//   // ✅ NEW: Toggle Year selection
//   const handleYearsChange = (selectedIds: number[]): void => {
//     if (!selectionsLocked) {
//       setSelectedYears(selectedIds);
//     }
//   };

//   // ✅ NEW: Toggle Season selection
//   const handleSeasonChange = (
//     e: React.ChangeEvent<HTMLSelectElement>,
//   ): void => {
//     if (!selectionsLocked) {
//       const value = e.target.value;
//       if (value === "") {
//         setSelectedSeason("");
//         return;
//       }

//       // ✅ Toggle: If same season clicked again, deselect it
//       if (selectedSeason === value) {
//         setSelectedSeason("");
//       } else {
//         setSelectedSeason(value);
//       }
//     }
//   };

//   // ✅ NEW: Toggle Product Type selection
//   const handleProductTypeChange = (
//     e: React.ChangeEvent<HTMLSelectElement>,
//   ): void => {
//     if (!selectionsLocked) {
//       const value = e.target.value;
//       if (value === "") {
//         setSelectedProductType("");
//         return;
//       }

//       // ✅ Toggle: If same product type clicked again, deselect it
//       if (selectedProductType === value) {
//         setSelectedProductType("");
//       } else {
//         setSelectedProductType(value);
//       }
//     }
//   };

//   const formatTruncatedList = (items: string[]) => {
//     if (items.length === 0) return "None";
//     if (items.length <= 3) return items.join(", ");
//     return `${items.slice(0, 3).join(", ")}, +${items.length - 3} more`;
//   };

//   const currentStretchValue = selectedStretch !== null ? selectedStretch : "";
//   const currentDrainValue = selectedDrain !== null ? selectedDrain : "";

//   const isConfirmDisabled = (): boolean => {
//     if (
//       selectionsLocked ||
//       isLoading ||
//       isProcessing ||
//       selectedDrain === null ||
//       selectedYears.length === 0 ||
//       !selectedProductType
//     ) {
//       return true;
//     }
//     if (timeScale === "seasonal" && !selectedSeason) {
//       return true;
//     }
//     return false;
//   };

//   const isResetDisabled = (): boolean => {
//     return isProcessing || isLoading;
//   };

//   return (
//     <div className="p-4 bg-white rounded-lg shadow-md">
//       {/* Location Selection */}
//       <div className="mb-4">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           {/* River Dropdown */}
//           <div>
//             <label
//               htmlFor="river-dropdown"
//               className="block text-sm font-semibold text-gray-700 mb-2"
//             >
//               River:
//             </label>
//             <select
//               id="river-dropdown"
//               className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(!!selectedRiver)}`}
//               value={selectedRiver || ""}
//               onChange={handleRiverSelect}
//               disabled={selectionsLocked || isLoading}
//             >
//               <option value="">--Choose a River--</option>
//               {rivers.map((river) => (
//                 <option key={river.River_Code} value={river.River_Code}>
//                   {river.River_Name}
//                 </option>
//               ))}
//             </select>
//           </div>

//           {/* Stretch select */}
//           <div>
//             <label
//               htmlFor="stretch-dropdown"
//               className="block text-sm font-semibold text-gray-700 mb-2"
//             >
//               Stretch:
//             </label>
//             <select
//               id="stretch-dropdown"
//               className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(selectedStretch !== null)}`}
//               value={currentStretchValue}
//               onChange={handleStretchesSelect}
//               disabled={!selectedRiver || selectionsLocked || isLoading}
//             >
//               <option value="">--Choose a Stretch--</option>
//               {allStretchIds.map((stretch: number) => (
//                 <option key={stretch} value={stretch}>
//                   {`Stretch ${stretch}`}
//                 </option>
//               ))}
//             </select>
//           </div>

//           {/* Drain Dropdown */}
//           <div>
//             <label
//               htmlFor="drain-dropdown"
//               className="block text-sm font-semibold text-gray-700 mb-2"
//             >
//               Drain:
//             </label>
//             <select
//               id="drain-dropdown"
//               className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(selectedDrain !== null)}`}
//               value={currentDrainValue}
//               onChange={handleDrainsSelect}
//               disabled={!selectedStretch || selectionsLocked || isLoading}
//             >
//               <option value="">--Choose a Drain--</option>
//               {allDrainIds.map((drain: number) => (
//                 <option key={drain} value={drain}>
//                   {`Drain ${drain}`}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* Year, Season and Product Type Selection */}
//       <div className="mb-4">
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//           {/* Time Scale Dropdown */}
//           <div>
//             <label
//               htmlFor="time-scale-dropdown"
//               className="block text-sm font-semibold text-gray-700 mb-2"
//             >
//               Time Scale:
//             </label>
//             <select
//               id="time-scale-dropdown"
//               className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(timeScale === "seasonal" || timeScale === "yearly")}`}
//               value={
//                 timeScale === "seasonal" || timeScale === "yearly"
//                   ? timeScale
//                   : ""
//               }
//               onChange={(e) => {
//                 const value = e.target.value;
//                 if (value === "seasonal" || value === "yearly") {
//                   handleTimeScaleChange(value);
//                 } else if (value === "") {
//                   // Handle explicit deselection from dropdown
//                   setTimeScale("");
//                   setSelectedSeason("");
//                 }
//               }}
//               disabled={selectionsLocked || isLoading}
//             >
//               <option value="">--Choose Time Scale--</option>
//               <option value="seasonal">Seasonal</option>
//               <option value="yearly">Yearly</option>
//             </select>
//           </div>

//           {/* Season Dropdown */}
//           {timeScale === "seasonal" && (
//             <div>
//               <label
//                 htmlFor="season-dropdown"
//                 className="block text-sm font-semibold text-gray-700 mb-2"
//               >
//                 Season:
//               </label>
//               <select
//                 id="season-dropdown"
//                 className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(!!selectedSeason)}`}
//                 value={selectedSeason || ""}
//                 onChange={handleSeasonChange}
//                 disabled={selectionsLocked || isLoading}
//               >
//                 <option value="">--Choose a Season--</option>
//                 {seasons.map((season) => (
//                   <option key={season} value={season}>
//                     {season}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}

//           {/* Year Dropdown */}
//           <div>
//                     <MultiSelect
//                       items={yearItems}
//                       selectedItems={selectedYears}
//                       onSelectionChange={handleYearsChange}
//                       label="Year"
//                       placeholder="--Choose Years--"
//                       disabled={selectionsLocked || isLoading}
//                     />
//                   </div>

//           {/* Product Type Dropdown */}
//           <div>
//             <label
//               htmlFor="product-type-dropdown"
//               className="block text-sm font-semibold text-gray-700 mb-2"
//             >
//               Product Type:
//             </label>
//             <select
//               id="product-type-dropdown"
//               className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(!!selectedProductType)}`}
//               value={selectedProductType || ""}
//               onChange={handleProductTypeChange}
//               disabled={selectionsLocked || isLoading}
//             >
//               <option value="">--Choose Product Type--</option>
//               {productTypes.map((type) => (
//                 <option key={type} value={type}>
//                   {type}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* ✅ COMPACT Display selected values */}
//       <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
//         <h3 className="text-sm font-semibold text-gray-800 mb-2">
//           Selected Parameters
//         </h3>

//         {timeScale === "seasonal" ? (
//           <div className="space-y-1.5 ">
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-3 ">
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">River:</span>{" "}
//                 <span
//                   className={
//                     selectedRiver
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {rivers.find((r) => r.River_Code === selectedRiver)
//                     ?.River_Name || "None"}
//                   {selectedRiver && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Stretch:</span>{" "}
//                 <span
//                   className={
//                     selectedStretch !== null
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedStretch !== null
//                     ? `Stretch ${selectedStretch}`
//                     : "None"}
//                   {selectedStretch !== null && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Drain:</span>{" "}
//                 <span
//                   className={
//                     selectedDrain !== null
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedDrain !== null ? `Drain ${selectedDrain}` : "None"}
//                   {selectedDrain !== null && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Time Scale:</span>{" "}
//                 <span
//                   className={
//                     timeScale ? "text-green-600 font-medium" : "text-gray-400"
//                   }
//                 >
//                   Seasonal
//                   {timeScale && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Season:</span>{" "}
//                 <span
//                   className={
//                     selectedSeason
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedSeason || "None"}
//                   {selectedSeason && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Year:</span>{" "}
//                 <span
//                   className={
//                     selectedYears.length > 0
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {formatTruncatedList([...selectedYears].sort((a, b) => a - b).map(String))}
//                   {selectedYears.length > 0 && (
//       <span > ✓</span>
//     )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">
//                   Product Type:
//                 </span>{" "}
//                 <span
//                   className={
//                     selectedProductType
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedProductType || "None"}
//                   {selectedProductType && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="space-y-1.5">
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">River:</span>{" "}
//                 <span
//                   className={
//                     selectedRiver
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {rivers.find((r) => r.River_Code === selectedRiver)
//                     ?.River_Name || "None"}
//                   {selectedRiver && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Stretch:</span>{" "}
//                 <span
//                   className={
//                     selectedStretch !== null
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedStretch !== null
//                     ? `Stretch ${selectedStretch}`
//                     : "None"}
//                   {selectedStretch !== null && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Drain:</span>{" "}
//                 <span
//                   className={
//                     selectedDrain !== null
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedDrain !== null ? `Drain ${selectedDrain}` : "None"}
//                   {selectedDrain !== null && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Time Scale:</span>{" "}
//                 <span
//                   className={
//                     timeScale === "yearly"
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {timeScale === "yearly" ? "Yearly" : "None"}
//                   {timeScale === "yearly" && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Year:</span>{" "}
//                 <span
//                   className={
//                     selectedYears.length > 0
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedYears.length > 0 ? formatTruncatedList([...selectedYears].sort((a, b) => a - b).map(String)) : "None"}
//                   {selectedYears.length > 0  && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>

//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">
//                   Product Type:
//                 </span>{" "}
//                 <span
//                   className={
//                     selectedProductType
//                       ? "text-green-600 font-medium"
//                       : "text-gray-400"
//                   }
//                 >
//                   {selectedProductType || "None"}
//                   {selectedProductType && (
//                     <span > ✓</span>
//                   )}
//                 </span>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* {selectionsLocked && (
//           <p className="mt-2 text-green-600 font-medium text-xs">
//             <span className="inline-block align-middle">✓</span> All selections
//             confirmed and locked
//           </p>
//         )} */}
//       </div>

//       {/* ACTION BUTTONS */}
//       <div className="flex space-x-4 mt-6">
//         <button
//           className={`${
//             isConfirmDisabled()
//               ? "bg-gray-400 cursor-not-allowed"
//               : "bg-blue-500 hover:bg-blue-700 cursor-pointer"
//           } text-white py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
//           onClick={handleConfirm}
//           disabled={isConfirmDisabled()}
//         >
//           {isProcessing ? "⏳ Processing..." : "Confirm"}
//         </button>

//         <button
//           className={`${
//             isResetDisabled()
//               ? "bg-gray-400 cursor-not-allowed"
//               : "bg-red-500 hover:bg-red-700 cursor-pointer"
//           } text-white py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors`}
//           onClick={handleReset}
//           disabled={isResetDisabled()}
//         >
//           Reset
//         </button>
//       </div>

//       {/* Loading indicator */}
//       {(isLoading || isProcessing) && (
//         <WholeLoading
//           visible={true}
//           title="Connecting to server"
//           message="Working on preparing data"
//         />
//       )}
//     </div>
//   );
// };

// export default RiverSelector;











"use client";
import React, { useState } from "react";
import { useRiverSystem } from "@/contexts/water/users/DrainContext";
import WholeLoading from "@/components/app_layout/newLoading";
import { MultiSelect } from "../../admin/components/Multiselect";

interface RiverSelectorProps {
  onConfirm?: (selectedData: {
    river: number;
    stretch: number;
    drain: number;
    timeScale: "seasonal" | "yearly";
    year: number[];
    season: string;
    productType: string;
    rasterResult?: any;
  }) => void;
}

const RiverSelector: React.FC<RiverSelectorProps> = ({ onConfirm }) => {
  const {
    rivers,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    isLoading,
    handleRiverChange,
    setSelectedStretch,
    setSelectedDrain,
    allStretchIds,
    allDrainIds,
    timeScale,
    setTimeScale,
    selectedYears,
    setSelectedYears,
    selectedSeason,
    setSelectedSeason,
    selectedProductType,
    setSelectedProductType,
    fetchRasterData,
    confirmSelections,
    setDisplayRaster, // ✅ ADDED
  } = useRiverSystem();

  const [isProcessing, setIsProcessing] = useState(false);

  const years = Array.from({ length: 10 }, (_, i) => 2015 + i);
  const seasons = ["Pre-Monsoon", "Monsoon", "Post-Monsoon", "Winter"];
  const productTypes = ["Water Budget", "Surplus", "Deficit", "Index"];

  const yearItems = React.useMemo(() => {
    return years.map((y) => ({ id: y, name: y.toString() }));
  }, [years]);

  const getBorderClass = (isSelected: boolean) => {
    return isSelected
      ? "border-blue-500 ring-1 ring-blue-500"
      : "border-gray-300";
  };

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (value === "") {
      handleRiverChange(null);
      return;
    }
    const newRiverId = parseInt(value);
    if (selectedRiver === newRiverId) {
      handleRiverChange(null);
    } else {
      handleRiverChange(newRiverId);
    }
  };

  const handleStretchesSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    const val = e.target.value;
    if (val === "") {
      setSelectedStretch(null);
      return;
    }
    const newStretchId = parseInt(val);
    if (selectedStretch === newStretchId) {
      setSelectedStretch(null);
    } else {
      setSelectedStretch(newStretchId);
    }
  };

  const handleDrainsSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    const val = e.target.value;
    if (val === "") {
      setSelectedDrain(null);
      return;
    }
    const newDrainId = parseInt(val);
    if (selectedDrain === newDrainId) {
      setSelectedDrain(null);
    } else {
      setSelectedDrain(newDrainId);
    }
  };

  const fetchRealRasterData = async (
    drain_no: number,
    year: number[],
    product_type: string,
    time_scale: "seasonal" | "yearly",
    season: string
  ): Promise<any> => {
    try {
      console.log("🔄 Calling real API: /api/water/process_drain_raster");

      const payload = {
        drain_no,
        year,
        product_type,
        time_scale,
        season: time_scale === "seasonal" ? season : "",
      };

      console.log("📤 API Payload:", payload);

      const response = await fetch("/api/water/process_drain_raster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log("✅ API Response:", result);

      if (result && result.clipped_rasters) {
        return {
          clipped_rasters: result.clipped_rasters,
          bbox: result.bbox || null,
          study_area_vector: result.study_area_vector || null,
        };
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Real API error:", errorMsg);
      throw error;
    }
  };

  const createMockRasterData = (years: number[]) => {
    return {
      clipped_rasters: [
        {
          layer_name: `water_test_${years[0]}_${Date.now()}`,
          original_name: "water_availability_clipped",
          workspace: "water_Availability",
          style: "default",
          year: years[0],
        },
      ],
    };
  };

  const handleConfirm = async (): Promise<void> => {
    if (selectedDrain && !isConfirmDisabled()) {
      setIsProcessing(true);
      try {
        console.log("📍 Confirm clicked - starting confirmation flow");

        const lockedData = confirmSelections();
        console.log("✓ Selections locked:", lockedData);

        if (!lockedData) {
          console.error("❌ Failed to lock selections");
          setIsProcessing(false);
          return;
        }

        let rasterResult = null;

        console.log("🔄 Calling Real API with latest selections...");
        try {
          rasterResult = await fetchRealRasterData(
            selectedDrain,
            selectedYears,
            selectedProductType,
            timeScale as "seasonal" | "yearly",
            selectedSeason
          );
          console.log("✅ Real API returned:", rasterResult);

          // ✅ ADDED: displayRaster update karo - map ka year panel yahi use karta hai
          if (rasterResult?.clipped_rasters?.length > 0) {
            setDisplayRaster(rasterResult.clipped_rasters);
          }
        } catch (apiError) {
          console.error("❌ Real API call failed:", apiError);
        }

        // Fallback: GeoServer
        if (
          !rasterResult ||
          !rasterResult.clipped_rasters ||
          rasterResult.clipped_rasters.length === 0
        ) {
          console.log("🗺️ Real API failed, trying GeoServer...");
          try {
            rasterResult = await fetchRasterData(); // yeh already setDisplayRaster karta hai
            console.log("✓ GeoServer returned:", rasterResult);
          } catch (error) {
            console.error("❌ GeoServer error:", error);
          }
        }

        // Last resort: Mock data
        if (
          !rasterResult ||
          !rasterResult.clipped_rasters ||
          rasterResult.clipped_rasters.length === 0
        ) {
          console.warn("⚠️ All sources failed - using MOCK data");
          rasterResult = createMockRasterData(selectedYears);
          console.log("✅ Using MOCK raster data:", rasterResult);
        }

        if (
          !rasterResult ||
          !rasterResult.clipped_rasters ||
          rasterResult.clipped_rasters.length === 0
        ) {
          console.error("❌ No raster data available from any source");
          setIsProcessing(false);
          return;
        }

        if (onConfirm) {
          const confirmData = {
            river: Number(selectedRiver),
            stretch: Number(selectedStretch),
            drain: Number(selectedDrain),
            timeScale: timeScale as "seasonal" | "yearly",
            year: selectedYears,
            season: selectedSeason,
            productType: selectedProductType,
            rasterResult: rasterResult,
          };

          console.log("✅ Calling onConfirm with latest data:", confirmData);
          onConfirm(confirmData);
        }
      } catch (error) {
        console.error("❌ Error in handleConfirm:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleTimeScaleChange = (scale: "seasonal" | "yearly"): void => {
    if (timeScale === scale) {
      setTimeScale("");
      setSelectedSeason("");
    } else {
      setTimeScale(scale);
      if (scale === "yearly") {
        setSelectedSeason("");
      }
    }
  };

  const handleYearsChange = (selectedIds: number[]): void => {
    setSelectedYears(selectedIds);
  };

  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (value === "") {
      setSelectedSeason("");
      return;
    }
    if (selectedSeason === value) {
      setSelectedSeason("");
    } else {
      setSelectedSeason(value);
    }
  };

  const handleProductTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    const value = e.target.value;
    if (value === "") {
      setSelectedProductType("");
      return;
    }
    if (selectedProductType === value) {
      setSelectedProductType("");
    } else {
      setSelectedProductType(value);
    }
  };

  const formatTruncatedList = (items: string[]) => {
    if (items.length === 0) return "None";
    if (items.length <= 3) return items.join(", ");
    return `${items.slice(0, 3).join(", ")}, +${items.length - 3} more`;
  };

  const currentStretchValue = selectedStretch !== null ? selectedStretch : "";
  const currentDrainValue = selectedDrain !== null ? selectedDrain : "";

  const isConfirmDisabled = (): boolean => {
    if (
      isLoading ||
      isProcessing ||
      selectedDrain === null ||
      selectedYears.length === 0 ||
      !selectedProductType ||
      !timeScale
    ) {
      return true;
    }
    if (timeScale === "seasonal" && !selectedSeason) {
      return true;
    }
    return false;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {/* Location Selection */}
      <div className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* River Dropdown */}
          <div>
            <label
              htmlFor="river-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              River:
            </label>
            <select
              id="river-dropdown"
              className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(!!selectedRiver)}`}
              value={selectedRiver || ""}
              onChange={handleRiverSelect}
              disabled={isLoading}
            >
              <option value="">--Choose a River--</option>
              {rivers.map((river) => (
                <option key={river.River_Code} value={river.River_Code}>
                  {river.River_Name}
                </option>
              ))}
            </select>
          </div>

          {/* Stretch Dropdown */}
          <div>
            <label
              htmlFor="stretch-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Stretch:
            </label>
            <select
              id="stretch-dropdown"
              className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(selectedStretch !== null)}`}
              value={currentStretchValue}
              onChange={handleStretchesSelect}
              disabled={!selectedRiver || isLoading}
            >
              <option value="">--Choose a Stretch--</option>
              {allStretchIds.map((stretch: number) => (
                <option key={stretch} value={stretch}>
                  {`Stretch ${stretch}`}
                </option>
              ))}
            </select>
          </div>

          {/* Drain Dropdown */}
          <div>
            <label
              htmlFor="drain-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Drain:
            </label>
            <select
              id="drain-dropdown"
              className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(selectedDrain !== null)}`}
              value={currentDrainValue}
              onChange={handleDrainsSelect}
              disabled={!selectedStretch || isLoading}
            >
              <option value="">--Choose a Drain--</option>
              {allDrainIds.map((drain: number) => (
                <option key={drain} value={drain}>
                  {`Drain ${drain}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Year, Season and Product Type Selection */}
      <div className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Time Scale Dropdown */}
          <div>
            <label
              htmlFor="time-scale-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Time Scale:
            </label>
            <select
              id="time-scale-dropdown"
              className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(
                timeScale === "seasonal" || timeScale === "yearly"
              )}`}
              value={
                timeScale === "seasonal" || timeScale === "yearly"
                  ? timeScale
                  : ""
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === "seasonal" || value === "yearly") {
                  handleTimeScaleChange(value);
                } else if (value === "") {
                  setTimeScale("");
                  setSelectedSeason("");
                }
              }}
              disabled={isLoading}
            >
              <option value="">--Choose Time Scale--</option>
              <option value="seasonal">Seasonal</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Season Dropdown */}
          {timeScale === "seasonal" && (
            <div>
              <label
                htmlFor="season-dropdown"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Season:
              </label>
              <select
                id="season-dropdown"
                className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(
                  !!selectedSeason
                )}`}
                value={selectedSeason || ""}
                onChange={handleSeasonChange}
                disabled={isLoading}
              >
                <option value="">--Choose a Season--</option>
                {seasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year MultiSelect */}
          <div>
            <MultiSelect
              items={yearItems}
              selectedItems={selectedYears}
              onSelectionChange={handleYearsChange}
              label="Year"
              placeholder="--Choose Years--"
              disabled={isLoading}
            />
          </div>

          {/* Product Type Dropdown */}
          <div>
            <label
              htmlFor="product-type-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Product Type:
            </label>
            <select
              id="product-type-dropdown"
              className={`w-full p-2 text-sm border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${getBorderClass(
                !!selectedProductType
              )}`}
              value={selectedProductType || ""}
              onChange={handleProductTypeChange}
              disabled={isLoading}
            >
              <option value="">--Choose Product Type--</option>
              {productTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Parameters Display */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Selected Parameters
        </h3>

        {timeScale === "seasonal" ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">River:</span>{" "}
                <span className={selectedRiver ? "text-green-600 font-medium" : "text-gray-400"}>
                  {rivers.find((r) => r.River_Code === selectedRiver)?.River_Name || "None"}
                  {selectedRiver && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Stretch:</span>{" "}
                <span className={selectedStretch !== null ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedStretch !== null ? `Stretch ${selectedStretch}` : "None"}
                  {selectedStretch !== null && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Drain:</span>{" "}
                <span className={selectedDrain !== null ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedDrain !== null ? `Drain ${selectedDrain}` : "None"}
                  {selectedDrain !== null && <span> ✓</span>}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Time Scale:</span>{" "}
                <span className={timeScale ? "text-green-600 font-medium" : "text-gray-400"}>
                  Seasonal{timeScale && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Season:</span>{" "}
                <span className={selectedSeason ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedSeason || "None"}
                  {selectedSeason && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Year:</span>{" "}
                <span className={selectedYears.length > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                  {formatTruncatedList([...selectedYears].sort((a, b) => a - b).map(String))}
                  {selectedYears.length > 0 && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Product Type:</span>{" "}
                <span className={selectedProductType ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedProductType || "None"}
                  {selectedProductType && <span> ✓</span>}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">River:</span>{" "}
                <span className={selectedRiver ? "text-green-600 font-medium" : "text-gray-400"}>
                  {rivers.find((r) => r.River_Code === selectedRiver)?.River_Name || "None"}
                  {selectedRiver && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Stretch:</span>{" "}
                <span className={selectedStretch !== null ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedStretch !== null ? `Stretch ${selectedStretch}` : "None"}
                  {selectedStretch !== null && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Drain:</span>{" "}
                <span className={selectedDrain !== null ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedDrain !== null ? `Drain ${selectedDrain}` : "None"}
                  {selectedDrain !== null && <span> ✓</span>}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Time Scale:</span>{" "}
                <span className={timeScale === "yearly" ? "text-green-600 font-medium" : "text-gray-400"}>
                  {timeScale === "yearly" ? "Yearly" : "None"}
                  {timeScale === "yearly" && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Year:</span>{" "}
                <span className={selectedYears.length > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedYears.length > 0
                    ? formatTruncatedList([...selectedYears].sort((a, b) => a - b).map(String))
                    : "None"}
                  {selectedYears.length > 0 && <span> ✓</span>}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Product Type:</span>{" "}
                <span className={selectedProductType ? "text-green-600 font-medium" : "text-gray-400"}>
                  {selectedProductType || "None"}
                  {selectedProductType && <span> ✓</span>}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex space-x-4 mt-6">
        <button
          className={`${
            isConfirmDisabled()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-700 cursor-pointer"
          } text-white py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
          onClick={handleConfirm}
          disabled={isConfirmDisabled()}
        >
          {isProcessing ? "⏳ Processing..." : "Confirm"}
        </button>
      </div>

      {/* Loading indicator */}
      {(isLoading || isProcessing) && (
        <WholeLoading
          visible={true}
          title="Connecting to server"
          message="Working on preparing data"
        />
      )}
    </div>
  );
};

export default RiverSelector;