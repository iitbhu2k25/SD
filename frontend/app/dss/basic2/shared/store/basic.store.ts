import { create } from 'zustand';
import type {
  LocationMode, ConfirmedLocation,
  AdminLocationSelection,
  DrainLocationSelection, DrainRiver, DrainStretch, DrainItem, DrainVillage,
  IndiaCatchmentSelection, IndiaVillage,
} from '../types/location.types';

export type ActiveModule = 'population' | 'water_demand' | 'water_supply' | 'sewage';

export interface PopulationReportData {
  combinedChartData: Record<string, Record<number, number>>;
  mergedTableData: Record<string, Record<number, number>> | null;
  cohortEntries: Array<{ year: number; data: Record<string, { male: number; female: number; total: number }> }>;
  selectedMethod: string | null;
  autoSelectedMethod: string | null;
  growthRates: Record<string, number>;
}

export interface WaterDemandReportData {
  years: string[];
  forecast: Record<string, number> | null;
  checkedMethods: string[];
  selectedFfMethod: string;
  results: Partial<Record<'domestic' | 'floating' | 'institutional' | 'firefighting', any>>;
}

export interface WaterSupplyReportData {
  inputs: {
    surfaceWater: string;
    directGW: string;
    numTubewells: string;
    dischargeRate: string;
    operatingHours: string;
    directAlt: string;
    rooftopTank: string;
    aquiferRecharge: string;
    surfaceRunoff: string;
    reuseWater: string;
  };
  computed: {
    gwComputed: number | null;
    altComputed: number | null;
  };
  result: { total_supply: number } | null;
  gapRows: Array<{ year: number; supply: number; demand: number; gap: number }> | null;
}

export interface SewageReportData {
  waterSupplyInput: string;
  waterSupplyResult: number | null;
  sewageDemandResult: any[] | null;
  floatingSeasonal: Record<string, Record<string, number>> | null;
  floatingYears: string[];
  peakRows: any[] | null;
  peakSelectedMethods: string[];
  treatmentMethod: 'cpheeo' | 'harmon' | 'babbitt' | '';
  treatmentCapacity: string;
  treatmentRows: any[] | null;
  stormData: any;
  stormInputs: { landUseType: string; duration: string; rainfall: string };
  stormResult: any;
  rawItems: any[] | null;
  rawCoeff: number | null;
}

interface BasicStore {
  // ── Mode ──────────────────────────────────────────────────────────────────
  mode: LocationMode;
  setMode: (mode: LocationMode) => void;

  // ── Admin selection ───────────────────────────────────────────────────────
  adminSelection: AdminLocationSelection;
  setAdminState: (state: AdminLocationSelection['state']) => void;
  setAdminDistricts: (districts: AdminLocationSelection['districts']) => void;
  setAdminSubDistricts: (sds: AdminLocationSelection['subDistricts']) => void;
  setAdminVillages: (villages: AdminLocationSelection['villages']) => void;
  resetAdminSelection: () => void;

  // ── Drain in-progress selection ───────────────────────────────────────────
  drainSelection: DrainLocationSelection;
  setDrainRiver: (river: DrainRiver | null) => void;
  setDrainStretch: (stretch: DrainStretch | null) => void;
  setDrainItems: (drains: DrainItem[]) => void;
  setDrainVillages: (villages: DrainVillage[]) => void;
  setDrainSelectedVillageIds: (ids: string[]) => void;
  setDrainTotalPopulation: (pop: number) => void;
  resetDrainSelection: () => void;

  // India catchment in-progress selection
  indiaCatchmentSelection: IndiaCatchmentSelection;
  setIndiaCatchmentPoint: (pt: IndiaCatchmentSelection['point']) => void;
  setIndiaCatchmentWatershed: (info: IndiaCatchmentSelection['watershedInfo']) => void;
  setIndiaCatchmentVillages: (villages: IndiaVillage[], totalPop: number) => void;
  setIndiaCatchmentSelectedIds: (ids: string[]) => void;
  resetIndiaCatchmentSelection: () => void;
  confirmIndiaCatchment: () => void;

  // ── Confirmed location ────────────────────────────────────────────────────
  confirmedLocation: ConfirmedLocation | null;
  confirmLocation: () => void;
  clearConfirmedLocation: () => void;

  // ── Active module ─────────────────────────────────────────────────────────
  activeModule: ActiveModule;
  setActiveModule: (m: ActiveModule) => void;

