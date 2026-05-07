import { useMemo } from "react";
import { toast } from "react-toastify";
import { useGeneralMapStore } from "../stores/generalMapStore";
import { useGeneralUiStore } from "../stores/generalUiStore";
import { useGeneralUploadStore } from "../stores/generalUploadStore";
import type {
  GeneralCsvFileInput,
  GeneralCsvUploadResult,
  GeneralRasterDownloadFormat,
  GeneralWqiSummary,
} from "../types";
import {
  downloadGeneralRaster,
  interpolateGeneralWqi,
  uploadGeneralCsv,
  uploadGeneralShapefile,
} from "../services/generalApi";
import { generateGeneralWqiReport } from "../utils/generateGeneralWqiReport";

const ALL_PARAMETERS = [
  "pH",
  "DO",
  "BOD",
  "FC",
  "Temperature",
  "Turbidity",
  "TDS",
  "EC",
  "TSS",
  "COD",
  "Nitrate",
];

const isCoordinateColumn = (column: string) =>
  ["lat", "lon", "latitude", "longitude"].includes(column.toLowerCase());

const makeUploadId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeSummary = (summary: any): GeneralWqiSummary | null => {
  if (!summary) return null;
  return {
    min: Number(summary.min ?? 0),
    max: Number(summary.max ?? 0),
    mean: Number(summary.mean ?? 0),
    countByClass: summary.count_by_class || summary.countByClass || {},
  };
};

const normalizeCsvResponse = ({
  payload,
  file,
  label,
}: {
  payload: any;
  file: File;
  label: string;
}): GeneralCsvUploadResult => {
  const fileLabel = label.trim() || file.name;
  const geojson = payload.geojson || { type: "FeatureCollection", features: [] };
  geojson.features = (geojson.features || []).map((feature: any) => ({
    ...feature,
    properties: {
      ...feature.properties,
      dataset_label: fileLabel,
    },
  }));

  const foundColumns = [
    ...(payload.columns_found?.required || []),
    ...(payload.columns_found?.optional || []),
  ].filter((column: string) => !isCoordinateColumn(column));
  const missingParameters = ALL_PARAMETERS.filter((param) => !foundColumns.includes(param));

  return {
    fileLabel,
    sourceFileName: file.name,
    uploadId: makeUploadId(),
    totalPoints: Number(payload.total_points || 0),
    validPoints: Number(payload.valid_points || 0),
    rejectedPoints: Number(payload.rejected_points || 0),
    geojson,
    summary: normalizeSummary(payload.wqi_summary),
    wqiRaster: null,
    givenParameters: foundColumns,
    missingParameters,
  };
};

const getQualifiedLayerName = (
  result: GeneralCsvUploadResult,
  activeParameter: string,
) => {
  const raster = result.wqiRaster;
  if (!raster) return null;
  const layerId =
    activeParameter === "WQI"
      ? raster.layerName
      : raster.parameterLayers?.[activeParameter];
  if (!layerId) return null;
  return layerId.includes(":") ? layerId : `${raster.workspace}:${layerId}`;
};

const safeFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "general_wqi";

