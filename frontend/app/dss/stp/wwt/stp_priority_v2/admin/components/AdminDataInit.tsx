"use client";

// This loads the basic data needed when the admin page opens.
// It gets location data and category data one time at the start.
import React, { useEffect } from "react";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";

interface AdminDataInitProps {
  children: React.ReactNode;
}

export default function AdminDataInit({ children }: AdminDataInitProps) {
  const initializeLocation = useAdminLocationStore((state) => state.initialize);
  const initializeCategories = useAdminCategoryStore((state) => state.initialize);

  useEffect(() => {
    void initializeLocation();
    void initializeCategories();
  }, [initializeCategories, initializeLocation]);

  return <>{children}</>;
}
