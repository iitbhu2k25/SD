import { API_BASE_URL } from '../utils/constants';
import type { ConfirmedLocation } from '../types/location.types';

const toInt = (v: string | number | undefined | null) =>
  v !== undefined && v !== null && v !== '' && Number.isFinite(parseInt(String(v), 10))
    ? parseInt(String(v), 10)
    : null;

function buildProps(location: ConfirmedLocation) {
  if (location.mode === 'admin') {
    const admin = location.admin!;

    // Backend reads v["id"], v["population"], v.get("subDistrictId", 0)
    const villages_props = admin.villages.map((v) => ({
      id: toInt(v.village_code),
      name: v.village_name,
      population: toInt(v.population as any) ?? 0,
      subDistrictId: toInt(v.subdistrict_code),
    }));

    // _extract_id_list reads item["id"] from each dict
    const subdistrict_props = admin.subDistricts.map((s) => ({
      id: toInt(s.subdistrict_code),
      name: s.subdistrict_name,
      districtId: toInt(s.district_code),
    }));

    const district_props = admin.districts.map((d) => ({
      id: toInt(d.district_code),
      name: d.district_name,
      stateId: toInt(d.state_code),
    }));

    // cohort reads state["id"]
    const state_props = admin.state
      ? { id: toInt(admin.state.state_code), name: admin.state.state_name }
      : null;

    return { villages_props, subdistrict_props, district_props, state_props };
  }

  if (location.mode === 'drain') {
    const drain = location.drain!;
    const villages_props = drain.villages.map((v) => ({
      id: toInt(v.shapeID),
      name: v.shapeName,
      population: Number(v.population ?? 0),
      // Prefer subdistrict code from catchment_village (SUBDIS_COD) when available.
      subDistrictId: toInt(v.subDistrictCode) ?? 0,
    }));

    const subdistrict_props = Array.from(
      new Set(
        drain.villages
          .map((v) => toInt(v.subDistrictCode))
          .filter((x): x is number => x !== null)
      )
    ).map((id) => ({ id }));

    return {
      villages_props,
      subdistrict_props,
      district_props: [] as Array<Record<string, number | string | null>>,
      state_props: null as { id: number | null; name: string } | null,
    };
  }

  const india = location.indiaCatchment!;
  const villages_props = india.villages.map((v) => ({
    id: toInt(v.vlcode),
    name: v.village,
    population: Number(v.population ?? 0),
    subDistrictId: toInt(v.subdis_cod) ?? 0,
  }));

  // Build unique subdistrict list if available (helps arithmetic/geometric methods).
  const subdistrict_props = Array.from(
    new Set(
      india.villages
        .map((v) => toInt(v.subdis_cod))
        .filter((x): x is number => x !== null)
    )
  ).map((id) => ({ id }));

  return {
    villages_props,
    subdistrict_props,
    district_props: [] as Array<Record<string, number | string | null>>,
    state_props: null as { id: number | null; name: string } | null,
  };
}

function yearFields(params: { year?: number; start_year?: number; end_year?: number }) {
  const out: Record<string, number> = {};
  if (params.year != null) out.year = params.year;
  if (params.start_year != null) out.start_year = params.start_year;
  if (params.end_year != null) out.end_year = params.end_year;
  return out;
}

