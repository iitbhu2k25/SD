import axios, { AxiosProgressEvent, AxiosRequestConfig, AxiosResponse, ResponseType } from "axios";
import { useAuthStore } from "@/store/authStore";
import { performLogout } from "@/utils/logout";
import { toast } from "react-toastify";

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  body?: any;
  authToken?: string;
  responseType?: "json" | "blob" | "text";
  onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
const TOKEN_URL = process.env.NEXT_PUBLIC_TOKEN_URL;

function extractMessage(data: any): string {
  
  if (!data) return "Something went wrong";
  if (typeof data === "string") return data;
  
  if ((data?.detail)) {
    return data.detail
  }
  if (typeof data?.detail === "string") return data.detail;

  return data?.message ?? data?.error ?? "Something went wrong";
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: any,
  ) {
    super(extractMessage(data));
    this.name = "ApiError";
  }
}

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

async function callBackend(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {},
): Promise<AxiosResponse> {
  const { headers = {}, params, body, authToken, responseType,onDownloadProgress } = options;

  const token = authToken ?? useAuthStore.getState().accessToken;
  const isFormData = body instanceof FormData;

  const axiosResponseType: ResponseType =
    responseType === "blob" ? "blob" :
    responseType === "text" ? "text" : "json";

  const config: AxiosRequestConfig = {
    method,
    url: endpoint,
    params,
    withCredentials: true,
    responseType: axiosResponseType,
    onDownloadProgress,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : body ? { "Content-Type": "application/json" } : {}),
      ...(isFormData ? {} : headers),
    },
    ...(body ? { data: isFormData ? body : body } : {}), 
  };

  return axiosInstance.request(config);
}

async function refreshAccessToken(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const res = await axios.post(`${TOKEN_URL}`, null, {
        withCredentials: true,
      });
      useAuthStore.getState().setAccessToken(res.data);
      return res.data.access_token;
    } catch (err) {
      toast.error("All Sessions expired. Please login again.");
      await performLogout();
      return "";
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

export async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {},
  retry = true,
): Promise<{ status: number; message: T | null }> {
  try {
    const res = await callBackend(method, endpoint, options);
    const data = res.status === 204 ? null : (res.data as T);
    return { status: res.status, message: data };

  } catch (error: any) {
  
    if (axios.isAxiosError(error) && error.response?.status === 401 && retry) {
      const newToken = await refreshAccessToken();

      try {
        const retryRes = await callBackend(method, endpoint, {
          ...options,
          authToken: newToken,
        });
        const data = retryRes.status === 204 ? null : (retryRes.data as T);
        return { status: retryRes.status, message: data };

      } catch (retryError: any) {
        if (axios.isAxiosError(retryError) && retryError.response) {
          throw new ApiError(retryError.response.status, retryError.response.data);
        }
        throw retryError;
      }
    }

    if (axios.isAxiosError(error) && error.response) {
      throw new ApiError(error.response.status, error.response.data);
    }

    throw error;
  }
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