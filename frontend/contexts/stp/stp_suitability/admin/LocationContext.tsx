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
import {
  State,
  District,
  SubDistrict,
  Towns,
  ClipRasters,
  raster_visual_resp,
} from "@/interface/raster_context";

export interface SelectionsData {
  subDistricts: SubDistrict[];
  towns: Towns[];
  totalPopulation: number;
}

interface LocationContextType {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  towns: Towns[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  selectedTowns: number[];
  selectedVillages: number[];
  totalPopulation: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  setDisplayRaster: (layer: ClipRasters[]) => void;
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  selectedTownsNames: string[];
  isLoading: boolean;
  resultLayer: string | null;
  setResultLayer: (layer: string | null) => void;
  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  setSelectedTowns: (townIds: number[]) => void;
  confirmSelections: () => SelectionsData | null;
  resetSelections: () => void;
  setSelectedVillages: (villageIds: number[]) => void;
  setSelectedState: (stateId: number | null) => void;
}

interface LocationProviderProps {
  children: ReactNode;
}

const LocationContext = createContext<LocationContextType>({
  states: [],
  districts: [],
  subDistricts: [],
  towns: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
  selectedTowns: [],
  selectedVillages: [],
  totalPopulation: 0,
  selectionsLocked: false,
  isLoading: false,
  displayRaster: [],
  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],
  selectedTownsNames: [],
  setDisplayRaster: () => {},
  resultLayer: null,
  setResultLayer: () => {},
  handleStateChange: () => {},
  setSelectedDistricts: () => {},
  setSelectedSubDistricts: () => {},
  setSelectedTowns: () => {},
  confirmSelections: () => null,
  resetSelections: () => {},
  setSelectedVillages: () => {},
  setSelectedState: () => {},
});

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  // ✅ All location data loaded once
  const [allStates, setAllStates] = useState<State[]>([]);
  const [allDistricts, setAllDistricts] = useState<District[]>([]);
  const [allSubDistricts, setAllSubDistricts] = useState<SubDistrict[]>([]);
  const [allTowns, setAllTowns] = useState<Towns[]>([]);

  // Selected locations
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<number[]>([]);
  const [selectedVillages, setSelectedVillages] = useState<number[]>([]);

  // Additional state
  const [totalPopulation, setTotalPopulation] = useState<number>(0);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setDisplayRaster] = useState<ClipRasters[]>([]);
  const [resultLayer, setResultLayer] = useState<string | null>(null);

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

        // Fetch all towns
        const townsResponse = await api.get("/location/get_all_towns");
        if (townsResponse.status === 201) {
          const townsData = townsResponse.message as Towns[];
          setAllTowns(townsData);
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
    return allDistricts.filter((d) => d.stateId === selectedState);
  }, [allDistricts, selectedState]);

  // ✅ Filter subdistricts based on selected districts (computed, not fetched)
  const subDistricts = useMemo(() => {
    if (selectedDistricts.length === 0) return [];
    return allSubDistricts.filter((sd) =>
      selectedDistricts.includes(Number(sd.districtId))
    );
  }, [allSubDistricts, selectedDistricts]);

  // ✅ Filter towns based on selected subdistricts (computed, not fetched)
  const towns = useMemo(() => {
    if (selectedSubDistricts.length === 0) return [];
    return allTowns.filter((town) =>
      selectedSubDistricts.includes(Number(town.subdistrict_code))
    );
  }, [allTowns, selectedSubDistricts]);

  // ✅ Computed names
  const selectedStateName = useMemo(() => {
    return allStates.find((s) => s.id === selectedState)?.name || "";
  }, [allStates, selectedState]);

  const selectedDistrictsNames = useMemo(() => {
    return allDistricts
      .filter((d) => selectedDistricts.includes(Number(d.id)))
      .map((d) => d.name);
  }, [allDistricts, selectedDistricts]);

  const selectedSubDistrictsNames = useMemo(() => {
    return allSubDistricts
      .filter((sd) => selectedSubDistricts.includes(Number(sd.id)))
      .map((sd) => sd.name);
  }, [allSubDistricts, selectedSubDistricts]);

  const selectedTownsNames = useMemo(() => {
    return allTowns
      .filter((town) => selectedTowns.includes(Number(town.id)))
      .map((town) => town.name);
  }, [allTowns, selectedTowns]);

  // ✅ Calculate total population from selected towns
  useEffect(() => {
    if (selectedTowns.length > 0) {
      const selectedTownObjects = allTowns.filter((town) =>
        selectedTowns.includes(Number(town.id))
      );

      const total = selectedTownObjects.reduce(
        (sum, town) => sum + (town.population || 0),
        0
      );

      setTotalPopulation(total);
    } else {
      setTotalPopulation(0);
    }
  }, [allTowns, selectedTowns]);

  // ✅ Handle state selection
  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedTowns([]);
    setSelectionsLocked(false);
  };

  // ✅ Wrapper for setSelectedDistricts with auto-cleanup
  const handleSetSelectedDistricts = (districtIds: number[]): void => {
    setSelectedDistricts(districtIds);

    // Auto-cleanup: remove subdistricts whose parent district is no longer selected
    setSelectedSubDistricts((prev) => {
      if (districtIds.length === 0) return [];

      return prev.filter((subId) => {
        const subDistrict = allSubDistricts.find((sd) => sd.id === subId);
        return (
          subDistrict && districtIds.includes(Number(subDistrict.districtId))
        );
      });
    });

    // Auto-cleanup: remove towns whose parent subdistrict is no longer valid
    setSelectedTowns((prev) => {
      if (districtIds.length === 0) return [];

      return prev.filter((townId) => {
        const town = allTowns.find((t) => t.id === townId);
        if (!town) return false;

        const subDistrict = allSubDistricts.find(
          (sd) => sd.id === town.subdistrict_code
        );
        return (
          subDistrict && districtIds.includes(Number(subDistrict.districtId))
        );
      });
    });
  };

  // ✅ Wrapper for setSelectedSubDistricts with auto-cleanup
  const handleSetSelectedSubDistricts = (subDistrictIds: number[]): void => {
    setSelectedSubDistricts(subDistrictIds);

    // Auto-cleanup: remove towns whose parent subdistrict is no longer selected
    setSelectedTowns((prev) => {
      if (subDistrictIds.length === 0) return [];

      return prev.filter((townId) => {
        const town = allTowns.find((t) => t.id === townId);
        return town && subDistrictIds.includes(Number(town.subdistrict_code));
      });
    });
  };

  // ✅ Fetch raster data when selections are locked
  useEffect(() => {
    const fetchRasterData = async () => {
      if (selectionsLocked && selectedTowns.length > 0) {
        setIsLoading(true);
        try {
          const response = await api.post(
            "/stp_operation/stp_suitability_visual_display",
            {
              body: {
                clip: selectedTowns,
                place: "sub_district",
              },
            }
          );
          const data = (await response.message) as raster_visual_resp;
          setDisplayRaster(data.raster_layer);
          setResultLayer(data.vector_layer);
        } catch (error) {
          console.log("Error fetching raster data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchRasterData();
  }, [selectionsLocked, selectedTowns]);

  // ✅ Confirm selections
  const confirmSelections = (): SelectionsData | null => {
    if (selectedTowns.length === 0) {
      return null;
    }

    const selectedSubDistrictObjects = allSubDistricts.filter((sd) =>
      selectedSubDistricts.includes(Number(sd.id))
    );

    const selectedTownObjects = allTowns.filter((town) =>
      selectedTowns.includes(Number(town.id))
    );

    setSelectionsLocked(true);

    return {
      subDistricts: selectedSubDistrictObjects,
      towns: selectedTownObjects,
      totalPopulation,
    };
  };

  const resetSelections = (): void => {
    setTotalPopulation(0);
    setSelectionsLocked(false);
    setDisplayRaster([]);
  };

  const contextValue: LocationContextType = {
    states: allStates,
    districts,
    subDistricts,
    towns,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedTowns,
    selectedVillages,
    totalPopulation,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts: handleSetSelectedDistricts,
    setSelectedSubDistricts: handleSetSelectedSubDistricts,
    setSelectedTowns,
    confirmSelections,
    displayRaster,
    setDisplayRaster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    selectedTownsNames,
    setSelectedState,
    resetSelections,
    setSelectedVillages,
    resultLayer,
    setResultLayer,
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