import { create } from "zustand";
import { ADMIN_TOWN_LAYER_NAMES, type ClipRasters } from "@/interface/raster_context";
import { runAdminSuitabilityAnalysis } from "../../services/stpSuitabilityApi";
import { useAdminCategoryStore } from "./adminCategoryStore";
import { useAdminLocationStore } from "./adminLocationStore";

interface AdminMapStoreState {
  primaryLayer: string;
  secondaryLayer: string | null;
  resultVectorLayer: string | null;
  layerFilter: string | null;
  layerFilterValue: number[] | null;
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

interface AdminMapStoreActions {
  setPrimaryLayer: (layer: string) => void;
  setSecondaryLayer: (layer: string | null) => void;
  setResultVectorLayer: (layer: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLayerOpacity: (opacity: number) => void;
  setSelectedRadioLayer: (layer: string | null) => void;
  setRasterLayerInfo: (layer: ClipRasters | null) => void;
  setShowLegend: (visible: boolean) => void;
  handleLayerSelection: (layer: string) => void;
  syncLayersWithLocation: () => void;
  runAnalysis: () => Promise<void>;
  resetMapView: () => void;
}

export type AdminMapStore = AdminMapStoreState & AdminMapStoreActions;

function resolveAdminSelectionLayer() {
  const { selectedState, selectedDistricts, selectedSubDistricts, selectedTowns } =
    useAdminLocationStore.getState();

  if (selectedTowns.length > 0) {
    return {
      secondaryLayer: ADMIN_TOWN_LAYER_NAMES.SUB_DISTRICT,
      layerFilter: '"ID"',
      layerFilterValue: selectedTowns,
    };
  }

  if (selectedSubDistricts.length > 0) {
    return {
      secondaryLayer: ADMIN_TOWN_LAYER_NAMES.SUB_DISTRICT,
      layerFilter: "subdis_cod",
      layerFilterValue: selectedSubDistricts,
    };
  }

  if (selectedDistricts.length > 0) {
    return {
      secondaryLayer: ADMIN_TOWN_LAYER_NAMES.DISTRICT,
      layerFilter: "district_c",
      layerFilterValue: selectedDistricts,
    };
  }

  if (selectedState) {
    return {
      secondaryLayer: ADMIN_TOWN_LAYER_NAMES.STATE,
      layerFilter: "State_Code",
      layerFilterValue: [selectedState],
    };
  }

  return {
    secondaryLayer: null,
    layerFilter: null,
    layerFilterValue: null,
  };
}

export const useAdminMapStore = create<AdminMapStore>((set) => ({
  primaryLayer: ADMIN_TOWN_LAYER_NAMES.INDIA,
  secondaryLayer: null,
  resultVectorLayer: null,
  layerFilter: null,
  layerFilterValue: null,
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
  setSecondaryLayer: (secondaryLayer) => set({ secondaryLayer }),
  setResultVectorLayer: (resultVectorLayer) => set({ resultVectorLayer }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLayerOpacity: (layerOpacity) => set({ layerOpacity }),
  setSelectedRadioLayer: (selectedRadioLayer) => set({ selectedRadioLayer }),
  setRasterLayerInfo: (rasterLayerInfo) => set({ rasterLayerInfo }),
  setShowLegend: (showLegend) => set({ showLegend }),
  handleLayerSelection: (selectedRadioLayer) => set({ selectedRadioLayer }),
  syncLayersWithLocation: () => {
    set({
      primaryLayer: ADMIN_TOWN_LAYER_NAMES.INDIA,
      ...resolveAdminSelectionLayer(),
      isMapLoading: false,
    });
  },
  runAnalysis: async () => {
    const { selectedCondition, selectedConstraint, setTableData, setShowTable } =
      useAdminCategoryStore.getState();
    const { selectedTowns, displayRaster, selectedVillages } = useAdminLocationStore.getState();
    const selectedCategories = [...selectedCondition, ...selectedConstraint];

    if (selectedCategories.length === 0 || selectedTowns.length === 0) {
      return;
    }

    set({
      stpOperation: true,
      isMapLoading: true,
      error: null,
    });

    try {
      const result = await runAdminSuitabilityAnalysis({
        data: selectedCategories,
        clip: selectedTowns,
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
      useAdminLocationStore.setState({
        displayRaster: nextRaster,
        selectedVillages:
          selectedVillages,
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
    useAdminCategoryStore.getState().setTableData([]);
    useAdminCategoryStore.getState().setShowTable(false);
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
