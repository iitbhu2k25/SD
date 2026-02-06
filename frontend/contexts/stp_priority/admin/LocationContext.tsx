"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from "react";
import { api } from "@/services/api";
import { State, District, SubDistrict, ClipRasters } from "@/interface/raster_context";

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
  setDisplayRaster: (layer: ClipRasters[]) => void;
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

interface LocationProviderProps {
  children: ReactNode;
}

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
  setDisplayRaster: () => {},
  handleStateChange: () => {},
  setSelectedDistricts: () => {},
  setSelectedSubDistricts: () => {},
  confirmSelections: () => null,
  setSelectedState: () => {},
  resetSelections: () => {},
});

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  // All location data loaded once
  const [allStates, setAllStates] = useState<State[]>([]);
  const [allDistricts, setAllDistricts] = useState<District[]>([]);
  const [allSubDistricts, setAllSubDistricts] = useState<SubDistrict[]>([]);

  // Selected locations
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>([]);

  // Additional state
  const [totalPopulation, setTotalPopulation] = useState<number>(0);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setDisplayRaster] = useState<ClipRasters[]>([]);

  // ✅ Load ALL data once on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Fetch all states
        const statesResponse = await api.get("/location/get_states?all_data=true");
        if (statesResponse.status === 201) {
          const statesData = statesResponse.message as State[];
          setAllStates(statesData);
        }

        // Fetch all districts
        const districtsResponse = await api.get("/location/all_districts");
        if (districtsResponse.status === 201) {
          const districtsData = districtsResponse.message as District[];
          setAllDistricts(districtsData);
        }

        // Fetch all sub-districts
        const subDistrictsResponse = await api.get("/location/all_sub_districts");
        if (subDistrictsResponse.status === 201) {
          const subDistrictsData = subDistrictsResponse.message as SubDistrict[];
          setAllSubDistricts(subDistrictsData);
        }
      } catch (error) {
        console.log("Error fetching location data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // ✅ Filter districts based on selected state (computed, not fetched)
  const districts = useMemo(() => {
    if (!selectedState) return [];
    return allDistricts.filter(d => d.stateId === selectedState);
  }, [allDistricts, selectedState]);

  // ✅ Filter subdistricts based on selected districts (computed, not fetched)
  const subDistricts = useMemo(() => {
    if (selectedDistricts.length === 0) return [];
    return allSubDistricts.filter(sd => 
      selectedDistricts.includes(Number(sd.districtId))
    );
  }, [allSubDistricts, selectedDistricts]);

  // ✅ Computed names
  const selectedStateName = useMemo(() => {
    return allStates.find(s => s.id === selectedState)?.name || "";
  }, [allStates, selectedState]);

  const selectedDistrictsNames = useMemo(() => {
    return allDistricts
      .filter(d => selectedDistricts.includes(Number(d.id)))
      .map(d => d.name);
  }, [allDistricts, selectedDistricts]);

  const selectedSubDistrictsNames = useMemo(() => {
    return allSubDistricts
      .filter(sd => selectedSubDistricts.includes(Number(sd.id)))
      .map(sd => sd.name);
  }, [allSubDistricts, selectedSubDistricts]);

  // ✅ Handle state selection
  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectionsLocked(false);
  };

  // ✅ Wrapper for setSelectedDistricts with auto-cleanup
  const handleSetSelectedDistricts = (districtIds: number[]): void => {
    setSelectedDistricts(districtIds);
    
    // Auto-cleanup: remove subdistricts whose parent district is no longer selected
    setSelectedSubDistricts(prev => {
      if (districtIds.length === 0) return [];
      
      return prev.filter(subId => {
        const subDistrict = allSubDistricts.find(sd => sd.id === subId);
        return subDistrict && districtIds.includes(Number(subDistrict.districtId));
      });
    });
  };

  // ✅ Fetch raster data when selections are locked
  useEffect(() => {
    const fetchRasterData = async () => {
      if (selectionsLocked && selectedSubDistricts.length > 0) {
        setIsLoading(true);
        try {
          const response = await api.post("/stp_operation/stp_priority_visual_display", {
            body: {
              clip: selectedSubDistricts,
              place: "sub_district",
            },
          });

          const data = await response.message as ClipRasters[];
          setDisplayRaster(data);
        } catch (error) {
          console.log("Error fetching raster data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchRasterData();
  }, [selectionsLocked, selectedSubDistricts]);

  // ✅ Confirm selections
  const confirmSelections = (): SelectionsData | null => {
    if (selectedSubDistricts.length === 0) {
      return null;
    }

    const selectedSubDistrictObjects = allSubDistricts.filter(sd =>
      selectedSubDistricts.includes(Number(sd.id))
    );

    setSelectionsLocked(true);

    return {
      subDistricts: selectedSubDistrictObjects,
      totalPopulation,
    };
  };

  const resetSelections = (): void => {
    setSelectionsLocked(false);
    setTotalPopulation(0);
    setDisplayRaster([]);
  };

  const contextValue: LocationContextType = {
    states: allStates,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    totalPopulation,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts: handleSetSelectedDistricts,
    setSelectedSubDistricts,
    confirmSelections,
    displayRaster,
    setDisplayRaster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    setSelectedState,
    resetSelections,
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