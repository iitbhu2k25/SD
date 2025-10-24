"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  use,
} from "react";
import { api } from "@/services/api";

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
}

// Interface for selections return data
export interface SelectionsData {
  subDistricts: SubDistrict[];
}
interface clip_rasters{
  file_name:string;
  layer_name:string;
  workspace:string;
}

// Define the context type
interface LocationContextType {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  selectedState: number | null;
  selectedDistrict: number | null;
  selectedSubDistricts: number[];
  selectionsLocked: boolean;
  display_raster: clip_rasters[];
  setdisplay_raster: (layer: clip_rasters[]) => void;

  isLoading: boolean;
  handleStateChange: (stateId: number) => void;
  setSelectedDistrict: (districtId: number) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  confirmSelections: () => SelectionsData | null;
  resetSelections: () => void;
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
  selectedDistrict: null,
  selectedSubDistricts: [],
  selectionsLocked: false,
  isLoading: false,
  display_raster:[],
  setdisplay_raster: () => {},
  handleStateChange: () => {},
  setSelectedDistrict: () => {},
  setSelectedSubDistricts: () => {},
  confirmSelections: () => null,
  resetSelections: () => {},
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
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>(
    []
  );

  // State for additional information
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [display_raster, setdisplay_raster] = useState<clip_rasters[]>([]);
 
  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(
          "/location/get_states?all_data=true"
        );
        if (response.status!=201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as State[];
        console.log("data:", data);
        const stateData: State[] = data.map((state: any) => ({
          id: state.id,
          name: state.name,
        }));
        console.log("State data:", stateData);
        
        setStates(stateData);
      } catch (error) {
        console.log("Error fetching states:", error);
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
      setSelectedDistrict(null);
      setSelectedSubDistricts([]);
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await api.post(
          "/location/get_districts",
          {
            body:{
              state: selectedState,
              all_data: true,
            },
          }
        );

        if (response.status !=201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as District[];

        const districtData: District[] = data.map((district: any) => ({
          id: district.id,
          name: district.name,
          stateId: selectedState,
        }));

        setDistricts(districtData);
      } catch (error) {
        console.log("Error fetching districts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistricts();
  }, [selectedState]);

  // Load sub-districts when districts are selected
  useEffect(() => {
    if (!selectedDistrict) {
      setSubDistricts([]);
      setSelectedSubDistricts([]);
      return;
    }

    setIsLoading(true);

    const fetchSubDistricts = async () => {
      try {
        const response = await api.post(
          "/location/get_sub_districts/",
          {
            body: {
              districts: [selectedDistrict],
            },
          }
        );

        if (response.status !=201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as SubDistrict[];
        const subDistrictData: SubDistrict[] = data.map((subDistrict: any) => ({
          id: subDistrict.id,
          name: subDistrict.name,
          districtId: selectedDistrict, 
          population: subDistrict.population || 0, // Added population to SubDistrict
        }));

        setSubDistricts(subDistrictData);
      } catch (error) {
        console.log("Error fetching sub-districts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubDistricts();

    // Reset dependent selections
    setSelectedSubDistricts([]);
  }, [selectedDistrict]);

  useEffect(() => {
    const disp_raster = async () => {
      if (selectionsLocked === true) {
        console.log("Starting fetch...");
        try {
          const response = await api.post(
            "/location/stp_operation/stp_visual_display",
            {
              body: { 
                clip: selectedSubDistricts,
                place:"sub_district",},
            }
          );

          const data = await response.message as clip_rasters[];
          setdisplay_raster(data);
        } catch (error) {
          console.log("Error:", error);
        }
      }
    };

    disp_raster();
  }, [selectionsLocked, selectedSubDistricts]);

  // Handle state selection
  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistrict(null);
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
      subDistricts: selectedSubDistrictObjects
    };
  };

  // Reset all selections
  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistrict(null);
    setSelectedSubDistricts([]);
    setSelectionsLocked(false);
    setdisplay_raster([]);
  };

  // Context value
  const contextValue: LocationContextType = {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistrict,
    selectedSubDistricts,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistrict,
    setSelectedSubDistricts,
    confirmSelections,
    resetSelections,
    display_raster,
    setdisplay_raster,
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
};
