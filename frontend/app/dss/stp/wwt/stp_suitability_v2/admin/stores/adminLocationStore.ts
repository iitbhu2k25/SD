import { create } from "zustand";
import type {
  ClipRasters,
  District,
  State,
  SubDistrict,
  Towns,
} from "../../services/stpSuitabilityTypes";
import {
  fetchAdminSuitabilityDisplayRaster,
  fetchAdminSuitabilityReferenceData,
} from "../../services/stpSuitabilityApi";

interface AdminLocationStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  allStates: State[];
  allDistricts: District[];
  allSubDistricts: SubDistrict[];
  allTowns: Towns[];
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  towns: Towns[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  selectedTowns: number[];
  selectedVillages: number[];
  totalPopulation: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  selectionVectorLayer: string | null;
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  selectedTownsNames: string[];
}

interface AdminLocationStoreActions {
  initialize: () => Promise<void>;
  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  setSelectedTowns: (townIds: number[]) => void;
  setSelectedVillages: (villageIds: number[]) => void;
  confirmSelections: () => Promise<void>;
  unlockSelections: () => void;
  resetSelections: () => void;
}

export type AdminLocationStore = AdminLocationStoreState & AdminLocationStoreActions;

type AdminLocationSet = (
  partial:
    | Partial<AdminLocationStore>
    | ((state: AdminLocationStore) => Partial<AdminLocationStore>),
) => void;
type AdminLocationGet = () => AdminLocationStore;

function deriveAdminLocationState(
  allStates: State[],
  allDistricts: District[],
  allSubDistricts: SubDistrict[],
  allTowns: Towns[],
  selectedState: number | null,
  selectedDistricts: number[],
  selectedSubDistricts: number[],
  selectedTowns: number[],
) {
  const districts = selectedState
    ? allDistricts.filter((district) => Number(district.stateId) === selectedState)
    : [];

  const subDistricts =
    selectedDistricts.length > 0
      ? allSubDistricts.filter((subDistrict) =>
          selectedDistricts.includes(Number(subDistrict.districtId)),
        )
      : [];

  const towns =
    selectedSubDistricts.length > 0
      ? allTowns.filter((town) =>
          selectedSubDistricts.includes(Number(town.subdistrict_code)),
        )
      : [];

  const selectedStateName =
    allStates.find((state) => Number(state.id) === selectedState)?.name ?? "";
  const selectedDistrictsNames = allDistricts
    .filter((district) => selectedDistricts.includes(Number(district.id)))
    .map((district) => district.name);
  const selectedSubDistrictsNames = allSubDistricts
    .filter((subDistrict) => selectedSubDistricts.includes(Number(subDistrict.id)))
    .map((subDistrict) => subDistrict.name);
  const selectedTownsNames = allTowns
    .filter((town) => selectedTowns.includes(Number(town.id)))
    .map((town) => town.name);
  const totalPopulation = allTowns
    .filter((town) => selectedTowns.includes(Number(town.id)))
    .reduce((sum, town) => sum + Number(town.population ?? 0), 0);

  return {
    districts,
    subDistricts,
    towns,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    selectedTownsNames,
    totalPopulation,
  };
}

async function initializeAdminLocationStore(set: AdminLocationSet, get: AdminLocationGet) {
  if (get().initialized) {
    return;
  }

  set({ isLoading: true, error: null });

  try {
    const { states, districts, subDistricts, towns } =
      await fetchAdminSuitabilityReferenceData();

    const derived = deriveAdminLocationState(
      states,
      districts,
      subDistricts,
      towns,
      null,
      [],
      [],
      [],
    );

    set({
      initialized: true,
      allStates: states,
      allDistricts: districts,
      allSubDistricts: subDistricts,
      allTowns: towns,
      states,
      ...derived,
    });
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : "Failed to initialize admin selections",
    });
  } finally {
    set({ isLoading: false });
  }
}

function handleAdminStateChange(set: AdminLocationSet, get: AdminLocationGet, stateId: number) {
  const { allStates, allDistricts, allSubDistricts, allTowns } = get();
  const nextStateId = Number.isNaN(stateId) ? null : stateId;
  const derived = deriveAdminLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    nextStateId,
    [],
    [],
    [],
  );

  set({
    selectedState: nextStateId,
    selectedDistricts: [],
    selectedSubDistricts: [],
    selectedTowns: [],
    selectedVillages: [],
    selectionsLocked: false,
    displayRaster: [],
    selectionVectorLayer: null,
    ...derived,
  });
}

