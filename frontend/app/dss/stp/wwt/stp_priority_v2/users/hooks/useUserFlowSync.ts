"use client";

import { useEffect, useRef } from "react";
import { useUserRiverStore } from "../stores/userRiverStore";

// This keeps the user workflow steps in sync after state changes.
export function useUserFlowSync() {
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const syncDisplayRasterForSelections = useUserRiverStore(
    (state) => state.syncDisplayRasterForSelections,
  );
  const lastRasterKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectionsLocked || selectedCatchments.length === 0) {
      lastRasterKeyRef.current = null;
      return;
    }

    const rasterKey = selectedCatchments.join(",");
    if (lastRasterKeyRef.current === rasterKey) {
      return;
    }

    lastRasterKeyRef.current = rasterKey;
    void syncDisplayRasterForSelections();
  }, [selectionsLocked, selectedCatchments, syncDisplayRasterForSelections]);
}
