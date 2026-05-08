
"use client";
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/app/dss/rwm/resource_estimation/water/admin/components/openlayer"),
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

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/water/admin/LocationContext";
import { MapProvider } from "@/contexts/water/admin/MapContext";
import LocationSelector from "@/app/dss/rwm/resource_estimation/water/admin/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import { useLocation } from "@/contexts/water/admin/LocationContext";
import { useMap } from "@/contexts/water/admin/MapContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import WaterBudget from "./components/waterbudget";

const MainContent = () => {
  const [reportLoading, setReportLoading] = useState(false);
  const [rasterResponse, setRasterResponse] = useState<any>(null);
  const [exportData, setExportData] = useState<any>(null);
  const [subdistrictCodes, setSubdistrictCodes] = useState<number[]>([]);
  const [waterBudgetData, setWaterBudgetData] = useState<any>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);

  const {
    selectionsLocked,
    selectedSubDistricts,
    selectedSubDistrictsNames,
    selectedDistrictsNames,
    selectedStateName,
  } = useLocation();

  const { loading, rasterLayerInfo } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  // Available years rasterResponse se derive karo
  const availableYears: number[] = React.useMemo(() => {
    if (!rasterResponse?.clipped_rasters) return [];
    const yearSet = new Set<number>(
      rasterResponse.clipped_rasters.map((r: any) => r.year as number)
    );
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [rasterResponse]);

  const handleYearChange = (year: number) => {
    setActiveYear(year);
    if (!rasterResponse || !rasterResponse.clipped_rasters) return;
    const rasterForYear = rasterResponse.clipped_rasters.find(
      (r: any) => r.year === year
    );
    if (rasterForYear) {
      setWaterBudgetData((prev: any) => ({
        ...prev,
        totalWaterBudget: rasterForYear.volume_MLD ?? null,
        year: year,
        timeScale: "yearly",
        season: rasterForYear.season || "Annual",
      }));
      setExportData((prev: any) => ({ ...prev, year: year }));
    }
  };

  const handleLocationConfirm = (confirmationData: any) => {
    const { rasterResult } = confirmationData;
    if (!rasterResult) {
      toast.error("Failed to process raster data");
      return;
    }
    if (
      !rasterResult.clipped_rasters ||
      rasterResult.clipped_rasters.length === 0
    ) {
      toast.error("No clipped rasters available");
      return;
    }

    setRasterResponse(rasterResult);

    const codes =
      selectedSubDistricts && selectedSubDistricts.length > 0
        ? selectedSubDistricts
        : [];
    setSubdistrictCodes(codes);

    const yearSet = new Set<number>(
      rasterResult.clipped_rasters.map((r: any) => r.year as number)
    );
    const availableYearsLocal = Array.from(yearSet).sort((a, b) => a - b);

    const defaultYear =
      availableYearsLocal.length > 0 ? Number(availableYearsLocal[0]) : null;
    setActiveYear(defaultYear);

    const firstRaster =
      rasterResult.clipped_rasters.find((r: any) => r.year === defaultYear) ||
      rasterResult.clipped_rasters[0];
    const metadata = rasterResult.metadata;

    setWaterBudgetData({
      totalWaterBudget: firstRaster?.volume_MLD ?? null,
      productType: metadata?.product_type || confirmationData.productType,
      year: defaultYear || metadata?.year || confirmationData.year,
      season:
        firstRaster?.season || metadata?.season || confirmationData.season,
      timeScale: metadata?.time_scale || confirmationData.timeScale,
      aggregationMethod: firstRaster?.aggregation || "SUM",
      layersProcessed:
        metadata?.layers_processed || rasterResult.clipped_rasters.length,
      subDistrictCount: selectedSubDistricts.length,
    });

    setExportData({
      ...confirmationData,
      rasterResult: { ...rasterResult },
      stateName: selectedStateName,
      districtNames: selectedDistrictsNames,
      subDistrictNames: selectedSubDistrictsNames,
      selectedSubDistricts,
      subdistrictCodes: codes,
      year: defaultYear || confirmationData.year,
      season: confirmationData.season,
      productType: confirmationData.productType,
      timeScale: confirmationData.timeScale,
    });

    toast.success("✓ Raster data loaded successfully!");
  };

  const handleReset = () => {
    setRasterResponse(null);
    setExportData(null);
    setWaterBudgetData(null);
    setSubdistrictCodes([]);
    setActiveYear(null);
    setShowCategories(false);
  };

  const isExportReady =
    selectionsLocked &&
    rasterResponse &&
    exportData &&
    rasterResponse.clipped_rasters &&
    rasterResponse.clipped_rasters.length > 0;

  // Index product type check
  const isIndexProduct =
    waterBudgetData?.productType?.toLowerCase() === "index";

  return (
    <div className="flex flex-col md:h-[900px]">
      <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 flex-1 min-h-0">

        {/* LEFT PANEL */}
        <div className="lg:w-1/2 flex flex-col overflow-y-auto bg-white rounded-xl p-6 space-y-6 transition-all duration-200 hover:shadow-xl hover:ring-2 hover:ring-blue-300">

          <section className="border-b">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Admin Selection
            </h2>
          </section>

          <LocationSelector
            onConfirm={handleLocationConfirm}
            onReset={handleReset}
          />

          {waterBudgetData &&
            waterBudgetData.totalWaterBudget !== null &&
            isExportReady && (
              <>
                {/* Cards Grid */}
                <div className={`grid grid-cols-1 gap-4 ${!isIndexProduct ? 'lg:grid-cols-2' : ''}`}>

                  {/* Water Budget Card — Index type ke liye hide */}
                  {!isIndexProduct && (
                    <WaterBudget
                      {...waterBudgetData}
                      availableYears={availableYears}
                      activeYear={activeYear}
                      onYearChange={handleYearChange}
                    />
                  )}

                  {/* Export Card — hamesha dikhega */}
                  <div className={`bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-300 rounded-xl shadow-sm p-4 flex flex-col justify-between w-full ${isIndexProduct ? 'min-h-[128px]' : ''}`}>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 uppercase tracking-wide">
                        <span>✅</span>
                        <span>Ready to Export</span>
                      </h3>
                      <p className="text-xs text-emerald-500 mt-0.5">
                        PDF report available
                      </p>
                    </div>

                    <PDFExportButton
                      exportData={exportData}
                      rasterResponse={rasterResponse}
                      subdistrictCodes={subdistrictCodes}
                      onExportStart={() => {
                        setReportLoading(true);
                        toast.info("Generating PDF report...");
                      }}
                      onExportComplete={() => {
                        setReportLoading(false);
                        toast.success("PDF report generated successfully!");
                      }}
                    />
                  </div>
                </div>

                {/* Non-Index: MLD Graph */}
                {!isIndexProduct && (
                  <section>
                    <WaterMLDGraph
                      rasterResponse={rasterResponse}
                      timeScale={waterBudgetData.timeScale}
                      productType={waterBudgetData.productType}
                      activeYear={activeYear}
                      currentRaster={rasterLayerInfo}
                    />
                  </section>
                )}

                {/* Index only: Donut + Histogram */}
                {isIndexProduct && (
                  <section>
                    <IndexChart
                      rasterResponse={rasterResponse}
                      activeYear={activeYear}
                      onYearChange={handleYearChange}
                      timeScale={waterBudgetData.timeScale}
                      currentRaster={rasterLayerInfo}
                    />
                  </section>
                )}
              </>
            )}
        </div>

        {/* RIGHT PANEL - Map */}
        <div className="lg:w-1/2 rounded-xl flex flex-col overflow-hidden transition-all duration-200 hover:shadow-xl hover:ring-2 hover:ring-blue-300">
          <div className="flex-1 overflow-hidden">
            <MapView
              rasterResponse={rasterResponse}
              activeYear={activeYear}
              onYearChange={handleYearChange}
            />
          </div>
        </div>

      </main>

      {(reportLoading || loading) && (
        <WholeLoading
          visible={true}
          title={reportLoading ? "Generating Report" : "Processing Data"}
          message={
            reportLoading ? "Creating PDF report..." : "Loading data..."
          }
        />
      )}
    </div>
  );
};

const PriorityAdmin = () => (
  <LocationProvider>
    <MapProvider>
      <MainContent />
    </MapProvider>
  </LocationProvider>
);

export default PriorityAdmin;
