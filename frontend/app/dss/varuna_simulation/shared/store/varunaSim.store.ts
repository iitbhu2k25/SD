import { create } from 'zustand';
import { DEFAULT_VARUNA_PARAMS } from '../types/varunaSim.types';
import type {
  ScenarioSummary,
  SimulationRow,
  SnapshotResponse,
  VarunaScenarioParams,
} from '../types/varunaSim.types';

interface VarunaSimState {
  params: VarunaScenarioParams;
  strategies: string[];
  snapshot: SnapshotResponse | null;
  simulationRows: SimulationRow[];
  scenarios: ScenarioSummary[];
  selectedScenarioIds: number[];
  activeScenarioId: number | null;

  setParam: <K extends keyof VarunaScenarioParams>(key: K, value: VarunaScenarioParams[K]) => void;
  setParams: (params: Partial<VarunaScenarioParams>) => void;
  setStrategies: (strategies: string[]) => void;
  setSnapshot: (snapshot: SnapshotResponse | null) => void;
  setSimulationRows: (rows: SimulationRow[]) => void;
  setScenarios: (scenarios: ScenarioSummary[]) => void;
  toggleScenarioSelected: (id: number) => void;
  setActiveScenarioId: (id: number | null) => void;
  resetToDefaults: () => void;
}

export const useVarunaSimStore = create<VarunaSimState>((set) => ({
  params: { ...DEFAULT_VARUNA_PARAMS },
  strategies: [],
  snapshot: null,
  simulationRows: [],
  scenarios: [],
  selectedScenarioIds: [],
  activeScenarioId: null,

  setParam: (key, value) =>
    set((state) => ({ params: { ...state.params, [key]: value } })),

  setParams: (params) =>
    set((state) => ({ params: { ...state.params, ...params } })),

  setStrategies: (strategies) => set({ strategies }),

  setSnapshot: (snapshot) => set({ snapshot }),

  setSimulationRows: (simulationRows) => set({ simulationRows }),

  setScenarios: (scenarios) => set({ scenarios }),

  toggleScenarioSelected: (id) =>
    set((state) => ({
      selectedScenarioIds: state.selectedScenarioIds.includes(id)
        ? state.selectedScenarioIds.filter((x) => x !== id)
        : [...state.selectedScenarioIds, id],
    })),

  setActiveScenarioId: (id) => set({ activeScenarioId: id }),

  resetToDefaults: () =>
    set({ params: { ...DEFAULT_VARUNA_PARAMS }, strategies: [], snapshot: null, simulationRows: [] }),
}));
