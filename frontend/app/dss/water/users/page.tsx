// 'use client';

// import React, { useState } from 'react';
// import { RiverSystemProvider } from '@/contexts/water/users/DrainContext';
// import { MapProvider } from '@/contexts/water/users/DrainMapContext';
// import RiverSelector from '@/app/dss/water/users/components/locations';
// import WholeLoading from '@/components/app_layout/newLoading';
// import { useRiverSystem } from '@/contexts/water/users/DrainContext';
// import MapView from '@/app/dss/water/users/components/openlayer';
// import { useMap } from '@/contexts/water/users/DrainMapContext';
// import { toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';
// import PDFExportButton from './components/export/page';
// import WaterBudget from './components/waterbudget';
// import WaterMLDGraph from './components/water_mld_graph';

// const MainContent = () => {
//   const [reportLoading, setReportLoading] = useState(false);
//   const [rasterResponse, setRasterResponse] = useState<any>(null);
//   const [exportData, setExportData] = useState<any>(null);
//   const [waterBudgetData, setWaterBudgetData] = useState<any>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [drainWaterBudgetData, setDrainWaterBudgetData] = useState<any>(null);

//   const {
//     selectedRiver,
//     selectedCatchments,
//     selectionsLocked,
//     confirmSelections,
//     resetSelections,
//     rivers,
//     catchments,
//   } = useRiverSystem();

//   const { loading, isMapLoading, stpOperation, setCatchmentLayer } = useMap();

//   const transformRasterResponseToWaterBudget = (
//     rasterResponse: any,
//     confirmationData: any
//   ) => {
//     try {
//       const clippedRasters = rasterResponse.clipped_rasters || [];
//       if (clippedRasters.length === 0) return null;

//       const firstRaster = clippedRasters[0];
//       const volumeMLD = firstRaster.volume_MLD;
//       if (volumeMLD === null || volumeMLD === undefined) return null;

//       const riverName =
//         rivers.find((r) => r.River_Code === confirmationData.river)
//           ?.River_Name || 'Unknown';

//       return {
//         drainId: confirmationData.drain,
//         drainName: `Drain ${confirmationData.drain}`,
//         waterBudget: volumeMLD,
//         productType: confirmationData.productType,
//         year: confirmationData.year,
//         season: confirmationData.season,
//         timeScale: confirmationData.timeScale,
//         riverName,
//         rasterData: firstRaster,
//         clippedRasters,
//       };
//     } catch (error) {
//       console.error('❌ Error transforming data:', error);
//       return null;
//     }
//   };

//   const handleLocationConfirm = async (confirmationData: any) => {
//     if (!confirmationData) {
//       toast.error('No confirmation data received');
//       return;
//     }

//     setIsLoading(true);

//     try {
//       const { rasterResult } = confirmationData;

//       if (
//         !rasterResult ||
//         !rasterResult.clipped_rasters ||
//         rasterResult.clipped_rasters.length === 0
//       ) {
//         toast.warning('No raster data available. Some features may be limited.');
//         setIsLoading(false);
//         return;
//       }

//       setRasterResponse(rasterResult);

//       const firstRaster = rasterResult.clipped_rasters[0];
//       const metadata = rasterResult.metadata;

//       setWaterBudgetData({
//         totalWaterBudget: firstRaster?.volume_MLD || null,
//         productType: metadata?.product_type || confirmationData.productType,
//         year: metadata?.year || confirmationData.year,
//         season: metadata?.season || confirmationData.season,
//         timeScale: metadata?.time_scale || confirmationData.timeScale,
//         aggregationMethod: firstRaster?.aggregation || 'SUM',
//         layersProcessed:
//           metadata?.layers_processed || rasterResult.clipped_rasters.length,
//         subDistrictCount: selectedCatchments?.length || 0,
//       });

//       const riverName =
//         rivers.find((r) => r.River_Code === selectedRiver)?.River_Name ||
//         'Unknown River';

//       const catchmentNames =
//         selectedCatchments?.map((id) => {
//           const catchment = catchments.find((c) => c.id === id);
//           return catchment?.name || `Catchment ${id}`;
//         }) || [];

//       const newExportData = {
//         river: confirmationData.river,
//         stretch: confirmationData.stretch,
//         drain: confirmationData.drain,
//         year: confirmationData.year,
//         season: confirmationData.season,
//         productType: confirmationData.productType,
//         timeScale: confirmationData.timeScale,
//         riverName,
//         stretchNumber: confirmationData.stretch,
//         drainNumber: confirmationData.drain,
//         catchmentNames,
//         selectedCatchments,
//         rasterResult,
//       };

//       setExportData(newExportData);

