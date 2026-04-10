import { create } from "zustand";
import { DRAIN_LAYER_NAMES, type ClipRasters } from "@/interface/raster_context";
import { runUserSuitabilityAnalysis } from "../../services/stpSuitabilityApi";
import { useUserCategoryStore } from "./userCategoryStore";
import { useUserRiverStore } from "./userRiverStore";

interface LayerFilter {
  filterField: string | null;
  filterValue: number[] | string[] | null;
}

interface UserMapStoreState {
  primaryLayer: string;
  riverLayer: string | null;
  stretchLayer: string | null;
  drainLayer: string | null;
  catchmentLayer: string | null;
  boundaryLayer: string | null;
  resultVectorLayer: string | null;
  riverFilter: LayerFilter;
  stretchFilter: LayerFilter;
  drainFilter: LayerFilter;
  catchmentFilter: LayerFilter;
  shouldLoadAllLayers: boolean;
  hasSelections: boolean;
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
}

interface UserMapStoreActions {
  setPrimaryLayer: (layer: string) => void;
  setRiverLayer: (layer: string | null) => void;
  setStretchLayer: (layer: string | null) => void;
  setDrainLayer: (layer: string | null) => void;
  setCatchmentLayer: (layer: string | null) => void;
  setResultVectorLayer: (layer: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLayerOpacity: (opacity: number) => void;
  setSelectedRadioLayer: (layer: string | null) => void;
  setRasterLayerInfo: (layer: ClipRasters | null) => void;
  setShowLegend: (visible: boolean) => void;
  handleLayerSelection: (layer: string) => void;
  syncLayersWithRiverSystem: () => void;
  runAnalysis: () => Promise<void>;
  resetMapView: () => void;
}

export type UserMapStore = UserMapStoreState & UserMapStoreActions;

export const useUserMapStore = create<UserMapStore>((set) => ({
  primaryLayer: DRAIN_LAYER_NAMES.INDIA,
  riverLayer: DRAIN_LAYER_NAMES.RIVER,
  stretchLayer: DRAIN_LAYER_NAMES.STRETCH,
  drainLayer: DRAIN_LAYER_NAMES.DRAIN,
  catchmentLayer: DRAIN_LAYER_NAMES.CATCHMENT,
  boundaryLayer: DRAIN_LAYER_NAMES.BOUNDARY,
  resultVectorLayer: null,
  riverFilter: { filterField: null, filterValue: null },
  stretchFilter: { filterField: null, filterValue: null },
  drainFilter: { filterField: null, filterValue: null },
  catchmentFilter: { filterField: null, filterValue: null },
  shouldLoadAllLayers: true,
  hasSelections: false,
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
  setPrimaryLayer: (primaryLayer) => set({ primaryLayer }),
  setRiverLayer: (riverLayer) => set({ riverLayer }),
  setStretchLayer: (stretchLayer) => set({ stretchLayer }),
  setDrainLayer: (drainLayer) => set({ drainLayer }),
  setCatchmentLayer: (catchmentLayer) => set({ catchmentLayer }),
  setResultVectorLayer: (resultVectorLayer) => set({ resultVectorLayer }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLayerOpacity: (layerOpacity) => set({ layerOpacity }),
  setSelectedRadioLayer: (selectedRadioLayer) => set({ selectedRadioLayer }),
  setRasterLayerInfo: (rasterLayerInfo) => set({ rasterLayerInfo }),
  setShowLegend: (showLegend) => set({ showLegend }),
  handleLayerSelection: (selectedRadioLayer) => set({ selectedRadioLayer }),
  syncLayersWithRiverSystem: () => {
    const {
      selectedRiver,
      selectedStretches,
      selectedDrains,
      selectedCatchments,
      catchmentLayerName,
    } = useUserRiverStore.getState();

    const hasSelections = Boolean(
      selectedRiver ||
        selectedStretches.length > 0 ||
        selectedDrains.length > 0 ||
        selectedCatchments.length > 0,
    );

    const riverFilter =
      selectedRiver !== null
        ? { filterField: "River_Code", filterValue: [selectedRiver] }
        : { filterField: null, filterValue: null };

    const stretchFilter =
      selectedStretches.length > 0
        ? { filterField: "Stretch_ID", filterValue: selectedStretches }
        : selectedRiver !== null
          ? { filterField: "River_Code", filterValue: [selectedRiver] }
          : { filterField: null, filterValue: null };

    const drainFilter =
      selectedDrains.length > 0
        ? { filterField: "Drain_No", filterValue: selectedDrains }
        : selectedStretches.length > 0
          ? { filterField: "Stretch_ID", filterValue: selectedStretches }
          : selectedRiver !== null
            ? { filterField: "River_Code", filterValue: [selectedRiver] }
            : { filterField: null, filterValue: null };

    const catchmentFilter =
      selectedCatchments.length > 0
        ? { filterField: "village_id", filterValue: selectedCatchments }
        : { filterField: null, filterValue: null };

    set({
      hasSelections,
      riverLayer: DRAIN_LAYER_NAMES.RIVER,
      stretchLayer: DRAIN_LAYER_NAMES.STRETCH,
      drainLayer: DRAIN_LAYER_NAMES.DRAIN,
      catchmentLayer: catchmentLayerName ?? DRAIN_LAYER_NAMES.CATCHMENT,
      riverFilter,
      stretchFilter,
      drainFilter,
      catchmentFilter,
      shouldLoadAllLayers: false,
      isMapLoading: false,
    });
  },
  runAnalysis: async () => {
    const { selectedCondition, selectedConstraint, setTableData, setShowTable } =
      useUserCategoryStore.getState();
    const { selectedCatchments, selectedDrains, displayRaster } = useUserRiverStore.getState();
    const selectedCategories = [...selectedCondition, ...selectedConstraint];

    if (selectedCategories.length === 0 || selectedCatchments.length === 0) {
      return;
    }

    set({
      stpOperation: true,
      isMapLoading: true,
      error: null,
    });

    try {
      const result = await runUserSuitabilityAnalysis({
        data: selectedCategories,
        clip: selectedCatchments,
        place: "Drain",
        drain_clip: selectedDrains,
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
      useUserRiverStore.setState({
        displayRaster: nextRaster,
      });

      set({
        rasterLayerInfo: suitabilityRaster,
        selectedRadioLayer: suitabilityRaster.file_name,
    
        showLegend: true,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to run suitability analysis",
      });
      setTableData([]);
      setShowTable(false);
    } finally {
      set({
        stpOperation: false,
        isMapLoading: false,
      });
    }
  },
  resetMapView: () => {
    useUserCategoryStore.getState().setTableData([]);
    useUserCategoryStore.getState().setShowTable(false);
    set({
      rasterLayerInfo: null,
      selectedRadioLayer: null,
      resultVectorLayer: null,
      showLegend: false,
      error: null,
      stpOperation: false,
    });
  },
}));
