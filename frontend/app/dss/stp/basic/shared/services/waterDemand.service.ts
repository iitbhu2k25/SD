import { API_BASE_URL } from '../utils/constants';

// ── Domestic ──────────────────────────────────────────────────────────
export interface DomesticParams {
  forecast_data: Record<string, number>;
  per_capita_consumption: number;
  seasonal_multipliers?: Record<string, number>;
}
export async function fetchDomesticWaterDemand(params: DomesticParams) {
  const res = await fetch(`${API_BASE_URL}/basic/domestic_water_demand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Domestic demand error ${res.status}`);
  return res.json();
}

// ── Floating ──────────────────────────────────────────────────────────
export interface FloatingParams {
  floating_population_percentage: number;
  facility_type: 'provided' | 'notprovided' | 'onlypublic';
  domestic_forecast: Record<string, number>;
  seasonal_multipliers?: Record<string, number>;
}
export async function fetchFloatingWaterDemand(params: FloatingParams) {
  const res = await fetch(`${API_BASE_URL}/basic/floating_water_demand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Floating demand error ${res.status}`);
  return res.json();
}

// ── Institutional ─────────────────────────────────────────────────────
export interface InstitutionalParams {
  institutional_fields: Record<string, number>;
  domestic_forecast: Record<string, number>;
}
export async function fetchInstitutionalWaterDemand(params: InstitutionalParams) {
  const res = await fetch(`${API_BASE_URL}/basic/institutional_water_demand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Institutional demand error ${res.status}`);
  return res.json();
}

// ── Firefighting ──────────────────────────────────────────────────────
export interface FirefightingParams {
  firefighting_methods: Record<string, boolean>;
  domestic_forecast: Record<string, number>;
}
export async function fetchFirefightingWaterDemand(params: FirefightingParams) {
  const res = await fetch(`${API_BASE_URL}/basic/firefighting_water_demand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Firefighting demand error ${res.status}`);
  return res.json();
}