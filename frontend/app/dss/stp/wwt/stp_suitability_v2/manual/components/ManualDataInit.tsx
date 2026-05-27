"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useManualMapStore } from "../stores/manualMapStore";
import { useManualCategoryStore } from "../stores/manualCategoryStore";

export default function ManualDataInit({ children }: { children: ReactNode }) {
  const resetMapView = useManualMapStore((state) => state.resetMapView);
  const initializeCategories = useManualCategoryStore((state) => state.initialize);

  useEffect(() => {
    resetMapView();
    void initializeCategories();
  }, [resetMapView, initializeCategories]);

  return <>{children}</>;
}