function setAdminSelectedDistricts(
  set: AdminLocationSet,
  get: AdminLocationGet,
  districtIds: number[],
) {
  const {
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    selectedState,
    selectedSubDistricts,
    selectedTowns,
  } = get();

  const validSubDistricts = selectedSubDistricts.filter((subDistrictId) => {
    const subDistrict = allSubDistricts.find((item) => Number(item.id) === Number(subDistrictId));
    return subDistrict ? districtIds.includes(Number(subDistrict.districtId)) : false;
  });

  const validTowns = selectedTowns.filter((townId) => {
    const town = allTowns.find((item) => Number(item.id) === Number(townId));
    return town ? validSubDistricts.includes(Number(town.subdistrict_code)) : false;
  });

  const derived = deriveAdminLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    selectedState,
    districtIds,
    validSubDistricts,
    validTowns,
  );

  set({
    selectedDistricts: districtIds,
    selectedSubDistricts: validSubDistricts,
    selectedTowns: validTowns,
    selectedVillages: [],
    selectionsLocked: false,
    displayRaster: [],
    selectionVectorLayer: null,
    ...derived,
  });
}

function setAdminSelectedSubDistricts(
  set: AdminLocationSet,
  get: AdminLocationGet,
  subDistrictIds: number[],
) {
  const {
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    selectedState,
    selectedDistricts,
    selectedTowns,
  } = get();

  const validTowns = selectedTowns.filter((townId) => {
    const town = allTowns.find((item) => Number(item.id) === Number(townId));
    return town ? subDistrictIds.includes(Number(town.subdistrict_code)) : false;
  });

  const derived = deriveAdminLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    selectedState,
    selectedDistricts,
    subDistrictIds,
    validTowns,
  );

  set({
    selectedSubDistricts: subDistrictIds,
    selectedTowns: validTowns,
    selectedVillages: [],
    selectionsLocked: false,
    displayRaster: [],
    selectionVectorLayer: null,
    ...derived,
  });
}

function setAdminSelectedTowns(set: AdminLocationSet, get: AdminLocationGet, townIds: number[]) {
  const {
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
  } = get();
  const derived = deriveAdminLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    townIds,
  );

  set({
    selectedTowns: townIds,
    selectedVillages: [],
    selectionsLocked: false,
    displayRaster: [],
    selectionVectorLayer: null,
    ...derived,
  });
}

function setAdminSelectedVillages(set: AdminLocationSet, villageIds: number[]) {
  set({ selectedVillages: villageIds });
}

async function confirmAdminSelections(set: AdminLocationSet, get: AdminLocationGet) {
  const { selectedTowns } = get();
  if (selectedTowns.length === 0) {
    return;
  }

  set({ isLoading: true, error: null });
  try {
    const displayResult = await fetchAdminSuitabilityDisplayRaster(selectedTowns);
    set({
      selectionsLocked: true,
      displayRaster: displayResult.rasterLayers,
      selectionVectorLayer: displayResult.vectorLayer,
    });
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : "Failed to confirm admin selections",
    });
  } finally {
    set({ isLoading: false });
  }
}

function unlockAdminSelections(set: AdminLocationSet) {
  set({ selectionsLocked: false });
}

function resetAdminSelections(set: AdminLocationSet, get: AdminLocationGet) {
  const { allStates, allDistricts, allSubDistricts, allTowns } = get();
  const derived = deriveAdminLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allTowns,
    null,
    [],
    [],
    [],
  );

  set({
    selectedState: null,
    selectedDistricts: [],
    selectedSubDistricts: [],
    selectedTowns: [],
    selectedVillages: [],
    selectionsLocked: false,
    displayRaster: [],
    selectionVectorLayer: null,
    ...derived,
  });
}

export const useAdminLocationStore = create<AdminLocationStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  allStates: [],
  allDistricts: [],
  allSubDistricts: [],
  allTowns: [],
  states: [],
  districts: [],
  subDistricts: [],
  towns: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
  selectedTowns: [],
  selectedVillages: [],
  totalPopulation: 0,
  selectionsLocked: false,
  displayRaster: [],
  selectionVectorLayer: null,
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  selectedTownsNames: [],
  initialize: () => initializeAdminLocationStore(set, get),
  handleStateChange: (stateId) => handleAdminStateChange(set, get, stateId),
  setSelectedDistricts: (districtIds) => setAdminSelectedDistricts(set, get, districtIds),
  setSelectedSubDistricts: (subDistrictIds) =>
    setAdminSelectedSubDistricts(set, get, subDistrictIds),
  setSelectedTowns: (townIds) => setAdminSelectedTowns(set, get, townIds),
  setSelectedVillages: (villageIds) => setAdminSelectedVillages(set, villageIds),
  confirmSelections: () => confirmAdminSelections(set, get),
  unlockSelections: () => unlockAdminSelections(set),
  resetSelections: () => resetAdminSelections(set, get),
}));
