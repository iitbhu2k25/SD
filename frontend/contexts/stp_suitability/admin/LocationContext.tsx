'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/services/api';

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

export interface Towns {
  id: string | number;
  name: string;
  population: number;
  subdistrictId: string | number;
}

// Interface for selections return data
export interface SelectionsData {
  subDistricts: SubDistrict[];
  towns: Towns[];
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
  towns: Towns[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  selectedTowns: number[];
  selectedVillages: number[];
  totalPopulation: number;
  selectionsLocked: boolean;
  displayRaster: clip_rasters[];
  setdisplay_raster: (layer: clip_rasters[]) => void;
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
  selectedTownsNames: string[];

  isLoading: boolean;
  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  setSelectedTowns: (townIds: number[]) => void;
  confirmSelections: () => SelectionsData | null;
  resetSelections: () => void;
  setSelectedVillages: (villageIds: number[]) => void
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
  setdisplay_raster: () => { },
  handleStateChange: () => { },
  setSelectedDistricts: () => { },
  setSelectedSubDistricts: () => { },
  setSelectedTowns: () => { },
  confirmSelections: () => null,
  resetSelections: () => { },
  setSelectedVillages: () => { }
});

// Create the provider component
export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  // State for location data
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);
  const [towns, setTowns] = useState<Towns[]>([]);

  // State for selected locations
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<number[]>([]);

  // State for additional information
  const [totalPopulation, setTotalPopulation] = useState<number>(0);
  const [selectedVillages, setSelectedVillages] =useState<number[]>([]);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setdisplay_raster] = useState<clip_rasters[]>([]);
  const [selectedStateName, setSelectedStateName] = useState<string>("");
  const [selectedDistrictsNames, setSelectedDistrictNames] = useState<string[]>([]);
  const [selectedSubDistrictsNames, setSelectedSubDistrictNames] = useState<string[]>([]);
  const [selectedTownsNames, setSelectedTownsNames] = useState<string[]>([]);
  useEffect(() => {
    setSelectedStateName(states.find((state) => state.id === selectedState)?.name || "");
    setSelectedDistrictNames(districts.filter((district) => selectedDistricts.includes(district.id as number)).map((district) => district.name));
    setSelectedSubDistrictNames(subDistricts.filter((subDistrict) => selectedSubDistricts.includes(subDistrict.id as number)).map((subDistrict) => subDistrict.name));
    setSelectedTownsNames(towns.filter((town) => selectedTowns.includes(town.id as number)).map((town) => town.name));
  }, [selectionsLocked])
  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/location/get_states?all_data=true');

        if (response.status != 201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as State[];
        const stateData = data.map((state: State) => ({
          id: state.id,
          name: state.name
        }));

        setStates(stateData);
      } catch (error) {
        console.log('Error fetching states:', error);
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
      setSubDistricts([]);
      setTowns([]);
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await api.post('/location/get_districts', {
          body: {
            state: selectedState,
            all_data: true,
          },
        })

        if (response.status != 201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as District[];

        const districtData = data.map((district: District) => ({
          id: district.id,
          name: district.name,
          stateId: selectedState
        }));

        setDistricts(districtData);
      } catch (error) {
        console.log('Error fetching districts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistricts();

    // Reset dependent selections when state changes
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedTowns([]);
    setTotalPopulation(0);
  }, [selectedState]);

  // Load sub-districts when districts are selected
  useEffect(() => {
    if (selectedDistricts.length === 0) {
      setSubDistricts([]);
      setTowns([]);
      return;
    }

    const fetchSubDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await api.post("/location/get_sub_districts/", {
          body: {
            districts: selectedDistricts,
            all_data: true,
          },
        });

        if (response.status != 201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as SubDistrict[];
       
        const subDistrictData = data.map((subDistrict: SubDistrict) => ({
          id: subDistrict.id,
          name: subDistrict.name,
          districtId: subDistrict.districtId
        }));

        setSubDistricts(subDistrictData);
      } catch (error) {
        console.log('Error fetching sub-districts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubDistricts();

    // Reset dependent selections when districts change
    setSelectedSubDistricts([]);
    setSelectedTowns([]);
    setTotalPopulation(0);
  }, [selectedDistricts]);

  useEffect(() => {
    const disp_raster = async () => {
      if (selectionsLocked === true) {
        setIsLoading(true);
        try {
          const response = await api.post("/stp_operation/stp_suitability_visual_display", {
            body: {
              clip: selectedTowns,
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
  // Load towns when sub-districts are selected
  useEffect(() => {
    if (selectedSubDistricts.length === 0) {
      setTowns([]);
      return;
    }

    const fetchTowns = async () => {
      setIsLoading(true);
      try {
        const response = await api.post("/location/get_towns/", {
          body: {
            subdis_code: selectedSubDistricts,
            all_data: true
          },
        });

        if (response.status != 201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as Towns[];
        const townData = data.map((town: Towns) => ({
          id: town.id,
          name: town.name,
          population: town.population || 0,
          subdistrictId: selectedSubDistricts[0]
        }));

        setTowns(townData);
      } catch (error) {
        console.log('Error fetching towns:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTowns();

    // Reset town selections when sub-districts change
    setSelectedTowns([]);
    setTotalPopulation(0);
  }, [selectedSubDistricts]);

  // Calculate total population based on selected TOWNS (not sub-districts)
  useEffect(() => {
    if (selectedTowns.length > 0) {
      // Filter to get only selected towns
      const selectedTownObjects = towns.filter(town =>
        selectedTowns.includes(Number(town.id))
      );

      // Calculate total population from selected towns
      const total = selectedTownObjects.reduce(
        (sum, town) => sum + (town.population || 0),
        0
      );

      setTotalPopulation(total);
    } else {
      setTotalPopulation(0);
    }
  }, [towns, selectedTowns]);

  // Handle state selection
  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedTowns([]);
    setSelectionsLocked(false);
    setTotalPopulation(0);
  };

  // Lock selections and return selected data (now requires towns to be selected)
  const confirmSelections = (): SelectionsData | null => {
    // Changed: Now requires towns to be selected instead of just sub-districts
    if (selectedTowns.length === 0) {
      return null;
    }

    const selectedSubDistrictObjects = subDistricts.filter(subDistrict =>
      selectedSubDistricts.includes(Number(subDistrict.id))
    );

    const selectedTownObjects = towns.filter(town =>
      selectedTowns.includes(Number(town.id))
    );

    setSelectionsLocked(true);

    // Population is now calculated from selected towns, not sub-districts
    return {
      subDistricts: selectedSubDistrictObjects,
      towns: selectedTownObjects,
      totalPopulation // This comes from selected towns
    };
  };

  // Reset all selections
  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedTowns([]);
    setTotalPopulation(0);
    setSelectionsLocked(false);
  };

  // Context value
  const contextValue: LocationContextType = {
    states,
    districts,
    subDistricts,
    towns,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedTowns,
    totalPopulation,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    setSelectedTowns,
    confirmSelections,
    resetSelections,
    displayRaster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    selectedTownsNames,
    setdisplay_raster,
    setSelectedVillages,
    selectedVillages
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
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};