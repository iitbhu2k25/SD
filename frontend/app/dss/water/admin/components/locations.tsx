// // frontend/app/dss/water/admin/components/locations.tsx
// "use client";
// import React, { useState } from "react";
// import { MultiSelect } from "./Multiselect";
// import { useLocation } from "@/contexts/water/admin/LocationContext";
// import { useMap } from "@/contexts/water/admin/MapContext";
// import { SubDistrict } from "@/interface/raster_context";
// import WholeLoading from "@/components/app_layout/newLoading";

// interface WaterAdminLocationOutput {
//   clippedrasters: any[];
//   [key: string]: any;
// }

// interface LocationSelectorProps {
//   onConfirm?: (selectedData: {
//     subDistricts: SubDistrict[];
//     totalPopulation: number;
//     year: number;
//     season: string;
//     productType: string;
//     timeScale: string;
//     rasterResult?: WaterAdminLocationOutput;
//   }) => void;
//   onReset?: () => void;
// }

// const LocationSelector: React.FC<LocationSelectorProps> = ({
//   onConfirm,
//   onReset,
// }) => {
//   const {
//     states,
//     districts,
//     subDistricts,
//     selectedState,
//     selectedDistricts,
//     selectedSubDistricts,
//     selectionsLocked,
//     isLoading,
//     handleStateChange,
//     setSelectedDistricts,
//     setSelectedSubDistricts,
//     confirmSelections,
//     resetSelections,
//   } = useLocation();

//   const { resetMapLayers } = useMap();

//   const [timeScale, setTimeScale] = useState<string>("");
//   const [selectedYears, setSelectedYears] = useState<number[]>([]);
//   const [selectedSeason, setSelectedSeason] = useState<string>("");
//   const [selectedProductType, setSelectedProductType] = useState<string>("");
//   const [yearSeasonLocked, setYearSeasonLocked] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);

//   const years = Array.from({ length: 10 }, (_, i) => 2015 + i);
//   const seasons = ["Pre-Monsoon", "Monsoon", "Post-Monsoon", "Winter"];
//   const productTypes = ["Water Budget", "Surplus", "Deficit", "Index"];

//   const ALLOWED_STATE_ID = 36;

//   const sortedStates = React.useMemo(() => {
//     const allowedState = states.find((state) => state.id === ALLOWED_STATE_ID);
//     const otherStates = states
//       .filter((state) => state.id !== ALLOWED_STATE_ID)
//       .sort((a, b) => a.name.localeCompare(b.name));
//     return allowedState ? [allowedState, ...otherStates] : otherStates;
//   }, [states]);

//   const yearItems = React.useMemo(() => {
//     return years.map((y) => ({ id: y, name: y.toString() }));
//   }, [years]);

//   // ✅ NEW: First item as green pill, remaining as +N more blue badge
//   const renderTagList = (items: string[]) => {
//     if (items.length === 0) return <span className="text-gray-400">None</span>;

//     const first = items[0];
//     const remaining = items.length - 1;

//     return (
//       <span className="inline-flex flex-wrap gap-1 items-center mt-0.5">
//         <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//           {first}
//         </span>
//         {remaining > 0 && (
//           <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-400 border-dashed">
//             +{remaining} more
//           </span>
//         )}
//       </span>
//     );
//   };

//   const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
//     if (selectionsLocked) return;
//     const value = e.target.value;
//     if (value === "") {
//       handleStateChange(null);
//       return;
//     }
//     const stateId = parseInt(value);
//     if (stateId === ALLOWED_STATE_ID) {
//       handleStateChange(stateId);
//     }
//   };

//   const handleDistrictsChange = (selectedIds: number[]): void => {
//     if (!selectionsLocked) {
//       setSelectedDistricts(selectedIds);
//     }
//   };

//   const handleSubDistrictsChange = (selectedIds: number[]): void => {
//     if (!selectionsLocked) {
//       setSelectedSubDistricts(selectedIds);
//     }
//   };

//   const handleTimeScaleChange = (scale: "seasonal" | "yearly"): void => {
//     if (!yearSeasonLocked) {
//       setTimeScale(scale);
//       if (scale === "yearly") {
//         setSelectedSeason("");
//       }
//     }
//   };

//   const handleYearsChange = (selectedIds: number[]): void => {
//     if (!yearSeasonLocked) {
//       setSelectedYears(selectedIds);
//     }
//   };

