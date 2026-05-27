import { create } from "zustand";
import { ADMIN_TOWN_LAYER_NAMES, type ClipRasters } from "@/interface/raster_context";
import { runManualSuitabilityAnalysis } from "../../services/manual_stpSuitabilityApi";
import { useManualCategoryStore } from "./manualCategoryStore";
import { useManualAreaStore } from "./manualAreaStore";
import type { ClusterInfo } from "../../services/manual_stpSuitabilityTypes";

export interface PolygonClusterGroup {
  label: string;
  clusters: ClusterInfo[];
}

interface ManualMapStoreState {
  primaryLayer: string;
  resultVectorLayer: string | null;
  resultPathVectorLayer: string | null;
  clusterDistances: ClusterInfo[] | null;
  /** For multi-polygon flow — one entry per polygon with its label and clusters */
  multiClusterDistances: PolygonClusterGroup[] | null;
  stpOperation: boolean;
  isMapLoading: boolean;
  loading: boolean;
  error: string | null;
  layerOpacity: number;
  selectedRadioLayer: string | null;
  rasterLayerInfo: ClipRasters | null;
  showLegend: boolean;
  defaultWorkspace: string;
  geoServerUrl: string;
  drawingActive: boolean;
  showDrainLabels: boolean;
  /** Cluster rank currently selected by user (for road-path toggle); null = path hidden */
  selectedClusterRank: number | null;
}

interface ManualMapStoreActions {
  setPrimaryLayer: (layer: string) => void;
  setResultVectorLayer: (layer: string | null) => void;
  setResultPathVectorLayer: (layer: string | null) => void;
  setClusterDistances: (distances: ClusterInfo[] | null) => void;
  setMultiClusterDistances: (groups: PolygonClusterGroup[] | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLayerOpacity: (opacity: number) => void;
  setSelectedRadioLayer: (layer: string | null) => void;
  setRasterLayerInfo: (layer: ClipRasters | null) => void;
  setShowLegend: (visible: boolean) => void;
  handleLayerSelection: (layer: string) => void;
  setDrawingActive: (active: boolean) => void;
  setShowDrainLabels: (show: boolean) => void;
  /** Toggle road-path visibility for a given cluster rank; same rank = deselect */
  setSelectedClusterRank: (rank: number | null) => void;
  runAnalysis: () => Promise<void>;
  resetMapView: () => void;
}

export type ManualMapStore = ManualMapStoreState & ManualMapStoreActions;

export const useManualMapStore = create<ManualMapStore>((set) => ({
  primaryLayer: ADMIN_TOWN_LAYER_NAMES.INDIA,
  resultVectorLayer: null,
  resultPathVectorLayer: null,
  clusterDistances: null,
  multiClusterDistances: null,
  stpOperation: false,
  isMapLoading: false,
  loading: false,
  error: null,
  layerOpacity: 70,
  selectedRadioLayer: null,
  rasterLayerInfo: null,
  showLegend: false,
  defaultWorkspace: "vector_work",
  geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
  drawingActive: false,
  showDrainLabels: false,
  selectedClusterRank: null,
  setPrimaryLayer: (primaryLayer) => set({ primaryLayer }),
  setResultVectorLayer: (resultVectorLayer) =>
    set((state) =>
      state.resultVectorLayer === resultVectorLayer ? state : { resultVectorLayer },
    ),
  setResultPathVectorLayer: (resultPathVectorLayer) =>
    set((state) =>
      state.resultPathVectorLayer === resultPathVectorLayer ? state : { resultPathVectorLayer },
    ),
  setClusterDistances: (clusterDistances) => set({ clusterDistances }),
  setMultiClusterDistances: (multiClusterDistances) => set({ multiClusterDistances }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLayerOpacity: (layerOpacity) => set({ layerOpacity }),
  setSelectedRadioLayer: (selectedRadioLayer) => set({ selectedRadioLayer }),
  setRasterLayerInfo: (rasterLayerInfo) => set({ rasterLayerInfo }),
  setShowLegend: (showLegend) => set({ showLegend }),
  handleLayerSelection: (selectedRadioLayer) => set({ selectedRadioLayer, showLegend: true }),
  setDrawingActive: (drawingActive) => set({ drawingActive }),
  setShowDrainLabels: (showDrainLabels) => set({ showDrainLabels }),
  setSelectedClusterRank: (rank) =>
    set((state) => ({ selectedClusterRank: state.selectedClusterRank === rank ? null : rank })),
  runAnalysis: async () => {
    const { selectedCondition, selectedConstraint, setTableData, setShowTable } =
      useManualCategoryStore.getState();
    const { selectionVectorLayer, displayRaster, uploadedFile, drawnPolygon, selectedMethod } =
      useManualAreaStore.getState();

    const selectedCategories = [...selectedCondition, ...selectedConstraint];

    if (selectedCategories.length === 0 || !selectionVectorLayer) return;

    set({ stpOperation: true, isMapLoading: true, error: null });

    try {
      const result = await runManualSuitabilityAnalysis({
        data: selectedCategories,
        village_layer: selectionVectorLayer,
        method: selectedMethod,
        file: uploadedFile ?? undefined,
        polygon: drawnPolygon?.geojson ?? undefined,
      });

      const suitabilityRaster: ClipRasters = {
        file_name: "STP_Suitability",
        workspace: result.workspace,
        layer_name: result.layer_name,
      };

      const existingIndex = displayRaster.findIndex(
        (item) => item.file_name === suitabilityRaster.file_name,
      );
      const nextRaster =
        existingIndex === -1
          ? [...displayRaster, suitabilityRaster]
          : displayRaster.map((item, index) =>
              index === existingIndex ? suitabilityRaster : item,
            );

      setTableData(result.csv_details);
      setShowTable(true);
      useManualAreaStore.setState({ displayRaster: nextRaster });

      set({
        rasterLayerInfo: suitabilityRaster,
        selectedRadioLayer: suitabilityRaster.file_name,
        showLegend: true,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to run manual suitability analysis",
      });
      setTableData([]);
      setShowTable(false);
    } finally {
      set({ stpOperation: false, isMapLoading: false });
    }
  },
  resetMapView: () => {
    useManualCategoryStore.getState().setTableData([]);
    useManualCategoryStore.getState().setShowTable(false);
    set({
      rasterLayerInfo: null,
      selectedRadioLayer: null,
      resultVectorLayer: null,
      resultPathVectorLayer: null,
      clusterDistances: null,
      multiClusterDistances: null,
      showLegend: false,
      error: null,
      stpOperation: false,
      selectedClusterRank: null,
    });
  },
}));
