import { create } from "zustand";
import {
  ClipRasters,
  District,
  State,
  SubDistrict,
  villages,
} from "@/interface/raster_context";
import { CsvRow } from "@/interface/table";
import {
  fetchAdminDisplayRaster,
  fetchDistricts,
  fetchStates,
  fetchSubDistricts,
  fetchVillages,
  runAdminPumpingFindScore,
} from "../../services/gwmPumpingApi";
import { useAdminCategoryStore } from "./adminCategoryStore";
import { useAdminMapStore } from "./adminMapStore";

export interface AdminSelectionsData {
  villages: villages[];
}

interface AdminLocationStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;

  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  villages: villages[];

  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  selectedVillages: number[];

  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  resultLayer: string | null;

  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  selectedVillagesNames: string[];

  wellPoints: CsvRow[];
  validateTable: boolean;
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
  setWellPoints: (points: CsvRow[]) => void;
  setValidateTable: (value: boolean) => Promise<void>;
  reset: () => void;
}

export type AdminLocationStore = AdminLocationStoreState & AdminLocationStoreActions;

type AdminLocationSet = (
  partial:
    | Partial<AdminLocationStore>
    | ((state: AdminLocationStore) => Partial<AdminLocationStore>),
) => void;
type AdminLocationGet = () => AdminLocationStore;

function clearAdminDownstreamState() {
  useAdminCategoryStore.getState().setTableData([]);
  useAdminMapStore.getState().resetMapView();
  useAdminMapStore.getState().syncLayersWithLocation();
}

function mapStateName(states: State[], selectedState: number | null) {
  return states.find((item) => Number(item.id) === selectedState)?.name ?? "";
}

function mapDistrictNames(districts: District[], selectedDistricts: number[]) {
  return districts
    .filter((item) => selectedDistricts.includes(Number(item.id)))
    .map((item) => item.name);
}

function mapSubDistrictNames(subDistricts: SubDistrict[], selectedSubDistricts: number[]) {
  return subDistricts
    .filter((item) => selectedSubDistricts.includes(Number(item.id)))
    .map((item) => item.name);
}

function mapVillageNames(villageItems: villages[], selectedVillages: number[]) {
  return villageItems
    .filter((item) => selectedVillages.includes(Number(item.id)))
    .map((item) => item.name);
}

