"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type RsqView = "admin" | "drain";

interface AdminStateItem {
  id: string;
  name: string;
}

interface AdminDistrictItem {
  id: string;
  name: string;
  stateId: string;
}

interface AdminBlockItem {
  id: string;
  name: string;
  districtCode: string;
}

interface AdminVillageItem {
  id: string;
  name: string;
  blockCode: string;
}

interface DrainRiverItem {
  id: string | number;
  name: string;
  code: number;
}

interface DrainStretchItem {
  id: string | number;
  name: string;
  stretchId: number;
  riverCode: number;
}

interface DrainItem {
  id: string | number;
  drainNo: number;
  riverCode: number;
  stretchId: number;
}

interface DrainCatchmentItem {
  id: string | number;
  name: string;
  objectId: number;
  gridCode: number;
  drainNo: number;
}

interface DrainVillageItem {
  id: string | number;
  code: number;
  name: string;
  village_code: string | number;
}

interface GroundWaterFeature {
  type: "Feature";
  id?: string;
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GroundWaterGeoJSON {
  type: "FeatureCollection";
  features: GroundWaterFeature[];
}

const STATUS_COLOR_MAP: Record<string, string> = {
  safe: "#27ae60",
  "semi-critical": "#f39c12",
  semicritical: "#f39c12",
  critical: "#6006cd",
  "over-exploited": "#c0392b",
  overexploited: "#c0392b",
  "no data": "#95a5a6",
  nodata: "#95a5a6",
};

interface AnalysisState {
  selectedYear: string;
  comparisonYear: string;
  groundWaterData: GroundWaterGeoJSON | null;
  comparisonGroundWaterData: GroundWaterGeoJSON | null;
  isLoading: boolean;
  error: string | null;
}

const ADMIN_ALLOWED_DISTRICTS = [179, 152, 120, 174, 187];

interface RsqStateValue {
  activeView: RsqView;
  setActiveView: (view: RsqView) => void;

  admin: {
    states: AdminStateItem[];
    districts: AdminDistrictItem[];
    blocks: AdminBlockItem[];
    villages: AdminVillageItem[];
    selectedState: string | null;
    selectedDistricts: string[];
    selectedBlocks: string[];
    selectedVillages: string[];
    isLoading: boolean;
    error: string | null;
    setSelectedState: (value: string | null) => void;
    setSelectedDistricts: (value: string[]) => void;
    setSelectedBlocks: (value: string[]) => void;
    setSelectedVillages: (value: string[]) => void;
    reset: () => void;
  };

  drain: {
    rivers: DrainRiverItem[];
    stretches: DrainStretchItem[];
    drains: DrainItem[];
    catchments: DrainCatchmentItem[];
    villages: DrainVillageItem[];
    selectedRiver: number | null;
    selectedStretch: number | null;
    selectedDrain: number | null;
    selectedCatchments: number[];
    selectedVillages: number[];
    isLoading: boolean;
    error: string | null;
    areaConfirmed: boolean;
    setSelectedRiver: (value: number | null) => void;
    setSelectedStretch: (value: number | null) => void;
    setSelectedDrain: (value: number | null) => void;
    setSelectedVillages: (value: number[]) => void;
    confirmArea: () => void;
    reset: () => void;
  };

  analysis: Record<RsqView, AnalysisState>;
  setAnalysisYear: (view: RsqView, year: string) => void;
  setComparisonYear: (view: RsqView, year: string) => void;
}

const RsqStateContext = createContext<RsqStateValue | null>(null);

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function getStatusColor(properties: Record<string, any>) {
  const rawStatus = String(properties.status || properties.Status || "").trim().toLowerCase();
  if (STATUS_COLOR_MAP[rawStatus]) {
    return STATUS_COLOR_MAP[rawStatus];
  }
  if (rawStatus.includes("safe")) return STATUS_COLOR_MAP.safe;
  if (rawStatus.includes("semi")) return STATUS_COLOR_MAP["semi-critical"];
  if (rawStatus.includes("critical")) return STATUS_COLOR_MAP.critical;
  if (rawStatus.includes("over")) return STATUS_COLOR_MAP["over-exploited"];
  if (rawStatus.includes("no data")) return STATUS_COLOR_MAP["no data"];
  return "#00BCD4";
}

function normalizeGroundWaterData(payload: any): GroundWaterGeoJSON | null {
  const candidate =
    payload?.type === "FeatureCollection"
      ? payload
      : payload?.data?.type === "FeatureCollection"
        ? payload.data
        : payload?.geojson?.type === "FeatureCollection"
          ? payload.geojson
          : typeof payload === "string"
            ? (() => {
                try {
                  const parsed = JSON.parse(payload);
                  return parsed?.type === "FeatureCollection" ? parsed : null;
                } catch {
                  return null;
                }
              })()
            : null;

  if (!candidate || !Array.isArray(candidate.features)) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: candidate.features
      .filter((feature: any) => feature?.type === "Feature" && feature?.geometry)
      .map((feature: any) => {
        const properties = { ...(feature.properties || {}) };
        const color = properties.color || properties.Color || properties.fill || properties.Fill || getStatusColor(properties);
        return {
          ...feature,
          properties: {
            ...properties,
            color,
          },
        };
      }),
  };
}

