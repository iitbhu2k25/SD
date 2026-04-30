import { useGeneralUploadStore, LayerInfo, UploadedCsvResult } from "../stores/generalUploadStore";
import { useGeneralUiStore } from "../stores/generalUiStore";
import { executeGeneralInterpolation } from "../../services/rwmRiverApi";
import type { CsvUploadResult } from "../../../river/general/components/CsvUploadPanel";

export function useGeneralViewModel() {
  const uploadStore = useGeneralUploadStore();
  const uiStore = useGeneralUiStore();

  const handleShapefileUploadSuccess = (info: LayerInfo) => {
    uploadStore.setLayerInfo(info);
    uiStore.showToast("Shapefile loaded successfully.", "success");
  };

  const handleShapefileReset = () => {
    uploadStore.resetAll();
    uiStore.setRightPanelOpen(false);
  };

  const handleCsvUploadSuccess = (results: CsvUploadResult[]) => {
    const mapped = results.map(r => ({
       fileLabel: r.datasetLabel,
       summary: r.wqiSummary || { min:0, max:100, mean:0, countByClass:{} },
       validPoints: r.validPoints,
       rejectedPoints: r.rejectedPoints,
       missingParameters: r.missingParameters,
       givenParameters: r.givenParameters,
       wqiRaster: r.wqiRaster,
       sourceFileName: r.sourceFileName,
       geojson: r.geojson
    }));
    uploadStore.setCsvResults(mapped);

    if (mapped.length > 0) {
      if (!uploadStore.activeCsvLabel || !mapped.find(x => x.fileLabel === uploadStore.activeCsvLabel)) {
         uploadStore.setActiveCsvLabel(mapped[0].fileLabel);
      }
      if (mapped[mapped.length -1].wqiRaster) uploadStore.setActiveParameter("WQI");
    }
    
    uiStore.setRightPanelOpen(true);
    uiStore.showToast(`Updated datasets.`, "success");
  };

  const generateInterpolation = async (parameter: string) => {
    if (!uploadStore.layerInfo || !uploadStore.activeCsvLabel) {
      uiStore.showToast("Missing shapefile or CSV dataset.", "error");
      return;
    }

    uiStore.showToast(`Generating raster for ${parameter}...`, "info");
    
    try {
      const payload = {
        layer_name: uploadStore.layerInfo.layerName,
        geometry_type: uploadStore.layerInfo.geometryType,
        buffer_created: uploadStore.layerInfo.bufferCreated,
        csv_file_label: uploadStore.activeCsvLabel,
        parameter: parameter !== "WQI" ? parameter : undefined, // passing undefined means all params if backend supports it, check legacy behavior
      };

      const res = await executeGeneralInterpolation(payload);
      
      if (res.success) {
        uiStore.showToast(`Raster ready for ${parameter}.`, "success");
        // In a real app we'd dispatch this back to update the wqiRaster mapping
        // but for now the user will see it via activeParameter switch in the map
      } else {
        uiStore.showToast(res.error || "Interpolation failed.", "error");
      }
    } catch (err: any) {
      uiStore.showToast(err.message, "error");
    }
  };

  return {
    upload: uploadStore,
    ui: uiStore,
    
    handleShapefileUploadSuccess,
    handleShapefileReset,
    handleCsvUploadSuccess,
    generateInterpolation,
  };
}
