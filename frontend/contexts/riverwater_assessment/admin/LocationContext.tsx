"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useApp } from "@/contexts/riverwater_assessment/admin/AppContext";

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
  
  selectedSeason: "premonsoon" | "monsoon" | "postmonsoon";
  setSelectedSeason: (season: "premonsoon" | "monsoon" | "postmonsoon") => void;
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
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [areaConfirmed, setAreaConfirmed] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<
    "premonsoon" | "monsoon" | "postmonsoon"
  >("premonsoon");

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

  // Register the reset function with parent context
  useEffect(() => {
    locationActions.current.resetSelections = resetSelections;
  }, []);

  // Fetch states on component mount
  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/django/state", {
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
        const response = await fetch("/django/district/", {
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
        const response = await fetch("/django/subdistrict/", {
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

  // MODIFIED: Auto-fetch water quality data - PARALLEL EXECUTION (Option A)
  useEffect(() => {
    if (areaConfirmed && selectedSubDistricts.length > 0) {
      console.log(
        "Area confirmed and subdistricts selected, fetching water quality data..."
      );
      
      // EXISTING PATH: Single season fetch for current charts
      fetchWaterQualityData(selectedSubDistricts, selectedSeason);
      
      // NEW PATH: All seasons fetch for comparison table
      fetchAllSeasonsWaterQualityData(selectedSubDistricts);
    } else {
      console.log("Conditions not met, clearing water quality data...");
      clearWaterQualityData();
      clearAllSeasonalData();
    }
  }, [selectedSubDistricts, areaConfirmed, selectedSeason]);

  // EXISTING: Single season fetch function (unchanged)
  const fetchWaterQualityData = async (
    subDistrictCodes: number[],
    season: string = "premonsoon"
  ): Promise<void> => {
    console.log("fetchWaterQualityData called with:", subDistrictCodes);

    if (subDistrictCodes.length === 0) {
      console.log("No sub-district codes provided, clearing data");
      clearWaterQualityData();
      return;
    }

    setIsLoadingWaterQuality(true);
    setWaterQualityError(null);

    const requestBody = {
      Sub_District_Code: subDistrictCodes,
    };

    console.log("Making water quality API request:", requestBody);

    try {
      const response = await fetch(
        `/django/rwm/shapefile/subdistbased/${season}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log("Water quality API response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: WaterQualityGeoJSON = await response.json();
      console.log(
        "Water quality data received:",
        data.features?.length || 0,
        "features"
      );

      // Store the raw GeoJSON data as-is
      setWaterQualityData(data);

      if (!data.features || data.features.length === 0) {
        setWaterQualityError(
          "No water quality data found for selected sub-districts."
        );
      }
    } catch (error: any) {
      console.log("Water quality API error:", error);
      setWaterQualityError(
        `Failed to fetch water quality data: ${error.message}`
      );
      setWaterQualityData(null);
    } finally {
      setIsLoadingWaterQuality(false);
    }
  };

  // NEW: Utility function to normalize sampling names
  const normalizeSamplingName = (originalSampling: string): string => {
    let normalized = originalSampling
      // Remove patterns like "(US)", "(DS)", "(Drain)"
      .replace(/\s*\((US|DS|Drain)\)\s*$/i, "")
      // Remove patterns like "Drain (US)" or "Drain (DS)"
      .replace(/\s*Drain\s*\((US|DS)\)\s*$/i, "")
      // Remove standalone words: "Drain", "Upstream", "Downstream"
      .replace(/\s*(Drain|Upstream|Downstream)\s*$/i, "")
      .trim();
    
    return normalized;
  };

  // NEW: Fetch all seasons in parallel
  const fetchAllSeasonsWaterQualityData = async (
    subDistrictCodes: number[]
  ): Promise<void> => {
    console.log("fetchAllSeasonsWaterQualityData called with:", subDistrictCodes);

    if (subDistrictCodes.length === 0) {
      console.log("No sub-district codes provided, clearing seasonal data");
      clearAllSeasonalData();
      return;
    }

    setIsLoadingAllSeasons(true);
    setAllSeasonsError(null);

    const requestBody = {
      Sub_District_Code: subDistrictCodes,
    };

    const seasons: Array<"premonsoon" | "monsoon" | "postmonsoon"> = [
      "premonsoon",
      "monsoon",
      // "postmonsoon",
    ];

    console.log("Making parallel seasonal API requests for:", seasons);

    try {
      // Parallel API calls using Promise.all
      const responses = await Promise.all(
        seasons.map((season) =>
          fetch(
            `/django/rwm/shapefile/subdistbased/${season}/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
            }
          )
        )
      );

      console.log("All seasonal API responses received");

      // Check if all responses are OK
      const failedResponses = responses.filter((r) => !r.ok);
      if (failedResponses.length > 0) {
        throw new Error(
          `Failed to fetch ${failedResponses.length} season(s): ${failedResponses
            .map((r) => r.status)
            .join(", ")}`
        );
      }

      // Parse all responses
      const dataPromises = responses.map((response) => response.json());
      const allSeasonalData = await Promise.all(dataPromises);

      // Process and normalize sampling names for each season
      const processedSeasonalData: {
        premonsoon: WaterQualityGeoJSON | null;
        monsoon: WaterQualityGeoJSON | null;
        postmonsoon: WaterQualityGeoJSON | null;
      } = {
        premonsoon: null,
        monsoon: null,
        postmonsoon: null,
      };

      seasons.forEach((season, index) => {
        const seasonData = allSeasonalData[index];
        
        if (seasonData && seasonData.features) {
          // Normalize sampling names for each feature
          const processedFeatures = seasonData.features.map((feature: WaterQualityFeature) => {
            const originalSampling = feature.properties.Sampling || "";
            const normalizedSampling = normalizeSamplingName(originalSampling);
            
            return {
              ...feature,
              properties: {
                ...feature.properties,
                NormalizedSampling: normalizedSampling,
              },
            };
          });

          processedSeasonalData[season] = {
            ...seasonData,
            features: processedFeatures,
          };

          console.log(
            `${season} data processed:`,
            processedFeatures.length,
            "features"
          );
        } else {
          console.warn(`No features found for ${season}`);
          processedSeasonalData[season] = null;
        }
      });

      // Store all processed seasonal data
      setSeasonalWaterQualityData(processedSeasonalData);

      // Check if any season has no data
      const emptySeasonsCount = seasons.filter(
        (season) =>
          !processedSeasonalData[season] ||
          !processedSeasonalData[season]?.features ||
          processedSeasonalData[season]?.features.length === 0
      ).length;

      if (emptySeasonsCount === seasons.length) {
        setAllSeasonsError(
          "No water quality data found for any season in selected sub-districts."
        );
      } else if (emptySeasonsCount > 0) {
        console.warn(
          `${emptySeasonsCount} season(s) have no data for selected sub-districts`
        );
      }
    } catch (error: any) {
      console.log("Seasonal water quality API error:", error);
      setAllSeasonsError(
        `Failed to fetch seasonal water quality data: ${error.message}`
      );
      setSeasonalWaterQualityData({
        premonsoon: null,
        monsoon: null,
        postmonsoon: null,
      });
    } finally {
      setIsLoadingAllSeasons(false);
    }
  };

  // EXISTING: WQI fetch function (unchanged)
  const fetchWaterQualityWithWQI = async (
    subDistrictCodes: number[],
    season: string = selectedSeason
  ): Promise<void> => {
    console.log("fetchWaterQualityWithWQI called with:", subDistrictCodes, season);
    
    if (subDistrictCodes.length === 0) {
      console.log("No sub-district codes provided, clearing data");
      clearWaterQualityData();
      return;
    }

    setIsLoadingWaterQuality(true);
    setWaterQualityError(null);

    const requestBody = {
      Sub_District_Code: subDistrictCodes
    };

    console.log("Making WQI API request:", requestBody);

    try {
      const response = await fetch(
        `/django/rwm/water_quality/subdistbased/${season}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log("WQI API response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const wqiData = await response.json();
      console.log("WQI data received:", wqiData.length, "points");

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
      console.log("WQI API error:", error);
      setWaterQualityError(`Failed to fetch WQI data: ${error.message}`);
      setWaterQualityData(null);
    } finally {
      setIsLoadingWaterQuality(false);
    }
  };

  // EXISTING: Clear single season data
  const clearWaterQualityData = (): void => {
    console.log("Clearing water quality data");
    setWaterQualityData(null);
    setWaterQualityError(null);
  };

  // NEW: Clear all seasonal data
  const clearAllSeasonalData = (): void => {
    console.log("Clearing all seasonal data");
    setSeasonalWaterQualityData({
      premonsoon: null,
      monsoon: null,
      postmonsoon: null,
    });
    setAllSeasonsError(null);
  };

  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectionsLocked(false);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearAllSeasonalData();
  };

  const handleAreaConfirm = () => {
    if (selectedSubDistricts.length > 0) setAreaConfirmed(true);
  };

  const lockSelections = () => setSelectionsLocked(true);

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
