"use client";

import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import UploadPanel from "./components/uploadPanel";
import CsvUploadPanel, { CsvUploadResult } from "./components/CsvUploadPanel";
import Map from "./components/Map";
import WqiSummaryTable from "./components/WqiSummaryTable";
import WqiComparisonChart from "./components/WqiComparisonChart";

interface LayerInfo {
  layerName: string;
  wmsUrl: string;
  wfsUrl: string;
  geometryType: string;
  bufferCreated: boolean;
  featureCount: number;
  bbox: [number, number, number, number] | null;
}

const GeneralRiverWaterManagement: React.FC = () => {
  const [layerInfo, setLayerInfo] = useState<LayerInfo | null>(null);

  // Array of individual dataset results instead of one combined result
  const [csvResults, setCsvResults] = useState<CsvUploadResult[]>([]);
  const [selectedDatasetLabel, setSelectedDatasetLabel] = useState<string>("");
  const [selectedWqiClass, setSelectedWqiClass] = useState<string | null>(null);
  const [activeParameter, setActiveParameter] = useState<string>("WQI");
  const [isDownloadingReport, setIsDownloadingReport] = useState<boolean>(false);

  // Extract unique dataset labels
  const datasetLabels = csvResults.map(r => r.datasetLabel);

  const handleUploadSuccess = (info: LayerInfo) => {
    setLayerInfo(info);
    setCsvResults([]);
    setSelectedDatasetLabel("");
  };

  const handleCsvUploadSuccess = (results: CsvUploadResult[]) => {
    setCsvResults(results);
    setSelectedDatasetLabel((prev) => {
      if (results.length === 0) return "";
      if (prev && results.some((r) => r.datasetLabel === prev)) return prev;
      return results[0].datasetLabel;
    });
  };

  const handleMapReset = useCallback(() => {
    setLayerInfo(null);
    setCsvResults([]);
    setSelectedDatasetLabel("");
    setSelectedWqiClass(null);
    setActiveParameter("WQI");
  }, []);

  const handleCsvReset = useCallback(() => {
    setCsvResults([]);
    setSelectedDatasetLabel("");
    setSelectedWqiClass(null);
    setActiveParameter("WQI");
  }, []);

  // Find the currently selected result object
  const activeResult = csvResults.find(r => r.datasetLabel === selectedDatasetLabel) || null;

  // Filter features for Map display based on active dataset and selected WQI class
  const mapFeatures = activeResult?.geojson?.features
    ? activeResult.geojson.features.filter((f: any) => {
      // Filter by WQI Class if selected
      if (selectedWqiClass && f.properties.wqi_class !== selectedWqiClass && f.properties.type === 'valid') return false;
      return true;
    })
    : [];

  const activeValidPoints = mapFeatures.filter((f: any) => f.properties.type === 'valid').length;
  const activeRejectedPoints = mapFeatures.filter((f: any) => f.properties.type !== 'valid').length;

  // Only show graph after raster generation.
  const rasterComparisonProfiles = csvResults
    .filter((result) => !!(result.wqiRaster?.rowProfileData && result.wqiRaster.rowProfileData.length > 0))
    .map((result) => ({
      name: result.datasetLabel,
      profile: result.wqiRaster?.rowProfileData || [],
    }));

  return (
    <div className="flex w-full" style={{ height: "850px" }}>
      {/* LEFT: UPLOAD PANEL */}
      <div className="w-1/3 border-r border-gray-200 bg-gradient-to-br from-slate-50 to-blue-50 overflow-y-auto">
        {/* Shapefile Upload Panel */}
        <UploadPanel
          onUploadSuccess={handleUploadSuccess}
          onReset={handleMapReset}
        />

        {/* CSV Upload Panel */}
        {layerInfo && (
          <div className="">
            <CsvUploadPanel
              layerName={layerInfo.layerName}
              onUploadSuccess={handleCsvUploadSuccess}
              onReset={handleCsvReset}
            />
          </div>
        )}

        {/* File Selector (integrated) & WQI Summary */}
        {activeResult && activeResult.wqiSummary && (
          <div className="mx-5 mb-4 space-y-4">

            <WqiSummaryTable
              fileLabel={activeResult.datasetLabel}
              fileOptions={datasetLabels}
              onSelectFile={(label) => {
                setSelectedDatasetLabel(label);
                setSelectedWqiClass(null);
                setActiveParameter("WQI"); // Always default to WQI when changing files safely
              }}
              summary={activeResult.wqiSummary}
              selectedClass={selectedWqiClass}
              onSelectClass={setSelectedWqiClass}
              validPoints={activeValidPoints}
              rejectedPoints={activeRejectedPoints}
              wqiRaster={activeResult.wqiRaster}
              givenParameters={activeResult.givenParameters}
              missingParameters={activeResult.missingParameters}
              activeParameter={activeParameter}
              onSelectParameter={setActiveParameter}
              onDownloadReport={async () => {
                if (!activeResult || !layerInfo || !activeResult.wqiRaster || isDownloadingReport) return;

                setIsDownloadingReport(true);
                const toastId = toast.loading("Preparing PDF report...");
                try {
                  const { generateGeneralWqiReport } = await import("./utils/generateGeneralWqiReport");

                  let chartImage: string | undefined;
                  const chartElement = document.getElementById("general-wqi-comparison-chart");

                  if (chartElement) {
                    try {
                      const plotlyModule = await import("plotly.js-dist-min");
                      const PlotlyLib: any = (plotlyModule as any).default || plotlyModule;
                      const plotDiv = chartElement.querySelector(".js-plotly-plot") as any;

                      if (plotDiv && typeof PlotlyLib?.toImage === "function") {
                        const width = Math.max(plotDiv.clientWidth || 900, 600);
                        const height = Math.max(plotDiv.clientHeight || 340, 280);

                        chartImage = await PlotlyLib.toImage(plotDiv, {
                          format: "png",
                          width,
                          height,
                          scale: 300 / 96,
                        });
                      }
                    } catch (error) {
                      console.warn("Chart image export skipped for PDF:", error);
                    }
                  }

                  await generateGeneralWqiReport({
                    data: activeResult,
                    selectedFileLabel: activeResult.datasetLabel || activeResult.sourceFileName,
                    analysisLayerName: layerInfo.layerName,
                    mapImage: activeResult.wqiRaster.mapImage,
                    legendImage: activeResult.wqiRaster.legendImage,
                    chartImage,
                  });
                  toast.success("PDF download started.", );
                } catch (error) {
                  console.error("PDF generation failed:", error);
                  toast.error("Failed to generate PDF report.", );
                } finally {
                  setIsDownloadingReport(false);
                }
              }}
              isDownloadingReport={isDownloadingReport}
            />

            {rasterComparisonProfiles.length > 0 && (
              <WqiComparisonChart data={rasterComparisonProfiles} />
            )}
          </div>
        )}
      </div>

      {/* RIGHT: MAP */}
      <div className="w-2/3">
        <Map
          layerInfo={layerInfo}
          wqiPoints={
            activeResult?.geojson
              ? {
                ...activeResult.geojson,
                features: mapFeatures // Pass filtered features
              }
              : null
          }
          wqiRasterLayer={activeResult?.wqiRaster}
          activeParameter={activeParameter} // Pass selected parameter down to Map
        />
      </div>
    </div>
  );
};

export default GeneralRiverWaterManagement;
