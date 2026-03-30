import { create } from "zustand";
import type {
  Catchment,
  ClipRasters,
  Drain,
  River,
  Stretch,
} from "../../services/stpSuitabilityTypes";
import {
  fetchSuitabilityCatchments,
  fetchUserSuitabilityDisplayRaster,
  fetchUserSuitabilityReferenceData,
} from "../../services/stpSuitabilityApi";

interface UserRiverStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  rivers: River[];
  allStretches: Stretch[];
  allDrains: Drain[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  selectedRiver: number | null;
  selectedStretches: number[];
  selectedDrains: number[];
  selectedCatchments: number[];
  selectedRiverName: string;
  selectedStretchNames: number[];
  selectedDrainsNames: number[];
  selectedCatchmentsNames: string[];
  totalArea: number;
  totalCatchments: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  showCatchment: boolean;
  catchmentLayerName: string | null;
}

interface UserRiverStoreActions {
  initialize: () => Promise<void>;
  handleRiverChange: (riverCode: number) => void;
  setSelectedStretches: (stretchIds: number[]) => void;
  setSelectedDrains: (drainIds: number[]) => void;
  setSelectedCatchments: (catchmentIds: number[]) => void;
  setShowCatchment: (show: boolean) => Promise<void>;
  confirmSelections: () => Promise<void>;
  unlockSelections: () => void;
  resetSelections: () => void;
}

export type UserRiverStore = UserRiverStoreState & UserRiverStoreActions;

type UserRiverSet = (
  partial:
    | Partial<UserRiverStore>
    | ((state: UserRiverStore) => Partial<UserRiverStore>),
) => void;
type UserRiverGet = () => UserRiverStore;

function deriveUserRiverState(
  rivers: River[],
  allStretches: Stretch[],
  allDrains: Drain[],
  catchments: Catchment[],
  selectedRiver: number | null,
  selectedStretches: number[],
  selectedDrains: number[],
  selectedCatchments: number[],
) {
  const stretches = selectedRiver
    ? allStretches.filter((stretch) => stretch.river_code === selectedRiver)
    : [];

  const drains =
    selectedStretches.length > 0
      ? allDrains.filter((drain) => selectedStretches.includes(Number(drain.stretch_id)))
      : [];

  const selectedRiverName =
    rivers.find((river) => river.River_Code === selectedRiver)?.River_Name ?? "";
  const selectedStretchNames = allStretches
    .filter((stretch) => selectedStretches.includes(Number(stretch.id)))
    .map((stretch) => stretch.id);
  const selectedDrainsNames = allDrains
    .filter((drain) => selectedDrains.includes(Number(drain.id)))
    .map((drain) => drain.id);
  const selectedCatchmentsNames = catchments
    .filter((catchment) => selectedCatchments.includes(Number(catchment.id)))
    .map((catchment) => catchment.village_name);
  const totalArea =
    catchments
      .filter((catchment) => selectedCatchments.includes(Number(catchment.id)))
      .reduce((sum, catchment) => sum + Number(catchment.area ?? 0), 0) / 1000000;

  return {
    stretches,
    drains,
    selectedRiverName,
    selectedStretchNames,
    selectedDrainsNames,
    selectedCatchmentsNames,
    totalArea,
    totalCatchments: selectedCatchments.length,
  };
}

async function initializeUserRiverStore(set: UserRiverSet, get: UserRiverGet) {
  if (get().initialized) {
    return;
  }

  set({ isLoading: true, error: null });
  try {
    const { rivers, stretches, drains } = await fetchUserSuitabilityReferenceData();
    const derived = deriveUserRiverState(rivers, stretches, drains, [], null, [], [], []);
    set({
      initialized: true,
      rivers,
      allStretches: stretches,
      allDrains: drains,
      ...derived,
    });
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : "Failed to initialize river-system data",
    });
  } finally {
    set({ isLoading: false });
  }
}

function handleUserRiverChange(set: UserRiverSet, get: UserRiverGet, riverCode: number) {
  const { rivers, allStretches, allDrains } = get();
  const nextRiverCode = Number.isNaN(riverCode) ? null : riverCode;
  const derived = deriveUserRiverState(
    rivers,
    allStretches,
    allDrains,
    [],
    nextRiverCode,
    [],
    [],
    [],
  );

  set({
    selectedRiver: nextRiverCode,
    selectedStretches: [],
    selectedDrains: [],
    selectedCatchments: [],
    catchments: [],
    catchmentLayerName: null,
    showCatchment: false,
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });
}