async function initializeAdminLocationStore(set: AdminLocationSet, get: AdminLocationGet) {
  if (get().initialized || get().isLoading) {
    return;
  }

  set({ isLoading: true, error: null });

  try {
    const states = await fetchStates();
    set({
      initialized: true,
      states,
      selectedStateName: mapStateName(states, get().selectedState),
    });
    useAdminMapStore.getState().syncLayersWithLocation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load states";
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

  set({
    isLoading: true,
    error: null,
    selectedState: nextSelectedState,
    selectedDistricts: [],
    selectedSubDistricts: [],
    selectedVillages: [],
    districts: [],
    subDistricts: [],
    villages: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
  });

  try {
    if (nextSelectedState === null) {
      set({
        selectedStateName: "",
        selectedDistrictsNames: [],
        selectedSubDistrictsNames: [],
        selectedVillagesNames: [],
      });
      clearAdminDownstreamState();
      return;
    }

    const districts = await fetchDistricts(nextSelectedState);

    set({
      districts,
      selectedStateName: mapStateName(get().states, nextSelectedState),
      selectedDistrictsNames: [],
      selectedSubDistrictsNames: [],
      selectedVillagesNames: [],
    });

    clearAdminDownstreamState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch districts";
    set({ error: message });
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
  set({
    isLoading: true,
    error: null,
    selectedDistricts: districtIds,
    selectedSubDistricts: [],
    selectedVillages: [],
    subDistricts: [],
    villages: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
  });

  try {
    const subDistricts = await fetchSubDistricts(districtIds);
    const selectedDistrictsNames = mapDistrictNames(get().districts, districtIds);

    set({
      subDistricts,
      selectedDistrictsNames,
      selectedSubDistrictsNames: [],
      selectedVillagesNames: [],
    });

    clearAdminDownstreamState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sub-districts";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

async function setAdminSelectedSubDistricts(
  set: AdminLocationSet,
  get: AdminLocationGet,
  subDistrictIds: number[],
) {
  set({
    isLoading: true,
    error: null,
    selectedSubDistricts: subDistrictIds,
    selectedVillages: [],
    villages: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
  });

  try {
    const villageItems = await fetchVillages(subDistrictIds);
    const selectedSubDistrictsNames = mapSubDistrictNames(get().subDistricts, subDistrictIds);

    set({
      villages: villageItems,
      selectedSubDistrictsNames,
      selectedVillagesNames: [],
    });

    clearAdminDownstreamState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch villages";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

function setAdminSelectedVillages(
  set: AdminLocationSet,
  get: AdminLocationGet,
  villageIds: number[],
) {
  set({
    selectedVillages: villageIds,
    selectedVillagesNames: mapVillageNames(get().villages, villageIds),
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
  });

  clearAdminDownstreamState();
}

async function confirmAdminSelections(set: AdminLocationSet, get: AdminLocationGet) {
  const { selectedVillages, villages: allVillages } = get();
  if (selectedVillages.length === 0) {
    return null;
  }

  set({ isLoading: true, error: null });

  try {
    const { rasterLayer, vectorLayer } = await fetchAdminDisplayRaster(selectedVillages);
    const selectedVillageObjects = allVillages.filter((item) =>
      selectedVillages.includes(Number(item.id)),
    );

    set({
      selectionsLocked: true,
      displayRaster: rasterLayer,
      resultLayer: vectorLayer,
    });

    useAdminMapStore.getState().syncLayersWithLocation();

    return {
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
    resultLayer: null,
  });

  clearAdminDownstreamState();
}

function setAdminDisplayRaster(set: AdminLocationSet, layers: ClipRasters[]) {
  set({ displayRaster: layers });
}

function setAdminWellPoints(set: AdminLocationSet, points: CsvRow[]) {
  set({ wellPoints: points });
}

async function setAdminValidateTable(
  set: AdminLocationSet,
  get: AdminLocationGet,
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
    const { table, wellPoints: normalizedWellPoints } = await runAdminPumpingFindScore({
      location: wellPoints,
      raster_name: pumpingRaster.layer_name,
      village_layer: resultLayer,
    });

    useAdminCategoryStore.getState().setTableData(table);
    set({ wellPoints: normalizedWellPoints });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate well points";
    set({ error: message });
    useAdminCategoryStore.getState().setTableData([]);
  } finally {
    set({
      isLoading: false,
      validateTable: false,
    });
  }
}

function resetAdminLocationStore(set: AdminLocationSet, get: AdminLocationGet) {
  set({
    selectedState: null,
    selectedDistricts: [],
    selectedSubDistricts: [],
    selectedVillages: [],
    districts: [],
    subDistricts: [],
    villages: [],
    selectionsLocked: false,
    displayRaster: [],
    resultLayer: null,
    selectedStateName: "",
    selectedDistrictsNames: [],
    selectedSubDistrictsNames: [],
    selectedVillagesNames: [],
    wellPoints: [],
    validateTable: false,
    error: null,
  });

  useAdminCategoryStore.getState().reset();
  useAdminMapStore.getState().resetMapView();
  useAdminMapStore.getState().syncLayersWithLocation();

  if (!get().initialized) {
    return;
  }
}

export const useAdminLocationStore = create<AdminLocationStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  states: [],
  districts: [],
  subDistricts: [],
  villages: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
  selectedVillages: [],
  selectionsLocked: false,
  displayRaster: [],
  resultLayer: null,
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  selectedVillagesNames: [],
  wellPoints: [],
  validateTable: false,

  initialize: () => initializeAdminLocationStore(set, get),
  handleStateChange: (stateId) => handleAdminStateChange(set, get, stateId),
  setSelectedState: (stateId) => setAdminSelectedState(set, get, stateId),
  setSelectedDistricts: (districtIds) => setAdminSelectedDistricts(set, get, districtIds),
  setSelectedSubDistricts: (subDistrictIds) =>
    setAdminSelectedSubDistricts(set, get, subDistrictIds),
  setSelectedVillages: (villageIds) => setAdminSelectedVillages(set, get, villageIds),
  confirmSelections: () => confirmAdminSelections(set, get),
  resetSelections: () => resetAdminSelections(set),
  setDisplayRaster: (layers) => setAdminDisplayRaster(set, layers),
  setWellPoints: (points) => setAdminWellPoints(set, points),
  setValidateTable: (value) => setAdminValidateTable(set, get, value),
  reset: () => resetAdminLocationStore(set, get),
}));
