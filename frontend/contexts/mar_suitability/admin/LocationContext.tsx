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

export interface villages {
  id: string | number;
  name: string;
}

// Interface for selections return data

export interface SelectionsData {
  subDistricts: SubDistrict[];
  villages: villages[];
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
  villages: villages[];
  selectedState: number | null;
  selectedDistricts: number | null;
  selectedSubDistricts: number | null;
  selectedvillages: number[];
  selectionsLocked: boolean;
  displayRaster: clip_rasters[];
  setdisplay_raster: (layer: clip_rasters[]) => void;
  isLoading: boolean;
  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number) => void;
  setSelectedSubDistricts: (subDistrictIds: number) => void;
  setSelectedvillages: (townIds: number[]) => void;
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
  villages: [],
  selectedState: null,
  selectedDistricts: null,
  selectedSubDistricts: null,
  selectedvillages: [],

  selectionsLocked: false,
  isLoading: false,
  displayRaster: [],
  setdisplay_raster: () => { },
  handleStateChange: () => { },
  setSelectedDistricts: () => { },
  setSelectedSubDistricts: () => { },
  setSelectedvillages: () => { },
  confirmSelections: () => null,
  resetSelections: () => { },
});

// Create the provider component
export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  // State for location data
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);
  const [villages, setvillages] = useState<villages[]>([]);

  // State for selected locations
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number | null>(null);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number | null>(null);
  const [selectedvillages, setSelectedvillages] = useState<number[]>([]);

  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setdisplay_raster] = useState<clip_rasters[]>([]);
  // Load states on component mount
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
      setvillages([]);
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
    setSelectedDistricts(null);
    setSelectedSubDistricts(null);
    setSelectedvillages([]);
  }, [selectedState]);

  // Load sub-districts when districts are selected
  useEffect(() => {
    if (selectedDistricts == null) {
      setSubDistricts([]);
      setvillages([]);
      return;
    }


    const fetchSubDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await api.post("/location/get_sub_districts/", {
          body: {
            districts: [selectedDistricts],
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
    setSelectedSubDistricts(null);
    setSelectedvillages([]);
  }, [selectedDistricts]);

  useEffect(() => {
    const disp_raster = async () => {
      if (selectionsLocked === true) {
        setIsLoading(true);
        try {
          const response = await api.post("/gwz_operation/mar_suitability_visual_display", {
            body: {
              clip: selectedvillages,
              place: "District",
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
    if (selectedSubDistricts == null) {
      setvillages([]);
      return;
    }
    const fetchvillages = async () => {
      setIsLoading(true);
      try {
        const response = await api.post("/location/get_villages/", {
          body: {
            subdis_code: [selectedSubDistricts],
            all_data: true
          },
        });

        if (response.status != 201) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.message as villages[];

        const townData = data.map((town: villages) => ({
          id: town.id,
          name: town.name,
        }));

        setvillages(townData);
      } catch (error) {
        console.log('Error fetching villages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchvillages();
    setSelectedvillages([]);
  }, [selectedSubDistricts]);

  // Calculate total population based on selected TOWNS (not sub-districts)

  // Handle state selection
  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts(null);
    setSelectedSubDistricts(null)
    setSelectedvillages([]);
    setSelectionsLocked(false);

  };

  // Lock selections and return selected data (now requires towns to be selected)
  const confirmSelections = (): SelectionsData | null => {
    // Changed: Now requires towns to be selected instead of just sub-districts
    if (selectedvillages.length === 0) {
      return null;
    }

    const selectedSubDistrictObjects = subDistricts.filter(subDistrict =>
      subDistrict.id === selectedSubDistricts
    );

    const selectedTownObjects = villages.filter(town =>
      selectedvillages.includes(Number(town.id))
    );

    setSelectionsLocked(true);

    // Population is now calculated from selected towns, not sub-districts
    return {
      subDistricts: selectedSubDistrictObjects,
      villages: selectedTownObjects,

    };
  };

  // Reset all selections
  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistricts(null);
    setSelectedSubDistricts(null);
    setSelectedvillages([]);
    setSelectionsLocked(false);
  };

  // Context value
  const contextValue: LocationContextType = {
    states,
    districts,
    subDistricts,
    villages,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedvillages,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    setSelectedvillages,
    confirmSelections,
    resetSelections,
    displayRaster,
    setdisplay_raster
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