  // ── Population forecast ───────────────────────────────────────────────────
  populationForecast: Record<number, number> | null;
  selectedPopMethod: string | null;
  populationForecastVersion: number;
  setPopulationForecast: (data: Record<number, number>, method: string) => void;
  clearPopulationForecast: () => void;

  population2025: number | null;
  setPopulation2025: (pop: number) => void;
  clearPopulation2025: () => void;

  // ── Water demand ──────────────────────────────────────────────────────────
  waterDemandTotals: Record<number, number> | null;
  setWaterDemandTotals: (totals: Record<number, number>) => void;
  clearWaterDemandTotals: () => void;

  // ── Water supply ──────────────────────────────────────────────────────────
  waterSupplyTotal: number | null;
  setWaterSupplyTotal: (total: number) => void;
  clearWaterSupplyTotal: () => void;

  populationReportData: PopulationReportData | null;
  setPopulationReportData: (data: PopulationReportData | null) => void;
  waterDemandReportData: WaterDemandReportData | null;
  setWaterDemandReportData: (data: WaterDemandReportData | null) => void;
  waterSupplyReportData: WaterSupplyReportData | null;
  setWaterSupplyReportData: (data: WaterSupplyReportData | null) => void;
  sewageReportData: SewageReportData | null;
  setSewageReportData: (data: SewageReportData | null) => void;

  // ── Map payload (admin map sync) ─────────────────────────────────────────
  mapPayload: {
    state: string; districts: string[]; subDistricts: string[];
    villages: string[]; allVillages?: any[]; totalPopulation?: number;
  } | null;
  setMapPayload: (payload: BasicStore['mapPayload']) => void;

  // ── Thematic map (population forecast choropleth) ─────────────────────────
  thematicMapData: { type: string; available_years: number[]; features: any[] } | null;
  thematicMapMethod: string | null;
  thematicMapYear: number | null;
  setThematicMapData: (data: { type: string; available_years: number[]; features: any[] } | null, method: string | null) => void;
  setThematicMapYear: (year: number) => void;
  setThematicMapMethod: (method: string) => void;
  mergeThematicMapMethod: (data: { type: string; available_years: number[]; features: any[] }, methodKey: string) => void;
  clearThematicMapData: () => void;
}

const defaultAdminSelection: AdminLocationSelection = {
  state: null, districts: [], subDistricts: [], villages: [],
};


const defaultIndiaCatchment: IndiaCatchmentSelection = {
  point: { lat: 0, lng: 0 },
  watershedInfo: null,
  villages: [],
  selectedVillageIds: [],
  totalPopulation: 0,
};

const defaultDrainSelection: DrainLocationSelection = {
  river: null, stretch: null, drains: [],
  villages: [], selectedVillageIds: [], totalPopulation: 0,
};