async function post(path: string, body: object) {
  console.log(`[population] POST /basic/${path}`, JSON.stringify(body, null, 2));
  const res = await fetch(`${API_BASE_URL}/basic/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// demographic also reads birthRate, deathRate, emigrationRate, immigrationRate
export async function fetchArithmetic(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number }
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('time_series/arthemitic', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    totalPopulation_props: null,
  });
}

export async function fetchDemographic(
  location: ConfirmedLocation,
  params: Record<string, any>
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('time_series/demographic', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    totalPopulation_props: null,
    demographic: params.demographic,
  });
}

export async function fetchCohort(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number }
) {
  const { villages_props, subdistrict_props, district_props, state_props } = buildProps(location);
  return post('cohort', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    district_props,
    state_props,
  });
}

export async function fetchThematicMapCohort(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number }
) {
  const { villages_props, subdistrict_props, district_props, state_props } = buildProps(location);
  return post('cohort/thematicmap', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    district_props,
    state_props,
  });
}

export async function fetchThematicMapDemographic(
  location: ConfirmedLocation,
  params: Record<string, any>
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('time_series/demographic/thematicmap', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    totalPopulation_props: null,
    demographic: params.demographic ?? {},
  });
}

export async function fetchThematicMap(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number }
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('time_series/arthemitic/thematicmap', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    totalPopulation_props: null,
  });
}

export async function fetchWaterSupplyThematic(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number },
  total_supply: number,
  demand_by_year: Record<string, number>,
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('water_supply/thematic', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    total_supply,
    demand_by_year,
  });
}

export interface WDThematicParams {
  per_capita_consumption: number;
  floating_percentage?: number;
  facility_lpcd?: number;
  inst_demand?: Record<string, number>;
  ff_demand?: Record<string, number>;
  total_population_2011?: number;
}

export async function fetchWaterDemandThematic(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number },
  wdParams: WDThematicParams,
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('water_demand/thematic', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    ...wdParams,
  });
}

export interface SewageThematicParams {
  water_supply: number;
  drain_recharge_sum: number;
  population_2025: number;
  unmetered_supply: number;
  population_data?: Record<string, number>;  // {year: total_pop} — exact totals from result rows
  load_method?: 'manual' | 'modeled';
}

export async function fetchSewageThematic(
  location: ConfirmedLocation,
  params: { year?: number; start_year?: number; end_year?: number },
  sewageParams: SewageThematicParams,
) {
  const { villages_props, subdistrict_props } = buildProps(location);
  return post('sewage/thematic', {
    ...yearFields(params),
    villages_props,
    subdistrict_props,
    ...sewageParams,
  });
}

// ── Fetch exactly 2025 population for the currently selected method ──────────
// Called by PopulationModule when the user's chosen forecast range doesn't include 2025.
// Returns the total population at year 2025 (number) or null on failure.

export async function fetchPopulation2025(
  location: ConfirmedLocation,
  methodName: string
): Promise<number | null> {
  try {
    const { villages_props, subdistrict_props, district_props, state_props } = buildProps(location);

    // Time-series methods (Arithmetic, Geometric, Incremental, Exponential)
    const tsMethodMap: Record<string, string> = {
      Arithmetic: 'Arithmetic',
      Geometric: 'Geometric',
      Incremental: 'Incremental',
      Exponential: 'Exponential',
    };

    if (tsMethodMap[methodName]) {
      const data = await post('time_series/arthemitic', {
        year: 2025,
        villages_props,
        subdistrict_props,
        totalPopulation_props: null,
      });
      // Response shape: { Arithmetic: {2011: N, 2025: N}, ... }
      const series = data?.[methodName] ?? data?.Arithmetic;
      const v = series?.[2025] ?? series?.['2025'];
      return v != null ? Number(v) : null;
    }

    if (methodName === 'Demographic') {
      const data = await post('time_series/demographic', {
        year: 2025,
        villages_props,
        subdistrict_props,
        totalPopulation_props: null,
        demographic: {},
      });
      const inner = data?.demographic ?? data;
      const v = inner?.[2025] ?? inner?.['2025'];
      return v != null ? Number(v) : null;
    }

    if (methodName === 'Cohort Total') {
      const data = await post('cohort', {
        year: 2025,
        villages_props,
        subdistrict_props,
        district_props,
        state_props,
      });
      const entries: any[] = data?.cohort ?? [];
      const entry2025 = entries.find((e: any) => Number(e.year) === 2025);
      const t = entry2025?.data?.total?.total;
      return t != null ? Number(t) : null;
    }

    return null;
  } catch {
    return null;
  }
}
