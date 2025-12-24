"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useLocation } from "./LocationContext";

// Define types for admin units response
export interface AdminUnitsData {
  state_code: number | null;
  district_codes: number[];
  subdistrict_codes: number[];
}

interface AdminUnitsContextType {
  // Admin units data
  stateCode: number | null;
  districtCodes: number[];
  subdistrictCodes: number[];
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Functions
  fetchAdminUnits: (villageCodes: number[]) => Promise<void>;
  clearAdminUnits: () => void;
}

interface AdminUnitsProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
}

const AdminUnitsContext = createContext<AdminUnitsContextType>({
  stateCode: null,
  districtCodes: [],
  subdistrictCodes: [],
  isLoading: false,
  error: null,
  fetchAdminUnits: async () => {},
  clearAdminUnits: () => {},
});

export const AdminUnitsProvider: React.FC<AdminUnitsProviderProps> = ({
  children,
  apiBaseUrl = "http://localhost:6500",
}) => {
  const [stateCode, setStateCode] = useState<number | null>(null);
  const [districtCodes, setDistrictCodes] = useState<number[]>([]);
  const [subdistrictCodes, setSubdistrictCodes] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get location context to listen for selection lock
  const { selectionsLocked, selectedVillages } = useLocation();

  // ✅ AUTO-FETCH: When user confirms selections (selectionsLocked becomes true)
  useEffect(() => {
    if (selectionsLocked && selectedVillages.length > 0 && !stateCode) {
      console.log("🔄 Selections locked! Auto-fetching admin units...");
      fetchAdminUnits(selectedVillages);
    }
  }, [selectionsLocked, selectedVillages]);

  // Fetch admin units from backend API
  const fetchAdminUnits = async (villageCodes: number[]) => {
    if (!villageCodes || villageCodes.length === 0) {
      console.log("⚠️ No village codes provided to fetch admin units");
      clearAdminUnits();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🔍 Fetching admin units for villages:", villageCodes);

      const response = await fetch(`${apiBaseUrl}/gwa/adminunit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ village_codes: villageCodes }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data: AdminUnitsData = await response.json();
      
      console.log("✅ Admin units received:", data);

      // Update state with received data
      setStateCode(data.state_code);
      setDistrictCodes(data.district_codes || []);
      setSubdistrictCodes(data.subdistrict_codes || []);

    } catch (err: any) {
      console.error("❌ Error fetching admin units:", err);
      setError(`Failed to fetch admin units: ${err.message}`);
      clearAdminUnits();
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all admin units data
  const clearAdminUnits = () => {
    setStateCode(null);
    setDistrictCodes([]);
    setSubdistrictCodes([]);
    setError(null);
  };

  const contextValue: AdminUnitsContextType = {
    stateCode,
    districtCodes,
    subdistrictCodes,
    isLoading,
    error,
    fetchAdminUnits,
    clearAdminUnits,
  };

  return (
    <AdminUnitsContext.Provider value={contextValue}>
      {children}
    </AdminUnitsContext.Provider>
  );
};

export const useAdminUnits = (): AdminUnitsContextType => {
  const context = useContext(AdminUnitsContext);
  if (context === undefined) {
    throw new Error("useAdminUnits must be used within an AdminUnitsProvider");
  }
  return context;
};