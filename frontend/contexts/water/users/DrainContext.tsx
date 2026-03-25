"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

import { River, Stretch, Catchment, Drain, Layer_name } from "@/interface/raster_context";

const FAST_M_BASE_URL = process.env.NEXT_PUBLIC_FAST_URL || "/fastapi";

async function fetchFastM<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${FAST_M_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : `HTTP error! Status: ${response.status}`,
    );
  }

  return data as T;
}

export interface RiverSelectionsData {
  river: number | null;
  stretch: number | null;
  drain: number | null;
  timeScale: "seasonal" | "yearly";
  year: number[];
  season: string;
  productType: string;
}

export interface ClipRasters {
  legend_data: null;
  original_name: string;
  layer_name: string;
  layer_type: string;
  workspace: string;
  style: string;
  year: number;
  time_scale: "seasonal" | "yearly";
  aggregation: string;
  season?: string; // Optional since yearly doesn't have season
}

// Add this for the study area (if needed later)
interface StudyAreaVector {
  workspace: string;
  layer_name: string;
}

// Add this for the full API response
interface RasterApiResponse {
  status: string;
  study_area_vector: StudyAreaVector;
  clipped_rasters: ClipRasters[];
  metadata: {
    year: number;
    product_type: string;
    time_scale: string;
    season?: string;
    layers_processed: number;
  };
}

interface RiverSystemContextType {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  selectedRiver: number | null;
  setSelectedRiver: (riverCode: number) => void;
  selectedDrain: number | null;
  selectedCatchments: number[];
  selectionsLocked: boolean;
  isLoading: boolean;
  displayRaster: ClipRasters[];
  setDisplayRaster: (layer: ClipRasters[]) => void;
  handleRiverChange: (riverCode: number | null) => void;
  setSelectedDrain: (drain: number | null) => void;
  setSelectedCatchments: (catchmentIds: number[]) => void;
  confirmSelections: () => RiverSelectionsData | null;
  resetSelections: () => void;
  showCatchment: boolean;
  setShowCatchment: (value: boolean) => void;

  allStretchIds: number[];
  setAllStretchIds: (stretchIds: number[]) => void;
  selectedStretch: number | null;
  setSelectedStretch: (stretchId: number | null) => void;
  allDrainIds: number[];
  setAllDrainIds: (drains: number[]) => void;

  timeScale: "seasonal" | "yearly" | "";
  setTimeScale: (scale: "seasonal" | "yearly" | "") => void;
  selectedYears: number[];
  setSelectedYears: (years: number[]) => void;
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  selectedProductType: string;
  setSelectedProductType: (type: string) => void;

  fetchRasterData: () => Promise<any>;
  resetTrigger: number;
}

interface StretchIds {
  stretch_ids: number[];
}

interface DrainIds {
  drains: number[];
}

// Props for the RiverSystemProvider component
interface RiverSystemProviderProps {
  children: ReactNode;
}

// Create the river system context with default values
const RiverSystemContext = createContext<RiverSystemContextType>({
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  selectedRiver: null,
  setSelectedRiver: () => {},
  selectedStretch: null,
  setSelectedStretch: () => {},
  selectedDrain: null,
  setSelectedDrain: () => {},
  selectedCatchments: [],
  setShowCatchment: () => {},
  selectionsLocked: false,
  displayRaster: [],
  setDisplayRaster: () => {},
  isLoading: false,
  showCatchment: false,
  handleRiverChange: () => {},

  setSelectedCatchments: () => {},
  confirmSelections: () => null,
  resetSelections: () => {},

  allStretchIds: [],
  setAllStretchIds: () => {},
  allDrainIds: [],
  setAllDrainIds: () => {},

  timeScale: "",
  setTimeScale: () => {},
  selectedYears: [],
  setSelectedYears: () => {},
  selectedSeason: "",
  setSelectedSeason: () => {},
  selectedProductType: "",
  setSelectedProductType: () => {},

  fetchRasterData: async () => {},
  resetTrigger: 0,
});