//   const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
//     if (!yearSeasonLocked) {
//       setSelectedSeason(e.target.value);
//     }
//   };

//   const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
//     if (!yearSeasonLocked) {
//       setSelectedProductType(e.target.value);
//     }
//   };

//   const handleConfirm = async (): Promise<void> => {
//     const isValid =
//       timeScale === "yearly"
//         ? selectedSubDistricts.length > 0 &&
//           selectedYears.length > 0 &&
//           selectedProductType
//         : selectedSubDistricts.length > 0 &&
//           selectedYears.length > 0 &&
//           selectedSeason &&
//           selectedProductType;

//     if (!isValid || selectionsLocked) return;

//     setIsProcessing(true);

//     try {
//       const selectedData = confirmSelections();
//       if (!selectedData) {
//         console.error("Failed to get selection data");
//         return;
//       }

//       const response = await fetch("/api/water/process_water_raster", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           subdistrict_codes: selectedSubDistricts,
//           year: selectedYears,
//           season: timeScale === "yearly" ? "Yearly" : selectedSeason,
//           product_type: selectedProductType,
//           time_scale: timeScale,
//         }),
//       });

//       if (response.status === 201 || response.status === 200) {
//         const data = await response.json();
//         const rasterResponse = data.message || data;
//         console.log("Raster response:", rasterResponse);

//         setYearSeasonLocked(true);

//         if (onConfirm) {
//           onConfirm({
//             ...selectedData,
//             year: selectedYears as any,
//             season: timeScale === "yearly" ? "Yearly" : selectedSeason,
//             productType: selectedProductType,
//             timeScale: timeScale,
//             rasterResult: rasterResponse,
//           });
//         }
//         console.log("✓ Raster data processed successfully");
//       } else {
//         console.error("Unexpected response from server");
//       }
//     } catch (error) {
//       console.error("API Error:", error);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const handleReset = (): void => {
//     console.log("🔄 Starting complete reset...");
//     setTimeScale("");
//     setSelectedYears([]);
//     setSelectedSeason("");
//     setSelectedProductType("");
//     setYearSeasonLocked(false);
//     setIsProcessing(false);
//     resetSelections();
//     resetMapLayers();
//     if (onReset) onReset();
//     console.log("✅ Complete reset finished - all selections cleared");
//   };

//   const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
//     return subDistrict.name;
//   };

//   const isConfirmDisabled = (): boolean => {
//     if (
//       selectionsLocked ||
//       isLoading ||
//       yearSeasonLocked ||
//       isProcessing ||
//       selectedSubDistricts.length === 0 ||
//       selectedYears.length === 0 ||
//       !selectedProductType
//     ) return true;
//     if (timeScale === "seasonal" && !selectedSeason) return true;
//     return false;
//   };

//   const isResetDisabled = (): boolean => {
//     return isProcessing || isLoading;
//   };

//   // ✅ Helper: get district names array
//   const getDistrictNames = () =>
//     selectedDistricts.length === districts.length
//       ? ["All Districts"]
//       : districts
//           .filter((d) => selectedDistricts.includes(Number(d.id)))
//           .map((d) => d.name);

//   // ✅ Helper: get sub-district names array
//   const getSubDistrictNames = () =>
//     selectedSubDistricts.length === subDistricts.length
//       ? ["All Sub-Districts"]
//       : subDistricts
//           .filter((sd) => selectedSubDistricts.includes(Number(sd.id)))
//           .map((sd) => sd.name);

//   // ✅ Helper: get sorted year strings
//   const getYearNames = () =>
//     [...selectedYears].sort((a, b) => a - b).map(String);

