import { create } from "zustand";

import type { GwaModuleKey } from "../types/common.types";
import type {
  AdminSelection,
  ConfirmedLocation,
  DistrictOption,
  DrainItem,
  DrainRiver,
  DrainSelection,
  DrainStretch,
  DrainVillage,
  GwaMode,
  StateOption,
  SubDistrictOption,
} from "../types/location.types";
import type {
  DemandModuleState,
  ForecastModuleState,
  GsrModuleState,
  IndustrialSubtype,
  RechargeModuleState,
  TableRow,
  TrendModuleState,
  WellsModuleState,
  WellSelectionMode,
} from "../types/module.types";
import { INITIAL_INDUSTRIAL_DATA } from "../utils/constants";
import { formatAdminLabel, formatDrainLabel } from "../utils/helpers";

const defaultAdminSelection: AdminSelection = {
  state: null,
  districts: [],
  subDistricts: [],
};

const defaultDrainSelection: DrainSelection = {
  river: null,
  stretch: null,
  drains: [],
  villages: [],
  selectedVillageIds: [],
};

const createDefaultWellsState = (): WellsModuleState => ({
  selectionMode: null,
  data: [],
  loading: false,
  error: null,
  isSaved: false,
  isUploading: false,
  uploadMessage: null,
  uploadSuccess: false,
  csvFilename: null,
  customColumns: [],
  newColumnName: "",
});

const createDefaultTrendState = (): TrendModuleState => ({
  yearStart: "",
  yearEnd: "",
  data: null,
  loading: false,
  error: null,
});

const createDefaultRechargeState = (): RechargeModuleState => ({
  data: [],
  loading: false,
  error: null,
});

const cloneIndustrialData = (): IndustrialSubtype[] => INITIAL_INDUSTRIAL_DATA.map((item) => ({ ...item }));

const createDefaultDemandState = (): DemandModuleState => ({
  domesticChecked: false,
  agriculturalChecked: false,
  industrialChecked: false,
  perCapitaConsumption: 60,
  kharifChecked: false,
  rabiChecked: false,
  zaidChecked: false,
  availableCrops: {},
  selectedCrops: {},
  cropsLoading: {},
  cropsError: {},
  groundwaterFactor: 0.8,
  industrialData: cloneIndustrialData(),
  industrialGWShare: 0.5,
  domesticData: [],
  agriculturalData: [],
  industrialResultData: [],
  combinedData: [],
  chartData: null,
  chartsError: null,
  domesticLoading: false,
  agriculturalLoading: false,
  industrialLoading: false,
  domesticError: null,
  agriculturalError: null,
  industrialError: null,
});

const createDefaultGsrState = (): GsrModuleState => ({
  data: [],
  loading: false,
  error: null,
  stressYears: "",
  stressData: [],
  stressLoading: false,
  stressError: null,
});

const createDefaultForecastState = (): ForecastModuleState => ({
  method: "linear_regression",
  forecastType: "yearly",
  rangeStart: "",
  rangeEnd: "",
  data: null,
  loading: false,
  error: null,
});

interface GwaStore {
  mode: GwaMode;
  confirmedLocation: ConfirmedLocation | null;
  activeModule: GwaModuleKey;
  adminSelection: AdminSelection;
  drainSelection: DrainSelection;
  wells: WellsModuleState;
  trend: TrendModuleState;
  recharge: RechargeModuleState;
  demand: DemandModuleState;
  gsr: GsrModuleState;
  forecast: ForecastModuleState;
  setMode: (mode: GwaMode) => void;
  setActiveModule: (module: GwaModuleKey) => void;
  setAdminState: (state: StateOption | null) => void;
  setAdminDistricts: (districts: DistrictOption[]) => void;
  setAdminSubDistricts: (subDistricts: SubDistrictOption[]) => void;
  resetAdminSelection: () => void;
  confirmAdminLocation: () => void;
  setDrainRiver: (river: DrainRiver | null) => void;
  setDrainStretch: (stretch: DrainStretch | null) => void;
  setDrainItems: (drains: DrainItem[]) => void;
  setDrainVillages: (villages: DrainVillage[]) => void;
  setDrainSelectedVillageIds: (selectedVillageIds: string[]) => void;
  resetDrainSelection: () => void;
  confirmDrainLocation: () => void;
  clearConfirmedLocation: () => void;
  resetWorkflow: () => void;
  setWellsState: (partial: Partial<WellsModuleState>) => void;
  setWellSelectionMode: (mode: WellSelectionMode) => void;
  setWellsData: (data: TableRow[]) => void;
  updateWellCell: (rowIndex: number, column: string, value: string) => void;
  addWellRow: () => void;
  removeWellRow: (rowIndex: number) => void;
  addWellColumn: () => void;
  removeWellColumn: (column: string) => void;
  setTrendState: (partial: Partial<TrendModuleState>) => void;
  setRechargeState: (partial: Partial<RechargeModuleState>) => void;
  setDemandState: (partial: Partial<DemandModuleState>) => void;
  setGsrState: (partial: Partial<GsrModuleState>) => void;
  setForecastState: (partial: Partial<ForecastModuleState>) => void;
}

function resetModules() {
  return {
    wells: createDefaultWellsState(),
    trend: createDefaultTrendState(),
    recharge: createDefaultRechargeState(),
    demand: createDefaultDemandState(),
    gsr: createDefaultGsrState(),
    forecast: createDefaultForecastState(),
  };
}

