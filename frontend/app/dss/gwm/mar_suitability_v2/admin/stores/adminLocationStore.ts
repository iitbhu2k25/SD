import { create } from "zustand";
import {
  ClipRasters,
  District,
  State,
  SubDistrict,
  villages,
} from "@/interface/raster_context";
import {
  fetchAdminDisplayRaster,
  fetchAdminLocationReferenceData,
  fetchDistrictsByState,
  fetchSubDistrictsByDistrict,
  fetchVillagesBySubDistrict,
} from "../../services/marSuitabilityApi";
import { useAdminMapStore } from "./adminMapStore";
import { useAdminCategoryStore } from "./adminCategoryStore";

export interface AdminSelectionsData {
  subDistricts: SubDistrict[];
  villages: villages[];
}

interface AdminLocationStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  allStates: State[];
  allDistricts: District[];
  allSubDistricts: SubDistrict[];
  allVillages: villages[];
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  villagesList: villages[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  selectedVillages: number[];
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  villageLayer: string | null;
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  selectedVillagesNames: string[];
}

interface AdminLocationStoreActions {
  initialize: () => Promise<void>;
  handleStateChange: (stateId: number) => Promise<void>;
  setSelectedState: (stateId: number | null) => Promise<void>;
  setSelectedDistricts: (districtIds: number[]) => Promise<void>;
  setSelectedSubDistricts: (subDistrictIds: number[]) => Promise<void>;
  setSelectedVillages: (villageIds: number[]) => void;
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
  allVillages: villages[],
  selectedState: number | null,
  selectedDistricts: number[],
  selectedSubDistricts: number[],
  selectedVillages: number[],
) {
  const districts = allDistricts;
  const subDistricts = allSubDistricts;
  const villagesList = allVillages;

  const selectedStateName =
    allStates.find((state) => Number(state.id) === selectedState)?.name ?? "";
  const selectedDistrictsNames = allDistricts
    .filter((district) => selectedDistricts.includes(Number(district.id)))
    .map((district) => district.name);
  const selectedSubDistrictsNames = allSubDistricts
    .filter((subDistrict) => selectedSubDistricts.includes(Number(subDistrict.id)))
    .map((subDistrict) => subDistrict.name);
  const selectedVillagesNames = allVillages
    .filter((village) => selectedVillages.includes(Number(village.id)))
    .map((village) => village.name);

  return {
    districts,
    subDistricts,
    villagesList,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    selectedVillagesNames,
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
    const { states } = await fetchAdminLocationReferenceData();

    set({
      initialized: true,
      allStates: states,
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

async function handleAdminStateChange(
  set: AdminLocationSet,
  get: AdminLocationGet,
  stateId: number,
) {
  const nextSelectedState = Number.isNaN(stateId) ? null : stateId;
  
  if (!nextSelectedState) {
    set({
      selectedState: null,
      selectedDistricts: [],
      selectedSubDistricts: [],
      selectedVillages: [],
      allDistricts: [],
      allSubDistricts: [],
      allVillages: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
    });
    clearAdminDownstreamState();
    return;
  }

  set({ isLoading: true });
  try {
    const fetchedDistricts = await fetchDistrictsByState(nextSelectedState);
    const { allStates } = get();
    
    const derived = deriveLocationState(
      allStates,
      fetchedDistricts,
      [],
      [],
      nextSelectedState,
      [],
      [],
      [],
    );

    set({
      selectedState: nextSelectedState,
      allDistricts: fetchedDistricts,
      allSubDistricts: [],
      allVillages: [],
      selectedDistricts: [],
      selectedSubDistricts: [],
      selectedVillages: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
      ...derived,
    });

    clearAdminDownstreamState();
  } catch (error) {
    console.error(error);
  } finally {
    set({ isLoading: false });
  }
}

async function setAdminSelectedState(
  set: AdminLocationSet,
  get: AdminLocationGet,
  stateId: number | null,
) {
  if (stateId === null) {
    await handleAdminStateChange(set, get, Number.NaN);
    return;
  }
  await handleAdminStateChange(set, get, stateId);
}

async function setAdminSelectedDistricts(
  set: AdminLocationSet,
  get: AdminLocationGet,
  districtIds: number[],
) {
  set({ isLoading: true });
  try {
    const newSubDistricts = await Promise.all(
      districtIds.map((id) => fetchSubDistrictsByDistrict(id))
    );
    const allFetchedSubDistricts = newSubDistricts.flat();

    const { allStates, allDistricts, selectedState } = get();

    const derived = deriveLocationState(
      allStates,
      allDistricts,
      allFetchedSubDistricts,
      [],
      selectedState,
      districtIds,
      [],
      [],
    );

    set({
      allSubDistricts: allFetchedSubDistricts,
      allVillages: [],
      selectedDistricts: districtIds,
      selectedSubDistricts: [],
      selectedVillages: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
      ...derived,
    });

    clearAdminDownstreamState();
  } catch(error) {
    console.error(error);
  } finally {
    set({ isLoading: false });
  }
}

async function setAdminSelectedSubDistricts(
  set: AdminLocationSet,
  get: AdminLocationGet,
  subDistrictIds: number[],
) {
  set({ isLoading: true });
  try {
    const newVillages = await Promise.all(
      subDistrictIds.map((id) => fetchVillagesBySubDistrict(id))
    );
    const allFetchedVillages = newVillages.flat();

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
      allFetchedVillages,
      selectedState,
      selectedDistricts,
      subDistrictIds,
      [],
    );

    set({
      allVillages: allFetchedVillages,
      selectedSubDistricts: subDistrictIds,
      selectedVillages: [],
      selectionsLocked: false,
      displayRaster: [],
      villageLayer: null,
      ...derived,
    });

    clearAdminDownstreamState();
  } catch(error) {
    console.error(error);
  } finally {
    set({ isLoading: false });
  }
}

function setAdminSelectedVillages(
  set: AdminLocationSet,
  get: AdminLocationGet,
  villageIds: number[],
) {
  const {
    allStates,
    allDistricts,
    allSubDistricts,
    allVillages,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
  } = get();

  const derived = deriveLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allVillages,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    villageIds,
  );

  set({
    selectedVillages: villageIds,
    selectionsLocked: false,
    displayRaster: [],
    villageLayer: null,
    ...derived,
  });

  clearAdminDownstreamState();
}


async function confirmAdminSelections(
  set: AdminLocationSet,
  get: AdminLocationGet,
) {
  const { allSubDistricts, allVillages, selectedSubDistricts, selectedVillages } = get();
  
  // Strict old-module parity: confirmation requires explicit village selection.
  if (selectedVillages.length === 0) {
    return null;
  }

  set({ isLoading: true, error: null });

  try {
    const displayRasterResponse = await fetchAdminDisplayRaster(selectedVillages);
    const selectedSubDistrictObjects = allSubDistricts.filter((subDistrict) =>
      selectedSubDistricts.includes(Number(subDistrict.id)),
    );
    const selectedVillageObjects = allVillages.filter((v) => 
      selectedVillages.includes(Number(v.id))
    );

    set({
      selectionsLocked: true,
      displayRaster: displayRasterResponse.raster_layer ?? [],
      villageLayer: displayRasterResponse.vector_layer || null,
    });

    useAdminMapStore.getState().syncLayersWithLocation();

    return {
      subDistricts: selectedSubDistrictObjects,
      villages: selectedVillageObjects,
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
    displayRaster: [],
    villageLayer: null,
  });
  clearAdminDownstreamState();
}

function setAdminDisplayRaster(set: AdminLocationSet, layers: ClipRasters[]) {
  set({ displayRaster: layers });
}

function resetAdminLocationStore(set: AdminLocationSet, get: AdminLocationGet) {
  const { allStates, allDistricts, allSubDistricts, allVillages } = get();
  const derived = deriveLocationState(
    allStates,
    allDistricts,
    allSubDistricts,
    allVillages,
    null,
    [],
    [],
    [],
  );

  set({
    selectedState: null,
    selectedDistricts: [],
    selectedSubDistricts: [],
    selectedVillages: [],
    selectionsLocked: false,
    displayRaster: [],
    villageLayer: null,
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
  allVillages: [],
  states: [],
  districts: [],
  subDistricts: [],
  villagesList: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
  selectedVillages: [],
  selectionsLocked: false,
  displayRaster: [],
  villageLayer: null,
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  selectedVillagesNames: [],
  initialize: () => initializeAdminLocationStore(set, get),
  handleStateChange: (stateId) => handleAdminStateChange(set, get, stateId),
  setSelectedState: (stateId) => setAdminSelectedState(set, get, stateId),
  setSelectedDistricts: (districtIds) => setAdminSelectedDistricts(set, get, districtIds),
  setSelectedSubDistricts: (subDistrictIds) => setAdminSelectedSubDistricts(set, get, subDistrictIds),
  setSelectedVillages: (villageIds) => setAdminSelectedVillages(set, get, villageIds),
  confirmSelections: () => confirmAdminSelections(set, get),
  resetSelections: () => resetAdminSelections(set),
  setDisplayRaster: (layers) => setAdminDisplayRaster(set, layers),
  reset: () => resetAdminLocationStore(set, get),
}));
