// This store keeps location data and the user's location choices.
// It loads states, districts, sub-districts, and raster data after confirm.
import { create } from "zustand";
import {
  ClipRasters,
  District,
  State,
  SubDistrict,
} from "@/interface/raster_context";
import {
  fetchAdminDisplayRaster,
  fetchAdminLocationReferenceData,
} from "../../services/stpPriorityApi";
import { useAdminMapStore } from "./adminMapStore";
import { useAdminCategoryStore } from "./adminCategoryStore";

export interface AdminSelectionsData {
  subDistricts: SubDistrict[];
  totalPopulation: number;
}

interface AdminLocationStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  allStates: State[];
  allDistricts: District[];
  allSubDistricts: SubDistrict[];
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  totalPopulation: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
}

interface AdminLocationStoreActions {
  initialize: () => Promise<void>;
  handleStateChange: (stateId: number) => void;
  setSelectedState: (stateId: number | null) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  confirmSelections: () => Promise<AdminSelectionsData | null>;
  resetSelections: () => void;
  setDisplayRaster: (layers: ClipRasters[]) => void;
  reset: () => void;
}

export type AdminLocationStore = AdminLocationStoreState & AdminLocationStoreActions;

type AdminLocationSet = (
  partial:
    | Partial<AdminLocationStore>
    | ((state: AdminLocationStore) => Partial<AdminLocationStore>),
) => void;
type AdminLocationGet = () => AdminLocationStore;

function deriveLocationState(
  allStates: State[],
  allDistricts: District[],
  allSubDistricts: SubDistrict[],
  selectedState: number | null,
  selectedDistricts: number[],
  selectedSubDistricts: number[],
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

  const selectedStateName =
    allStates.find((state) => Number(state.id) === selectedState)?.name ?? "";
  const selectedDistrictsNames = allDistricts
    .filter((district) => selectedDistricts.includes(Number(district.id)))
    .map((district) => district.name);
  const selectedSubDistrictsNames = allSubDistricts
    .filter((subDistrict) => selectedSubDistricts.includes(Number(subDistrict.id)))
    .map((subDistrict) => subDistrict.name);

  return {
    districts,
    subDistricts,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
  };
}

function clearAdminDownstreamState() {
  useAdminCategoryStore.getState().setTableData([]);
  useAdminMapStore.getState().resetMapView();
  useAdminMapStore.getState().syncLayersWithLocation();
}

async function initializeAdminLocationStore(
  set: AdminLocationSet,
  get: AdminLocationGet,
) {
  if (get().initialized) {
    return;
  }

  set({ isLoading: true, error: null });

  try {
    const { states, districts, subDistricts } =
      await fetchAdminLocationReferenceData();

    set({
      initialized: true,
      allStates: states,
      allDistricts: districts,
      allSubDistricts: subDistricts,
      states,
    });

    useAdminMapStore.getState().syncLayersWithLocation();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch location data";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

function handleAdminStateChange(
  set: AdminLocationSet,
  get: AdminLocationGet,
  stateId: number,
) {
  const nextSelectedState = Number.isNaN(stateId) ? null : stateId;
  const { allStates, allDistricts, allSubDistricts } = get();
  const derived = deriveLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    nextSelectedState,
    [],
    [],
  );

  set({
    selectedState: nextSelectedState,
    selectedDistricts: [],
    selectedSubDistricts: [],
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });

  clearAdminDownstreamState();
}

function setAdminSelectedState(
  _set: AdminLocationSet,
  get: AdminLocationGet,
  stateId: number | null,
) {
  if (stateId === null) {
    get().handleStateChange(Number.NaN);
    return;
  }

  get().handleStateChange(stateId);
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
    selectedState,
    selectedSubDistricts,
  } = get();

  const validSubDistricts = selectedSubDistricts.filter((subDistrictId) => {
    const subDistrict = allSubDistricts.find(
      (item) => Number(item.id) === Number(subDistrictId),
    );

    return subDistrict
      ? districtIds.includes(Number(subDistrict.districtId))
      : false;
  });

  const derived = deriveLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    selectedState,
    districtIds,
    validSubDistricts,
  );

  set({
    selectedDistricts: districtIds,
    selectedSubDistricts: validSubDistricts,
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });

  clearAdminDownstreamState();
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
    selectedState,
    selectedDistricts,
  } = get();

  const derived = deriveLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    selectedState,
    selectedDistricts,
    subDistrictIds,
  );

  set({
    selectedSubDistricts: subDistrictIds,
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });

  clearAdminDownstreamState();
}

async function confirmAdminSelections(
  set: AdminLocationSet,
  get: AdminLocationGet,
) {
  const { allSubDistricts, selectedSubDistricts, totalPopulation } = get();
  if (selectedSubDistricts.length === 0) {
    return null;
  }

  set({ isLoading: true, error: null });

  try {
    const displayRaster = await fetchAdminDisplayRaster(selectedSubDistricts);
    const selectedSubDistrictObjects = allSubDistricts.filter((subDistrict) =>
      selectedSubDistricts.includes(Number(subDistrict.id)),
    );

    set({
      selectionsLocked: true,
      displayRaster,
    });

    useAdminMapStore.getState().syncLayersWithLocation();

    return {
      subDistricts: selectedSubDistrictObjects,
      totalPopulation,
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

function resetAdminSelections(set: AdminLocationSet) {
  set({
    selectionsLocked: false,
    totalPopulation: 0,
    displayRaster: [],
  });

  clearAdminDownstreamState();
}

function setAdminDisplayRaster(set: AdminLocationSet, layers: ClipRasters[]) {
  set({ displayRaster: layers });
}

function resetAdminLocationStore(set: AdminLocationSet, get: AdminLocationGet) {
  const { allStates, allDistricts, allSubDistricts } = get();
  const derived = deriveLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    null,
    [],
    [],
  );

  set({
    selectedState: null,
    selectedDistricts: [],
    selectedSubDistricts: [],
    totalPopulation: 0,
    selectionsLocked: false,
    displayRaster: [],
    ...derived,
  });

  useAdminCategoryStore.getState().reset();
  useAdminMapStore.getState().resetMapView();
  useAdminMapStore.getState().syncLayersWithLocation();
}

export const useAdminLocationStore = create<AdminLocationStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  allStates: [],
  allDistricts: [],
  allSubDistricts: [],
  states: [],
  districts: [],
  subDistricts: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
  totalPopulation: 0,
  selectionsLocked: false,
  displayRaster: [],
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  initialize: () => initializeAdminLocationStore(set, get),
  handleStateChange: (stateId) => handleAdminStateChange(set, get, stateId),
  setSelectedState: (stateId) => setAdminSelectedState(set, get, stateId),
  setSelectedDistricts: (districtIds) =>
    setAdminSelectedDistricts(set, get, districtIds),
  setSelectedSubDistricts: (subDistrictIds) =>
    setAdminSelectedSubDistricts(set, get, subDistrictIds),
  confirmSelections: () => confirmAdminSelections(set, get),
  resetSelections: () => resetAdminSelections(set),
  setDisplayRaster: (layers) => setAdminDisplayRaster(set, layers),
  reset: () => resetAdminLocationStore(set, get),
}));