export const useBasicStore = create<BasicStore>((set, get) => ({
  // ── Mode ──────────────────────────────────────────────────────────────────
  mode: 'admin',
  setMode: (mode) => set({
    mode,
    confirmedLocation: null,
    adminSelection: defaultAdminSelection,
    drainSelection: defaultDrainSelection,
    mapPayload: null,
    // Reset all module data
    activeModule: 'population',
    populationForecast: null, selectedPopMethod: null, populationForecastVersion: 0,
    population2025: null, waterDemandTotals: null, waterSupplyTotal: null,
    populationReportData: null, waterDemandReportData: null, waterSupplyReportData: null, sewageReportData: null,
    // Reset thematic map
    thematicMapData: null, thematicMapMethod: null, thematicMapYear: null,
  }),

  // ── Admin selection ───────────────────────────────────────────────────────
  adminSelection: defaultAdminSelection,
  setAdminState: (state) => set({ adminSelection: { state, districts: [], subDistricts: [], villages: [] } }),
  setAdminDistricts: (districts) => set((s) => ({ adminSelection: { ...s.adminSelection, districts } })),
  setAdminSubDistricts: (subDistricts) => set((s) => ({ adminSelection: { ...s.adminSelection, subDistricts } })),
  setAdminVillages: (villages) => set((s) => ({ adminSelection: { ...s.adminSelection, villages } })),
  resetAdminSelection: () => set({ adminSelection: defaultAdminSelection }),

  // ── Drain in-progress selection ───────────────────────────────────────────
  drainSelection: defaultDrainSelection,
  setDrainRiver: (river) => set((s) => ({
    drainSelection: { ...s.drainSelection, river, stretch: null, drains: [], villages: [], selectedVillageIds: [], totalPopulation: 0 },
  })),
  setDrainStretch: (stretch) => set((s) => ({
    drainSelection: { ...s.drainSelection, stretch, drains: [], villages: [], selectedVillageIds: [], totalPopulation: 0 },
  })),
  setDrainItems: (drains) => set((s) => ({
    drainSelection: { ...s.drainSelection, drains, villages: [], selectedVillageIds: [], totalPopulation: 0 },
  })),
  setDrainVillages: (villages) => set((s) => ({
    drainSelection: { ...s.drainSelection, villages, selectedVillageIds: villages.map(v => v.shapeID) },
  })),
  setDrainSelectedVillageIds: (ids) => set((s) => ({ drainSelection: { ...s.drainSelection, selectedVillageIds: ids } })),
  setDrainTotalPopulation: (pop) => set((s) => ({ drainSelection: { ...s.drainSelection, totalPopulation: pop } })),
  resetDrainSelection: () => set({ drainSelection: defaultDrainSelection }),

  // ── Confirmed location ────────────────────────────────────────────────────
  confirmedLocation: null,
  confirmLocation: () => {
    const { mode, adminSelection, drainSelection } = get();

    if (mode === 'admin') {
      if (!adminSelection.state) return;
      const label = [
        adminSelection.state.state_name,
        adminSelection.districts.length ? `${adminSelection.districts.length} District(s)` : null,
        adminSelection.subDistricts.length ? `${adminSelection.subDistricts.length} Sub-District(s)` : null,
        adminSelection.villages.length ? `${adminSelection.villages.length} Village(s)` : null,
      ].filter(Boolean).join(' › ');
      set({ confirmedLocation: { mode: 'admin', admin: adminSelection, label } });
      return;
    }

    if (mode === 'drain') {
      if (!drainSelection.drains.length || !drainSelection.villages.length) return;
      const selVillages = drainSelection.villages.filter(v =>
        drainSelection.selectedVillageIds.includes(v.shapeID)
      );
      const label = [
        drainSelection.river?.name,
        drainSelection.stretch ? `Stretch ${drainSelection.stretch.id}` : null,
        `${drainSelection.drains.length} Drain(s)`,
        `${selVillages.length} Village(s)`,
      ].filter(Boolean).join(' › ');

      // finalise drain selection — only keep selected villages
      const finalDrain: DrainLocationSelection = {
        ...drainSelection,
        villages: selVillages,
        selectedVillageIds: selVillages.map(v => v.shapeID),
      };
      set({ confirmedLocation: { mode: 'drain', drain: finalDrain, label } });
      return;
    }

    // india_catchment — handled externally via confirmIndiaCatchment
  },

  clearConfirmedLocation: () => set({
    confirmedLocation: null,
    activeModule: 'population',
    populationForecast: null, selectedPopMethod: null, populationForecastVersion: 0,
    population2025: null, waterDemandTotals: null, waterSupplyTotal: null,
    populationReportData: null, waterDemandReportData: null, waterSupplyReportData: null, sewageReportData: null,
  }),

  // ── Active module ─────────────────────────────────────────────────────────
  activeModule: 'population',
  setActiveModule: (activeModule) => set({ activeModule }),

  // ── Population forecast ───────────────────────────────────────────────────
  populationForecast: null,
  selectedPopMethod: null,
  populationForecastVersion: 0,
  setPopulationForecast: (data, method) => set((s) => ({
    populationForecast: data, selectedPopMethod: method,
    populationForecastVersion: s.populationForecastVersion + 1,
    waterDemandTotals: null, waterSupplyTotal: null,
    waterDemandReportData: null, waterSupplyReportData: null, sewageReportData: null,
  })),
  clearPopulationForecast: () => set({
    populationForecast: null, selectedPopMethod: null, populationForecastVersion: 0,
    population2025: null, waterDemandTotals: null, waterSupplyTotal: null,
    populationReportData: null, waterDemandReportData: null, waterSupplyReportData: null, sewageReportData: null,
  }),

  population2025: null,
  setPopulation2025: (pop) => set({ population2025: pop }),
  clearPopulation2025: () => set({ population2025: null }),

  waterDemandTotals: null,
  setWaterDemandTotals: (totals) => set({ waterDemandTotals: totals }),
  clearWaterDemandTotals: () => set({ waterDemandTotals: null }),

  waterSupplyTotal: null,
  setWaterSupplyTotal: (total) => set({ waterSupplyTotal: total }),
  clearWaterSupplyTotal: () => set({ waterSupplyTotal: null }),

  populationReportData: null,
  setPopulationReportData: (data) => set({ populationReportData: data }),
  waterDemandReportData: null,
  setWaterDemandReportData: (data) => set({ waterDemandReportData: data }),
  waterSupplyReportData: null,
  setWaterSupplyReportData: (data) => set({ waterSupplyReportData: data }),
  sewageReportData: null,
  setSewageReportData: (data) => set({ sewageReportData: data }),


  indiaCatchmentSelection: defaultIndiaCatchment,
  setIndiaCatchmentPoint: (pt) => set((s) => ({ indiaCatchmentSelection: { ...s.indiaCatchmentSelection, point: pt, watershedInfo: null, villages: [], selectedVillageIds: [], totalPopulation: 0 } })),
  setIndiaCatchmentWatershed: (info) => set((s) => ({ indiaCatchmentSelection: { ...s.indiaCatchmentSelection, watershedInfo: info } })),
  setIndiaCatchmentVillages: (villages, totalPop) => set((s) => ({
    indiaCatchmentSelection: { ...s.indiaCatchmentSelection, villages, totalPopulation: totalPop, selectedVillageIds: villages.map(v => v.vlcode) }
  })),
  setIndiaCatchmentSelectedIds: (ids) => set((s) => ({ indiaCatchmentSelection: { ...s.indiaCatchmentSelection, selectedVillageIds: ids } })),
  resetIndiaCatchmentSelection: () => set({ indiaCatchmentSelection: defaultIndiaCatchment }),
  confirmIndiaCatchment: () => {
    const { indiaCatchmentSelection } = get();
    const sel = indiaCatchmentSelection.villages.filter(v => indiaCatchmentSelection.selectedVillageIds.includes(v.vlcode));
    if (!sel.length) return;
    const label = `Watershed (${indiaCatchmentSelection.point.lat.toFixed(3)}, ${indiaCatchmentSelection.point.lng.toFixed(3)}) › ${sel.length} Village(s)`;
    set({ confirmedLocation: { mode: 'india_catchment', indiaCatchment: { ...indiaCatchmentSelection, villages: sel, selectedVillageIds: sel.map(v => v.vlcode) }, label } });
  },

  mapPayload: null,
  setMapPayload: (payload) => set({ mapPayload: payload }),

  thematicMapData: null,
  thematicMapMethod: null,
  thematicMapYear: null,
  setThematicMapData: (data, method) => set({
    thematicMapData: data,
    thematicMapMethod: method,
    thematicMapYear: data?.available_years?.length ? data.available_years[data.available_years.length - 1] : null,
  }),
  setThematicMapYear: (year) => set({ thematicMapYear: year }),
  setThematicMapMethod: (method) => set({ thematicMapMethod: method }),
  mergeThematicMapMethod: (incoming, methodKey) => set((s) => {
    if (!s.thematicMapData) {
      return { thematicMapData: incoming, thematicMapMethod: methodKey };
    }
    // Build a lookup from village_code → incoming feature properties
    const lookup: Record<string, any> = {};
    for (const f of incoming.features) {
      const code = f.properties?.village_code;
      if (code != null) lookup[String(code)] = f.properties;
    }
    // Merge the new method key (and companion keys like Cohort AgeSex) into existing features
    const companionKey = methodKey === 'Cohort Total' ? 'Cohort AgeSex' : null;
    const mergedFeatures = s.thematicMapData.features.map((f) => {
      const code = f.properties?.village_code;
      const src = code != null ? lookup[String(code)] : null;
      if (!src) return f;
      const extra: Record<string, any> = { [methodKey]: src[methodKey] };
      if (companionKey && src[companionKey] != null) extra[companionKey] = src[companionKey];
      return {
        ...f,
        properties: { ...f.properties, ...extra },
      };
    });
    // Merge available_years
    const mergedYears = Array.from(new Set([...s.thematicMapData.available_years, ...incoming.available_years])).sort((a, b) => a - b);
    return {
      thematicMapData: { ...s.thematicMapData, features: mergedFeatures, available_years: mergedYears },
      thematicMapMethod: methodKey,
    };
  }),
  clearThematicMapData: () => set({ thematicMapData: null, thematicMapMethod: null, thematicMapYear: null }),
}));

// NOTE: India Catchment confirm is called externally from IndCatchmentSelector
// because it needs the watershedInfo + villages data from the map component.
// We expose a direct setter:
