"use client";

import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { toast } from "react-toastify";

export const useLogout = () => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Step 1: Delete all local (non-HttpOnly) cookies
      if (typeof document !== "undefined") {
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
        });
      }

      console.log("All local cookies deleted.");

      // Step 2: Call backend to clear HttpOnly cookie
      const response = await api.post("/authentication/logout");

      if (response.status === 201) {
        toast.success("Logout successful");
      } else {
        toast.warn("Logout response not successful");
      }
    } catch (error) {
      console.log("Logout failed:", error);
      toast.error("Logout failed. Please try again.");
    } finally {
      // Step 3: Redirect to login page
      router.push("/");
    }
  };

  return { handleLogout };
};
