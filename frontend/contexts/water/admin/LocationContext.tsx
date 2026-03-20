"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { State, District, SubDistrict, ClipRasters } from "@/interface/raster_context";

// Toast utility function - customize based on your toast library
const showToast = (message: string, type: "error" | "success" = "error") => {
  // Option 1: If using sonner, uncomment:
  // import { toast } from "sonner";
  // toast[type](message);

  // Option 2: If using react-hot-toast, uncomment:
  // import toast from 'react-hot-toast';
  // toast[type](message);

  // Option 3: Fallback to console
  console.warn(`[${type.toUpperCase()}] ${message}`);
};

// Interface for selections return data
export interface SelectionsData {
  subDistricts: SubDistrict[];
  totalPopulation: number;
}

interface LocationContextType {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  totalPopulation: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  setdisplay_raster: (layer: ClipRasters[]) => void;
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  isLoading: boolean;
  handleStateChange: (stateId: number | null) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  confirmSelections: () => SelectionsData | null;
  setSelectedState: (stateId: number | null) => void;
  resetSelections: () => void; // ✅ ADD THIS
}

// Props for the LocationProvider component
interface LocationProviderProps {
  children: ReactNode;
}

// Create the location context with default values
const LocationContext = createContext<LocationContextType>({
  states: [],
  districts: [],
  subDistricts: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
  totalPopulation: 0,
  selectionsLocked: false,
  isLoading: false,
  displayRaster: [],
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  setdisplay_raster: () => {},
  handleStateChange: () => {},
  setSelectedDistricts: () => {},
  setSelectedSubDistricts: () => {},
  confirmSelections: () => null,
  setSelectedState: () => {},
  resetSelections: () => {}, // ✅ ADD THIS
});

// Create the provider component
export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  // State for location data
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);

  // State for selected locations
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>([]);

  // State for additional information
  const [totalPopulation, setTotalPopulation] = useState<number>(0);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [displayRaster, setdisplay_raster] = useState<ClipRasters[]>([]);
  const [selectedStateName, setSelectedStateName] = useState<string>("");
  const [selectedDistrictsNames, setSelectedDistrictNames] = useState<string[]>([]);
  const [selectedSubDistrictsNames, setSelectedSubDistrictName] = useState<string[]>([]);

  // Update location names when selections are locked
  useEffect(() => {
    setSelectedStateName(states.find((state) => state.id === selectedState)?.name || "");
    setSelectedDistrictNames(
      districts
        .filter((district) => selectedDistricts.includes(district.id as number))
        .map((district) => district.name)
    );
    setSelectedSubDistrictName(
      subDistricts
        .filter((subDistrict) => selectedSubDistricts.includes(subDistrict.id as number))
        .map((subDistrict) => subDistrict.name)
    );
  }, [selectionsLocked, states, districts, subDistricts, selectedState, selectedDistricts, selectedSubDistricts]);

  // Fetch states on mount
  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_FAST_URL}/water/get_states?all_data=true`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log('API Response:', result); // pehle ye add karo debug ke liye
       const data = (Array.isArray(result) 
         ? result 
         : result?.message ?? result?.data ?? result?.states ?? []) as State[];
        const stateData: State[] = data.map((state: any) => ({
          id: state.id,
          name: state.name,
        }));
        setStates(stateData);
      } catch (error) {
        console.error("Error fetching states:", error);
        showToast("Failed to load states", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStates();
  }, []);

  // Load districts when state is selected
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_FAST_URL}/water/get_districts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              state: selectedState,
              all_data: true,
            }),
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        const data = (Array.isArray(result) 
          ? result 
          : result?.message ?? result?.data ?? []) as District[];

        const districtData: District[] = data.map((district: any) => ({
          id: district.id,
          name: district.name,
          stateId: selectedState,
        }));

        setDistricts(districtData);
      } catch (error) {
        console.error("Error fetching districts:", error);
        showToast("Failed to load districts", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistricts();

    // Reset dependent selections
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setTotalPopulation(0);
  }, [selectedState]);

  // Load sub-districts when districts are selected
  useEffect(() => {
    if (selectedDistricts.length === 0) {
      setSubDistricts([]);
      return;
    }

    setIsLoading(true);

    const fetchSubDistricts = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_FAST_URL}/water/get_sub_districts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              districts: selectedDistricts,
              all_data: true,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        const data = (Array.isArray(result) 
          ? result 
          : result?.message ?? result?.data ?? []) as SubDistrict[];
        const subDistrictData = data.map((subDistrict: any) => ({
          id: subDistrict.id,
          name: subDistrict.name,
          districtId: selectedDistricts[0],
        }));

        setSubDistricts(subDistrictData);
      } catch (error) {
        console.error("Error fetching sub-districts:", error);
        showToast("Failed to load sub-districts", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubDistricts();

    // Reset dependent selections
    setSelectedSubDistricts([]);
    setTotalPopulation(0);
  }, [selectedDistricts]);

  // Handle state selection
  const handleStateChange = (stateId: number | null): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectionsLocked(false);
  };

  // Lock selections and return selected data
  const confirmSelections = (): SelectionsData | null => {
    if (selectedSubDistricts.length === 0) {
      return null;
    }

    const selectedSubDistrictObjects = subDistricts.filter((subDistrict) =>
      selectedSubDistricts.includes(Number(subDistrict.id))
    );

    setSelectionsLocked(true);

    return {
      subDistricts: selectedSubDistrictObjects,
      totalPopulation,
    };
  };

  // ✅ Reset all selections
  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setTotalPopulation(0);
    setSelectionsLocked(false);
    setdisplay_raster([]);
    setSelectedStateName("");
    setSelectedDistrictNames([]);
    setSelectedSubDistrictName([]);
    
    console.log('✓ LocationContext: All selections reset');
  };

  // Context value
  const contextValue: LocationContextType = {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    totalPopulation,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    confirmSelections,
    displayRaster,
    setdisplay_raster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    setSelectedState,
    resetSelections, // ✅ ADD THIS
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use the location context
export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
