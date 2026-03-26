"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useApp } from "@/contexts/riverwater_assessment/admin/AppContext";

type SeasonType = "premonsoon" | "monsoon" | "postmonsoon";
const SEASONS: SeasonType[] = ["premonsoon", "monsoon", "postmonsoon"];
const DEFAULT_SEASON: SeasonType = "premonsoon";

// Define types for the location data
export interface State {
  id: string | number;
  name: string;
}

export interface District {
  id: string | number;
  name: string;
  stateId: string | number;
}

export interface SubDistrict {
  id: string | number;
  name: string;
  districtId: string | number;
  districtName: string;
}

// Define the exact structure from your API response
export interface WaterQualityFeature {
  id: string;
  type: "Feature";
  properties: {
    S_No_: number;
    Sub_Distri: string;
    Sub_Dist_1: string;
    District_C: number;
    Sampling: string;
    Location: string;
    STATUS: string | null;
    LATITUDE: number;
    LONGITUDE: number;
    pH: number;
    Temperatur: number;
    EC__S_cm_: number;
    TDS_mg_L_: number;
    TSS_mg_L_: number;
    TS_mg_L_: number;
    DO_mg_L_: number;
    Turbidity_: number;
    ORP: number;
    COD_mg_L_: number;
    BOD_mg_L_: number;
    Chloride_m: number;
    Nitrate_mg: number;
    Hardness_m: number;
    Faecal_Col: string;
    Total_Coli: string;
    Observatio: string | null;
    Sub_Dist_2: number;
    Stretch_ID: number;
    WQI?: number;
    WQI_Class?: string;
    NormalizedSampling?: string; // NEW: Added for normalized sampling names
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface WaterQualityGeoJSON {
  length: ReactNode;
  type: "FeatureCollection";
  features: WaterQualityFeature[];
}

export interface LocationContextType {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  selectedYear: "" | "2025";
  selectionsLocked: boolean;
  isLoading: boolean;
  error: string | null;
  areaConfirmed: boolean;

  // EXISTING: Single season water quality data
  waterQualityData: WaterQualityGeoJSON | null;
  isLoadingWaterQuality: boolean;
  waterQualityError: string | null;

  // NEW: Seasonal water quality data
  seasonalWaterQualityData: {
    premonsoon: WaterQualityGeoJSON | null;
    monsoon: WaterQualityGeoJSON | null;
    postmonsoon: WaterQualityGeoJSON | null;
  };
  isLoadingAllSeasons: boolean;
  allSeasonsError: string | null;

  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  handleAreaConfirm: () => void;
  returnToSelection: () => void;
  confirmSelections: () => boolean;
  lockSelections: () => void;
  resetSelections: () => void;
  fetchWaterQualityData: (
    subDistrictCodes: number[],
    season?: string
  ) => Promise<void>;
  fetchWaterQualityWithWQI: (
    subDistrictCodes: number[],
    season?: string
  ) => Promise<void>;
  clearWaterQualityData: () => void;
  
  // NEW: Seasonal comparison functions
  fetchAllSeasonsWaterQualityData: (subDistrictCodes: number[]) => Promise<void>;
  clearAllSeasonalData: () => void;
  
  selectedSeason: "premonsoon" | "monsoon" | "postmonsoon" | "";
  setSelectedSeason: (season: "premonsoon" | "monsoon" | "postmonsoon" | "") => void;
  setSelectedYear: (year: "" | "2025") => void;
}

interface LocationProviderProps {
  children: ReactNode;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  const { locationActions } = useApp();

  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<"" | "2025">("");
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [areaConfirmed, setAreaConfirmed] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<
    "premonsoon" | "monsoon" | "postmonsoon" | ""
  >("");

  // EXISTING: Single season water quality data state
  const [waterQualityData, setWaterQualityData] =
    useState<WaterQualityGeoJSON | null>(null);
  const [isLoadingWaterQuality, setIsLoadingWaterQuality] =
    useState<boolean>(false);
  const [waterQualityError, setWaterQualityError] = useState<string | null>(null);

  // NEW: Seasonal water quality data state
  const [seasonalWaterQualityData, setSeasonalWaterQualityData] = useState<{
    premonsoon: WaterQualityGeoJSON | null;
    monsoon: WaterQualityGeoJSON | null;
    postmonsoon: WaterQualityGeoJSON | null;
  }>({
    premonsoon: null,
    monsoon: null,
    postmonsoon: null,
  });
  const [isLoadingAllSeasons, setIsLoadingAllSeasons] = useState<boolean>(false);
  const [allSeasonsError, setAllSeasonsError] = useState<string | null>(null);

  // Request guards to prevent stale response writes and abort in-flight calls.
  const singleSeasonAbortRef = useRef<AbortController | null>(null);
  const allSeasonAbortRef = useRef<AbortController | null>(null);
  const singleSeasonRequestIdRef = useRef(0);
  const allSeasonRequestIdRef = useRef(0);

  // Register the reset function with parent context
  useEffect(() => {
    locationActions.current.resetSelections = resetSelections;
  }, []);

  // Cancel pending network requests on unmount.
  useEffect(() => {
    return () => {
      singleSeasonAbortRef.current?.abort();
      allSeasonAbortRef.current?.abort();
    };
  }, []);

  // Fetch states on component mount
  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/state`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const stateData: State[] =
          data.length > 0
            ? data.map((state: any) => ({
                id: state.state_code,
                name: state.state_name,
              }))
            : [];
        setStates(stateData);
        if (data.length === 0) setError("No states found.");
      } catch (error: any) {
        setError(`Failed to fetch states: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStates();
  }, []);

