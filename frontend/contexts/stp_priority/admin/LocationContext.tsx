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
import { toast } from "react-toastify";

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
  totalPopulation: number;
}
interface clip_rasters {
  file_name: string;
  layer_name: string;
  workspace: string;
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
  displayRaster: clip_rasters[];
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
  setSelectedState: (stateId: number | null) => void;
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
  setdisplay_raster: () => { },
  handleStateChange: () => { },
  setSelectedDistricts: () => { },
  setSelectedSubDistricts: () => { },
  confirmSelections: () => null,
  resetSelections: () => { },
  setSelectedState: () => { },
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

  const [displayRaster, setdisplay_raster] = useState<clip_rasters[]>([]);
  const [selectedStateName, setSelectedStateName] = useState<string>("");
  const [selectedDistrictsNames, setSelectedDistrictNames] = useState<string[]>([]);
  const [selectedSubDistrictsNames, setSelectedSubDistrictNames] = useState<string[]>([]);
  useEffect(() => {
    setSelectedStateName(states.find((state) => state.id === selectedState)?.name || "");
    setSelectedDistrictNames(districts.filter((district) => selectedDistricts.includes(district.id as number)).map((district) => district.name));
    setSelectedSubDistrictNames(subDistricts.filter((subDistrict) => selectedSubDistricts.includes(subDistrict.id as number)).map((subDistrict) => subDistrict.name));

  }, [selectionsLocked])

  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/location/get_states?all_data=true")

        if (response.status != 201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.message as State[];
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
        const response = await api.post("/location/get_districts", {
          body: {
            state: selectedState,
            all_data: true,
          },
        });
        if (response.status != 201) {
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
          const response = await api.post("/location/get_sub_districts", {
            body: {
              districts: selectedDistricts,
              all_data: true,
            },
          });

          if (response.status != 201) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.message as SubDistrict[];
          const subDistrictData= data.map((subDistrict: any) => ({
          id: subDistrict.id,
          name: subDistrict.name,
          districtId: selectedDistricts[0], 
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
          const response = await api.post("/stp_operation/stp_priority_visual_display",{
            body: {
              clip: selectedSubDistricts,
              place: "sub_district",
            },  
          }) 

          const data = await response.message as clip_rasters[];
          setdisplay_raster(data);
        } catch (error) {
          console.log("Error:", error);
        }
        setIsLoading(false);
      }
    };

    disp_raster();
  }, [selectionsLocked, selectedSubDistricts]);


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
    displayRaster,
    setdisplay_raster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    setSelectedState
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
