"use client";

// Loads startup data (states) when the admin mode mounts.
// This is a logic layer — it renders no visible UI card.
import { useEffect } from "react";
import { useAdminLocationStore } from "../stores/adminLocationStore";

interface AdminDataInitProps {
  children: React.ReactNode;
}

export default function AdminDataInit({ children }: AdminDataInitProps) {
  const initialize = useAdminLocationStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}
