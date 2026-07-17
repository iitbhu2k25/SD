// All backend communication for the varuna_simulation module lives here.
// Components, hooks, and stores must not call fetch directly.

import { VARUNA_API } from '../utils/constants';
import type {
  // ChatResponse, // chatbot disabled for now
  ScenarioOut,
  ScenarioSummary,
  SimulateResponse,
  SnapshotResponse,
  VarunaScenarioParams,
} from '../types/varunaSim.types';

interface ScenarioListResponse {
  scenarios: ScenarioSummary[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${VARUNA_API}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status} — ${path}`,
    );
  }

  return data as T;
}

export async function fetchSnapshot(params: VarunaScenarioParams): Promise<SnapshotResponse> {
  return request<SnapshotResponse>('/snapshot', {
    method: 'POST',
    body: JSON.stringify({ params }),
  });
}

export async function fetchSimulation(
  params: VarunaScenarioParams,
  strategies: string[],
  years: number,
): Promise<SimulateResponse> {
  return request<SimulateResponse>('/simulate', {
    method: 'POST',
    body: JSON.stringify({ params, strategies, years }),
  });
}

export async function saveScenario(
  name: string,
  params: VarunaScenarioParams,
  strategies: string[],
): Promise<ScenarioOut> {
  return request<ScenarioOut>('/scenarios', {
    method: 'POST',
    body: JSON.stringify({ name, params, strategies }),
  });
}

export async function listScenarios(): Promise<ScenarioListResponse> {
  return request<ScenarioListResponse>('/scenarios');
}

export async function getScenario(id: number): Promise<ScenarioOut> {
  return request<ScenarioOut>(`/scenarios/${id}`);
}

export async function deleteScenario(id: number): Promise<{ status: string; id: number }> {
  return request(`/scenarios/${id}`, { method: 'DELETE' });
}

export async function downloadReportPdf(id: number, filenameHint: string): Promise<void> {
  const response = await fetch(`${VARUNA_API}/scenarios/${id}/report`, { credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status} — report`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `varuna_${filenameHint.replace(/\s+/g, '_')}_report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// chatbot disabled for now
// export async function askChatbot(
//   question: string,
//   baselineName = 'Default Baseline',
// ): Promise<ChatResponse> {
//   return request<ChatResponse>('/chat', {
//     method: 'POST',
//     body: JSON.stringify({
//       question,
//       scenario_context: { baseline_name: baselineName },
//     }),
//   });
// }

// export async function uploadChatDocument(file: File): Promise<{ filename: string; chunks_added: number }> {
//   const formData = new FormData();
//   formData.append('file', file);
//   const response = await fetch(`${VARUNA_API}/chat/upload`, {
//     method: 'POST',
//     credentials: 'include',
//     body: formData,
//   });
//   const data = await response.json().catch(() => ({}));
//   if (!response.ok) {
//     throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status}`);
//   }
//   return data;
// }
