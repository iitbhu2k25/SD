import { create } from "zustand";
import {
  Catchment,
  ClipRasters,
  DRAIN_LAYER_NAMES,
  Drain,
  River,
  Stretch,
} from "@/interface/raster_context";
import { CsvRow } from "@/interface/table";
import {
  fetchDrains,
  fetchPriorityCatchments,
  fetchRivers,
  fetchStretches,
  fetchUserDisplayRaster,
  runUserPumpingFindScore,
} from "../../services/gwmPumpingApi";
import { useUserCategoryStore } from "./userCategoryStore";
import { useUserMapStore } from "./userMapStore";

const NO_PUMPING_SCORE_MESSAGE =
  "No pumping score could be generated for the selected well points. Please choose points inside or closer to the generated analysis area.";

export interface UserSelectionsData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  totalArea: number;
}

interface UserRiverStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;

  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];

  selectedRiver: number | null;
  selectedStretches: number[];
  selectedDrains: number[];
  selectedCatchments: number[];

  selectedRiverName: string;
  selectedStreachNames: number[];
  selectedDrainsNames: number[];
  selectedCatchmentsNames: string[];

  totalArea: number;
  totalCatchments: number;

  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  resultLayer: string | null;
  showCatchment: boolean;
  analysisCatchment: boolean;

  wellPoints: CsvRow[];
  validateTable: boolean;
}

interface UserRiverStoreActions {
  initialize: () => Promise<void>;
  handleRiverChange: (riverCode: number) => Promise<void>;
  setSelectedRiver: (riverCode: number | null) => Promise<void>;
  setSelectedStretches: (stretchIds: number[]) => Promise<void>;
  setSelectedDrains: (drainIds: number[]) => Promise<void>;
  setSelectedCatchments: (catchmentIds: number[]) => void;
  setShowCatchment: (value: boolean) => Promise<void>;
  setAnalysisCatchment: (value: boolean) => void;
  setDisplayRaster: (layers: ClipRasters[]) => void;
  setWellPoints: (points: CsvRow[]) => void;
  setValidateTable: (value: boolean) => Promise<void>;
  confirmSelections: () => Promise<UserSelectionsData | null>;
  resetSelections: () => void;
  reset: () => void;
}

export type UserRiverStore = UserRiverStoreState & UserRiverStoreActions;

type UserRiverSet = (
  partial:
    | Partial<UserRiverStore>
    | ((state: UserRiverStore) => Partial<UserRiverStore>),
) => void;
type UserRiverGet = () => UserRiverStore;

function mapSelectedRiverName(rivers: River[], selectedRiver: number | null) {
  return rivers.find((river) => Number(river.River_Code) === selectedRiver)?.River_Name ?? "";
}

function mapSelectedStretchNames(stretches: Stretch[], selectedStretches: number[]) {
  return stretches
    .filter((stretch) => selectedStretches.includes(Number(stretch.id)))
    .map((stretch) => stretch.id);
}

function mapSelectedDrainNames(drains: Drain[], selectedDrains: number[]) {
  return drains
    .filter((drain) => selectedDrains.includes(Number(drain.id)))
    .map((drain) => drain.id);
}

function mapSelectedCatchmentNames(catchments: Catchment[], selectedCatchments: number[]) {
  return catchments
    .filter((catchment) => selectedCatchments.includes(Number(catchment.id)))
    .map((catchment) => catchment.village_name);
}

function calculateTotalArea(catchments: Catchment[], selectedCatchments: number[]) {
  const areaInSqm = catchments
    .filter((catchment) => selectedCatchments.includes(Number(catchment.id)))
    .reduce((sum, catchment) => sum + (catchment.area || 0), 0);

  return areaInSqm / 1000000;
}

function clearUserDownstreamState() {
  useUserCategoryStore.getState().setTableData([]);
  useUserMapStore.getState().resetMapView();
  useUserMapStore.getState().syncLayersWithRiverSystem();
}

