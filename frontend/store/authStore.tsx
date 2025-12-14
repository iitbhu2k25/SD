"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthState } from "@/interface/authentication";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isVerified: false,

      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setVerification: (verified) => set({ isVerified: verified }),


      clearAuth: () =>
        set({ user: null, accessToken: null, isVerified: false }),


      logout: () => {
        set({ user: null, accessToken: null, isVerified: false });
        
      },
    }),
    {
      name: "auth-storage",
    }
  )
);
