// utils/services.ts

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  authToken?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
): Promise<{ status: number; message: T }> {
  const { headers = {}, params, body, authToken } = options;

  const url = `${BASE_URL}${endpoint}${buildQuery(params)}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const responseData = (await res.json()) as T;
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