//   return (
//     <div className="p-4 bg-rede rounded-lg shadow-md">
//       {/* Location Selection */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
//         {/* STATE DROPDOWN */}
//         <div>
//           <label
//             htmlFor="state-dropdown"
//             className="block text-sm font-semibold text-gray-700 mb-2 cursor-pointer"
//           >
//             State:
//           </label>
//           <select
//             id="state-dropdown"
//             className={`
//               w-full p-2 text-sm rounded-md transition
//               ${selectedState !== null
//                 ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-400"
//                 : "border border-gray-300 bg-gray-100 text-gray-500"
//               }
//               hover:border-gray-400 hover:shadow-sm
//               focus:outline-none focus:ring-2 focus:ring-blue-400
//               disabled:opacity-50 disabled:cursor-not-allowed
//             `}
//             value={selectedState || ""}
//             onChange={handleStateSelect}
//             disabled={selectionsLocked || isLoading}
//           >
//             <option value="">--Choose State--</option>
//             {sortedStates.map((state) => {
//               const isAllowedState = state.id === ALLOWED_STATE_ID;
//               return (
//                 <option
//                   key={state.id}
//                   value={state.id}
//                   disabled={!isAllowedState}
//                   className={
//                     isAllowedState
//                       ? "bg-emerald-100 text-black font-bold border-t border-emerald-300"
//                       : "bg-gray-100 text-gray-600"
//                   }
//                 >
//                   {isAllowedState && " "}
//                   {state.name}
//                   {!isAllowedState}
//                 </option>
//               );
//             })}
//           </select>
//         </div>

//         {/* District Multiselect */}
//         <MultiSelect
//           items={districts}
//           selectedItems={selectedDistricts}
//           onSelectionChange={handleDistrictsChange}
//           label="District"
//           placeholder="--Choose Districts--"
//           disabled={!selectedState || selectionsLocked || isLoading}
//           allowedIds={[691, 637, 669, 696, 704]}
//         />

//         {/* Sub-District Multiselect */}
//         <MultiSelect
//           items={subDistricts}
//           selectedItems={selectedSubDistricts}
//           onSelectionChange={handleSubDistrictsChange}
//           label="Sub-District"
//           placeholder="--Choose SubDistricts--"
//           disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
//           displayPattern={formatSubDistrictDisplay}
//         />
//       </div>

//       {/* Year, Season and Product Type Selection */}
//       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
//         <div className="mb-4">
//           <label
//             htmlFor="timescale-dropdown"
//             className="block text-sm font-semibold text-gray-700 mb-2"
//           >
//             Time Scale:
//           </label>
//           <select
//             id="timescale-dropdown"
//             className={`
//               w-full p-2 text-sm rounded-md transition
//               ${timeScale !== ""
//                 ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
//                 : "border border-gray-300 bg-gray-100 text-gray-500"
//               }
//               hover:border-gray-400 hover:shadow-sm
//               focus:outline-none focus:ring-2 focus:ring-blue-400
//               disabled:opacity-50 disabled:cursor-not-allowed
//             `}
//             value={timeScale}
//             onChange={(e) => handleTimeScaleChange(e.target.value as "seasonal" | "yearly")}
//             disabled={yearSeasonLocked || isLoading}
//           >
//             <option value="">--Choose Time Scale--</option>
//             <option value="seasonal">Seasonal</option>
//             <option value="yearly">Yearly</option>
//           </select>
//         </div>

//         {timeScale === "seasonal" && (
//           <div>
//             <label
//               htmlFor="season-dropdown"
//               className="block text-sm font-semibold text-gray-700 mb-2"
//             >
//               Season:
//             </label>
//             <select
//               id="season-dropdown"
//               className={`
//                 w-full p-2 text-sm rounded-md transition
//                 ${selectedSeason !== null && selectedSeason !== ""
//                   ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
//                   : "border border-gray-300 bg-gray-100 text-gray-500"
//                 }
//                 hover:border-gray-400 hover:shadow-sm
//                 focus:outline-none focus:ring-2 focus:ring-blue-400
//                 disabled:opacity-50 disabled:cursor-not-allowed
//               `}
//               value={selectedSeason || ""}
//               onChange={handleSeasonChange}
//               disabled={yearSeasonLocked || isLoading}
//             >
//               <option value="">--Choose a Season--</option>
//               {seasons.map((season) => (
//                 <option key={season} value={season}>{season}</option>
//               ))}
//             </select>
//           </div>
//         )}

//         <div>
//           <MultiSelect
//             items={yearItems}
//             selectedItems={selectedYears}
//             onSelectionChange={handleYearsChange}
//             label="Year"
//             placeholder="--Choose Years--"
//             disabled={yearSeasonLocked || isLoading}
//           />
//         </div>

