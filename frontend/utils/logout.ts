// src/utils/logout.ts
import { useAuthStore } from "@/store/authStore";

import { api } from "@/services/api";
export async function performLogout() {
  try {
    const logout_url=`/authentication/logout`
    const response = await api.post(logout_url);
    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name =
          eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
      });
    }
    useAuthStore.getState().logout();
  } catch (err) {
    console.error("Logout error", err);
  } finally {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }
}