export const useGwaStore = create<GwaStore>((set, get) => ({
  mode: "admin",
  confirmedLocation: null,
  activeModule: "overview",
  adminSelection: defaultAdminSelection,
  drainSelection: defaultDrainSelection,
  ...resetModules(),

  setMode: (mode) =>
    set({
      mode,
      confirmedLocation: null,
      activeModule: "overview",
      adminSelection: defaultAdminSelection,
      drainSelection: defaultDrainSelection,
      ...resetModules(),
    }),
  setActiveModule: (activeModule) => set({ activeModule }),

  setAdminState: (state) => set({ adminSelection: { state, districts: [], subDistricts: [] } }),
  setAdminDistricts: (districts) =>
    set((store) => ({
      adminSelection: { ...store.adminSelection, districts, subDistricts: [] },
    })),
  setAdminSubDistricts: (subDistricts) =>
    set((store) => ({
      adminSelection: { ...store.adminSelection, subDistricts },
    })),
  resetAdminSelection: () => set({ adminSelection: defaultAdminSelection }),
  confirmAdminLocation: () => {
    const { adminSelection } = get();
    if (!adminSelection.state || adminSelection.subDistricts.length === 0) return;
    set({
      confirmedLocation: {
        mode: "admin",
        admin: adminSelection,
        label: formatAdminLabel(adminSelection),
      },
      activeModule: "overview",
      ...resetModules(),
    });
  },

  setDrainRiver: (river) =>
    set({
      drainSelection: { river, stretch: null, drains: [], villages: [], selectedVillageIds: [] },
    }),
  setDrainStretch: (stretch) =>
    set((store) => ({
      drainSelection: { ...store.drainSelection, stretch, drains: [], villages: [], selectedVillageIds: [] },
    })),
  setDrainItems: (drains) =>
    set((store) => ({
      drainSelection: { ...store.drainSelection, drains, villages: [], selectedVillageIds: [] },
    })),
  setDrainVillages: (villages) =>
    set((store) => ({
      drainSelection: {
        ...store.drainSelection,
        villages,
        selectedVillageIds: villages.map((village) => village.shapeID),
      },
    })),
  setDrainSelectedVillageIds: (selectedVillageIds) =>
    set((store) => ({
      drainSelection: { ...store.drainSelection, selectedVillageIds },
    })),
  resetDrainSelection: () => set({ drainSelection: defaultDrainSelection }),
  confirmDrainLocation: () => {
    const { drainSelection } = get();
    if (!drainSelection.river || !drainSelection.stretch || drainSelection.selectedVillageIds.length === 0) return;
    const villages = drainSelection.villages.filter((village) =>
      drainSelection.selectedVillageIds.includes(village.shapeID),
    );
    const finalSelection: DrainSelection = {
      ...drainSelection,
      villages,
      selectedVillageIds: villages.map((village) => village.shapeID),
    };
    set({
      confirmedLocation: {
        mode: "drain",
        drain: finalSelection,
        label: formatDrainLabel(finalSelection),
      },
      activeModule: "overview",
      ...resetModules(),
    });
  },

  clearConfirmedLocation: () =>
    set({
      confirmedLocation: null,
      activeModule: "overview",
      ...resetModules(),
    }),

  resetWorkflow: () => set(resetModules()),

  setWellsState: (partial) => set((store) => ({ wells: { ...store.wells, ...partial } })),
  setWellSelectionMode: (mode) =>
    set((store) => ({
      wells: {
        ...createDefaultWellsState(),
        selectionMode: mode,
        customColumns: store.wells.customColumns,
      },
    })),
  setWellsData: (data) =>
    set((store) => ({
      wells: {
        ...store.wells,
        data,
      },
    })),
  updateWellCell: (rowIndex, column, value) =>
    set((store) => {
      const data = [...store.wells.data];
      data[rowIndex] = { ...data[rowIndex], [column]: value };
      return { wells: { ...store.wells, data } };
    }),
  addWellRow: () =>
    set((store) => ({
      wells: {
        ...store.wells,
        data: [...store.wells.data, {}],
      },
    })),
  removeWellRow: (rowIndex) =>
    set((store) => ({
      wells: {
        ...store.wells,
        data: store.wells.data.filter((_, index) => index !== rowIndex),
      },
    })),
  addWellColumn: () =>
    set((store) => {
      const columnName = store.wells.newColumnName.trim();
      if (!columnName || store.wells.customColumns.includes(columnName)) return store;

      return {
        wells: {
          ...store.wells,
          customColumns: [...store.wells.customColumns, columnName],
          newColumnName: "",
          data: store.wells.data.map((row) => ({ ...row, [columnName]: row[columnName] ?? "" })),
        },
      };
    }),
  removeWellColumn: (column) =>
    set((store) => ({
      wells: {
        ...store.wells,
        customColumns: store.wells.customColumns.filter((item) => item !== column),
        data: store.wells.data.map((row) => {
          const next = { ...row };
          delete next[column];
          return next;
        }),
      },
    })),

  setTrendState: (partial) => set((store) => ({ trend: { ...store.trend, ...partial } })),
  setRechargeState: (partial) => set((store) => ({ recharge: { ...store.recharge, ...partial } })),
  setDemandState: (partial) => set((store) => ({ demand: { ...store.demand, ...partial } })),
  setGsrState: (partial) => set((store) => ({ gsr: { ...store.gsr, ...partial } })),
  setForecastState: (partial) => set((store) => ({ forecast: { ...store.forecast, ...partial } })),
}));
