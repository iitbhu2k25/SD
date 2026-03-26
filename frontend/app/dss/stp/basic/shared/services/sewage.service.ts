import { API_BASE_URL } from '../utils/constants';

export async function fetchSewage(params: Record<string, any>) {
  const res = await fetch(`${API_BASE_URL}/basic/sewage/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Sewage request failed');
  return res.json();
}