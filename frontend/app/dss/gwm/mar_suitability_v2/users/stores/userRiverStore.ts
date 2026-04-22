import { create } from "zustand";
import {
  Catchment,
  ClipRasters,
  DRAIN_LAYER_NAMES,
  Drain,
  River,
  Stretch,
} from "@/interface/raster_context";
import { DataRow } from "@/interface/table";
import {
  fetchPriorityCatchments,
  fetchUserDisplayRaster,
  fetchUserRiverReferenceData,
  fetchStretchesByRiver,
  fetchDrainsByStretches,
} from "../../services/marSuitabilityApi";
import { useUserMapStore } from "./userMapStore";

export interface UserSelectionsData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  totalArea: number;
}

interface UserRiverState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  allRivers: River[];
  allStretches: Stretch[];
  allDrains: Drain[];
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  selectedRiver: number | null;
  selectedStretches: number[];
  selectedDrains: number[];
  selectedCatchments: number[];
  selectedStreachNames: number[];
  selectedDrainsNames: number[];
  selectedCatchmentsNames: string[];
  selectedRiverName: string;
  totalArea: number;
  totalCatchments: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  villageLayer: string | null;
  showCatchment: boolean;
  AnalysisCachement: boolean;
  showCatchmentLayer: boolean;
  initialize: () => Promise<void>;
  handleRiverChange: (riverCode: number) => Promise<void>;
  setSelectedRiver: (riverCode: number | null) => Promise<void>;
  setSelectedStretches: (stretchIds: number[]) => Promise<void>;
  setSelectedDrains: (drainIds: number[]) => void;
  setSelectedCatchments: (catchmentIds: number[]) => void;
  setShowCatchment: (value: boolean) => Promise<void>;
  setAnalysisCachement: (value: boolean) => void;
  setShowCatchmentLayer: (value: boolean) => void;
  setDisplayRaster: (layers: ClipRasters[]) => void;
  syncDisplayRasterForSelections: () => Promise<void>;
  confirmSelections: () => Promise<UserSelectionsData | null>;
  resetSelections: () => void;
  reset: () => void;
}

function deriveUserRiverState(
  allRivers: River[],
  allStretches: Stretch[],
  allDrains: Drain[],
  catchments: Catchment[],
  selectedRiver: number | null,
  selectedStretches: number[],
  selectedDrains: number[],
  selectedCatchments: number[],
) {
  const stretches = allStretches;
  const drains = allDrains;

  const selectedRiverName =
    allRivers.find((river) => river.River_Code === selectedRiver)?.River_Name ?? "";
  const selectedStreachNames = allStretches
    .filter((stretch) => selectedStretches.includes(stretch.id))
    .map((stretch) => stretch.id);
  const selectedDrainsNames = Array.from(
    new Set(allDrains.filter((drain) => selectedDrains.includes(drain.id)).map((drain) => drain.id)),
  );
  const selectedCatchmentsNames = catchments
    .filter((catchment) => selectedCatchments.includes(catchment.id))
    .map((catchment) => catchment.village_name || "");
  const selectedCatchmentObjects = catchments.filter((catchment) =>
    selectedCatchments.includes(Number(catchment.id)),
  );
  const totalArea =
    selectedCatchmentObjects.reduce((sum, catchment) => sum + (catchment.area || 0), 0) /
    1000000;

  return {
    stretches,
    drains,
    selectedRiverName,
    selectedStreachNames,
    selectedDrainsNames,
    selectedCatchmentsNames,
    totalArea,
    totalCatchments: selectedCatchments.length,
  };
}

