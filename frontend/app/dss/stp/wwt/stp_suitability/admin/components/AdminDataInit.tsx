"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

export default function AdminDataInit({ children }: { children: ReactNode }) {
  const initializeLocation = useAdminLocationStore((state) => state.initialize);
  const initializeCategories = useAdminCategoryStore((state) => state.initialize);
  const syncLayersWithLocation = useAdminMapStore((state) => state.syncLayersWithLocation);

  useEffect(() => {
    void initializeLocation();
    void initializeCategories();
    syncLayersWithLocation();
  }, [initializeCategories, initializeLocation, syncLayersWithLocation]);

  return <>{children}</>;
}
