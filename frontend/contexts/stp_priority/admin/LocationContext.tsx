"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  use,
} from "react";


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
  population: number;
}

// Interface for selections return data
export interface SelectionsData {
  subDistricts: SubDistrict[];
  totalPopulation: number;
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
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  totalPopulation: number;
  selectionsLocked: boolean;
  display_raster: clip_rasters[];
  setdisplay_raster: (layer: clip_rasters[]) => void;
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  isLoading: boolean;
  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
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
  selectedDistricts: [],
  selectedSubDistricts: [],
  totalPopulation: 0,
  selectionsLocked: false,
  isLoading: false,
  display_raster:[],
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  setdisplay_raster: () => {},
  handleStateChange: () => {},
  setSelectedDistricts: () => {},
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
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>(
    []
  );

 

  // State for additional information
  const [totalPopulation, setTotalPopulation] = useState<number>(0);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [display_raster, setdisplay_raster] = useState<clip_rasters[]>([]);
  const [selectedStateName, setSelectedStateName] = useState<string>("");
  const [selectedDistrictsNames, setSelectedDistrictNames] = useState<string[]>([]);
  const [selectedSubDistrictsNames, setSelectedSubDistrictNames] = useState<string[]>([]);
  useEffect(()=>{
      setSelectedStateName(states.find((state) => state.id === selectedState)?.name || "");
      setSelectedDistrictNames(districts.filter((district) => selectedDistricts.includes(district.id as number)).map((district) => district.name));
      setSelectedSubDistrictNames(subDistricts.filter((subDistrict) => selectedSubDistricts.includes(subDistrict.id as number)).map((subDistrict) => subDistrict.name));

  },[selectionsLocked])

  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          "/api/stp/get_states?all_data=true"
        );
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const stateData: State[] = data.map((state: any) => ({
          id: state.id,
          name: state.name,
        }));

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
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          "/api/stp/get_districts",
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

        const data = await response.json();

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
          "/api/stp/get_sub_districts/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              districts: selectedDistricts,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const subDistrictData: SubDistrict[] = data.map((subDistrict: any) => ({
          id: subDistrict.id,
          name: subDistrict.name,
          districtId: selectedDistricts[0], // This might need adjustment based on your data structure
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
    setTotalPopulation(0);
  }, [selectedDistricts]);

  useEffect(() => {
    const disp_raster = async () => {
      if (selectionsLocked === true) {
        setIsLoading(true);
        try {
          const response = await fetch(
            "/api/stp_operation/stp_visual_display",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                clip: selectedSubDistricts,
                place:"sub_district",}),
            }
          );

          const data = await response.json();
          setdisplay_raster(data);
        } catch (error) {
          console.log("Error:", error);
        }
        setIsLoading(false);
      }
    };

    disp_raster();
  }, [selectionsLocked, selectedSubDistricts]);

  




  
  // Calculate total population based on selected sub-districts
  useEffect(() => {
    if (selectedSubDistricts.length > 0) {
      // Filter to get only selected sub-districts
      const selectedSubDistrictObjects = subDistricts.filter((subDistrict) =>
        selectedSubDistricts.includes(Number(subDistrict.id))
      );

      // Calculate total population
      const total = selectedSubDistrictObjects.reduce(
        (sum, subDistrict) => sum + subDistrict.population,
        0
      );

      setTotalPopulation(total);
    } else {
      setTotalPopulation(0);
    }
  }, [selectedSubDistricts, subDistricts]);

  // Handle state selection
  const handleStateChange = (stateId: number): void => {
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

  // Reset all selections
  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setTotalPopulation(0);
    setSelectionsLocked(false);
    setdisplay_raster([]);
    
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
    resetSelections,
    display_raster,
    setdisplay_raster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames
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