  // Fetch districts when state is selected
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      setSelectedDistricts([]);
      setSubDistricts([]);
      setSelectedSubDistricts([]);
      return;
    }
    const fetchDistricts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/district/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state_code: selectedState }),
        });
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const districtData: District[] = data.map((district: any) => ({
          id: district.district_code,
          name: district.district_name,
          stateId: selectedState,
        }));
        setDistricts(districtData.sort((a, b) => a.name.localeCompare(b.name)));
        if (data.length === 0)
          setError("No districts found for the selected state.");
      } catch (error: any) {
        setError(`Failed to fetch districts: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDistricts();
  }, [selectedState]);

  // Fetch sub-districts when districts are selected
  useEffect(() => {
    if (selectedDistricts.length === 0) {
      setSubDistricts([]);
      setSelectedSubDistricts([]);
      return;
    }
    const fetchSubDistricts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/subdistrict/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ district_code: selectedDistricts }),
        });
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const districtMap = new Map(
          districts.map((district) => [district.id.toString(), district.name])
        );
        const subDistrictData: SubDistrict[] = data.map((subDistrict: any) => ({
          id: subDistrict.subdistrict_code,
          name: subDistrict.subdistrict_name,
          districtId: parseInt(subDistrict.district_code),
          districtName:
            districtMap.get(subDistrict.district_code.toString()) ||
            "Unknown District",
        }));
        setSubDistricts(
          subDistrictData.sort((a, b) => {
            const dcmp = a.districtName.localeCompare(b.districtName);
            return dcmp !== 0 ? dcmp : a.name.localeCompare(b.name);
          })
        );
        if (data.length === 0)
          setError("No sub-districts found for the selected districts.");
      } catch (error: any) {
        setError(`Failed to fetch sub-districts: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubDistricts();
  }, [selectedDistricts, districts]);

  // Single-season data drives map/chart point rendering.
  useEffect(() => {
    if (areaConfirmed && selectedSubDistricts.length > 0) {
      const seasonToFetch = selectedSeason || DEFAULT_SEASON;
      fetchWaterQualityData(selectedSubDistricts, seasonToFetch);
    } else {
      clearWaterQualityData();
    }
  }, [selectedSubDistricts, areaConfirmed, selectedSeason]);

  // Multi-season data drives the comparison table only.
  // Intentionally decoupled from selectedSeason to avoid redundant refetching.
  useEffect(() => {
    if (areaConfirmed && selectedSubDistricts.length > 0) {
      fetchAllSeasonsWaterQualityData(selectedSubDistricts);
    } else {
      clearAllSeasonalData();
    }
  }, [selectedSubDistricts, areaConfirmed]);

  const isAbortError = (error: unknown): boolean => {
    return error instanceof Error && error.name === "AbortError";
  };

  // Utility function to normalize sampling names for cross-season alignment.
  const normalizeSamplingName = (originalSampling: string): string => {
    return originalSampling
      .replace(/\s*\((US|DS|Drain)\)\s*$/i, "")
      .replace(/\s*Drain\s*\((US|DS)\)\s*$/i, "")
      .replace(/\s*(Drain|Upstream|Downstream)\s*$/i, "")
      .trim();
  };

  const fetchSeasonWaterQualityGeoJson = async (
    subDistrictCodes: number[],
    season: SeasonType,
    signal?: AbortSignal
  ): Promise<WaterQualityGeoJSON> => {
    const requestBody = { Sub_District_Code: subDistrictCodes };
    const response = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/rwm/shapefile/subdistbased/${season}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
  };

  const withNormalizedSampling = (
    seasonData: WaterQualityGeoJSON | null
  ): WaterQualityGeoJSON | null => {
    if (!seasonData || !seasonData.features) return null;

    return {
      ...seasonData,
      features: seasonData.features.map((feature: WaterQualityFeature) => {
        const originalSampling = feature.properties.Sampling || "";
        const normalizedSampling = normalizeSamplingName(originalSampling);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            NormalizedSampling: normalizedSampling,
          },
        };
      }),
    };
  };

  // Single-season fetch used by map/point rendering.
  const fetchWaterQualityData = async (
    subDistrictCodes: number[],
    season: string = DEFAULT_SEASON
  ): Promise<void> => {
    if (subDistrictCodes.length === 0) {
      clearWaterQualityData();
      return;
    }

    const normalizedSeason: SeasonType = SEASONS.includes(season as SeasonType)
      ? (season as SeasonType)
      : DEFAULT_SEASON;

    singleSeasonAbortRef.current?.abort();
    const controller = new AbortController();
    singleSeasonAbortRef.current = controller;
    const requestId = ++singleSeasonRequestIdRef.current;

    setIsLoadingWaterQuality(true);
    setWaterQualityError(null);

    try {
      const data = await fetchSeasonWaterQualityGeoJson(
        subDistrictCodes,
        normalizedSeason,
        controller.signal
      );

      if (requestId !== singleSeasonRequestIdRef.current) return;

      setWaterQualityData(data);
      if (!data.features || data.features.length === 0) {
        setWaterQualityError(
          "No water quality data found for selected sub-districts."
        );
      }
    } catch (error: any) {
      if (isAbortError(error)) return;
      if (requestId !== singleSeasonRequestIdRef.current) return;

      setWaterQualityError(
        `Failed to fetch water quality data: ${error.message}`
      );
      setWaterQualityData(null);
    } finally {
      if (requestId === singleSeasonRequestIdRef.current) {
        setIsLoadingWaterQuality(false);
      }
    }
  };

  // All-seasons fetch used by comparison table.
  const fetchAllSeasonsWaterQualityData = async (
    subDistrictCodes: number[]
  ): Promise<void> => {
    if (subDistrictCodes.length === 0) {
      clearAllSeasonalData();
      return;
    }

    allSeasonAbortRef.current?.abort();
    const controller = new AbortController();
    allSeasonAbortRef.current = controller;
    const requestId = ++allSeasonRequestIdRef.current;

    setIsLoadingAllSeasons(true);
    setAllSeasonsError(null);

    try {
      const allSeasonalData = await Promise.all(
        SEASONS.map((season) =>
          fetchSeasonWaterQualityGeoJson(
            subDistrictCodes,
            season,
            controller.signal
          )
        )
      );

      if (requestId !== allSeasonRequestIdRef.current) return;

      const processedSeasonalData: {
        premonsoon: WaterQualityGeoJSON | null;
        monsoon: WaterQualityGeoJSON | null;
        postmonsoon: WaterQualityGeoJSON | null;
      } = {
        premonsoon: withNormalizedSampling(allSeasonalData[0]),
        monsoon: withNormalizedSampling(allSeasonalData[1]),
        postmonsoon: withNormalizedSampling(allSeasonalData[2]),
      };

      setSeasonalWaterQualityData(processedSeasonalData);

      const emptySeasonsCount = SEASONS.filter((season) => {
        const seasonData = processedSeasonalData[season];
        return !seasonData || !seasonData.features || seasonData.features.length === 0;
      }).length;

      if (emptySeasonsCount === SEASONS.length) {
        setAllSeasonsError(
          "No water quality data found for any season in selected sub-districts."
        );
      }
    } catch (error: any) {
      if (isAbortError(error)) return;
      if (requestId !== allSeasonRequestIdRef.current) return;

      setAllSeasonsError(
        `Failed to fetch seasonal water quality data: ${error.message}`
      );
      setSeasonalWaterQualityData({
        premonsoon: null,
        monsoon: null,
        postmonsoon: null,
      });
    } finally {
      if (requestId === allSeasonRequestIdRef.current) {
        setIsLoadingAllSeasons(false);
      }
    }
  };

  // EXISTING: WQI fetch function (unchanged)
  const fetchWaterQualityWithWQI = async (
    subDistrictCodes: number[],
    season: string = selectedSeason
  ): Promise<void> => {
    // console.log("fetchWaterQualityWithWQI called with:", subDistrictCodes, season);
    
    if (subDistrictCodes.length === 0) {
      // console.log("No sub-district codes provided, clearing data");
      clearWaterQualityData();
      return;
    }

    setIsLoadingWaterQuality(true);
    setWaterQualityError(null);
    const normalizedSeason: SeasonType = SEASONS.includes(season as SeasonType)
      ? (season as SeasonType)
      : DEFAULT_SEASON;

    const requestBody = {
      Sub_District_Code: subDistrictCodes
    };

    // console.log("Making WQI API request:", requestBody);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_DJANGO_URL}/rwm/water_quality/subdistbased/${normalizedSeason}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      // console.log("WQI API response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const wqiData = await response.json();
      // console.log("WQI data received:", wqiData.length, "points");

      // Convert WQI JSON array to GeoJSON format
      const geoJsonData: WaterQualityGeoJSON = {
        type: "FeatureCollection",
        features: wqiData.map((point: any) => ({
          id: `wqi_${point.s_no}`,
          type: "Feature",
          properties: {
            S_No_: point.s_no,
            Sub_Distri: point.Sub_District,
            Sub_Dist_1: point.Sub_District_Code,
            District_C: point.District_Code,
            Sampling: point.sampling,
            Location: point.location,
            STATUS: point.status,
            LATITUDE: point.latitude,
            LONGITUDE: point.longitude,
            pH: point.ph,
            Temperatur: point.temperature,
            EC__S_cm_: point.ec,
            TDS_mg_L_: point.tds,
            TSS_mg_L_: point.tss,
            TS_mg_L_: point.ts,
            DO_mg_L_: point.do,
            Turbidity_: point.turbidity,
            ORP: point.orp,
            COD_mg_L_: point.cod,
            BOD_mg_L_: point.bod,
            Chloride_m: point.chloride,
            Nitrate_mg: point.nitrate,
            Hardness_m: point.hardness,
            Faecal_Col: point.faecal_coliform,
            Total_Coli: point.total_coliform,
            Observatio: null,
            Sub_Dist_2: point.Sub_District_Code,
            Stretch_ID: point.Stretch_ID,
            WQI: point.WQI,
            WQI_Class: point.WQI_Class,
          },
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude]
          }
        })),
        length: wqiData.length
      };

      setWaterQualityData(geoJsonData);

      if (wqiData.length === 0) {
        setWaterQualityError("No WQI data found for selected sub-districts.");
      }
    } catch (error: any) {
      // console.log("WQI API error:", error);
      setWaterQualityError(`Failed to fetch WQI data: ${error.message}`);
      setWaterQualityData(null);
    } finally {
      setIsLoadingWaterQuality(false);
    }
  };

  // EXISTING: Clear single season data
  const clearWaterQualityData = (): void => {
    singleSeasonAbortRef.current?.abort();
    singleSeasonAbortRef.current = null;
    singleSeasonRequestIdRef.current += 1;
    setWaterQualityData(null);
    setWaterQualityError(null);
    setIsLoadingWaterQuality(false);
  };

  // NEW: Clear all seasonal data
  const clearAllSeasonalData = (): void => {
    allSeasonAbortRef.current?.abort();
    allSeasonAbortRef.current = null;
    allSeasonRequestIdRef.current += 1;
    setSeasonalWaterQualityData({
      premonsoon: null,
      monsoon: null,
      postmonsoon: null,
    });
    setAllSeasonsError(null);
    setIsLoadingAllSeasons(false);
  };

  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedYear("");
    setSelectionsLocked(false);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearAllSeasonalData();
  };

  const handleAreaConfirm = () => {
    if (selectedSubDistricts.length > 0) setAreaConfirmed(true);
  };

  const lockSelections = () => setSelectionsLocked(true);

  const returnToSelection = (): void => {
    setSelectionsLocked(false);
    setAreaConfirmed(false);
  };

  const confirmSelections = (): boolean => {
    if (
      selectedState !== null &&
      selectedDistricts.length > 0 &&
      !selectionsLocked
    ) {
      handleAreaConfirm();
      lockSelections();
      return true;
    }
    return false;
  };

  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedYear("");
    setSelectionsLocked(false);
    setError(null);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearAllSeasonalData();
  };

  const updateSelectedDistricts = (districtIds: number[]): void => {
    setSelectedDistricts(districtIds);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearAllSeasonalData();
  };

  const updateSelectedSubDistricts = (subDistrictIds: number[]): void => {
    setSelectedSubDistricts(subDistrictIds);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearAllSeasonalData();
  };

  const contextValue: LocationContextType = {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedYear,
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed,
    
    // EXISTING: Single season data
    waterQualityData,
    isLoadingWaterQuality,
    waterQualityError,
    
    // NEW: Seasonal data
    seasonalWaterQualityData,
    isLoadingAllSeasons,
    allSeasonsError,
    
    handleStateChange,
    setSelectedDistricts: updateSelectedDistricts,
    setSelectedSubDistricts: updateSelectedSubDistricts,
    handleAreaConfirm,
    returnToSelection,
    confirmSelections,
    lockSelections,
    resetSelections,
    fetchWaterQualityData,
    clearWaterQualityData,
    fetchWaterQualityWithWQI,
    
    // NEW: Seasonal functions
    fetchAllSeasonsWaterQualityData,
    clearAllSeasonalData,
    
    selectedSeason,
    setSelectedSeason,
    setSelectedYear,
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
