import { create } from "zustand";
import {
  ClipRasters,
  DRAIN_LAYER_NAMES,
} from "@/interface/raster_context";
import { runUserPriorityAnalysis } from "../../services/stpPriorityApi";
import { useUserCategoryStore } from "./userCategoryStore";
import { useUserRiverStore } from "./userRiverStore";

interface LayerFilter {
  filterField: string | null;
  filterValue: number[] | string[] | null;
}

interface UserMapState {
  primaryLayer: string;
  riverLayer: string | null;
  stretchLayer: string | null;
  drainLayer: string | null;
  catchmentLayer: string | null;
  boundarylayer: string | null;
  riverFilter: LayerFilter;
  stretchFilter: LayerFilter;
  drainFilter: LayerFilter;
  catchmentFilter: LayerFilter;
  shouldLoadAllLayers: boolean;
  hasSelections: boolean;
  stpOperation: boolean;
  isMapLoading: boolean;
  loading: boolean;
  rasterLoading: boolean;
  error: string | null;
  wmsDebugInfo: string | null;
  layerOpacity: number;
  selectedradioLayer: string | null;
  rasterLayerInfo: ClipRasters | null;
  showLegend: boolean;
  defaultWorkspace: string;
  geoServerUrl: string;
  setPrimaryLayer: (layer: string) => void;
  setRiverLayer: (layer: string | null) => void;
  setStretchLayer: (layer: string | null) => void;
  setDrainLayer: (layer: string | null) => void;
  setCatchmentLayer: (layer: string | null) => void;
  setLoading: (loading: boolean) => void;
  setRasterLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWmsDebugInfo: (info: string | null) => void;
  setLayerOpacity: (opacity: number) => void;
  setSelectedradioLayer: (layer: string | null) => void;
  setRasterLayerInfo: (layer: ClipRasters | null) => void;
  setShowLegend: (visible: boolean) => void;
  handleLayerSelection: (layer: string) => void;
  syncLayersWithRiverSystem: () => void;
  runAnalysis: () => Promise<void>;
  resetMapView: () => void;
}

