"use client";

// Basin (user) right panel — shows analysis results after confirm.
import dynamic from "next/dynamic";
import { useUserViewModel } from "../hooks/useUserViewModel";
import WaterBudgetCard from "../../components/WaterBudgetCard";

const WaterMLDGraph = dynamic(() => import("../../components/WaterMLDGraph"), {
  ssr: false,
});
const WaterIndexChart = dynamic(
  () => import("../../components/WaterIndexChart"),
  { ssr: false },
);
const UserPDFExportButton = dynamic(
  () => import("@/app/dss/rwm/resource_estimation/water/users/components/export/ExportPage"),
  { ssr: false },
);

export default function UserRightPanel() {
  const {
    rasterResponse,
    activeYear,
    availableYears,
    rasterLayerInfo,
    exportData,
    isExportReady,
    isIndexProduct,
    handleYearChange,
  } = useUserViewModel();

  if (!isExportReady || !rasterResponse || !exportData) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-slate-400">
          Confirm a selection to see results here.
        </p>
      </div>
    );
  }

  const firstRaster = rasterResponse.clipped_rasters[0];
  const waterBudgetProps = {
    totalWaterBudget: rasterLayerInfo?.volume_MLD ?? firstRaster?.volume_MLD ?? null,
    productType: exportData.productType,
    year: activeYear ?? availableYears[0] ?? exportData.year[0],
    season: exportData.season,
    timeScale: exportData.timeScale,
    aggregationMethod: rasterLayerInfo?.aggregation ?? firstRaster?.aggregation ?? "SUM",
    layersProcessed:
      rasterResponse.metadata?.layers_processed ?? rasterResponse.clipped_rasters.length,
    areaCount: 1,
    availableYears,
    activeYear,
    onYearChange: handleYearChange,
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b pb-2">
        Analysis Results
      </h3>

      {!isIndexProduct && <WaterBudgetCard {...waterBudgetProps} />}

      <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-4 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
          Ready to Export
        </p>
        <p className="mb-3 text-xs text-slate-500">PDF report available</p>
        <UserPDFExportButton
          exportData={exportData}
          rasterResponse={rasterResponse}
          subdistrictCodes={[exportData.drain]}
          onExportStart={() => {}}
          onExportComplete={() => {}}
        />
      </div>

      {!isIndexProduct && rasterResponse && (
        <WaterMLDGraph
          rasterResponse={rasterResponse}
          timeScale={exportData.timeScale}
          productType={exportData.productType}
          activeYear={activeYear}
          currentRaster={rasterLayerInfo}
        />
      )}

      {isIndexProduct && rasterResponse && (
        <WaterIndexChart
          rasterResponse={rasterResponse}
          activeYear={activeYear}
          onYearChange={handleYearChange}
          timeScale={exportData.timeScale}
          currentRaster={rasterLayerInfo}
        />
      )}
    </div>
  );
}