export const useUserRiverStore = create<UserRiverState>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  allRivers: [],
  allStretches: [],
  allDrains: [],
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  selectedRiver: null,
  selectedStretches: [],
  selectedDrains: [],
  selectedCatchments: [],
  selectedStreachNames: [],
  selectedDrainsNames: [],
  selectedCatchmentsNames: [],
  selectedRiverName: "",
  totalArea: 0,
  totalCatchments: 0,
  selectionsLocked: false,
  displayRaster: [],
  villageLayer: null,
  showCatchment: false,
  AnalysisCachement: false,
  showCatchmentLayer: true,
  tableData: [],
  initialize: async () => {
    if (get().initialized || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { rivers } = await fetchUserRiverReferenceData();
      set({
        initialized: true,
        allRivers: rivers,
        rivers,
      });
      useUserMapStore.getState().syncLayersWithRiverSystem();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch river system data";
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },
  handleRiverChange: async (riverCode) => {
    const nextSelectedRiver = Number.isNaN(riverCode) ? null : riverCode;
    if (!nextSelectedRiver) {
      set({
        selectedRiver: null,
        selectedStretches: [],
        selectedDrains: [],
        selectedCatchments: [],
        allStretches: [],
        allDrains: [],
        catchments: [],
        selectionsLocked: false,
        displayRaster: [],
        villageLayer: null,
        showCatchment: false,
      });
      useUserMapStore.getState().syncLayersWithRiverSystem();
      return;
    }

    set({ isLoading: true });
    try {
      const stretches = await fetchStretchesByRiver(nextSelectedRiver);
      const { allRivers } = get();
      const derived = deriveUserRiverState(
        allRivers,
        stretches,
        [],
        [],
        nextSelectedRiver,
        [],
        [],
        [],
      );
      set({
        selectedRiver: nextSelectedRiver,
        allStretches: stretches,
        allDrains: [],
        selectedStretches: [],
        selectedDrains: [],
        selectedCatchments: [],
        catchments: [],
        selectionsLocked: false,
        displayRaster: [],
        villageLayer: null,
        showCatchment: false,
        AnalysisCachement: false,
        showCatchmentLayer: true,
        ...derived,
      });
      DRAIN_LAYER_NAMES.CATCHMENT = null;
      useUserMapStore.getState().syncLayersWithRiverSystem();
    } catch(err) {
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },
  setSelectedRiver: async (riverCode) => {
    if (riverCode === null) {
      await get().handleRiverChange(Number.NaN);
      return;
    }
    await get().handleRiverChange(riverCode);
  },
  setSelectedStretches: async (stretchIds) => {
    set({ isLoading: true });
    try {
      const allDrains = await fetchDrainsByStretches(stretchIds);
      const { allRivers, allStretches, selectedRiver } = get();

      const derived = deriveUserRiverState(
        allRivers,
        allStretches,
        allDrains,
        [],
        selectedRiver,
        stretchIds,
        [],
        [],
      );
      set({
        allDrains,
        selectedStretches: stretchIds,
        selectedDrains: [],
        selectedCatchments: [],
        catchments: [],
        selectionsLocked: false,
        displayRaster: [],
        villageLayer: null,
        showCatchment: false,
        AnalysisCachement: false,
        showCatchmentLayer: true,
        ...derived,
      });
      DRAIN_LAYER_NAMES.CATCHMENT = null;
      useUserMapStore.getState().syncLayersWithRiverSystem();
    } catch(err) {
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },
  setSelectedDrains: (drainIds) => {
    const { allRivers, allStretches, allDrains, selectedRiver, selectedStretches } = get();
    const derived = deriveUserRiverState(
      allRivers,
      allStretches,
      allDrains,
      [],
      selectedRiver,
      selectedStretches,
      drainIds,
      [],
    );
    set({
      selectedDrains: drainIds,
      selectedCatchments: [],
      catchments: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
      showCatchment: false,
      AnalysisCachement: false,
      showCatchmentLayer: true,
      ...derived,
    });
    DRAIN_LAYER_NAMES.CATCHMENT = null;
    useUserMapStore.getState().syncLayersWithRiverSystem();
  },
  setSelectedCatchments: (catchmentIds) => {
    const {
      allRivers,
      allStretches,
      allDrains,
      catchments,
      selectedRiver,
      selectedStretches,
      selectedDrains,
    } = get();
    const derived = deriveUserRiverState(
      allRivers,
      allStretches,
      allDrains,
      catchments,
      selectedRiver,
      selectedStretches,
      selectedDrains,
      catchmentIds,
    );
    set({
      selectedCatchments: catchmentIds,
      selectionsLocked: false,
      displayRaster: [],
      ...derived,
    });
    useUserMapStore.getState().syncLayersWithRiverSystem();
  },
  setShowCatchment: async (value) => {
    set({ showCatchment: value });
    if (!value) {
      return;
    }

    const { selectedDrains } = get();
    if (selectedDrains.length === 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await fetchPriorityCatchments(selectedDrains);
      DRAIN_LAYER_NAMES.CATCHMENT = response.layer_name;
      const catchments = response.catchments.map((catchment) => ({
        id: catchment.id,
        village_name: catchment.village_name,
        area: catchment.area,
      }));
      const {
        allRivers,
        allStretches,
        allDrains,
        selectedRiver,
        selectedStretches,
      } = get();
      const catchmentIds = catchments.map((catchment) => catchment.id);
      const derived = deriveUserRiverState(
        allRivers,
        allStretches,
        allDrains,
        catchments,
        selectedRiver,
        selectedStretches,
        selectedDrains,
        catchmentIds,
      );
      set({
        catchments,
        selectedCatchments: catchmentIds,
        villageLayer: response.layer_name || null,
        ...derived,
      });
      useUserMapStore.getState().syncLayersWithRiverSystem();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch catchments";
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },
  setAnalysisCachement: (AnalysisCachement) => set({ AnalysisCachement }),
  setShowCatchmentLayer: (showCatchmentLayer) => set({ showCatchmentLayer }),
  setDisplayRaster: (displayRaster) => set({ displayRaster }),
  syncDisplayRasterForSelections: async () => {
    const { selectionsLocked, selectedCatchments, villageLayer } = get();
    if (!selectionsLocked || selectedCatchments.length === 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const displayRasterResponse = await fetchUserDisplayRaster(
        selectedCatchments,
        DRAIN_LAYER_NAMES.CATCHMENT,
      );
      set({
        displayRaster: displayRasterResponse.raster_layer ?? [],
        villageLayer: displayRasterResponse.vector_layer || villageLayer || null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch display raster";
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },
  confirmSelections: async () => {
    const {
      allRivers,
      allStretches,
      allDrains,
      catchments,
      selectedRiver,
      selectedStretches,
      selectedDrains,
      selectedCatchments,
      totalArea,
      villageLayer,
    } = get();
    if (selectedCatchments.length === 0) {
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const displayRasterResponse = await fetchUserDisplayRaster(
        selectedCatchments,
        DRAIN_LAYER_NAMES.CATCHMENT,
      );
      set({
        selectionsLocked: true,
        displayRaster: displayRasterResponse.raster_layer ?? [],
        villageLayer: displayRasterResponse.vector_layer || villageLayer || null,
      });
      useUserMapStore.getState().syncLayersWithRiverSystem();

      return {
        rivers: selectedRiver
          ? allRivers.filter((river) => river.River_Code === selectedRiver)
          : [],
        stretches: allStretches.filter((stretch) =>
          selectedStretches.includes(Number(stretch.id)),
        ),
        drains: allDrains.filter((drain) => selectedDrains.includes(Number(drain.id))),
        catchments: catchments.filter((catchment) =>
          selectedCatchments.includes(Number(catchment.id)),
        ),
        totalArea,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch display raster";
      set({ error: message });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  resetSelections: () => {
    const { allRivers, allStretches, allDrains, selectedRiver, selectedStretches, selectedDrains } =
      get();
    const derived = deriveUserRiverState(
      allRivers,
      allStretches,
      allDrains,
      [],
      selectedRiver,
      selectedStretches,
      selectedDrains,
      [],
    );
    set({
      catchments: [],
      selectedCatchments: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
      showCatchment: false,
      AnalysisCachement: false,
      showCatchmentLayer: true,
      ...derived,
    });
    useUserMapStore.getState().syncLayersWithRiverSystem();
  },
  reset: () => {
    const { allRivers, allStretches, allDrains } = get();
    const derived = deriveUserRiverState(allRivers, allStretches, allDrains, [], null, [], [], []);
    set({
      selectedRiver: null,
      selectedStretches: [],
      selectedDrains: [],
      selectedCatchments: [],
      catchments: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
      showCatchment: false,
      AnalysisCachement: false,
      showCatchmentLayer: true,
      ...derived,
    });
    DRAIN_LAYER_NAMES.CATCHMENT = null;
    useUserMapStore.getState().resetMapView();
    useUserMapStore.getState().syncLayersWithRiverSystem();
  },
}));