export function RsqStateProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<RsqView>("admin");

  const [adminStates, setAdminStates] = useState<AdminStateItem[]>([]);
  const [adminDistricts, setAdminDistricts] = useState<AdminDistrictItem[]>([]);
  const [adminBlocks, setAdminBlocks] = useState<AdminBlockItem[]>([]);
  const [adminVillages, setAdminVillages] = useState<AdminVillageItem[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [selectedAdminVillages, setSelectedAdminVillages] = useState<string[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [rivers, setRivers] = useState<DrainRiverItem[]>([]);
  const [stretches, setStretches] = useState<DrainStretchItem[]>([]);
  const [drains, setDrains] = useState<DrainItem[]>([]);
  const [catchments, setCatchments] = useState<DrainCatchmentItem[]>([]);
  const [drainVillages, setDrainVillages] = useState<DrainVillageItem[]>([]);
  const [selectedRiver, setSelectedRiverState] = useState<number | null>(null);
  const [selectedStretch, setSelectedStretchState] = useState<number | null>(null);
  const [selectedDrain, setSelectedDrainState] = useState<number | null>(null);
  const [selectedCatchments, setSelectedCatchments] = useState<number[]>([]);
  const [selectedDrainVillages, setSelectedDrainVillages] = useState<number[]>([]);
  const [drainLoading, setDrainLoading] = useState(false);
  const [drainError, setDrainError] = useState<string | null>(null);
  const [drainAreaConfirmed, setDrainAreaConfirmed] = useState(false);

  const [analysis, setAnalysis] = useState<Record<RsqView, AnalysisState>>({
    admin: { selectedYear: "", comparisonYear: "", groundWaterData: null, comparisonGroundWaterData: null, isLoading: false, error: null },
    drain: { selectedYear: "", comparisonYear: "", groundWaterData: null, comparisonGroundWaterData: null, isLoading: false, error: null },
  });

  useEffect(() => {
    let cancelled = false;
    async function loadStates() {
      setAdminLoading(true);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/state`);
        if (!cancelled) {
          setAdminStates(
            data.map((item: any) => ({
              id: String(item.state_code).padStart(2, "0"),
              name: item.state_name,
            }))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(error instanceof Error ? error.message : "Failed to fetch states");
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }

    async function loadRivers() {
      setDrainLoading(true);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/rivers/`);
        const features = data.features || [];
        if (!cancelled) {
          const mapped = features
            .map((feature: any) => ({
              id: feature.properties.River_Code,
              name: feature.properties.River_Name,
              code: feature.properties.River_Code,
            }))
            .filter((river: DrainRiverItem, index: number, list: DrainRiverItem[]) => index === list.findIndex((item) => item.code === river.code))
            .sort((a: DrainRiverItem, b: DrainRiverItem) => a.name.localeCompare(b.name));
          setRivers(mapped);
        }
      } catch (error) {
        if (!cancelled) {
          setDrainError(error instanceof Error ? error.message : "Failed to fetch rivers");
        }
      } finally {
        if (!cancelled) {
          setDrainLoading(false);
        }
      }
    }

    loadStates();
    loadRivers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDistricts() {
      if (!selectedState) {
        setAdminDistricts([]);
        return;
      }
      setAdminLoading(true);
      setAdminError(null);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/district/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state_code: selectedState }),
        });
        if (!cancelled) {
          setAdminDistricts(
            data.map((item: any) => ({
              id: String(item.district_code).padStart(3, "0"),
              name: item.district_name,
              stateId: selectedState,
            }))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(error instanceof Error ? error.message : "Failed to fetch districts");
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }
    loadDistricts();
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  useEffect(() => {
    let cancelled = false;
    async function loadBlocks() {
      if (selectedDistricts.length === 0) {
        setAdminBlocks([]);
        return;
      }
      setAdminLoading(true);
      setAdminError(null);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/rsq/getblocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ districtcodes: selectedDistricts }),
        });
        if (!cancelled) {
          setAdminBlocks(
            data.map((item: any) => ({
              id: String(item.blockcode).padStart(4, "0"),
              name: item.block,
              districtCode: String(item.districtcode).padStart(3, "0"),
            }))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(error instanceof Error ? error.message : "Failed to fetch blocks");
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }
    loadBlocks();
    return () => {
      cancelled = true;
    };
  }, [selectedDistricts]);

  useEffect(() => {
    let cancelled = false;
    async function loadVillages() {
      if (selectedBlocks.length === 0) {
        setAdminVillages([]);
        return;
      }
      setAdminLoading(true);
      setAdminError(null);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/rsq/getvillages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockcodes: selectedBlocks }),
        });
        if (!cancelled) {
          setAdminVillages(
            data.map((item: any) => ({
              id: String(item.vlcode).padStart(6, "0"),
              name: item.village,
              blockCode: String(item.blockcode).padStart(4, "0"),
            }))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(error instanceof Error ? error.message : "Failed to fetch villages");
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }
    loadVillages();
    return () => {
      cancelled = true;
    };
  }, [selectedBlocks]);

  useEffect(() => {
    let cancelled = false;
    async function loadStretches() {
      if (!selectedRiver) {
        setStretches([]);
        return;
      }
      setDrainLoading(true);
      setDrainError(null);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/river-stretched/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ River_Code: selectedRiver }),
        });
        const features = data.features || [];
        if (!cancelled) {
          setStretches(
            features
              .map((feature: any) => ({
                id: feature.properties.Stretch_ID,
                name: `Stretch ${feature.properties.Stretch_ID}`,
                stretchId: feature.properties.Stretch_ID,
                riverCode: feature.properties.River_Code,
              }))
              .sort((a: DrainStretchItem, b: DrainStretchItem) => a.stretchId - b.stretchId)
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDrainError(error instanceof Error ? error.message : "Failed to fetch stretches");
        }
      } finally {
        if (!cancelled) {
          setDrainLoading(false);
        }
      }
    }
    loadStretches();
    return () => {
      cancelled = true;
    };
  }, [selectedRiver]);

  useEffect(() => {
    let cancelled = false;
    async function loadDrains() {
      if (!selectedRiver || !selectedStretch) {
        setDrains([]);
        return;
      }
      setDrainLoading(true);
      setDrainError(null);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/drain/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Stretch_ID: selectedStretch }),
        });
        const features = data.features || [];
        if (!cancelled) {
          setDrains(
            features
              .map((feature: any) => ({
                id: feature.properties.Drain_No,
                drainNo: feature.properties.Drain_No,
                riverCode: feature.properties.River_Code,
                stretchId: feature.properties.Stretch_ID,
              }))
              .sort((a: DrainItem, b: DrainItem) => a.drainNo - b.drainNo)
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDrainError(error instanceof Error ? error.message : "Failed to fetch drains");
        }
      } finally {
        if (!cancelled) {
          setDrainLoading(false);
        }
      }
    }
    loadDrains();
    return () => {
      cancelled = true;
    };
  }, [selectedRiver, selectedStretch]);

  useEffect(() => {
    let cancelled = false;
    async function loadCatchments() {
      if (!selectedDrain) {
        setCatchments([]);
        return;
      }
      setDrainLoading(true);
      setDrainError(null);
      try {
        const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/catchment_village/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Drain_No: [selectedDrain] }),
        });
        const features = data.catchment_geojson?.features || [];
        if (!cancelled) {
          const mapped = features
            .map((feature: any) => ({
              id: feature.properties.OBJECTID,
              name: `Catchment ${feature.properties.GRIDCODE}`,
              objectId: feature.properties.OBJECTID,
              gridCode: feature.properties.GRIDCODE,
              drainNo: feature.properties.Drain_No,
            }))
            .sort((a: DrainCatchmentItem, b: DrainCatchmentItem) => a.gridCode - b.gridCode);
          setCatchments(mapped);
          setSelectedCatchments(mapped.map((item: DrainCatchmentItem) => Number(item.objectId)));
        }
      } catch (error) {
        if (!cancelled) {
          setDrainError(error instanceof Error ? error.message : "Failed to fetch catchments");
        }
      } finally {
        if (!cancelled) {
          setDrainLoading(false);
        }
      }
    }
    loadCatchments();
    return () => {
      cancelled = true;
    };
  }, [selectedDrain]);

  useEffect(() => {
    let cancelled = false;
    async function loadDrainVillages() {
      if (selectedCatchments.length === 0 || catchments.length === 0) {
        setDrainVillages([]);
        return;
      }
      setDrainLoading(true);
      setDrainError(null);
      try {
        const selectedDrainNos = Array.from(
          new Set(
            catchments
          .filter((item) => selectedCatchments.includes(Number(item.objectId)))
          .map((item) => item.drainNo)
          )
        );
        const allVillages: DrainVillageItem[] = [];
        for (const drainNo of selectedDrainNos) {
          const data = await fetchJson(`${process.env.NEXT_PUBLIC_FAST_URL}/gwa/villagescatchment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ Drain_No: drainNo }),
          });
          const villages = data.villages || [];
          allVillages.push(
            ...villages.map((item: any) => ({
              id: item.village_code,
              code: item.village_code,
              name: item.name || `Village ${item.village_code}`,
              village_code: item.village_code,
            }))
          );
        }
        if (!cancelled) {
          const unique = allVillages
            .filter((item, index, list) => index === list.findIndex((candidate) => candidate.code === item.code))
            .sort((a, b) => a.name.localeCompare(b.name));
          setDrainVillages(unique);
          setSelectedDrainVillages(unique.map((item) => Number(item.code)));
        }
      } catch (error) {
        if (!cancelled) {
          setDrainError(error instanceof Error ? error.message : "Failed to fetch villages");
        }
      } finally {
        if (!cancelled) {
          setDrainLoading(false);
        }
      }
    }
    loadDrainVillages();
    return () => {
      cancelled = true;
    };
  }, [catchments, selectedCatchments]);

  useEffect(() => {
    setAnalysis((current) => ({
      ...current,
      admin: { selectedYear: "", comparisonYear: "", groundWaterData: null, comparisonGroundWaterData: null, isLoading: false, error: null },
    }));
  }, [selectedAdminVillages]);

  useEffect(() => {
    setAnalysis((current) => ({
      ...current,
      drain: { selectedYear: "", comparisonYear: "", groundWaterData: null, comparisonGroundWaterData: null, isLoading: false, error: null },
    }));
  }, [selectedDrainVillages]);

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis(view: RsqView, villages: Array<string | number>, year: string, target: "groundWaterData" | "comparisonGroundWaterData") {
      if (!year || villages.length === 0) {
        return;
      }
      setAnalysis((current) => ({
        ...current,
        [view]: {
          ...current[view],
          isLoading: true,
          error: null,
          [target]: null,
        },
      }));
      try {
        const baseUrl = process.env.NEXT_PUBLIC_FAST_URL;
        const rawData = await fetchJson(`${baseUrl}/rsq/quantification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            vlcodes: villages,
          }),
        });
          const data = normalizeGroundWaterData(rawData);
          if (!data) {
            throw new Error("Invalid RSQ GeoJSON response");
          }
          if (!cancelled) {
            setAnalysis((current) => ({
              ...current,
            [view]: {
              ...current[view],
              [target]: data,
              isLoading: false,
            },
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysis((current) => ({
            ...current,
            [view]: {
              ...current[view],
              error: error instanceof Error ? error.message : "Failed to fetch RSQ data",
              isLoading: false,
              [target]: null,
            },
          }));
        }
      }
    }

    const timer = window.setTimeout(() => {
      loadAnalysis("admin", selectedAdminVillages, analysis.admin.selectedYear, "groundWaterData");
      loadAnalysis("admin", selectedAdminVillages, analysis.admin.comparisonYear, "comparisonGroundWaterData");
      loadAnalysis("drain", selectedDrainVillages, analysis.drain.selectedYear, "groundWaterData");
      loadAnalysis("drain", selectedDrainVillages, analysis.drain.comparisonYear, "comparisonGroundWaterData");
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    analysis.admin.comparisonYear,
    analysis.admin.selectedYear,
    analysis.drain.comparisonYear,
    analysis.drain.selectedYear,
    selectedAdminVillages,
    selectedDrainVillages,
  ]);

  const value = useMemo<RsqStateValue>(
    () => ({
      activeView,
      setActiveView,
      admin: {
        states: adminStates,
        districts: adminDistricts,
        blocks: adminBlocks,
        villages: adminVillages,
        selectedState,
        selectedDistricts,
        selectedBlocks,
        selectedVillages: selectedAdminVillages,
        isLoading: adminLoading,
        error: adminError,
        setSelectedState: (value) => {
          setSelectedState(value);
          setSelectedDistricts([]);
          setSelectedBlocks([]);
          setSelectedAdminVillages([]);
          setAdminBlocks([]);
          setAdminVillages([]);
        },
        setSelectedDistricts: (value) => {
          setSelectedDistricts(value);
          setSelectedBlocks([]);
          setSelectedAdminVillages([]);
          setAdminVillages([]);
        },
        setSelectedBlocks: (value) => {
          setSelectedBlocks(value);
          setSelectedAdminVillages([]);
        },
        setSelectedVillages: setSelectedAdminVillages,
        reset: () => {
          setSelectedState(null);
          setSelectedDistricts([]);
          setSelectedBlocks([]);
          setSelectedAdminVillages([]);
          setAdminDistricts([]);
          setAdminBlocks([]);
          setAdminVillages([]);
        },
      },
      drain: {
        rivers,
        stretches,
        drains,
        catchments,
        villages: drainVillages,
        selectedRiver,
        selectedStretch,
        selectedDrain,
        selectedCatchments,
        selectedVillages: selectedDrainVillages,
        isLoading: drainLoading,
        error: drainError,
        areaConfirmed: drainAreaConfirmed,
        setSelectedRiver: (value) => {
          setDrainError(null);
          setSelectedRiverState(value);
          setSelectedStretchState(null);
          setSelectedDrainState(null);
          setSelectedCatchments([]);
          setSelectedDrainVillages([]);
          setStretches([]);
          setDrains([]);
          setCatchments([]);
          setDrainVillages([]);
          setDrainAreaConfirmed(false);
        },
        setSelectedStretch: (value) => {
          setDrainError(null);
          setSelectedStretchState(value);
          setSelectedDrainState(null);
          setSelectedCatchments([]);
          setSelectedDrainVillages([]);
          setDrains([]);
          setCatchments([]);
          setDrainVillages([]);
          setDrainAreaConfirmed(false);
        },
        setSelectedDrain: (value) => {
          setDrainError(null);
          setSelectedDrainState(value);
          setSelectedCatchments([]);
          setSelectedDrainVillages([]);
          setCatchments([]);
          setDrainVillages([]);
          setDrainAreaConfirmed(false);
        },
        setSelectedVillages: (value) => {
          setDrainError(null);
          setSelectedDrainVillages(value);
          setDrainAreaConfirmed(false);
        },
        confirmArea: () => setDrainAreaConfirmed(true),
        reset: () => {
          setDrainError(null);
          setSelectedRiverState(null);
          setSelectedStretchState(null);
          setSelectedDrainState(null);
          setSelectedCatchments([]);
          setSelectedDrainVillages([]);
          setStretches([]);
          setDrains([]);
          setCatchments([]);
          setDrainVillages([]);
          setDrainAreaConfirmed(false);
        },
      },
      analysis,
      setAnalysisYear: (view, year) =>
        setAnalysis((current) => ({
          ...current,
          [view]: {
            ...current[view],
            selectedYear: year,
            groundWaterData: year ? current[view].groundWaterData : null,
          },
        })),
      setComparisonYear: (view, year) =>
        setAnalysis((current) => ({
          ...current,
          [view]: {
            ...current[view],
            comparisonYear: year,
            comparisonGroundWaterData: year ? current[view].comparisonGroundWaterData : null,
          },
        })),
    }),
    [
      activeView,
      adminBlocks,
      adminDistricts,
      adminError,
      adminLoading,
      adminStates,
      adminVillages,
      analysis,
      catchments,
      drainAreaConfirmed,
      drainError,
      drainLoading,
      drainVillages,
      drains,
      rivers,
      selectedAdminVillages,
      selectedBlocks,
      selectedCatchments,
      selectedDistricts,
      selectedDrain,
      selectedDrainVillages,
      selectedRiver,
      selectedState,
      selectedStretch,
      stretches,
    ]
  );

  return <RsqStateContext.Provider value={value}>{children}</RsqStateContext.Provider>;
}

function useRsqState() {
  const context = useContext(RsqStateContext);
  if (!context) {
    throw new Error("useRsqState must be used within RsqStateProvider");
  }
  return context;
}

export function useRsqAdmin() {
  const { admin } = useRsqState();
  return {
    ...admin,
    sortedStates: [...admin.states].sort((a, b) => {
      if (Number(a.id) === 9) return -1;
      if (Number(b.id) === 9) return 1;
      return a.name.localeCompare(b.name);
    }),
    allowedDistrictIds: ADMIN_ALLOWED_DISTRICTS,
  };
}

export function useRsqDrain() {
  return useRsqState().drain;
}

export function useRsqAnalysis(view: RsqView) {
  const { analysis, setAnalysisYear, setComparisonYear } = useRsqState();
  return {
    ...analysis[view],
    setSelectedYear: (year: string) => setAnalysisYear(view, year),
    setComparisonYear: (year: string) => setComparisonYear(view, year),
  };
}

export function useRsqView() {
  const { activeView, setActiveView } = useRsqState();
  return { activeView, setActiveView };
}
