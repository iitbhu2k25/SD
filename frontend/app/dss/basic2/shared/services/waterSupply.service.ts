import { API_BASE_URL } from '../utils/constants';

export async function fetchWaterSupply(params: Record<string, any>) {
  const res = await fetch(`${API_BASE_URL}/basic/water-supply/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Water supply request failed');
  return res.json();
}