//         <div>
//           <label
//             htmlFor="product-type-dropdown"
//             className="block text-sm font-semibold text-gray-700 mb-2"
//           >
//             Product Type:
//           </label>
//           <select
//             id="product-type-dropdown"
//             className={`
//               w-full p-2 text-sm rounded-md transition
//               ${selectedProductType !== null && selectedProductType !== ""
//                 ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
//                 : "border border-gray-300 bg-gray-100 text-gray-500"
//               }
//               hover:border-gray-400 hover:shadow-sm
//               focus:outline-none focus:ring-2 focus:ring-blue-400
//               disabled:opacity-50 disabled:cursor-not-allowed
//             `}
//             value={selectedProductType || ""}
//             onChange={handleProductTypeChange}
//             disabled={yearSeasonLocked || isLoading}
//           >
//             <option value="">--Choose Product Type--</option>
//             {productTypes.map((type) => (
//               <option key={type} value={type}>{type}</option>
//             ))}
//           </select>
//         </div>
//       </div>

//       {/* ✅ UPDATED: Display selected values with pill tags */}
//       <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
//         <h3 className="text-sm font-semibold text-gray-800 mb-2">
//           Selected Parameters
//         </h3>

//         {timeScale === "seasonal" ? (
//           <div className="space-y-2">
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//               {/* State */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">State: </span>
//                 {selectedState ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     {states.find((s) => s.id === selectedState)?.name} ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Districts */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Districts: </span>
//                 {selectedDistricts.length > 0 ? (
//                   renderTagList(getDistrictNames())
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Sub-Districts */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Sub-Districts: </span>
//                 {selectedSubDistricts.length > 0 ? (
//                   renderTagList(getSubDistrictNames())
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
//               {/* Time Scale */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Time Scale: </span>
//                 {timeScale ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     Seasonal ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Season */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Season: </span>
//                 {selectedSeason ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     {selectedSeason} ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Years */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Year: </span>
//                 {selectedYears.length > 0 ? (
//                   renderTagList(getYearNames())
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Product Type */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Product Type: </span>
//                 {selectedProductType ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     {selectedProductType} ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="space-y-2">
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//               {/* State */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">State: </span>
//                 {selectedState ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     {states.find((s) => s.id === selectedState)?.name} ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Districts */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Districts: </span>
//                 {selectedDistricts.length > 0 ? (
//                   renderTagList(getDistrictNames())
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Sub-Districts */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Sub-Districts: </span>
//                 {selectedSubDistricts.length > 0 ? (
//                   renderTagList(getSubDistrictNames())
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//               {/* Time Scale */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Time Scale: </span>
//                 {timeScale === "yearly" ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     Yearly ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Years */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Year: </span>
//                 {selectedYears.length > 0 ? (
//                   renderTagList(getYearNames())
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>

//               {/* Product Type */}
//               <div className="text-sm">
//                 <span className="font-semibold text-gray-600">Product Type: </span>
//                 {selectedProductType ? (
//                   <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
//                     {selectedProductType} ✓
//                   </span>
//                 ) : (
//                   <span className="text-gray-400">None</span>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}

       
//       </div>

//       {/* ACTION BUTTONS */}
//       <div className="flex space-x-4 mt-4">
//         <button
//           onClick={handleConfirm}
//           disabled={isConfirmDisabled()}
//           className={`px-6 py-2 rounded-md font-medium transition border ${
//             isConfirmDisabled()
//               ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400"
//               : "bg-green-500 text-white hover:bg-green-600 border-green-600 cursor-pointer"
//           }`}
//         >
//           {isProcessing ? (
//             <span className="flex items-center gap-2">
//               <span className="animate-spin">⏳</span>
//               Processing...
//             </span>
//           ) : (
//             "Confirm"
//           )}
//         </button>

//         <button
//           onClick={handleReset}
//           disabled={isResetDisabled()}
//           className={`px-6 py-2 rounded-md font-medium transition border ${
//             isResetDisabled()
//               ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400"
//               : "bg-red-500 text-white hover:bg-red-600 border-red-600 cursor-pointer"
//           }`}
//         >
//           Reset
//         </button>
//       </div>

//       {/* Loading indicator */}
//       {(isLoading || isProcessing) && (
//         <WholeLoading
//           visible={true}
//           title={isProcessing ? "Processing data" : "Connecting to server"}
//           message={
//             isProcessing
//               ? "Working on preparing data"
//               : "Working on preparing data"
//           }
//         />
//       )}
//     </div>
//   );
// };