//       const budgetData = transformRasterResponseToWaterBudget(
//         rasterResult,
//         confirmationData
//       );
//       if (budgetData) {
//         setDrainWaterBudgetData(budgetData);
//         toast.success('✓ Data loaded! Ready to export.');
//       } else {
//         toast.warning('⚠️ Could not extract water budget from raster data');
//       }
//     } catch (error) {
//       console.error('❌ Error:', error);
//       toast.error('Failed to process data');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleReset = () => {
//     resetSelections();
//     setCatchmentLayer(null);
//     setRasterResponse(null);
//     setExportData(null);
//     setWaterBudgetData(null);
//     setDrainWaterBudgetData(null);
//     toast.info('Reset complete');
//   };

//   const handleConfirm = (confirmationData: any) => {
//     confirmSelections();
//     handleLocationConfirm(confirmationData);
//   };

//   const isExportReady =
//     selectionsLocked &&
//     rasterResponse &&
//     exportData &&
//     rasterResponse.clipped_rasters &&
//     rasterResponse.clipped_rasters.length > 0;

//   const isBusy =
//     loading || isMapLoading || stpOperation || reportLoading || isLoading;

//   return (
//     <div className="bg-gray-50 flex flex-col md:h-[850px]">
//       <WholeLoading
//         visible={isBusy}
//         title={reportLoading ? 'Generating Report' : 'Loading'}
//         message={reportLoading ? 'Creating PDF...' : 'Processing data...'}
//       />

//       <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 h-[calc(100vh-100px)]">
//         {/* LEFT PANEL */}
//         <div
//           className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6 transition-all duration-200
//           hover:shadow-xl hover:ring-2 hover:ring-blue-300"
//         >
//           <section className="border-b">
//             <h2 className="text-xl font-semibold text-gray-800 mb-2">
//               River System Selection
//             </h2>
//           </section>

//           <RiverSelector onConfirm={handleConfirm} onReset={handleReset} />

//           {/* Water Budget + Export side by side + Graph below */}
//           {waterBudgetData &&
//             waterBudgetData.totalWaterBudget !== null &&
//             isExportReady && (
//               <section className="space-y-6">

//                 {/* ✅ Side-by-side row: Budget card (left) + Export card (right) */}
//                 <div className="flex flex-row gap-4">

//                   {/* Left: Water Budget Card */}
//                   <WaterBudget {...waterBudgetData} />

//                   {/* Right: Export Card with PDFExportButton inside */}
//                   <div className="flex-1 p-4 bg-green-50 rounded-xl border-2 border-green-300 shadow-sm flex flex-col justify-between min-h-[110px]">
//                     <div>
//                       <p className="text-xs font-semibold text-green-600 uppercase tracking-wide flex items-center gap-1 mb-1">
//                         <span>✅</span> READY TO EXPORT
//                       </p>
//                       <p className="text-xs text-gray-500 mb-3">
//                         PDF report available
//                       </p>
//                     </div>
//                     <PDFExportButton
//                       exportData={exportData}
//                       rasterResponse={rasterResponse}
//                       subdistrictCodes={selectedCatchments || []}
//                       onExportStart={() => {
//                         setReportLoading(true);
//                         toast.info('📄 Generating PDF...');
//                       }}
//                       onExportComplete={() => {
//                         setReportLoading(false);
//                         toast.success('✅ PDF generated!');
//                       }}
//                     />
//                   </div>

//                 </div>

//                 <WaterMLDGraph
//                   rasterResponse={rasterResponse}
//                   timeScale={waterBudgetData.timeScale}
//                   productType={waterBudgetData.productType}
//                 />
//               </section>
//             )}
//         </div>

//         {/* RIGHT PANEL - MAP */}
//         <div
//           className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-200
//           hover:shadow-xl hover:ring-2 hover:ring-blue-300"
//         >
//           <div className="flex-1 overflow-hidden">
//             <MapView />
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// const PriorityDrain = () => {
//   return (
//     <RiverSystemProvider>
//       <MapProvider>
//         <MainContent />
//       </MapProvider>
//     </RiverSystemProvider>
//   );
// };

// export default PriorityDrain;







'use client';

// ✅ ADD these dynamic imports instead:
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/app/dss/water/users/components/openlayer"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
        Loading map...
      </div>
    ),
  }
);

const PDFExportButton = dynamic(
  () => import("./components/export/ExportPage"),
  { ssr: false }
);

const WaterMLDGraph = dynamic(
  () => import("../users/components/water_mld_graph"),
  { ssr: false }
);
const IndexChart = dynamic(
  () => import("./components/IndexChart"),
  { ssr: false }
);
import React, { useState } from 'react';
import { RiverSystemProvider } from '@/contexts/water/users/DrainContext';
import { MapProvider } from '@/contexts/water/users/DrainMapContext';
import RiverSelector from '@/app/dss/water/users/components/locations';
import WholeLoading from '@/components/app_layout/newLoading';
import { useRiverSystem } from '@/contexts/water/users/DrainContext';
// import MapView from '@/app/dss/water/users/components/openlayer';
import { useMap } from '@/contexts/water/users/DrainMapContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// import PDFExportButton from './components/export/ExportPage';
import WaterBudget from './components/waterbudget';
// import WaterMLDGraph from './components/water_mld_graph';