export const useUserMapStore = create<UserMapState>((set) => ({
  primaryLayer: DRAIN_LAYER_NAMES.INDIA,
  riverLayer: DRAIN_LAYER_NAMES.RIVER,
  stretchLayer: DRAIN_LAYER_NAMES.STRETCH,
  drainLayer: DRAIN_LAYER_NAMES.DRAIN,
  catchmentLayer: DRAIN_LAYER_NAMES.CATCHMENT,
  boundarylayer: DRAIN_LAYER_NAMES.BOUNDARY,
  riverFilter: { filterField: null, filterValue: null },
  stretchFilter: { filterField: null, filterValue: null },
  drainFilter: { filterField: null, filterValue: null },
  catchmentFilter: { filterField: null, filterValue: null },
  shouldLoadAllLayers: true,
  hasSelections: false,
  stpOperation: false,
  isMapLoading: false,
  loading: false,
  rasterLoading: false,
  error: null,
  wmsDebugInfo: null,
  layerOpacity: 70,
  selectedradioLayer: null,
  rasterLayerInfo: null,
  showLegend: false,
  defaultWorkspace: "vector_work",
  geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
  setPrimaryLayer: (primaryLayer) => set({ primaryLayer }),
  setRiverLayer: (riverLayer) => set({ riverLayer }),
  setStretchLayer: (stretchLayer) => set({ stretchLayer }),
  setDrainLayer: (drainLayer) => set({ drainLayer }),
  setCatchmentLayer: (catchmentLayer) => set({ catchmentLayer }),
  setLoading: (loading) => set({ loading }),
  setRasterLoading: (rasterLoading) => set({ rasterLoading }),
  setError: (error) => set({ error }),
  setWmsDebugInfo: (wmsDebugInfo) => set({ wmsDebugInfo }),
  setLayerOpacity: (layerOpacity) => set({ layerOpacity }),
  setSelectedradioLayer: (selectedradioLayer) => set({ selectedradioLayer }),
  setRasterLayerInfo: (rasterLayerInfo) => set({ rasterLayerInfo }),
  setShowLegend: (showLegend) => set({ showLegend }),
  handleLayerSelection: (selectedradioLayer) => set({ selectedradioLayer }),
  syncLayersWithRiverSystem: () => {
    const {
      selectedRiver,
      selectedStretches,
      selectedDrains,
      selectedCatchments,
    } = useUserRiverStore.getState();

    const hasSelections = !!(
      selectedRiver ||
      selectedStretches.length > 0 ||
      selectedDrains.length > 0 ||
      selectedCatchments.length > 0
    );

    set({
      isMapLoading: true,
      hasSelections,
      riverLayer: DRAIN_LAYER_NAMES.RIVER,
      stretchLayer: DRAIN_LAYER_NAMES.STRETCH,
      drainLayer: DRAIN_LAYER_NAMES.DRAIN,
      catchmentLayer: DRAIN_LAYER_NAMES.CATCHMENT,
    });

    const riverFilter =
      selectedRiver !== null
        ? {
            filterField: "River_Code",
            filterValue: [selectedRiver],
          }
        : { filterField: null, filterValue: null };

    const stretchFilter =
      selectedStretches.length > 0
        ? {
            filterField: "Stretch_ID",
            filterValue: selectedStretches,
          }
        : selectedRiver !== null
          ? {
              filterField: "River_Code",
              filterValue: [selectedRiver],
            }
          : { filterField: null, filterValue: null };

    const drainFilter =
      selectedDrains.length > 0
        ? {
            filterField: "Drain_No",
            filterValue: selectedDrains,
          }
        : selectedStretches.length > 0
          ? {
              filterField: "Stretch_ID",
              filterValue: selectedStretches,
            }
          : selectedRiver !== null
            ? {
                filterField: "River_Code",
                filterValue: [selectedRiver],
              }
            : { filterField: null, filterValue: null };

    const catchmentFilter =
      selectedCatchments.length > 0
        ? {
            filterField: "village_id",
            filterValue: selectedCatchments,
          }
        : { filterField: null, filterValue: null };

    set({
      riverFilter,
      stretchFilter,
      drainFilter,
      catchmentFilter,
      shouldLoadAllLayers: false,
      isMapLoading: false,
    });
  },
  runAnalysis: async () => {
    const { selectedCategories, setStpProcess } = useUserCategoryStore.getState();
    const { catchmentLayer } = useUserMapStore.getState();
    const {
      selectedCatchments,
      displayRaster,
      setDisplayRaster,
      setTableData,
    } = useUserRiverStore.getState();

    if (selectedCategories.length === 0 || selectedCatchments.length === 0) {
      return;
    }

    set({
      stpOperation: true,
      rasterLoading: true,
      error: null,
      wmsDebugInfo: null,
    });
    setStpProcess(true);

    try {
      const result = await runUserPriorityAnalysis({
        data: selectedCategories,
        clip: selectedCatchments,
        place: "Drain",
        village_layer: catchmentLayer,
      });

      const priorityRaster: ClipRasters = {
        file_name: "STP_Priority",
        workspace: result.workspace,
        layer_name: result.layer_name,
      };

      const existingIndex = displayRaster.findIndex(
        (item) => item.file_name === priorityRaster.file_name,
      );
      const nextRaster =
        existingIndex === -1
          ? [...displayRaster, priorityRaster]
          : displayRaster.map((item, index) =>
              index === existingIndex ? priorityRaster : item,
            );

      setTableData(result.csv_details);
      setDisplayRaster(nextRaster);
      set({
        rasterLayerInfo: priorityRaster,
        selectedradioLayer: priorityRaster.file_name,
        showLegend: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error communicating with STP service";
      set({ error: message });
      setTableData([]);
    } finally {
      set({
        stpOperation: false,
        rasterLoading: false,
      });
      setStpProcess(false);
    }
  },
  resetMapView: () => {
    useUserRiverStore.getState().setTableData([]);
    set({
      catchmentLayer: null,
      rasterLayerInfo: null,
      selectedradioLayer: null,
      showLegend: false,
      error: null,
      rasterLoading: false,
      stpOperation: false,
    });
  },
}));