function setUserSelectedStretches(set: UserRiverSet, get: UserRiverGet, stretchIds: number[]) {
  const { rivers, allStretches, allDrains, selectedRiver } = get();
  const validDrains = get().selectedDrains.filter((drainId) => {
    const drain = allDrains.find((item) => Number(item.id) === Number(drainId));
    return drain ? stretchIds.includes(Number(drain.stretch_id)) : false;
  });
  const derived = deriveUserRiverState(
    rivers,
    allStretches,
    allDrains,
    [],
    selectedRiver,
    stretchIds,
    validDrains,
    [],
  );

  set({
    selectedStretches: stretchIds,
    selectedDrains: validDrains,
    selectedCatchments: [],
    catchments: [],
    catchmentLayerName: null,
    showCatchment: false,
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });
}

function setUserSelectedDrains(set: UserRiverSet, get: UserRiverGet, drainIds: number[]) {
  const { rivers, allStretches, allDrains, selectedRiver, selectedStretches } = get();
  const derived = deriveUserRiverState(
    rivers,
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
    catchmentLayerName: null,
    showCatchment: false,
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });
}

function setUserSelectedCatchments(
  set: UserRiverSet,
  get: UserRiverGet,
  catchmentIds: number[],
) {
  const { rivers, allStretches, allDrains, catchments, selectedRiver, selectedStretches, selectedDrains } =
    get();
  const derived = deriveUserRiverState(
    rivers,
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
}

async function setUserShowCatchment(set: UserRiverSet, get: UserRiverGet, show: boolean) {
  set({ showCatchment: show });
  if (!show) {
    set({
      catchments: [],
      selectedCatchments: [],
      catchmentLayerName: null,
    });
    return;
  }

  const { selectedDrains, rivers, allStretches, allDrains, selectedRiver, selectedStretches } =
    get();
  if (selectedDrains.length === 0) {
    return;
  }

  set({ isLoading: true, error: null });
  try {
    const response = await fetchSuitabilityCatchments(selectedDrains);
    const selectedCatchments = (response.catchments ?? []).map((catchment) => catchment.id);
    const derived = deriveUserRiverState(
      rivers,
      allStretches,
      allDrains,
      response.catchments ?? [],
      selectedRiver,
      selectedStretches,
      selectedDrains,
      selectedCatchments,
    );

    set({
      catchments: response.catchments ?? [],
      selectedCatchments,
      catchmentLayerName: response.layer_name,
      ...derived,
    });
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : "Failed to fetch catchments",
      showCatchment: false,
    });
  } finally {
    set({ isLoading: false });
  }
}

async function confirmUserSelections(set: UserRiverSet, get: UserRiverGet) {
  const { selectedCatchments } = get();
  if (selectedCatchments.length === 0) {
    return;
  }

  set({ isLoading: true, error: null });
  try {
    const displayRaster = await fetchUserSuitabilityDisplayRaster(selectedCatchments);
    set({
      selectionsLocked: true,
      displayRaster,
    });
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : "Failed to confirm river-system selections",
    });
  } finally {
    set({ isLoading: false });
  }
}

function unlockUserSelections(set: UserRiverSet) {
  set({ selectionsLocked: false });
}

function resetUserSelections(set: UserRiverSet, get: UserRiverGet) {
  const { rivers, allStretches, allDrains } = get();
  const derived = deriveUserRiverState(rivers, allStretches, allDrains, [], null, [], [], []);
  set({
    selectedRiver: null,
    selectedStretches: [],
    selectedDrains: [],
    selectedCatchments: [],
    catchments: [],
    catchmentLayerName: null,
    selectionsLocked: false,
    displayRaster: [],
    showCatchment: false,
    ...derived,
  });
}

export const useUserRiverStore = create<UserRiverStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  rivers: [],
  allStretches: [],
  allDrains: [],
  stretches: [],
  drains: [],
  catchments: [],
  selectedRiver: null,
  selectedStretches: [],
  selectedDrains: [],
  selectedCatchments: [],
  selectedRiverName: "",
  selectedStretchNames: [],
  selectedDrainsNames: [],
  selectedCatchmentsNames: [],
  totalArea: 0,
  totalCatchments: 0,
  selectionsLocked: false,
  displayRaster: [],
  showCatchment: false,
  catchmentLayerName: null,
  initialize: () => initializeUserRiverStore(set, get),
  handleRiverChange: (riverCode) => handleUserRiverChange(set, get, riverCode),
  setSelectedStretches: (stretchIds) => setUserSelectedStretches(set, get, stretchIds),
  setSelectedDrains: (drainIds) => setUserSelectedDrains(set, get, drainIds),
  setSelectedCatchments: (catchmentIds) => setUserSelectedCatchments(set, get, catchmentIds),
  setShowCatchment: (show) => setUserShowCatchment(set, get, show),
  confirmSelections: () => confirmUserSelections(set, get),
  unlockSelections: () => unlockUserSelections(set),
  resetSelections: () => resetUserSelections(set, get),
}));
