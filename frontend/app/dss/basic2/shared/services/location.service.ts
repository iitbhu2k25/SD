import { ADMIN_API } from '../utils/constants';
import type { StateOption, DistrictOption, SubDistrictOption, VillageOption } from '../types/location.types';

// ── States: GET ──────────────────────────────────────────────────────────────
export async function fetchStates(): Promise<StateOption[]> {
  const res = await fetch(ADMIN_API.STATE);
  if (!res.ok) throw new Error('Failed to fetch states');
  const data = await res.json();
  const list: any[] = Array.isArray(data) ? data : data.results ?? [];
  return list
    .map((s) => ({
      state_code: String(s.state_code),
      state_name: String(s.state_name),
    }))
    .sort((a, b) => a.state_name.localeCompare(b.state_name));
}

// ── Districts: POST { state_code } ───────────────────────────────────────────
export async function fetchDistricts(stateCode: string): Promise<DistrictOption[]> {
  const res = await fetch(ADMIN_API.DISTRICT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state_code: stateCode }),
  });
  if (!res.ok) throw new Error('Failed to fetch districts');
  const data = await res.json();
  const list: any[] = Array.isArray(data) ? data : data.results ?? [];
  return list
    .map((d) => ({
      district_code: String(d.district_code),
      district_name: String(d.district_name),
      state_code: stateCode,
    }))
    .sort((a, b) => a.district_name.localeCompare(b.district_name));
}

// ── Sub-districts: POST { district_code: string[] } ──────────────────────────
export async function fetchSubDistricts(districtCodes: string[]): Promise<SubDistrictOption[]> {
  const res = await fetch(ADMIN_API.SUBDISTRICT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ district_code: districtCodes }),
  });
  if (!res.ok) throw new Error('Failed to fetch sub-districts');
  const data = await res.json();
  const list: any[] = Array.isArray(data) ? data : data.results ?? [];
  return list
    .map((s) => ({
      subdistrict_code: String(s.subdistrict_code),
      subdistrict_name: String(s.subdistrict_name),
      district_code: String(s.district_code),
    }))
    .sort((a, b) => a.subdistrict_name.localeCompare(b.subdistrict_name));
}

// ── Villages: POST { subdistrict_code: string[] } ────────────────────────────
export async function fetchVillages(subDistrictCodes: string[]): Promise<VillageOption[]> {
  const res = await fetch(ADMIN_API.VILLAGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdistrict_code: subDistrictCodes }),
  });
  if (!res.ok) throw new Error('Failed to fetch villages');
  const data = await res.json();
  const list: any[] = Array.isArray(data) ? data : data.results ?? [];
  return list
    .map((v) => ({
      village_code: String(v.village_code),
      village_name: String(v.village_name),
      subdistrict_code: String(v.subdistrict_code),
      population: v.population_2011 ?? 0,
    }))
    .sort((a, b) => a.village_name.localeCompare(b.village_name));
}