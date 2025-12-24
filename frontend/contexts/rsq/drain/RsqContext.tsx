"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useLocation } from "./LocationContext";

/* ================= TYPES ================= */

export interface GroundWaterFeature {
  type: "Feature";
  id?: string;
  properties: {
    village: string;
    blockname?: string;
    Year: string;

    Total_Annual_Ground_Water_Recharge?: number;
    Annual_Extractable_Ground_Water_Resource?: number;
    Irrigation_Use?: number;
    Domestic_Use?: number;
    Industrial_Use?: number | null;
    Total_Extraction?: number;
    Net_Ground_Water_Availability_for_future_use?: number;

    Stage_of_Ground_Water_Extraction?: number;

    Recharge_from_Rainfall_MON?: number;
    Recharge_from_Other_Sources_MON?: number;
    Recharge_from_Rainfall_NM?: number;
    Recharge_from_Other_Sources_NM?: number;
    Total_Natural_Discharges?: number;

    status?: "Safe" | "Semi-Critical" | "Critical" | "Over-Exploited" | "No Data";

    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}
export interface GroundWaterGeoJSON {
  type: "FeatureCollection";
  features: GroundWaterFeature[];
}

interface RSQContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  groundWaterData: GroundWaterGeoJSON | null;
  isLoading: boolean;
  error: string | null;
  fetchGroundWaterData: () => Promise<void>;
  clearData: () => void;
}

const RSQContext = createContext<RSQContextType>({
  selectedYear: "",
  setSelectedYear: () => { },
  groundWaterData: null,
  isLoading: false,
  error: null,
  fetchGroundWaterData: async () => { },
  clearData: () => { },
});

/* ================= PROVIDER ================= */

export const RSQProvider = ({ children }: { children: ReactNode }) => {
  const [selectedYear, setSelectedYear] = useState("");
  const [groundWaterData, setGroundWaterData] = useState<GroundWaterGeoJSON | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedVillages } = useLocation();

// In RsqContext.tsx — THIS IS CRITICAL
useEffect(() => {
  if (selectedYear && selectedVillages.length > 0) {
    console.log('RSQ: Fetching data for', selectedYear, selectedVillages.length, 'villages');
    setGroundWaterData(null);
    const timer = setTimeout(() => fetchGroundWaterData(), 300);
    return () => clearTimeout(timer);
  } else {
    setGroundWaterData(null);
  }
}, [selectedYear, selectedVillages]); // ← MUST INCLUDE selectedVillages

  // Clear data when villages change
  useEffect(() => {
    console.log('🌊 Villages changed - clearing RSQ data');
    setGroundWaterData(null);
    setError(null);
    setSelectedYear("");
  }, [selectedVillages]);

  const fetchGroundWaterData = async () => {
    if (selectedVillages.length === 0 || !selectedYear) {
      console.log("🌊 No villages or year selected - skipping fetch");
      return;
    }

    console.log("🌊 🔄 Fetching RSQ data for:", {
      year: selectedYear,
      villages: selectedVillages.length,
    });

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/django/rsq/quantification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedYear,
          vlcodes: selectedVillages,
        }),
      });

      console.log("🌊 API Response status:", response.status);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch data");
      }

      const data: GroundWaterGeoJSON = await response.json();

      console.log("🌊 ✅ RSQ Data received:", {
        features: data.features?.length || 0,
        year: selectedYear,
        firstFeature: data.features?.[0]?.properties,
      });

      // Set the new data
      setGroundWaterData(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Fetch failed";
      console.error("🌊 ❌ RSQ Fetch error:", errorMsg);
      setError(errorMsg);
      setGroundWaterData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearData = () => {
    console.log("🌊 Manually clearing all RSQ data");
    setGroundWaterData(null);
    setError(null);
    setSelectedYear("");
  };

  return (
    <RSQContext.Provider
      value={{
        selectedYear,
        setSelectedYear,
        groundWaterData,
        isLoading,
        error,
        fetchGroundWaterData,
        clearData,
      }}
    >
      {children}
    </RSQContext.Provider>
  );
};

export const useRSQ = () => useContext(RSQContext);