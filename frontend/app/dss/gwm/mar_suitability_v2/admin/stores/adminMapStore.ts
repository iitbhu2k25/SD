import { create } from "zustand";
import {
  ADMIN_LAYER_NAMES,
  ClipRasters,
  MarValidationItem,
} from "@/interface/raster_context";
import { runAdminMarAnalysis } from "../../services/marSuitabilityApi";
import { useAdminCategoryStore } from "./adminCategoryStore";
import { useAdminLocationStore } from "./adminLocationStore";

export interface Coordinates {
  lat: number;
  lon: number;
}

interface AdminMapStoreState {
  primaryLayer: string;
  secondaryLayer: string | null;
  showSecondaryLayer: boolean;
  showPrimaryLayer: boolean;
  LayerFilter: string | null;
  LayerFilterValue: number[] | null;
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
  
  // MAR Single Click Subsurface Additions
  vectorInteractionEnabled: boolean;
  pinCoordinate: Coordinates | null;
  subsurfaceValidation: MarValidationItem[];
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
  
  // Single click properties
  setVectorInteractionEnabled: (enabled: boolean) => void;
  setPinCoordinate: (coord: Coordinates | null) => void;
  setSubsurfaceValidation: (validation: MarValidationItem[]) => void;
}

export type AdminMapStore = AdminMapStoreState & AdminMapStoreActions;

type AdminMapSet = (
  partial:
    | Partial<AdminMapStore>
    | ((state: AdminMapStore) => Partial<AdminMapStore>),
) => void;

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

function resolveAdminSelectionLayer() {
  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedVillages,
  } = useAdminLocationStore.getState();

  let secondaryLayer: string | null = null;
  let LayerFilter: string | null = null;
  let LayerFilterValue: number[] = [];

  if (selectedVillages.length > 0) {
    secondaryLayer = ADMIN_LAYER_NAMES.SUB_DISTRICT;
    LayerFilter = '"ID"';
    LayerFilterValue = selectedVillages;
  } else if (selectedSubDistricts.length > 0) {
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

function setAdminVectorInteractionEnabled(set: AdminMapSet, vectorInteractionEnabled: boolean) {
  set({ vectorInteractionEnabled });
}

function setAdminPinCoordinate(set: AdminMapSet, pinCoordinate: Coordinates | null) {
  set({ pinCoordinate });
}

function setAdminSubsurfaceValidation(
  set: AdminMapSet,
  subsurfaceValidation: MarValidationItem[],
) {
  set({ subsurfaceValidation: normalizeValidationItems(subsurfaceValidation) });
}

async function runAdminAnalysis(set: AdminMapSet) {
  const { selectedConditions, selectedConstraints, setMarProcess, setTableData } =
    useAdminCategoryStore.getState();
  const {
    villageLayer,
    displayRaster,
    setDisplayRaster,
  } = useAdminLocationStore.getState();

  // Combine conditions and constraints for analysis
  const combinedData = [...selectedConditions, ...selectedConstraints];

  if (combinedData.length === 0 || !villageLayer) {
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
    const result = await runAdminMarAnalysis({
      data: combinedData,
      village_layer: villageLayer,
    });

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
}

function resetAdminMapView(set: AdminMapSet) {
  useAdminCategoryStore.getState().setTableData([]);
  set({
    rasterLayerInfo: null,
    selectedradioLayer: null,
    showLegend: false,
    error: null,
    rasterLoading: false,
    marOperation: false,
    pinCoordinate: null,
    subsurfaceValidation: [],
  });
}

export const useAdminMapStore = create<AdminMapStore>((set) => ({
  primaryLayer: ADMIN_LAYER_NAMES.INDIA,
  secondaryLayer: null,
  showSecondaryLayer: true,
  showPrimaryLayer: false,
  LayerFilter: null,
  LayerFilterValue: [],
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
  
  setVectorInteractionEnabled: (enabled) => setAdminVectorInteractionEnabled(set, enabled),
  setPinCoordinate: (coord) => setAdminPinCoordinate(set, coord),
  setSubsurfaceValidation: (validation) => setAdminSubsurfaceValidation(set, validation),
}));
