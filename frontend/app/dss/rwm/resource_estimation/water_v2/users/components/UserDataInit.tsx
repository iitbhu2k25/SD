"use client";

// Loads startup data (rivers) when basin mode mounts.
// Pure logic layer — no visible UI card.
import { useEffect } from "react";
import { useUserRiverStore } from "../stores/userRiverStore";

interface UserDataInitProps {
  children: React.ReactNode;
}

export default function UserDataInit({ children }: UserDataInitProps) {
  const initialize = useUserRiverStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}
