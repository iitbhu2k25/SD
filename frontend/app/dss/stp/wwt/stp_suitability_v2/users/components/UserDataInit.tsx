"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";

export default function UserDataInit({ children }: { children: ReactNode }) {
  const initializeRiverSystem = useUserRiverStore((state) => state.initialize);
  const initializeCategories = useUserCategoryStore((state) => state.initialize);
  const syncLayersWithRiverSystem = useUserMapStore(
    (state) => state.syncLayersWithRiverSystem,
  );

  useEffect(() => {
    void initializeRiverSystem();
    void initializeCategories();
    syncLayersWithRiverSystem();
  }, [initializeCategories, initializeRiverSystem, syncLayersWithRiverSystem]);

  return <>{children}</>;
}