const MainContent = () => {
  const [reportLoading, setReportLoading] = useState(false);
  const [rasterResponse, setRasterResponse] = useState<any>(null);
  const [exportData, setExportData] = useState<any>(null);
  const [waterBudgetData, setWaterBudgetData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [drainWaterBudgetData, setDrainWaterBudgetData] = useState<any>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);

  const {
    selectedRiver,
    selectedCatchments,
    selectionsLocked,
    rivers,
    catchments,
  } = useRiverSystem();

  // ✅ FIX: setRasterLayerInfo add kiya - map ko raster data milega
  const { loading, isMapLoading, stpOperation, setCatchmentLayer, setRasterLayerInfo } = useMap();

  const transformRasterResponseToWaterBudget = (
    rasterResponse: any,
    confirmationData: any
  ) => {
    try {
      const clippedRasters = rasterResponse.clipped_rasters || [];
      if (clippedRasters.length === 0) return null;

      const firstRaster = clippedRasters[0];
      const volumeMLD = firstRaster.volume_MLD;
      if (volumeMLD === null || volumeMLD === undefined) return null;

      const riverName =
        rivers.find((r) => r.River_Code === confirmationData.river)
          ?.River_Name || 'Unknown';

      return {
        drainId: confirmationData.drain,
        drainName: `Drain ${confirmationData.drain}`,
        waterBudget: volumeMLD,
        productType: confirmationData.productType,
        year: confirmationData.year,
        season: confirmationData.season,
        timeScale: confirmationData.timeScale,
        riverName,
        rasterData: firstRaster,
        clippedRasters,
      };
    } catch (error) {
      console.error('❌ Error transforming data:', error);
      return null;
    }
  };

  const handleLocationConfirm = async (confirmationData: any) => {
    if (!confirmationData) {
      toast.error('No confirmation data received');
      return;
    }

    setIsLoading(true);

    try {
      const { rasterResult } = confirmationData;

      if (
        !rasterResult ||
        !rasterResult.clipped_rasters ||
        rasterResult.clipped_rasters.length === 0
      ) {
        toast.warning('No raster data available. Some features may be limited.');
        setIsLoading(false);
        return;
      }

      setRasterResponse(rasterResult);

      const availableYearsLocal = Array.from(
        new Set<number>(rasterResult.clipped_rasters.map((r: any) => r.year as number))
      ).sort((a, b) => a - b);

      const defaultYear =
        availableYearsLocal.length > 0 ? Number(availableYearsLocal[0]) : null;
      setActiveYear(defaultYear);

      const firstRaster =
        rasterResult.clipped_rasters.find((r: any) => r.year === defaultYear) ||
        rasterResult.clipped_rasters[0];

      // ✅ KEY FIX: Map ko raster layer info do - yahi map update karta hai
      setRasterLayerInfo(firstRaster);

      const metadata = rasterResult.metadata;

      setWaterBudgetData({
        totalWaterBudget: firstRaster?.volume_MLD ?? null,
        productType: metadata?.product_type || confirmationData.productType,
        year: defaultYear || metadata?.year || confirmationData.year,
        season: firstRaster?.season || metadata?.season || confirmationData.season,
        timeScale: metadata?.time_scale || confirmationData.timeScale,
        aggregationMethod: firstRaster?.aggregation || 'SUM',
        layersProcessed:
          metadata?.layers_processed || rasterResult.clipped_rasters.length,
        subDistrictCount: selectedCatchments?.length || 0,
      });

      const riverName =
        rivers.find((r) => r.River_Code === selectedRiver)?.River_Name ||
        'Unknown River';

      const catchmentNames =
        selectedCatchments?.map((id) => {
          const catchment = catchments.find((c) => c.id === id);
          return catchment?.name || `Catchment ${id}`;
        }) || [];

      const newExportData = {
        river: confirmationData.river,
        stretch: confirmationData.stretch,
        drain: confirmationData.drain,
        year: defaultYear || confirmationData.year,
        season: confirmationData.season,
        productType: confirmationData.productType,
        timeScale: confirmationData.timeScale,
        riverName,
        stretchNumber: confirmationData.stretch,
        drainNumber: confirmationData.drain,
        catchmentNames,
        selectedCatchments,
        rasterResult,
      };

      setExportData(newExportData);

      const budgetData = transformRasterResponseToWaterBudget(
        rasterResult,
        confirmationData
      );
      if (budgetData) {
        setDrainWaterBudgetData(budgetData);
        toast.success('✓ Data loaded! Ready to export.');
      } else {
        toast.warning('⚠️ Could not extract water budget from raster data');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Failed to process data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCatchmentLayer(null);
    setRasterResponse(null);
    setExportData(null);
    setWaterBudgetData(null);
    setDrainWaterBudgetData(null);
    setActiveYear(null);
    // ✅ Reset map raster layer bhi
    setRasterLayerInfo(null);
    toast.info('Reset complete');
  };

  const handleYearChange = (year: number) => {
    setActiveYear(year);
    if (!rasterResponse?.clipped_rasters) return;

    const rasterForYear = rasterResponse.clipped_rasters.find(
      (r: any) => r.year === year
    );

    if (!rasterForYear) return;

    setRasterLayerInfo(rasterForYear);
    setWaterBudgetData((prev: any) => ({
      ...prev,
      totalWaterBudget: rasterForYear.volume_MLD ?? null,
      year,
      season: rasterForYear.season || prev?.season || 'Annual',
    }));
    setExportData((prev: any) =>
      prev ? { ...prev, year, season: rasterForYear.season || prev.season } : prev
    );
  };

  // ✅ FIX: Extra confirmSelections() call hataya - RiverSelector already karta hai
  const handleConfirm = (confirmationData: any) => {
    handleLocationConfirm(confirmationData);
  };

  const isExportReady =
    selectionsLocked &&
    rasterResponse &&
    exportData &&
    rasterResponse.clipped_rasters &&
    rasterResponse.clipped_rasters.length > 0;

  const isBusy =
    loading || isMapLoading || stpOperation || reportLoading || isLoading;
  const isIndexProduct =
    waterBudgetData?.productType?.toLowerCase() === 'index';

  return (
    <div className="bg-gray-50 flex flex-col md:h-[850px]">
      <WholeLoading
        visible={isBusy}
        title={reportLoading ? 'Generating Report' : 'Loading'}
        message={reportLoading ? 'Creating PDF...' : 'Processing data...'}
      />

      <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 h-[calc(100vh-100px)]">
        {/* LEFT PANEL */}
        <div
          className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6 transition-all duration-200
          hover:shadow-xl hover:ring-2 hover:ring-blue-300"
        >
          <section className="border-b">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              River System Selection
            </h2>
          </section>

          {/* ✅ FIX: onReset prop hataya - interface mein exist nahi karta */}
          <RiverSelector onConfirm={handleConfirm} />

          {/* Water Budget + Export side by side + Graph below */}
          {waterBudgetData &&
            waterBudgetData.totalWaterBudget !== null &&
            isExportReady && (
              <section className="space-y-6">

                {/* Side-by-side row: Budget card (left) + Export card (right) */}
                <div className={`flex gap-4 ${isIndexProduct ? 'flex-col' : 'flex-row'}`}>

                  {/* Left: Water Budget Card */}
                  {!isIndexProduct && <WaterBudget {...waterBudgetData} />}

                  {/* Right: Export Card with PDFExportButton inside */}
                  <div className="flex-1 p-4 bg-green-50 rounded-xl border-2 border-green-300 shadow-sm flex flex-col justify-between min-h-[110px]">
                    <div>
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <span>✅</span> READY TO EXPORT
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        PDF report available
                      </p>
                    </div>
                    <PDFExportButton
                      exportData={exportData}
                      rasterResponse={rasterResponse}
                      subdistrictCodes={selectedCatchments || []}
                      onExportStart={() => {
                        setReportLoading(true);
                        toast.info('📄 Generating PDF...');
                      }}
                      onExportComplete={() => {
                        setReportLoading(false);
                        toast.success('✅ PDF generated!');
                      }}
                    />
                  </div>

                </div>

                {!isIndexProduct && (
                  <WaterMLDGraph
                    rasterResponse={rasterResponse}
                    timeScale={waterBudgetData.timeScale}
                    productType={waterBudgetData.productType}
                  />
                )}

                {isIndexProduct && (
                  <IndexChart
                    rasterResponse={rasterResponse}
                    activeYear={activeYear}
                    onYearChange={handleYearChange}
                    timeScale={waterBudgetData.timeScale}
                  />
                )}
              </section>
            )}
        </div>

        {/* RIGHT PANEL - MAP */}
        <div
          className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-200
          hover:shadow-xl hover:ring-2 hover:ring-blue-300"
        >
          <div className="flex-1 overflow-hidden">
            <MapView />
          </div>
        </div>
      </main>
    </div>
  );
};

const PriorityDrain = () => {
  return (
    <RiverSystemProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </RiverSystemProvider>
  );
};

export default PriorityDrain;