// export default LocationSelector;










"use client";
import React, { useState } from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation } from "@/contexts/water/admin/LocationContext";
import { useMap } from "@/contexts/water/admin/MapContext";
import { SubDistrict } from "@/interface/raster_context";
import WholeLoading from "@/components/app_layout/newLoading";

interface WaterAdminLocationOutput {
  clippedrasters: any[];
  [key: string]: any;
}

interface LocationSelectorProps {
  onConfirm?: (selectedData: {
    subDistricts: SubDistrict[];
    totalPopulation: number;
    year: number;
    season: string;
    productType: string;
    timeScale: string;
    rasterResult?: WaterAdminLocationOutput;
  }) => void;
  onReset?: () => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  onConfirm,
  onReset,
}) => {
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    confirmSelections,
    resetSelections,
  } = useLocation();

  const { resetMapLayers } = useMap();

  const [timeScale, setTimeScale] = useState<string>("");
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [yearSeasonLocked, setYearSeasonLocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const years = Array.from({ length: 10 }, (_, i) => 2015 + i);
  const seasons = ["Pre-Monsoon", "Monsoon", "Post-Monsoon", "Winter"];
  const productTypes = ["Water Budget", "Surplus", "Deficit", "Index"];

  const ALLOWED_STATE_ID = 36;

  const sortedStates = React.useMemo(() => {
    const allowedState = states.find((state) => state.id === ALLOWED_STATE_ID);
    const otherStates = states
      .filter((state) => state.id !== ALLOWED_STATE_ID)
      .sort((a, b) => a.name.localeCompare(b.name));
    return allowedState ? [allowedState, ...otherStates] : otherStates;
  }, [states]);

  const yearItems = React.useMemo(() => {
    return years.map((y) => ({ id: y, name: y.toString() }));
  }, [years]);

  const renderTagList = (items: string[]) => {
    if (items.length === 0) return <span className="text-gray-400">None</span>;
    const first = items[0];
    const remaining = items.length - 1;
    return (
      <span className="inline-flex flex-wrap gap-1 items-center mt-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
          {first}
        </span>
        {remaining > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-400 border-dashed">
            +{remaining} more
          </span>
        )}
      </span>
    );
  };

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (value === "") {
      handleStateChange(null);
    } else {
      const stateId = parseInt(value);
      if (stateId === ALLOWED_STATE_ID) {
        handleStateChange(stateId);
      }
    }
    setYearSeasonLocked(false); // ✅ Confirm active on change
  };

  // ✅ selectionsLocked hata diya - always editable, yearSeasonLocked reset
  const handleDistrictsChange = (selectedIds: number[]): void => {
    setSelectedDistricts(selectedIds);
    setYearSeasonLocked(false); // ✅ Confirm active on change
  };

  // ✅ selectionsLocked hata diya - always editable, yearSeasonLocked reset
  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    setSelectedSubDistricts(selectedIds);
    setYearSeasonLocked(false); // ✅ Confirm active on change
  };

  const handleTimeScaleChange = (scale: "seasonal" | "yearly"): void => {
    setTimeScale(scale);
    setYearSeasonLocked(false); // ✅ Confirm active on change
    if (scale === "yearly") {
      setSelectedSeason("");
    }
  };

  const handleYearsChange = (selectedIds: number[]): void => {
    setSelectedYears(selectedIds);
    setYearSeasonLocked(false); // ✅ Confirm active on change
  };

  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedSeason(e.target.value);
    setYearSeasonLocked(false); // ✅ Confirm active on change
  };

  const handleProductTypeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedProductType(e.target.value);
    setYearSeasonLocked(false); // ✅ Confirm active on change
  };

  const handleConfirm = async (): Promise<void> => {
    const isValid =
      timeScale === "yearly"
        ? selectedSubDistricts.length > 0 &&
          selectedYears.length > 0 &&
          selectedProductType
        : selectedSubDistricts.length > 0 &&
          selectedYears.length > 0 &&
          selectedSeason &&
          selectedProductType;

    if (!isValid) return;

    setIsProcessing(true);

    try {
      const selectedData = confirmSelections();
      if (!selectedData) {
        console.error("Failed to get selection data");
        return;
      }

      const response = await fetch("/api/water/process_water_raster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdistrict_codes: selectedSubDistricts,
          year: selectedYears,
          season: timeScale === "yearly" ? "Yearly" : selectedSeason,
          product_type: selectedProductType,
          time_scale: timeScale,
        }),
      });

      if (response.status === 201 || response.status === 200) {
        const data = await response.json();
        const rasterResponse = data.message || data;
        console.log("Raster response:", rasterResponse);

        // ✅ Sirf Reset enable karne ke liye
        setYearSeasonLocked(true);

        if (onConfirm) {
          onConfirm({
            ...selectedData,
            year: selectedYears as any,
            season: timeScale === "yearly" ? "Yearly" : selectedSeason,
            productType: selectedProductType,
            timeScale: timeScale,
            rasterResult: rasterResponse,
          });
        }
        console.log("✓ Raster data processed successfully");
      } else {
        console.error("Unexpected response from server");
      }
    } catch (error) {
      console.error("API Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = (): void => {
    console.log("🔄 Starting complete reset...");
    setTimeScale("");
    setSelectedYears([]);
    setSelectedSeason("");
    setSelectedProductType("");
    setYearSeasonLocked(false);
    setIsProcessing(false);
    resetSelections();
    resetMapLayers();
    if (onReset) onReset();
    console.log("✅ Complete reset finished - all selections cleared");
  };

  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
    return subDistrict.name;
  };

  // ✅ selectionsLocked aur yearSeasonLocked dono hata diye
  const isConfirmDisabled = (): boolean => {
    if (
      isLoading ||
      isProcessing ||
      selectedSubDistricts.length === 0 ||
      selectedYears.length === 0 ||
      !selectedProductType ||
      !timeScale
    ) return true;
    if (timeScale === "seasonal" && !selectedSeason) return true;
    return false;
  };

  // ✅ Reset sirf Confirm ke baad active
  const isResetDisabled = (): boolean => {
    return isProcessing || isLoading || !yearSeasonLocked;
  };

  const getDistrictNames = () =>
    selectedDistricts.length === districts.length
      ? ["All Districts"]
      : districts
          .filter((d) => selectedDistricts.includes(Number(d.id)))
          .map((d) => d.name);

  const getSubDistrictNames = () =>
    selectedSubDistricts.length === subDistricts.length
      ? ["All Sub-Districts"]
      : subDistricts
          .filter((sd) => selectedSubDistricts.includes(Number(sd.id)))
          .map((sd) => sd.name);

  const getYearNames = () =>
    [...selectedYears].sort((a, b) => a - b).map(String);

  return (
    <div className="p-4 bg-rede rounded-lg shadow-md">
      {/* Location Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* STATE DROPDOWN */}
        <div>
          <label
            htmlFor="state-dropdown"
            className="block text-sm font-semibold text-gray-700 mb-2 cursor-pointer"
          >
            State:
          </label>
          <select
            id="state-dropdown"
            className={`
              w-full p-2 text-sm rounded-md transition
              ${selectedState !== null
                ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-400"
                : "border border-gray-300 bg-gray-100 text-gray-500"
              }
              hover:border-gray-400 hover:shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            value={selectedState || ""}
            onChange={handleStateSelect}
            disabled={isLoading}
          >
            <option value="">--Choose State--</option>
            {sortedStates.map((state) => {
              const isAllowedState = state.id === ALLOWED_STATE_ID;
              return (
                <option
                  key={state.id}
                  value={state.id}
                  disabled={!isAllowedState}
                  className={
                    isAllowedState
                      ? "bg-emerald-100 text-black font-bold border-t border-emerald-300"
                      : "bg-gray-100 text-gray-600"
                  }
                >
                  {isAllowedState && " "}
                  {state.name}
                  {!isAllowedState}
                </option>
              );
            })}
          </select>
        </div>

        {/* ✅ District - selectionsLocked hata diya */}
        <MultiSelect
          items={districts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || isLoading}
          allowedIds={[691, 637, 669, 696, 704]}
        />

        {/* ✅ Sub-District - selectionsLocked hata diya */}
        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder="--Choose SubDistricts--"
          disabled={selectedDistricts.length === 0 || isLoading}
          displayPattern={formatSubDistrictDisplay}
        />
      </div>

      {/* Year, Season and Product Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="mb-4">
          <label
            htmlFor="timescale-dropdown"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Time Scale:
          </label>
          <select
            id="timescale-dropdown"
            className={`
              w-full p-2 text-sm rounded-md transition
              ${timeScale !== ""
                ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
                : "border border-gray-300 bg-gray-100 text-gray-500"
              }
              hover:border-gray-400 hover:shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            value={timeScale}
            onChange={(e) => handleTimeScaleChange(e.target.value as "seasonal" | "yearly")}
            disabled={isLoading}
          >
            <option value="">--Choose Time Scale--</option>
            <option value="seasonal">Seasonal</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

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
              className={`
                w-full p-2 text-sm rounded-md transition
                ${selectedSeason !== null && selectedSeason !== ""
                  ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
                  : "border border-gray-300 bg-gray-100 text-gray-500"
                }
                hover:border-gray-400 hover:shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-400
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              value={selectedSeason || ""}
              onChange={handleSeasonChange}
              disabled={isLoading}
            >
              <option value="">--Choose a Season--</option>
              {seasons.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        )}

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

        <div>
          <label
            htmlFor="product-type-dropdown"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Product Type:
          </label>
          <select
            id="product-type-dropdown"
            className={`
              w-full p-2 text-sm rounded-md transition
              ${selectedProductType !== null && selectedProductType !== ""
                ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
                : "border border-gray-300 bg-gray-100 text-gray-500"
              }
              hover:border-gray-400 hover:shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            value={selectedProductType || ""}
            onChange={handleProductTypeChange}
            disabled={isLoading}
          >
            <option value="">--Choose Product Type--</option>
            {productTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Parameters Display */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Selected Parameters
        </h3>

        {timeScale === "seasonal" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">State: </span>
                {selectedState ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    {states.find((s) => s.id === selectedState)?.name} ✓
                  </span>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Districts: </span>
                {selectedDistricts.length > 0 ? renderTagList(getDistrictNames()) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Sub-Districts: </span>
                {selectedSubDistricts.length > 0 ? renderTagList(getSubDistrictNames()) : <span className="text-gray-400">None</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Time Scale: </span>
                {timeScale ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    Seasonal ✓
                  </span>
                ) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Season: </span>
                {selectedSeason ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    {selectedSeason} ✓
                  </span>
                ) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Year: </span>
                {selectedYears.length > 0 ? renderTagList(getYearNames()) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Product Type: </span>
                {selectedProductType ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    {selectedProductType} ✓
                  </span>
                ) : <span className="text-gray-400">None</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">State: </span>
                {selectedState ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    {states.find((s) => s.id === selectedState)?.name} ✓
                  </span>
                ) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Districts: </span>
                {selectedDistricts.length > 0 ? renderTagList(getDistrictNames()) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Sub-Districts: </span>
                {selectedSubDistricts.length > 0 ? renderTagList(getSubDistrictNames()) : <span className="text-gray-400">None</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Time Scale: </span>
                {timeScale === "yearly" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    Yearly ✓
                  </span>
                ) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Year: </span>
                {selectedYears.length > 0 ? renderTagList(getYearNames()) : <span className="text-gray-400">None</span>}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-600">Product Type: </span>
                {selectedProductType ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-400">
                    {selectedProductType} ✓
                  </span>
                ) : <span className="text-gray-400">None</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex space-x-4 mt-4">
        <button
          onClick={handleConfirm}
          disabled={isConfirmDisabled()}
          className={`px-6 py-2 rounded-md font-medium transition border ${
            isConfirmDisabled()
              ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400"
              : "bg-green-500 text-white hover:bg-green-600 border-green-600 cursor-pointer"
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Processing...
            </span>
          ) : (
            "Confirm"
          )}
        </button>

        {/* <button
          onClick={handleReset}
          disabled={isResetDisabled()}
          className={`px-6 py-2 rounded-md font-medium transition border ${
            isResetDisabled()
              ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400"
              : "bg-red-500 text-white hover:bg-red-600 border-red-600 cursor-pointer"
          }`}
        >
          Reset
        </button> */}
      </div>

      {/* Loading indicator */}
      {(isLoading || isProcessing) && (
        <WholeLoading
          visible={true}
          title={isProcessing ? "Processing data" : "Connecting to server"}
          message={
            isProcessing
              ? "Working on preparing data"
              : "Working on preparing data"
          }
        />
      )}
    </div>
  );
};

export default LocationSelector;