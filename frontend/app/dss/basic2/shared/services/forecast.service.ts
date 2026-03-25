import { API_BASE_URL } from '../utils/constants';
import type { ConfirmedLocation } from '../types/location.types';

export async function runForecast(location: ConfirmedLocation, params: Record<string, any>) {
  const res = await fetch(`${API_BASE_URL}/basic/forecast/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, ...params }),
  });
  if (!res.ok) throw new Error('Forecast request failed');
  return res.json();
}