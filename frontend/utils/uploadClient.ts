import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import { performLogout } from "@/utils/logout";
import { toast } from "react-toastify";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const TOKEN_URL = process.env.NEXT_PUBLIC_TOKEN_URL;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    const res = await fetch(`${TOKEN_URL}`, {
      method: "POST",
      credentials: "include",
    });

    if (res.status >= 400) {
      toast.error("All Sessions expired. Please login again.");
      await performLogout();
      return null;
    }

    const data = await res.json();
    useAuthStore.getState().setAccessToken(data);
    return data.access_token as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

export const uploadClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  withCredentials: true,
});

// Request interceptor — attach token
uploadClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 + token refresh
uploadClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only retry once, and only on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();

      if (!newToken) {
        // Logout already handled inside refreshAccessToken
        return Promise.reject(error);
      }

      // Patch the failed request with the new token and retry
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return uploadClient(originalRequest);
    }

    return Promise.reject(error);
  },
);