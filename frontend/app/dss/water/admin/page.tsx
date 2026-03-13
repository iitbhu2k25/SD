"use client";
// ✅ ADD these dynamic imports instead:
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/app/dss/water/admin/components/openlayer"),
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

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/water/admin/LocationContext";
import { MapProvider } from "@/contexts/water/admin/MapContext";
import LocationSelector from "@/app/dss/water/admin/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import { useLocation } from "@/contexts/water/admin/LocationContext";
// import MapView from "@/app/dss/water/admin/components/openlayer";
import { useMap } from "@/contexts/water/admin/MapContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// import PDFExportButton from "./components/export/ExportPage";
import WaterBudget from "./components/waterbudget";
// import WaterMLDGraph from "../users/components/water_mld_graph";

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

  const { loading } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleYearChange = (year: number) => {
    setActiveYear(year);
    if (!rasterResponse || !rasterResponse.clipped_rasters) return;
    const rasterForYear = rasterResponse.clipped_rasters.find((r: any) => r.year === year);
    if (rasterForYear) {
      setWaterBudgetData((prev: any) => ({
        ...prev,
        totalWaterBudget: rasterForYear.volume_MLD ?? null,
        year: year,
        timeScale: 'yearly',
        season: rasterForYear.season || 'Annual'
      }));
      setExportData((prev: any) => ({ ...prev, year: year }));
    }
  };

  const handleLocationConfirm = (confirmationData: any) => {
    const { rasterResult } = confirmationData;
    if (!rasterResult) { toast.error("Failed to process raster data"); return; }
    if (!rasterResult.clipped_rasters || rasterResult.clipped_rasters.length === 0) {
      toast.error("No clipped rasters available"); return;
    }
    setRasterResponse(rasterResult);
    const codes = selectedSubDistricts && selectedSubDistricts.length > 0 ? selectedSubDistricts : [];
    setSubdistrictCodes(codes);
    const availableYears = [...new Set(rasterResult.clipped_rasters.map((r: any) => r.year))].sort();
    const defaultYear = availableYears.length > 0 ? Number(availableYears[0]) : null;
    setActiveYear(defaultYear);
    const firstRaster = rasterResult.clipped_rasters.find((r: any) => r.year === defaultYear) || rasterResult.clipped_rasters[0];
    const metadata = rasterResult.metadata;
    setWaterBudgetData({
      totalWaterBudget: firstRaster?.volume_MLD ?? null,
      productType: metadata?.product_type || confirmationData.productType,
      year: defaultYear || metadata?.year || confirmationData.year,
      season: firstRaster?.season || metadata?.season || confirmationData.season,
      timeScale: metadata?.time_scale || confirmationData.timeScale,
      aggregationMethod: firstRaster?.aggregation || "SUM",
      layersProcessed: metadata?.layers_processed || rasterResult.clipped_rasters.length,
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
    setShowCategories(false);
  };

  const isExportReady =
    selectionsLocked && rasterResponse && exportData &&
    rasterResponse.clipped_rasters && rasterResponse.clipped_rasters.length > 0;

  return (
    <div className="flex flex-col md:h-[900px]">
      <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 flex-1 min-h-0">

        {/* LEFT PANEL */}
        <div className="lg:w-1/2 flex flex-col overflow-y-auto bg-white rounded-xl p-6 space-y-6 transition-all duration-200 hover:shadow-xl hover:ring-2 hover:ring-blue-300">

          <section className="border-b">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Admin Selection</h2>
          </section>

          <LocationSelector onConfirm={handleLocationConfirm} onReset={handleReset} />

          {waterBudgetData && waterBudgetData.totalWaterBudget !== null && isExportReady && (
            <>
              {/* ✅ Matched Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Water Budget Card */}
                <WaterBudget {...waterBudgetData} />

                {/* Export Card — matched style */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-300 rounded-xl shadow-sm p-4 flex flex-col justify-between">
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

              {/* MLD Graph */}
              <section>
                <WaterMLDGraph
                  rasterResponse={rasterResponse}
                  timeScale={waterBudgetData.timeScale}
                  productType={waterBudgetData.productType}
                />
              </section>
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
          message={reportLoading ? "Creating PDF report..." : "Loading data..."}
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