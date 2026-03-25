export const API_BASE_URL = `${process.env.NEXT_PUBLIC_FAST_URL}`;

export const ADMIN_API = {
  STATE: `${API_BASE_URL}/basic/state/`,
  DISTRICT: `${API_BASE_URL}/basic/district/`,
  SUBDISTRICT: `${API_BASE_URL}/basic/subdistrict/`,
  VILLAGE: `${API_BASE_URL}/basic/village/`,
} as const;

export const LOCATION_MODES = {
  ADMIN: 'admin',
  DRAIN: 'drain',
  INDIA_CATCHMENT: 'india_catchment',
} as const;

export const MODE_LABELS: Record<string, string> = {
  admin: 'Administrative',
  drain: 'Drain',
  india_catchment: 'India Catchment',
};

export const FORECAST_YEARS = [2025, 2030, 2035, 2040, 2045, 2050];

export const POPULATION_METHODS = [
  { value: 'arithmetic', label: 'Arithmetic Growth' },
  { value: 'geometric', label: 'Geometric Growth' },
  { value: 'exponential', label: 'Exponential Growth' },
  { value: 'logistic', label: 'Logistic Growth' },
  { value: 'decreasing_rate', label: 'Decreasing Rate of Growth' },
];