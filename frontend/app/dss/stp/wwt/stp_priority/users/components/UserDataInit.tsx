"use client";

import React, { useEffect } from "react";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserFlowSync } from "../hooks/useUserFlowSync";

interface UserDataInitProps {
  children: React.ReactNode;
}

export default function UserDataInit({ children }: UserDataInitProps) {
  const initializeRiver = useUserRiverStore((state) => state.initialize);
  const initializeCategories = useUserCategoryStore((state) => state.initialize);
  useUserFlowSync();

  useEffect(() => {
    void initializeRiver();
    void initializeCategories();
  }, [initializeCategories, initializeRiver]);

  return <>{children}</>;
}
