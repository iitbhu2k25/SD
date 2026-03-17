'use client';

import { useRef, useMemo, useCallback } from 'react';
import { useBasicStore } from '../store/basic.store';
import type { MapLocationPayload } from '../types/location.types';

export function useMapSelection() {
  const adminSelection = useBasicStore((s) => s.adminSelection);
  const confirmedLocation = useBasicStore((s) => s.confirmedLocation);
  const mode = useBasicStore((s) => s.mode);
  const setMapPayload = useBasicStore((s) => s.setMapPayload);
  const mapPayload = useBasicStore((s) => s.mapPayload);

  // Freeze map props the moment location is confirmed.
  // After confirm we never change these again until user clicks "Change location".
  // This prevents the map from reloading on every store update.
  const frozenRef = useRef<{
    selectedState?: string;
    selectedDistricts: string[];
    selectedSubDistricts: string[];
    selectedVillages: string[];
  } | null>(null);

  // Live props (while user is still selecting)
  const liveProps = useMemo(() => ({
    selectedState: adminSelection.state?.state_code,
    selectedDistricts: adminSelection.districts.map((d) => d.district_code),
    selectedSubDistricts: adminSelection.subDistricts.map((s) => s.subdistrict_code),
    selectedVillages: adminSelection.villages.map((v) => v.village_code),
  }), [
    adminSelection.state?.state_code,
    // Use JSON strings so memo only breaks when values actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(adminSelection.districts.map((d) => d.district_code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(adminSelection.subDistricts.map((s) => s.subdistrict_code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(adminSelection.villages.map((v) => v.village_code)),
  ]);

  // When confirmed: freeze props once, reuse forever until cleared
  if (confirmedLocation && !frozenRef.current) {
    frozenRef.current = { ...liveProps };
  }
  // When cleared (user clicks Change): unfreeze
  if (!confirmedLocation && frozenRef.current) {
    frozenRef.current = null;
  }

  const mapProps = frozenRef.current ?? liveProps;

  // Stable callback — never recreated so map never sees a new function reference
  const handleMapLocationSelect = useCallback((payload: MapLocationPayload) => {
    setMapPayload(payload);
  }, [setMapPayload]);

  return { mode, mapProps, mapPayload, handleMapLocationSelect };
}