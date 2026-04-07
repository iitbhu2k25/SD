'use client';

import { useEffect, useState } from "react";

import { fetchDistricts, fetchStates, fetchSubDistricts } from "../services/location.service";
import { useGwaStore } from "../store/gwa.store";
import type { SelectOption } from "../types/common.types";
import type { DistrictOption, StateOption, SubDistrictOption } from "../types/location.types";

export function useAdminSelection() {
  const {
    adminSelection,
    confirmedLocation,
    setAdminState,
    setAdminDistricts,
    setAdminSubDistricts,
    resetAdminSelection,
    confirmAdminLocation,
  } = useGwaStore();

  const [states, setStates] = useState<StateOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrictOption[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubDistricts, setLoadingSubDistricts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingStates(true);
    fetchStates()
      .then(setStates)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingStates(false));
  }, []);

  useEffect(() => {
    if (!adminSelection.state) {
      setDistricts([]);
      setSubDistricts([]);
      return;
    }

    setLoadingDistricts(true);
    fetchDistricts(adminSelection.state.state_code)
      .then((items) => {
        setDistricts(items);
        setSubDistricts([]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingDistricts(false));
  }, [adminSelection.state]);

  useEffect(() => {
    if (adminSelection.districts.length === 0) {
      setSubDistricts([]);
      return;
    }

    setLoadingSubDistricts(true);
    fetchSubDistricts(adminSelection.districts.map((item) => item.district_code))
      .then(setSubDistricts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingSubDistricts(false));
  }, [adminSelection.districts]);

  const stateOptions: SelectOption[] = states.map((item) => ({
    value: item.state_code,
    label: item.state_name,
  }));

  const districtOptions: SelectOption[] = districts.map((item) => ({
    value: item.district_code,
    label: item.district_name,
  }));

  const subDistrictOptions: SelectOption[] = subDistricts.map((item) => ({
    value: item.subdistrict_code,
    label: item.subdistrict_name,
  }));

  return {
    adminSelection,
    confirmedLocation,
    loadingStates,
    loadingDistricts,
    loadingSubDistricts,
    error,
    stateOptions,
    districtOptions,
    subDistrictOptions,
    canConfirm: !!adminSelection.state && adminSelection.subDistricts.length > 0,
    handleStateChange: (codes: string[]) => {
      const selected = states.find((item) => item.state_code === codes[0]) ?? null;
      setAdminState(selected);
    },
    handleDistrictChange: (codes: string[]) => {
      setAdminDistricts(districts.filter((item) => codes.includes(item.district_code)));
    },
    handleSubDistrictChange: (codes: string[]) => {
      setAdminSubDistricts(subDistricts.filter((item) => codes.includes(item.subdistrict_code)));
    },
    handleReset: () => {
      resetAdminSelection();
      setDistricts([]);
      setSubDistricts([]);
      setError(null);
    },
    handleConfirm: () => {
      setError(null);
      confirmAdminLocation();
    },
  };
}
