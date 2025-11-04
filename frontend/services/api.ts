import { useAuthStore } from "@/store/authStore";

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  body?: any;
  authToken?: string;
  responseType?: 'json' | 'blob' | 'text';
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function buildQuery(params?: Record<string, string | number>): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    query.append(key, value.toString());
  });
  return `?${query.toString()}`;
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ status: number; message: T | null }> {
  const { headers = {}, params, body, authToken, responseType = 'json' } = options;

  const token = authToken ?? useAuthStore.getState().accessToken;
  const url = `${BASE_URL}${endpoint}${buildQuery(params)}`;

  const res = await fetch(url, {
    method,
    headers: {
      ...(responseType === 'json' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    credentials: 'include',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) {
    return { status: res.status, message: null };
  }

  let responseData: any = null;
  try {
    if (responseType === 'blob') {
      responseData = await res.blob();
    } else if (responseType === 'text') {
      responseData = await res.text();
    } else {
      responseData = await res.json();
    }
  } catch {
    responseData = null;
  }

  if (!res.ok) {
    throw {
      status: res.status,
      statusText: res.statusText,
      message: responseData,
    };
  }

  return {
    status: res.status,
    message: responseData,
  };
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) => request<T>('GET', url, options),
  post: <T>(url: string, options?: RequestOptions) => request<T>('POST', url, options),
  put: <T>(url: string, options?: RequestOptions) => request<T>('PUT', url, options),
  delete: <T>(url: string, options?: RequestOptions) => request<T>('DELETE', url, options),
};
