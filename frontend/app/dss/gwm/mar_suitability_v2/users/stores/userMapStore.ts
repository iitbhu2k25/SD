import { create } from "zustand";
import {
  ClipRasters,
  DRAIN_LAYER_NAMES,
  MarValidationItem,
} from "@/interface/raster_context";
import { runUserMarAnalysis, UserPriorityAnalysisPayload } from "../../services/marSuitabilityApi";
import { useUserCategoryStore } from "./userCategoryStore";
import { useUserRiverStore } from "./userRiverStore";

interface LayerFilter {
  filterField: string | null;
  filterValue: number[] | string[] | null;
}

export interface Coordinates {
  lat: number;
  lon: number;
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
  marOperation: boolean;
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
  
  vectorInteractionEnabled: boolean;
  pinCoordinate: Coordinates | null;
  subsurfaceValidation: MarValidationItem[];
  
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
  
  setVectorInteractionEnabled: (enabled: boolean) => void;
  setPinCoordinate: (coord: Coordinates | null) => void;
  setSubsurfaceValidation: (validation: MarValidationItem[]) => void;
}

function getValidationTitle(item: MarValidationItem): string {
  const key = Object.keys(item).find(
    (entry) => entry !== "reason" && entry !== "color_code",
  );
  return key ?? "Validation";
}

function normalizeValidationItems(items: MarValidationItem[]): MarValidationItem[] {
  if (items.length <= 1) {
    return items;
  }
  const uniqueByTitle = new Map<string, MarValidationItem>();
  for (const item of items) {
    uniqueByTitle.set(getValidationTitle(item), item);
  }
  return Array.from(uniqueByTitle.values());
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
  marOperation: false,
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
  
  vectorInteractionEnabled: false,
  pinCoordinate: null,
  subsurfaceValidation: [],
  
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
    const { selectedConditions, selectedConstraints, setMarProcess } = useUserCategoryStore.getState();
    const {
      selectedCatchments,
      villageLayer,
      displayRaster,
      setDisplayRaster,
    } = useUserRiverStore.getState();
    const setTableData = useUserCategoryStore.getState().setTableData;
    
    const combinedData = [...selectedConditions, ...selectedConstraints];

    if (combinedData.length === 0 || selectedCatchments.length === 0 || !villageLayer) {
      return;
    }

    set({
      marOperation: true,
      rasterLoading: true,
      error: null,
      wmsDebugInfo: null,
    });
    setMarProcess(true);

    try {
      const payload: UserPriorityAnalysisPayload = {
        data: combinedData,
        village_layer: villageLayer,
        place: "Drain",
      };
      
      const result = await runUserMarAnalysis(payload);

      const priorityRaster: ClipRasters = {
        file_name: "mar_suitability",
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
          : "Error communicating with MAR service";
      set({ error: message });
      setTableData([]);
    } finally {
      set({
        marOperation: false,
        rasterLoading: false,
      });
      setMarProcess(false);
    }
  },
  resetMapView: () => {
    useUserCategoryStore.getState().setTableData([]);
    set({
      catchmentLayer: null,
      rasterLayerInfo: null,
      selectedradioLayer: null,
      showLegend: false,
      error: null,
      rasterLoading: false,
      marOperation: false,
      pinCoordinate: null,
      subsurfaceValidation: [],
    });
  },
  
  setVectorInteractionEnabled: (enabled) => set({ vectorInteractionEnabled: enabled }),
  setPinCoordinate: (coord) => set({ pinCoordinate: coord }),
  setSubsurfaceValidation: (validation) =>
    set({ subsurfaceValidation: normalizeValidationItems(validation) }),
}));
