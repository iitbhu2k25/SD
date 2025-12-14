import { useAuthStore } from "@/store/authStore";
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
import { performLogout } from "@/utils/logout";
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  body?: any;
  authToken?: string;
  responseType?: "json" | "blob" | "text";
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

function buildQuery(params?: Record<string, string | number>): string {
  if (!params) return "";
  return `?${new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  )}`;
}

async function callBackend(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  const {
    headers = {},
    params,
    body,
    authToken,
    responseType = "json",
  } = options;

  const token = authToken ?? useAuthStore.getState().accessToken ?? "test-token";
  const url = `${BASE_URL}${endpoint}${buildQuery(params)}`;
  
  return fetch(url, {
    method,
    credentials: "include",
    headers: {
      ...(responseType === "json" && body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function refreshAccessToken(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    const res = await fetch(`/access_token`, {
      method: "POST",
      credentials: "include",
    });
    console.log("access failed", res)
    if (res.status >= 400) {
      console.log("logout")
      await performLogout();
      return
    }
    const data = await res.json();
    useAuthStore.getState().setAccessToken(data);
    return data.access_token;
  })();

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function parseResponse<T>(
  res: Response,
  responseType?: RequestOptions["responseType"]
): Promise<T | null> {
  if (res.status === 204) return null;

  if (responseType === "blob") return (await res.blob()) as T;
  if (responseType === "text") return (await res.text()) as T;

  return (await res.json()) as T;
}

export async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {},
  retry = true
): Promise<{ status: number; message: T | null }> {

  let res = await callBackend(method, endpoint, options);

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();

    res = await callBackend(method, endpoint, {
      ...options,
      authToken: newToken,
    });
  }

  const data = await parseResponse<T>(res, options.responseType);

  if (!res.ok) {
    throw {
      status: res.status,
      message: data,
    };
  }

  return {
    status: res.status,
    message: data,
  };
}

export const api = {
  get: <T>(url: string, options?: RequestOptions) =>
    request<T>("GET", url, options),

  post: <T>(url: string, options?: RequestOptions) =>
    request<T>("POST", url, options),

  put: <T>(url: string, options?: RequestOptions) =>
    request<T>("PUT", url, options),

  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>("DELETE", url, options),
};
