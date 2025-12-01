"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { useStretchApp } from "./AppContext";

// Define types for stretch data
export interface Stretch {
  stretch_name: string;
  stretch_code: number;
  Stretch_ID: number;
  River_Code: number;
}

// GeoJSON types for map data
export interface GeoJSONFeature {
  id: string;
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// Water Quality Feature for stretch-based data
export interface StretchWaterQualityFeature {
  id: string;
  type: "Feature";
  properties: {
    S_No_: number;
    River_Name: string;
    Stretch_Name: string;
    Stretch_ID: number;
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
    WQI?: number;
    WQI_Class?: string;
     NormalizedSampling?: string; 
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface StretchWaterQualityGeoJSON {
  type: "FeatureCollection";
  features: StretchWaterQualityFeature[];
  length: number;
}

export interface StretchContextType {
  // Stretch data
  stretches: Stretch[];
  selectedStretches: string[];
  selectionsLocked: boolean;
  isLoading: boolean;
  error: string | null;
  areaConfirmed: boolean;

  // Map layer data
  basinData: GeoJSONFeatureCollection | null;
  riverData: GeoJSONFeatureCollection | null;
  riverBufferData: GeoJSONFeatureCollection | null;
  isLoadingMapLayers: boolean;
  mapLayersError: string | null;

  // Water Quality Data - Store as raw GeoJSON
  waterQualityData: StretchWaterQualityGeoJSON | null;
  isLoadingWaterQuality: boolean;
  waterQualityError: string | null;

  // Season selection
  selectedSeason: "premonsoon" | "monsoon" | "postmonsoon";

  // Actions
  setSelectedStretches: (stretchIds: string[]) => void;
  setSelectedSeason: (season: "premonsoon" | "monsoon" | "postmonsoon") => void;
  setSelectionsLocked: (locked: boolean) => void;
  handleAreaConfirm: () => void;
  confirmSelections: () => boolean;
  lockSelections: () => void;
  resetSelections: () => void;
  fetchStretches: () => Promise<void>;
  fetchMapLayers: () => Promise<void>;
  fetchWaterQualityData: (
    stretchIds: string[],
    season?: string
  ) => Promise<void>;
  clearWaterQualityData: () => void;
  stretchLinesData: StretchLineGeoJSON | null;
  isLoadingStretchLines: boolean;
  stretchLinesError: string | null;
  fetchStretchLines: (stretchIds: string[]) => Promise<void>;
  clearStretchLines: () => void;

  stretchBufferData: GeoJSONFeatureCollection | null;
isLoadingStretchBuffer: boolean;
stretchBufferError: string | null;
fetchStretchBuffer: (stretchIds: string[]) => Promise<void>;
clearStretchBuffer: () => void;

seasonalWaterQualityData: {
    premonsoon: StretchWaterQualityGeoJSON | null;
    monsoon: StretchWaterQualityGeoJSON | null;
    postmonsoon: StretchWaterQualityGeoJSON | null;
  };
  isLoadingAllSeasons: boolean;
  allSeasonsError: string | null;
  fetchAllSeasonsWaterQualityData: (stretchIds: string[]) => Promise<void>;
  clearAllSeasonalData: () => void;
}

export interface StretchLineFeature {
  id: string;
  type: "Feature";
  properties: {
    River_Code: number;
    InLine_FID: number;
    Stretch_ID: string; // Note: API returns string, not number
    Stretch_Na: string; // Note: property name is "Stretch_Na", not "stretch_name"
  };
  geometry: {
    type: "MultiLineString";
    coordinates: number[][][];
  };
}

export interface StretchLineGeoJSON {
  type: "FeatureCollection";
  features: StretchLineFeature[];
}

interface StretchProviderProps {
  children: ReactNode;
}

const StretchContext = createContext<StretchContextType | undefined>(undefined);

export const StretchProvider: React.FC<StretchProviderProps> = ({
  children,
}) => {
  const { stretchActions } = useStretchApp();

  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [selectedStretches, setSelectedStretches] = useState<string[]>([]);
  const [selectionsLocked, setSelectionsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaConfirmed, setAreaConfirmed] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<
    "premonsoon" | "monsoon" | "postmonsoon"
  >("premonsoon");

  // Map layer data states
  const [basinData, setBasinData] = useState<GeoJSONFeatureCollection | null>(
    null
  );
  const [riverData, setRiverData] = useState<GeoJSONFeatureCollection | null>(
    null
  );
  const [riverBufferData, setRiverBufferData] =
    useState<GeoJSONFeatureCollection | null>(null);
  const [isLoadingMapLayers, setIsLoadingMapLayers] = useState(false);
  const [mapLayersError, setMapLayersError] = useState<string | null>(null);
  const initializationRef = useRef(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Water Quality Data State - Store raw GeoJSON
  const [waterQualityData, setWaterQualityData] =
    useState<StretchWaterQualityGeoJSON | null>(null);
  const [isLoadingWaterQuality, setIsLoadingWaterQuality] = useState(false);
  const [waterQualityError, setWaterQualityError] = useState<string | null>(
    null
  );

  const [stretchLinesData, setStretchLinesData] =
    useState<StretchLineGeoJSON | null>(null);
  const [isLoadingStretchLines, setIsLoadingStretchLines] = useState(false);
  const [stretchLinesError, setStretchLinesError] = useState<string | null>(
    null
  );

  const [stretchBufferData, setStretchBufferData] = useState<GeoJSONFeatureCollection | null>(null);
const [isLoadingStretchBuffer, setIsLoadingStretchBuffer] = useState(false);
const [stretchBufferError, setStretchBufferError] = useState<string | null>(null);

const [seasonalWaterQualityData, setSeasonalWaterQualityData] = useState<{
  premonsoon: StretchWaterQualityGeoJSON | null;
  monsoon: StretchWaterQualityGeoJSON | null;
  postmonsoon: StretchWaterQualityGeoJSON | null;
}>({
  premonsoon: null,
  monsoon: null,
  postmonsoon: null,
});
const [isLoadingAllSeasons, setIsLoadingAllSeasons] = useState<boolean>(false);
const [allSeasonsError, setAllSeasonsError] = useState<string | null>(null);

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000";

  // Register the reset function with parent context
  useEffect(() => {
    stretchActions.current.resetSelections = resetSelections;
  }, []);

  // Load initial data on component mount (with double-call prevention)
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initializationRef.current || hasInitialized) {
      console.log("Already initialized or initializing, skipping...");
      return;
    }

    initializationRef.current = true;
    setHasInitialized(true);

    const loadInitialData = async () => {
      console.log("🚀 Loading initial data (single call)...");

      try {
        // Run all initial API calls in parallel
        await Promise.all([fetchStretches(), fetchMapLayers()]);
        console.log("✅ Initial data loading completed successfully");
      } catch (error) {
        console.error("❌ Error loading initial data:", error);
        // Reset initialization state on error so it can be retried
        setHasInitialized(false);
        initializationRef.current = false;
      }
    };

    loadInitialData();

    // Cleanup function
    return () => {
      console.log("LocationContext cleanup");
    };
  }, []); // Keep empty dependency array

