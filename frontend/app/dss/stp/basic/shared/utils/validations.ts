import type { AdminLocationSelection } from '../types/location.types';

export function validateAdminLocation(sel: AdminLocationSelection): string | null {
  if (!sel.state) return 'Please select a state';
  return null;
}

export function isAdminLocationComplete(sel: AdminLocationSelection): boolean {
  return !!sel.state;
}

export function validateForecastYear(year: number): string | null {
  if (year < 2020 || year > 2100) return 'Forecast year must be between 2020 and 2100';
  return null;
}