async function initializeUserRiverStore(set: UserRiverSet, get: UserRiverGet) {
  if (get().initialized || get().isLoading) {
    return;
  }

  set({ isLoading: true, error: null });
  try {
    const rivers = await fetchRivers();
    set({ initialized: true, rivers });
    useUserMapStore.getState().syncLayersWithRiverSystem();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch river data";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

async function handleUserRiverChange(
  set: UserRiverSet,
  get: UserRiverGet,
  riverCode: number,
) {
  const nextRiver = Number.isNaN(riverCode) ? null : riverCode;
  set({
    isLoading: true,
    error: null,
    selectedRiver: nextRiver,
    selectedStretches: [],
    selectedDrains: [],
    selectedCatchments: [],
    stretches: [],
    drains: [],
    catchments: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
    showCatchment: false,
    analysisCatchment: false,
  });

  try {
    if (nextRiver === null) {
      set({
        selectedRiverName: "",
        selectedStreachNames: [],
        selectedDrainsNames: [],
        selectedCatchmentsNames: [],
        totalArea: 0,
        totalCatchments: 0,
      });
      DRAIN_LAYER_NAMES.CATCHMENT = null;
      clearUserDownstreamState();
      return;
    }

    const stretches = await fetchStretches(nextRiver);

    set({
      stretches,
      selectedRiverName: mapSelectedRiverName(get().rivers, nextRiver),
      selectedStreachNames: [],
      selectedDrainsNames: [],
      selectedCatchmentsNames: [],
      totalArea: 0,
      totalCatchments: 0,
    });

    DRAIN_LAYER_NAMES.CATCHMENT = null;
    clearUserDownstreamState();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch stretches";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

async function setUserSelectedRiver(
  set: UserRiverSet,
  get: UserRiverGet,
  riverCode: number | null,
) {
  if (riverCode === null) {
    await handleUserRiverChange(set, get, Number.NaN);
    return;
  }

  await handleUserRiverChange(set, get, riverCode);
}

async function setUserSelectedStretches(
  set: UserRiverSet,
  get: UserRiverGet,
  stretchIds: number[],
) {
  set({
    isLoading: true,
    error: null,
    selectedStretches: stretchIds,
    selectedDrains: [],
    selectedCatchments: [],
    drains: [],
    catchments: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
    showCatchment: false,
    analysisCatchment: false,
  });

  try {
    const drains = await fetchDrains(stretchIds);
    set({
      drains,
      selectedStreachNames: mapSelectedStretchNames(get().stretches, stretchIds),
      selectedDrainsNames: [],
      selectedCatchmentsNames: [],
      totalArea: 0,
      totalCatchments: 0,
    });

    DRAIN_LAYER_NAMES.CATCHMENT = null;
    clearUserDownstreamState();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch drains";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

async function setUserSelectedDrains(
  set: UserRiverSet,
  get: UserRiverGet,
  drainIds: number[],
) {
  set({
    selectedDrains: drainIds,
    selectedCatchments: [],
    catchments: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
    showCatchment: false,
    analysisCatchment: false,
    selectedDrainsNames: mapSelectedDrainNames(get().drains, drainIds),
    selectedCatchmentsNames: [],
    totalArea: 0,
    totalCatchments: 0,
  });

  DRAIN_LAYER_NAMES.CATCHMENT = null;
  clearUserDownstreamState();
}

function setUserSelectedCatchments(
  set: UserRiverSet,
  get: UserRiverGet,
  catchmentIds: number[],
) {
  set({
    selectedCatchments: catchmentIds,
    selectedCatchmentsNames: mapSelectedCatchmentNames(get().catchments, catchmentIds),
    totalArea: calculateTotalArea(get().catchments, catchmentIds),
    totalCatchments: catchmentIds.length,
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
  });

  clearUserDownstreamState();
}

async function setUserShowCatchment(
  set: UserRiverSet,
  get: UserRiverGet,
  value: boolean,
) {
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
    const result = await fetchPriorityCatchments(selectedDrains);
    DRAIN_LAYER_NAMES.CATCHMENT = result.layer_name;
    const catchments = result.catchments.map((item) => ({
      id: item.id,
      village_name: item.village_name,
      area: item.area,
      name: item.name,
    }));
    const selectedCatchments = catchments.map((item) => item.id);
    set({
      catchments,
      selectedCatchments,
      selectedCatchmentsNames: mapSelectedCatchmentNames(catchments, selectedCatchments),
      totalArea: calculateTotalArea(catchments, selectedCatchments),
      totalCatchments: selectedCatchments.length,
    });
    useUserMapStore.getState().syncLayersWithRiverSystem();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch catchments";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

function setUserDisplayRaster(set: UserRiverSet, layers: ClipRasters[]) {
  set({ displayRaster: layers });
}

function setUserWellPoints(set: UserRiverSet, points: CsvRow[]) {
  set({ wellPoints: points });
}

async function setUserValidateTable(
  set: UserRiverSet,
  get: UserRiverGet,
  value: boolean,
) {
  set({ validateTable: value });
  if (!value) {
    return;
  }

  const { wellPoints, displayRaster, resultLayer } = get();
  const pumpingRaster = displayRaster.find((item) => item.file_name === "Pumping_location");

  if (!pumpingRaster || wellPoints.length === 0) {
    set({ validateTable: false });
    return;
  }

  set({ isLoading: true, error: null });

  try {
    const { table, wellPoints: normalizedWellPoints } = await runUserPumpingFindScore({
      location: wellPoints,
      raster_name: pumpingRaster.layer_name,
      village_layer: resultLayer,
    });

    const scoredCount = Math.min(table.length, normalizedWellPoints.length);

    if (scoredCount === 0) {
      useUserCategoryStore.getState().setTableData([]);
      set({ error: NO_PUMPING_SCORE_MESSAGE });
      return;
    }

    useUserCategoryStore.getState().setTableData(table);
    set({
      wellPoints: normalizedWellPoints,
      error: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate well points";
    set({ error: message });
    useUserCategoryStore.getState().setTableData([]);
  } finally {
    set({
      isLoading: false,
      validateTable: false,
    });
  }
}

async function confirmUserSelections(set: UserRiverSet, get: UserRiverGet) {
  const {
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    catchments,
    totalArea,
  } = get();

  if (selectedCatchments.length === 0) {
    return null;
  }

  set({ isLoading: true, error: null });

  try {
    const { rasterLayer, vectorLayer } = await fetchUserDisplayRaster(
      selectedCatchments,
      DRAIN_LAYER_NAMES.CATCHMENT,
    );

    if (vectorLayer) {
      DRAIN_LAYER_NAMES.CATCHMENT = vectorLayer;
    }

    set({
      selectionsLocked: true,
      displayRaster: rasterLayer,
      resultLayer: vectorLayer ?? DRAIN_LAYER_NAMES.CATCHMENT,
    });

    useUserMapStore.getState().syncLayersWithRiverSystem();

    return {
      rivers: selectedRiver
        ? get().rivers.filter((river) => Number(river.River_Code) === selectedRiver)
        : [],
      stretches: get().stretches.filter((stretch) =>
        selectedStretches.includes(Number(stretch.id)),
      ),
      drains: get().drains.filter((drain) =>
        selectedDrains.includes(Number(drain.id)),
      ),
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
}

function resetUserSelections(set: UserRiverSet, get: UserRiverGet) {
  set({
    selectedCatchments: [],
    catchments: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
    showCatchment: false,
    analysisCatchment: false,
    selectedCatchmentsNames: [],
    totalArea: 0,
    totalCatchments: 0,
  });

  useUserCategoryStore.getState().setTableData([]);
  useUserMapStore.getState().syncLayersWithRiverSystem();

  if (!get().initialized) {
    return;
  }
}

function resetUserRiverStore(set: UserRiverSet, get: UserRiverGet) {
  set({
    selectedRiver: null,
    selectedStretches: [],
    selectedDrains: [],
    selectedCatchments: [],
    stretches: [],
    drains: [],
    catchments: [],
    selectedRiverName: "",
    selectedStreachNames: [],
    selectedDrainsNames: [],
    selectedCatchmentsNames: [],
    totalArea: 0,
    totalCatchments: 0,
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
    showCatchment: false,
    analysisCatchment: false,
    wellPoints: [],
    validateTable: false,
    error: null,
  });

  DRAIN_LAYER_NAMES.CATCHMENT = null;
  useUserCategoryStore.getState().reset();
  useUserMapStore.getState().resetMapView();
  useUserMapStore.getState().syncLayersWithRiverSystem();

  if (!get().initialized) {
    return;
  }
}

export const useUserRiverStore = create<UserRiverStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  selectedRiver: null,
  selectedStretches: [],
  selectedDrains: [],
  selectedCatchments: [],
  selectedRiverName: "",
  selectedStreachNames: [],
  selectedDrainsNames: [],
  selectedCatchmentsNames: [],
  totalArea: 0,
  totalCatchments: 0,
  selectionsLocked: false,
  displayRaster: [],
  resultLayer: null,
  showCatchment: false,
  analysisCatchment: false,
  wellPoints: [],
  validateTable: false,

  initialize: () => initializeUserRiverStore(set, get),
  handleRiverChange: (riverCode) => handleUserRiverChange(set, get, riverCode),
  setSelectedRiver: (riverCode) => setUserSelectedRiver(set, get, riverCode),
  setSelectedStretches: (stretchIds) => setUserSelectedStretches(set, get, stretchIds),
  setSelectedDrains: (drainIds) => setUserSelectedDrains(set, get, drainIds),
  setSelectedCatchments: (catchmentIds) =>
    setUserSelectedCatchments(set, get, catchmentIds),
  setShowCatchment: (value) => setUserShowCatchment(set, get, value),
  setAnalysisCatchment: (value) => set({ analysisCatchment: value }),
  setDisplayRaster: (layers) => setUserDisplayRaster(set, layers),
  setWellPoints: (points) => setUserWellPoints(set, points),
  setValidateTable: (value) => setUserValidateTable(set, get, value),
  confirmSelections: () => confirmUserSelections(set, get),
  resetSelections: () => resetUserSelections(set, get),
  reset: () => resetUserRiverStore(set, get),
}));