  // Auto-fetch water quality data when area is confirmed and stretches are selected
  useEffect(() => {
    if (areaConfirmed && selectedStretches.length > 0) {
      console.log(
        "Area confirmed and stretches selected, fetching water quality data..."
      );
      fetchWaterQualityData(selectedStretches, selectedSeason);

      fetchAllSeasonsWaterQualityData(selectedStretches);
    } else {
      console.log("Conditions not met, clearing water quality data...");
      clearWaterQualityData();
       clearAllSeasonalData();
    }
  }, [selectedStretches, areaConfirmed, selectedSeason]);

  const fetchStretches = async (): Promise<void> => {
    console.log("🔄 fetchStretches called at:", new Date().toISOString());

    setIsLoading(true);
    setError(null);

    try {
      console.log("📡 Making stretches API request...");
      const response = await fetch(`/django/rwm/stretches/`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: Stretch[] = await response.json();
      console.log("✅ Fetched stretches:", data.length, "items");

      setStretches(data);

      if (data.length === 0) {
        setError("No stretches found.");
      }
    } catch (error: any) {
      console.error("❌ Error fetching stretches:", error);
      setError(`Failed to fetch stretches: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMapLayers = async (): Promise<void> => {
    setIsLoadingMapLayers(true);
    setMapLayersError(null);

    try {
      console.log("Fetching map layers...");

      // Fetch basin data
      const basinResponse = await fetch(`/django/basin`);
      if (!basinResponse.ok) {
        throw new Error(`Basin API error! Status: ${basinResponse.status}`);
      }
      const basinGeoJSON = await basinResponse.json();
      setBasinData(basinGeoJSON);
      console.log("Fetched basin data:", basinGeoJSON);

      // Fetch river data
      const riverResponse = await fetch(`/django/rwm/river/`);
      if (!riverResponse.ok) {
        throw new Error(`River API error! Status: ${riverResponse.status}`);
      }
      const riverGeoJSON = await riverResponse.json();
      setRiverData(riverGeoJSON);
      console.log("Fetched river data:", riverGeoJSON);

      // Fetch river buffer data
      const riverBufferResponse = await fetch(
        `/django/rwm/river_100m_buffer/stretchbased/`
      );
      if (!riverBufferResponse.ok) {
        throw new Error(
          `River buffer API error! Status: ${riverBufferResponse.status}`
        );
      }
      const riverBufferGeoJSON = await riverBufferResponse.json();
      setRiverBufferData(riverBufferGeoJSON);
      console.log("Fetched river buffer data:", riverBufferGeoJSON);
    } catch (error: any) {
      console.error("Error fetching map layers:", error);
      setMapLayersError(`Failed to fetch map layers: ${error.message}`);
    } finally {
      setIsLoadingMapLayers(false);
    }
  };

 const fetchWaterQualityData = async (
  stretchIds: string[],
  season: string = "premonsoon"
): Promise<void> => {
  console.log("fetchWaterQualityData called with:", stretchIds, season);

  if (stretchIds.length === 0) {
    console.log("No stretch IDs provided, clearing data");
    clearWaterQualityData();
    return;
  }

  setIsLoadingWaterQuality(true);
  setWaterQualityError(null);

  const requestBody = {
    Stretch_ID: stretchIds,
  };

  console.log("Making water quality API request:", requestBody);

  try {
    const response = await fetch(
      `/django/rwm/shapefile/stretchbased/${season}/`,
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

    // Your API already returns GeoJSON, so use it directly
    const data: StretchWaterQualityGeoJSON = await response.json();
    console.log("Water quality data received:", data.features?.length || 0, "features");

    // Store the raw GeoJSON data as-is (your API already returns correct format)
    setWaterQualityData(data);

    if (!data.features || data.features.length === 0) {
      setWaterQualityError("No water quality data found for selected stretches.");
    }
  } catch (error: any) {
    console.error("Water quality API error:", error);
    setWaterQualityError(`Failed to fetch water quality data: ${error.message}`);
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
  stretchIds: string[]
): Promise<void> => {
  console.log("fetchAllSeasonsWaterQualityData called with:", stretchIds);

  if (stretchIds.length === 0) {
    console.log("No stretch IDs provided, clearing seasonal data");
    clearAllSeasonalData();
    return;
  }

  setIsLoadingAllSeasons(true);
  setAllSeasonsError(null);

  const requestBody = {
    Stretch_ID: stretchIds,
  };

  // Temporarily exclude postmonsoon until data is available
  const seasons: Array<"premonsoon" | "monsoon"> = [
    "premonsoon",
    "monsoon",
  ];

  console.log("Making parallel seasonal API requests for:", seasons);

  try {
    // Parallel API calls using Promise.all
    const responses = await Promise.all(
      seasons.map((season) =>
        fetch(
          `/django/rwm/shapefile/stretchbased/${season}/`,
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
      premonsoon: StretchWaterQualityGeoJSON | null;
      monsoon: StretchWaterQualityGeoJSON | null;
      postmonsoon: StretchWaterQualityGeoJSON | null;
    } = {
      premonsoon: null,
      monsoon: null,
      postmonsoon: null,
    };

    seasons.forEach((season, index) => {
      const seasonData = allSeasonalData[index];
      
      if (seasonData && seasonData.features) {
        // Normalize sampling names for each feature
        const processedFeatures = seasonData.features.map((feature: StretchWaterQualityFeature) => {
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
        "No water quality data found for any season in selected stretches."
      );
    } else if (emptySeasonsCount > 0) {
      console.warn(
        `${emptySeasonsCount} season(s) have no data for selected stretches`
      );
    }
  } catch (error: any) {
    console.error("Seasonal water quality API error:", error);
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

  const clearWaterQualityData = (): void => {
    console.log("Clearing water quality data");
    setWaterQualityData(null);
    setWaterQualityError(null);
  };

  const handleAreaConfirm = () => {
    if (selectedStretches.length > 0) {
      setAreaConfirmed(true);
      fetchStretchLines(selectedStretches);
      fetchStretchBuffer(selectedStretches);
    }
  };

  const lockSelections = () => setSelectionsLocked(true);

  const confirmSelections = (): boolean => {
    if (selectedStretches.length > 0 && !selectionsLocked) {
      handleAreaConfirm();
      lockSelections();
      return true;
    }
    return false;
  };

  const resetSelections = (): void => {
    setSelectedStretches([]);
    setSelectionsLocked(false);
    setError(null);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearStretchLines();
     clearAllSeasonalData();
  };

  const updateSelectedStretches = (stretchIds: string[]): void => {
    setSelectedStretches(stretchIds);
    setAreaConfirmed(false);
    clearWaterQualityData();
    clearAllSeasonalData();
  };

  const fetchStretchLines = async (stretchIds: string[]): Promise<void> => {
    console.log("fetchStretchLines called with:", stretchIds);

    if (stretchIds.length === 0) {
      clearStretchLines();
      return;
    }

    setIsLoadingStretchLines(true);
    setStretchLinesError(null);

    const requestBody = {
      Stretch_ID: stretchIds,
    };

    try {
      const response = await fetch(`/django/rwm/stretch_lines/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: StretchLineGeoJSON = await response.json();
      console.log(
        "Stretch lines data received:",
        data.features?.length || 0,
        "features"
      );

      // API already returns GeoJSON format, so use directly
      setStretchLinesData(data);

      if (data.features?.length === 0) {
        setStretchLinesError("No stretch lines found for selected stretches.");
      }
    } catch (error: any) {
      console.error("Stretch lines API error:", error);
      setStretchLinesError(`Failed to fetch stretch lines: ${error.message}`);
      setStretchLinesData(null);
    } finally {
      setIsLoadingStretchLines(false);
    }
  };

  const clearStretchLines = (): void => {
    setStretchLinesData(null);
    setStretchLinesError(null);
  };


  const fetchStretchBuffer = async (stretchIds: string[]): Promise<void> => {
  console.log("fetchStretchBuffer called with:", stretchIds);
  
  if (stretchIds.length === 0) {
    clearStretchBuffer();
    return;
  }

  setIsLoadingStretchBuffer(true);
  setStretchBufferError(null);

  const requestBody = {
    Stretch_ID: stretchIds,
  };

  try {
    const response = await fetch(`/django/rwm/river_100m_buffer/stretchbased/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GeoJSONFeatureCollection = await response.json();
    console.log(
      "Stretch buffer data received:",
      data.features?.length || 0,
      "features"
    );

    // Store the data for use in interpolation API
    setStretchBufferData({
      type: "FeatureCollection",
      features: data.features || []
    });

    setStretchBufferData(data);

    if (data.features?.length === 0) {
      setStretchBufferError("No stretch buffer found for selected stretches.");
    }
  } catch (error: any) {
    console.error("Stretch buffer API error:", error);
    setStretchBufferError(`Failed to fetch stretch buffer: ${error.message}`);
    setStretchBufferData(null);
  } finally {
    setIsLoadingStretchBuffer(false);
  }
};

const clearStretchBuffer = (): void => {
  setStretchBufferData(null);
  setStretchBufferError(null);
};


  const contextValue: StretchContextType = {
    stretches,
    selectedStretches,
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed,
    basinData,
    riverData,
    riverBufferData,
    isLoadingMapLayers,
    mapLayersError,
    waterQualityData,
    isLoadingWaterQuality,
    waterQualityError,
    selectedSeason,
    setSelectedStretches: updateSelectedStretches,
    setSelectedSeason,
    setSelectionsLocked,
    handleAreaConfirm,
    confirmSelections,
    lockSelections,
    resetSelections,
    fetchStretches,
    fetchMapLayers,
    fetchWaterQualityData,
    clearWaterQualityData,
    stretchLinesData,
    isLoadingStretchLines,
    stretchLinesError,
    fetchStretchLines,
    clearStretchLines,
    stretchBufferData,
  isLoadingStretchBuffer,
  stretchBufferError,
  fetchStretchBuffer,
  clearStretchBuffer,

  seasonalWaterQualityData,
  isLoadingAllSeasons,
  allSeasonsError,
  fetchAllSeasonsWaterQualityData,
  clearAllSeasonalData,
  };

  return (
    <StretchContext.Provider value={contextValue}>
      {children}
    </StretchContext.Provider>
  );
};

export const useStretch = (): StretchContextType => {
  const context = useContext(StretchContext);
  if (context === undefined) {
    throw new Error("useStretch must be used within a StretchProvider");
  }
  return context;
};
