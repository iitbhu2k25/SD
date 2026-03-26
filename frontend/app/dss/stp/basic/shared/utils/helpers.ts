import type { AdminLocationSelection } from '../types/location.types';

export function formatAdminLabel(selection: AdminLocationSelection): string {
  const parts: string[] = [];
  if (selection.state) parts.push(selection.state.state_name);
  if (selection.districts.length > 0) {
    parts.push(`${selection.districts.length} district(s)`);
  }
  if (selection.subDistricts.length > 0) {
    parts.push(`${selection.subDistricts.length} sub-district(s)`);
  }
  if (selection.villages.length > 0) {
    parts.push(`${selection.villages.length} village(s)`);
  }
  return parts.join(' › ') || 'No location selected';
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function formatPopulation(n: number): string {
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(2)} L`;
  return formatNumber(n);
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.append(k, String(v));
  });
  return q.toString();
}