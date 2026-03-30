// This store keeps map-related state for the admin page.
// It tracks visible layers, raster settings, and runs the analysis call.
import { create } from "zustand";
import {
  ADMIN_LAYER_NAMES,
  ClipRasters,
} from "@/interface/raster_context";
import { runAdminPriorityAnalysis } from "../../services/stpPriorityApi";
import { useAdminCategoryStore } from "./adminCategoryStore";
import { useAdminLocationStore } from "./adminLocationStore";

interface AdminMapStoreState {
  primaryLayer: string;
  secondaryLayer: string | null;
  showSecondaryLayer: boolean;
  showPrimaryLayer: boolean;
  LayerFilter: string | null;
  LayerFilterValue: number[] | null;
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
}

interface AdminMapStoreActions {
  setPrimaryLayer: (layer: string) => void;
  setSecondaryLayer: (layer: string | null) => void;
  setShowSecondaryLayer: (visible: boolean) => void;
  setShowPrimaryLayer: (visible: boolean) => void;
  setLoading: (loading: boolean) => void;
  setRasterLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWmsDebugInfo: (info: string | null) => void;
  setLayerOpacity: (opacity: number) => void;
  setSelectedradioLayer: (layer: string | null) => void;
  setRasterLayerInfo: (layer: ClipRasters | null) => void;
  setShowLegend: (visible: boolean) => void;
  handleLayerSelection: (layer: string) => void;
  syncLayersWithLocation: () => void;
  runAnalysis: () => Promise<void>;
  resetMapView: () => void;
}

export type AdminMapStore = AdminMapStoreState & AdminMapStoreActions;

type AdminMapSet = (
  partial:
    | Partial<AdminMapStore>
    | ((state: AdminMapStore) => Partial<AdminMapStore>),
) => void;

function resolveAdminSelectionLayer() {
  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
  } = useAdminLocationStore.getState();

  let secondaryLayer: string | null = null;
  let LayerFilter: string | null = null;
  let LayerFilterValue: number[] = [];

  if (selectedSubDistricts.length > 0) {
    secondaryLayer = ADMIN_LAYER_NAMES.SUB_DISTRICT;
    LayerFilter = "subdis_cod";
    LayerFilterValue = selectedSubDistricts;
  } else if (selectedDistricts.length > 0) {
    secondaryLayer = ADMIN_LAYER_NAMES.DISTRICT;
    LayerFilter = "district_c";
    LayerFilterValue = selectedDistricts;
  } else if (selectedState) {
    secondaryLayer = ADMIN_LAYER_NAMES.STATE;
    LayerFilter = "State_Code";
    LayerFilterValue = [selectedState];
  }

  return {
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
  };
}

function setAdminPrimaryLayer(set: AdminMapSet, layer: string) {
  set({ primaryLayer: layer });
}

function setAdminSecondaryLayer(set: AdminMapSet, layer: string | null) {
  set({ secondaryLayer: layer });
}

function setAdminShowSecondaryLayer(set: AdminMapSet, visible: boolean) {
  set({ showSecondaryLayer: visible });
}

function setAdminShowPrimaryLayer(set: AdminMapSet, visible: boolean) {
  set({ showPrimaryLayer: visible });
}

function setAdminLoading(set: AdminMapSet, loading: boolean) {
  set({ loading });
}

function setAdminRasterLoading(set: AdminMapSet, rasterLoading: boolean) {
  set({ rasterLoading });
}

function setAdminError(set: AdminMapSet, error: string | null) {
  set({ error });
}

function setAdminWmsDebugInfo(set: AdminMapSet, wmsDebugInfo: string | null) {
  set({ wmsDebugInfo });
}

function setAdminLayerOpacity(set: AdminMapSet, layerOpacity: number) {
  set({ layerOpacity });
}

function setAdminSelectedRadioLayer(set: AdminMapSet, selectedradioLayer: string | null) {
  set({ selectedradioLayer });
}

function setAdminRasterLayerInfo(set: AdminMapSet, rasterLayerInfo: ClipRasters | null) {
  set({ rasterLayerInfo });
}

function setAdminShowLegend(set: AdminMapSet, showLegend: boolean) {
  set({ showLegend });
}

function handleAdminLayerSelection(set: AdminMapSet, selectedradioLayer: string) {
  set({ selectedradioLayer });
}

function syncAdminLayersWithLocation(set: AdminMapSet) {
  set({ isMapLoading: true });
  set({
    primaryLayer: ADMIN_LAYER_NAMES.INDIA,
    ...resolveAdminSelectionLayer(),
    isMapLoading: false,
  });
}

async function runAdminAnalysis(set: AdminMapSet) {
  const { selectedCategories, setStpProcess, setTableData } =
    useAdminCategoryStore.getState();
  const {
    selectedSubDistricts,
    displayRaster,
    setDisplayRaster,
  } = useAdminLocationStore.getState();

  if (selectedCategories.length === 0 || selectedSubDistricts.length === 0) {
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
    const result = await runAdminPriorityAnalysis({
      data: selectedCategories,
      clip: selectedSubDistricts,
      place: "sub_district",
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
}

function resetAdminMapView(set: AdminMapSet) {
  useAdminCategoryStore.getState().setTableData([]);
  set({
    rasterLayerInfo: null,
    selectedradioLayer: null,
    showLegend: false,
    error: null,
    rasterLoading: false,
    stpOperation: false,
  });
}

export const useAdminMapStore = create<AdminMapStore>((set) => ({
  primaryLayer: ADMIN_LAYER_NAMES.INDIA,
  secondaryLayer: null,
  showSecondaryLayer: true,
  showPrimaryLayer: false,
  LayerFilter: null,
  LayerFilterValue: [],
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
  setPrimaryLayer: (layer) => setAdminPrimaryLayer(set, layer),
  setSecondaryLayer: (layer) => setAdminSecondaryLayer(set, layer),
  setShowSecondaryLayer: (visible) => setAdminShowSecondaryLayer(set, visible),
  setShowPrimaryLayer: (visible) => setAdminShowPrimaryLayer(set, visible),
  setLoading: (loading) => setAdminLoading(set, loading),
  setRasterLoading: (loading) => setAdminRasterLoading(set, loading),
  setError: (error) => setAdminError(set, error),
  setWmsDebugInfo: (info) => setAdminWmsDebugInfo(set, info),
  setLayerOpacity: (opacity) => setAdminLayerOpacity(set, opacity),
  setSelectedradioLayer: (layer) => setAdminSelectedRadioLayer(set, layer),
  setRasterLayerInfo: (layer) => setAdminRasterLayerInfo(set, layer),
  setShowLegend: (visible) => setAdminShowLegend(set, visible),
  handleLayerSelection: (layer) => handleAdminLayerSelection(set, layer),
  syncLayersWithLocation: () => syncAdminLayersWithLocation(set),
  runAnalysis: () => runAdminAnalysis(set),
  resetMapView: () => resetAdminMapView(set),
}));