// Create the provider component
export const RiverSystemProvider: React.FC<RiverSystemProviderProps> = ({
  children,
}) => {
  // State for river system data
  const [rivers, setRivers] = useState<River[]>([]);
  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [drains, setDrains] = useState<Drain[]>([]);
  const [catchments, setCatchments] = useState<Catchment[]>([]);

  // State for selected items
  const [selectedRiver, setSelectedRiver] = useState<number | null>(null);
  const [selectedCatchments, setSelectedCatchments] = useState<number[]>([]);
  const [showCatchment, setShowCatchment] = useState<boolean>(false);

  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setDisplayRaster] = useState<ClipRasters[]>([]);

  const [allStretchIds, setAllStretchIds] = useState<number[]>([]);
  const [allDrainIds, setAllDrainIds] = useState<number[]>([]);
  const [selectedStretch, setSelectedStretch] = useState<number | null>(null);
  const [selectedDrain, setSelectedDrain] = useState<number | null>(null);

  const [timeScale, setTimeScale] = useState<"seasonal" | "yearly" | "">("");
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Load rivers on component mount
  useEffect(() => {
    const fetchRivers = async () => {
      setIsLoading(true);
      try {
        const data = await fetchFastM<River[]>("/water/get_river");
        const riverData: River[] = data.map((river: any) => ({
          River_Name: river.River_Name,
          River_Code: river.River_Code,
        }));
        setRivers(riverData);
      } catch (error) {
        console.log("Error fetching rivers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRivers();
  }, []);

  // Load stretches when river is selected
  useEffect(() => {
    if (!selectedRiver) {
      setStretches([]);
      return;
    }

    const fetchStretches = async () => {
      setIsLoading(true);
      try {
        const data = await fetchFastM<StretchIds>("/water/get_stretch", {
          method: "POST",
          body: JSON.stringify({
            river_code: selectedRiver,
          }),
        });
        setAllStretchIds(data.stretch_ids);
      } catch (error) {
        console.log("Error fetching stretches:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStretches();

    // Reset dependent selections
    setSelectedStretch(null);
    setSelectedDrain(null);
    setSelectedCatchments([]);
    setDisplayRaster([]);
  }, [selectedRiver]);

  // Load drains when stretches are selected
  useEffect(() => {
    if (selectedStretch === null) {
      setDrains([]);
      return;
    }

    setIsLoading(true);

    const fetchDrains = async () => {
      try {
        const data = await fetchFastM<DrainIds>("/water/get_drain", {
          method: "POST",
          body: JSON.stringify({
            stretch_id: selectedStretch,
            all_data: true,
          }),
        });
        setAllDrainIds(data.drains);
      } catch (error) {
        console.log("Error fetching drains:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrains();

    // Reset dependent selections
    setSelectedDrain(null);
    setSelectedCatchments([]);
  }, [selectedStretch]);

  // Load catchments when drains are selected
  useEffect(() => {
    if (selectedDrain === null) {
      setCatchments([]);
      return;
    }

    setIsLoading(true);

    // Reset dependent selections
    setSelectedCatchments([]);
  }, [showCatchment]);

  // Handle river selection
  const handleRiverChange = (riverCode: number | null): void => {
    setSelectedRiver(riverCode);
    setSelectedStretch(null);
    setSelectedDrain(null);
    setSelectedCatchments([]);
    setSelectionsLocked(false);
  };

  // ✅ FIXED: Lock selections and return selected data with proper validation
  const confirmSelections = (): RiverSelectionsData | null => {
    // 1. Basic Check
    if (!selectedDrain) {
      console.error("❌ Cannot confirm: selectedDrain is null");
      return null;
    }



    // 3. Lock the selections
    setSelectionsLocked(true);

    // 4. Return Full Data Object
    const selectionsData: RiverSelectionsData = {
      river: selectedRiver,
      stretch: selectedStretch,
      drain: selectedDrain,
      timeScale: timeScale as "seasonal" | "yearly",
      year: selectedYears,
      season: timeScale === "seasonal" ? selectedSeason : "",
      productType: selectedProductType,
    };

    console.log("✅ Selections confirmed:", selectionsData);
    return selectionsData;
  };

  // New dedicated API function
  const fetchRasterData = async () => {
    setIsLoading(true);
    try {
      const payload = {
        drain_no: selectedDrain,
        year: selectedYears,
        time_scale: timeScale,
        season: timeScale === "seasonal" ? selectedSeason : null,
        product_type: selectedProductType,
      };

      console.log("📤 Calling fetchRasterData API with payload:", payload);

      const apiData = await fetchFastM<RasterApiResponse>("/water/process_drain_raster", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const rasterLayers = apiData.clipped_rasters;

      console.log("✅ fetchRasterData API response:", rasterLayers);
      setDisplayRaster(rasterLayers);

      // ✅ Return the data so handleConfirm can use it
      return {
        clipped_rasters: rasterLayers,
        bbox: null,
        study_area_vector: apiData.study_area_vector || null,
      };
    } catch (error) {
      console.error("❌ fetchRasterData failed:", error);
      throw error; // Re-throw so handleConfirm knows it failed
    } finally {
      setIsLoading(false);
    }
  };

  // Reset all selections
  const resetSelections = (): void => {
    setSelectedRiver(null);
    setSelectedStretch(null);
    setSelectedDrain(null);
    setSelectedCatchments([]);
    setSelectionsLocked(false);
    setDisplayRaster([]);
    setCatchments([]);

    setTimeScale("");
    setSelectedYears([]);
    setSelectedSeason("");
    setSelectedProductType("");
    setResetTrigger((prev) => prev + 1);
  };

  // Context value
  const contextValue: RiverSystemContextType = {
    rivers,
    stretches,
    drains,
    catchments,
    selectedRiver,
    setSelectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectionsLocked,
    isLoading,
    displayRaster,
    setDisplayRaster,
    handleRiverChange,
    setSelectedStretch,
    setSelectedDrain,
    setSelectedCatchments,
    confirmSelections,
    resetSelections,
    showCatchment,
    setShowCatchment,
    allStretchIds,
    setAllStretchIds,
    allDrainIds,
    setAllDrainIds,

    timeScale,
    setTimeScale,
    selectedYears,
    setSelectedYears,
    selectedSeason,
    setSelectedSeason,
    selectedProductType,
    setSelectedProductType,
    fetchRasterData,
    resetTrigger,
  };

  return (
    <RiverSystemContext.Provider value={contextValue}>
      {children}
    </RiverSystemContext.Provider>
  );
};

// Custom hook to use the river system context
export const useRiverSystem = (): RiverSystemContextType => {
  const context = useContext(RiverSystemContext);
  if (context === undefined) {
    throw new Error("useRiverSystem must be used within a RiverSystemProvider");
  }
  return context;
};