const downloadBlob = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export function useGeneralViewModel() {
  const uploadStore = useGeneralUploadStore();
  const uiStore = useGeneralUiStore();
  const mapStore = useGeneralMapStore();

  const activeResult = useMemo(
    () =>
      uploadStore.csvResults.find((result) => result.fileLabel === uploadStore.activeCsvLabel) ||
      null,
    [uploadStore.activeCsvLabel, uploadStore.csvResults],
  );

  const activeMapGeoJson = useMemo(() => {
    if (!activeResult?.geojson?.features) return null;
    return {
      ...activeResult.geojson,
      features: activeResult.geojson.features.filter((feature: any) => {
        if (
          uploadStore.selectedWqiClass &&
          feature.properties?.type === "valid" &&
          feature.properties?.wqi_class !== uploadStore.selectedWqiClass
        ) {
          return false;
        }
        return true;
      }),
    };
  }, [activeResult, uploadStore.selectedWqiClass]);

  const activeValidPoints =
    activeMapGeoJson?.features?.filter((feature: any) => feature.properties?.type === "valid")
      .length || 0;
  const activeRejectedPoints =
    activeMapGeoJson?.features?.filter((feature: any) => feature.properties?.type !== "valid")
      .length || 0;

  const rasterComparisonProfiles = useMemo(
    () =>
      uploadStore.csvResults
        .filter((result) => Boolean(result.wqiRaster?.rowProfileData?.length))
        .map((result) => ({
          name: result.fileLabel,
          profile: result.wqiRaster?.rowProfileData || [],
        })),
    [uploadStore.csvResults],
  );

  const uploadShapefile = async (file: File) => {
    uploadStore.setShapefileStatus("uploading", "Uploading shapefile...");
    try {
      const layerInfo = await uploadGeneralShapefile(file);
      uploadStore.setLayerInfo(layerInfo);
      mapStore.resetMapState();
      uiStore.setRightPanelOpen(false);
      uploadStore.setShapefileStatus("success", "Shapefile loaded successfully.");
      uiStore.showToast("Shapefile loaded successfully.", "success");
      toast.success("Shapefile loaded successfully.");
    } catch (error: any) {
      const message = error?.message || "Shapefile upload failed.";
      uploadStore.setShapefileStatus("error", null, message);
      uiStore.showToast(message, "error");
      toast.error(message);
    }
  };

  const resetShapefile = () => {
    uploadStore.resetAll();
    mapStore.resetMapState();
    uiStore.setRightPanelOpen(false);
  };

  const uploadCsvFiles = async (entries: GeneralCsvFileInput[]) => {
    if (!uploadStore.layerInfo) {
      toast.error("Upload a shapefile before adding CSV datasets.");
      return;
    }
    if (!entries.length) {
      toast.error("Select at least one CSV file.");
      return;
    }

    uploadStore.setCsvBatchStatus("uploading", "Uploading CSV datasets...");
    uploadStore.setCsvEntries(
      entries.map((entry) => ({
        id: entry.id,
        fileName: entry.file.name,
        label: entry.label || entry.file.name,
        status: "idle",
        error: null,
      })),
    );
    const completedResults: GeneralCsvUploadResult[] = [];

    for (const entry of entries) {
      uploadStore.setCsvEntryStatus(entry.id, "uploading");
      try {
        const uploadPayload = await uploadGeneralCsv(entry.file, uploadStore.layerInfo.layerName);
        const result = normalizeCsvResponse({
          payload: uploadPayload,
          file: entry.file,
          label: entry.label,
        });

        if (result.validPoints <= 0) {
          throw new Error("No points fall within the uploaded river buffer region.");
        }

        uploadStore.setCsvEntryStatus(entry.id, "generating_raster");
        const sourceMin = result.summary?.min ?? 0;
        const sourceMax = result.summary?.max ?? 100;
        const wqiRaster = await interpolateGeneralWqi({
          layer_name: uploadStore.layerInfo.layerName,
          wqi_geojson: result.geojson,
          source_file_name: result.sourceFileName,
          upload_id: result.uploadId,
          min_value: sourceMin,
          max_value: sourceMax,
        });

        const finalResult = { ...result, wqiRaster };
        completedResults.push(finalResult);
        uploadStore.upsertCsvResult(finalResult);
        uploadStore.setCsvEntryStatus(entry.id, "success");
      } catch (error: any) {
        uploadStore.setCsvEntryStatus(
          entry.id,
          "error",
          error?.message || "CSV processing failed.",
        );
      }
    }

    uploadStore.setCsvResults(completedResults);

    if (completedResults.length > 0) {
      uploadStore.setCsvBatchStatus(
        "success",
        `${completedResults.length} dataset(s) processed successfully.`,
      );
      uiStore.setRightPanelOpen(true);
      uiStore.showToast("CSV datasets processed.", "success");
      toast.success("CSV datasets processed.");
    } else {
      uploadStore.setCsvBatchStatus("error", null, "No CSV dataset could be processed.");
      toast.error("No CSV dataset could be processed.");
    }
  };

  const resetCsvWorkflow = () => {
    uploadStore.resetCsvWorkflow();
    uiStore.setRightPanelOpen(false);
  };

  const selectDataset = (label: string | null) => {
    uploadStore.setActiveCsvLabel(label);
    if (label) uiStore.setRightPanelOpen(true);
  };

  const selectWqiClass = (wqiClass: string | null) => {
    uploadStore.setSelectedWqiClass(wqiClass);
  };

  const selectRasterParameter = (parameter: string) => {
    uploadStore.setActiveParameter(parameter);
  };

  const downloadRaster = async (format: GeneralRasterDownloadFormat) => {
    if (!activeResult?.wqiRaster) return;
    const qualifiedLayerName = getQualifiedLayerName(activeResult, uploadStore.activeParameter);
    if (!qualifiedLayerName) {
      toast.error(`No raster layer found for ${uploadStore.activeParameter}.`);
      return;
    }

    uiStore.setDownloadingRaster(true);
    try {
      const extension = format === "png" ? "png" : "tif";
      const fileName = `${safeFileName(`${activeResult.fileLabel}_${uploadStore.activeParameter}`)}.${extension}`;
      const blob = await downloadGeneralRaster({
        layerName: qualifiedLayerName,
        workspace: activeResult.wqiRaster.workspace,
        fileName,
        format,
      });
      downloadBlob(blob, fileName);
      toast.success(`${uploadStore.activeParameter} raster download started.`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to download raster.");
    } finally {
      uiStore.setDownloadingRaster(false);
    }
  };

  const downloadReport = async () => {
    if (!activeResult || !uploadStore.layerInfo || !activeResult.wqiRaster) return;

    uiStore.setDownloadingReport(true);
    try {
      let chartImage: string | undefined;
      const chartElement = document.getElementById("general-wqi-comparison-chart");
      if (chartElement) {
        try {
          const plotlyModule = await import("plotly.js-dist-min");
          const PlotlyLib: any = (plotlyModule as any).default || plotlyModule;
          const plotDiv = chartElement.querySelector(".js-plotly-plot") as any;
          if (plotDiv && typeof PlotlyLib?.toImage === "function") {
            chartImage = await PlotlyLib.toImage(plotDiv, {
              format: "png",
              width: Math.max(plotDiv.clientWidth || 900, 600),
              height: Math.max(plotDiv.clientHeight || 340, 280),
              scale: 300 / 96,
            });
          }
        } catch {
          chartImage = undefined;
        }
      }

      await generateGeneralWqiReport({
        data: activeResult,
        selectedFileLabel: activeResult.fileLabel || activeResult.sourceFileName,
        analysisLayerName: uploadStore.layerInfo.layerName,
        mapImage: activeResult.wqiRaster.mapImage,
        legendImage: activeResult.wqiRaster.legendImage,
        chartImage,
      });
      toast.success("PDF download started.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate PDF report.");
    } finally {
      uiStore.setDownloadingReport(false);
    }
  };

  return {
    upload: uploadStore,
    ui: uiStore,
    map: mapStore,
    activeResult,
    activeMapGeoJson,
    activeValidPoints,
    activeRejectedPoints,
    datasetLabels: uploadStore.csvResults.map((result) => result.fileLabel),
    rasterComparisonProfiles,

    uploadShapefile,
    resetShapefile,
    uploadCsvFiles,
    resetCsvWorkflow,
    selectDataset,
    selectWqiClass,
    selectRasterParameter,
    downloadRaster,
    downloadReport,
  };
}
