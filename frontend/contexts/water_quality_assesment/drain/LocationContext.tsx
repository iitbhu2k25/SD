"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from "react";

// Define types for the location data
export interface River {
  id: string | number;
  name: string;
  code: number;
}

export interface Stretch {
  id: string | number;
  name: string;
  stretchId: number;
  riverCode: number;
  riverName: string;
}

export interface Drain {
  id: string | number;
  drainNo: number;
  riverCode: number;
  stretchId: number;
}

export interface Catchment {
  id: string | number;
  name: string;
  objectId: number;
  gridCode: number;
  drainNo: number;
}

export interface Village {
  code: any;
  id: string | number;
  name: string;
  village_code: string | number;
  catchment_gridcode?: number;
}

interface LocationContextType {
  // Location data
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  villages: Village[];
  
  // Selected values
  selectedRiver: number | null;
  selectedStretch: number | null;
  selectedDrain: number | null;
  selectedCatchments: number[];
  selectedVillages: number[];
  
  // UI states
  selectionsLocked: boolean;
  isLoading: boolean;
  error: string | null;
  areaConfirmed: boolean;
  
  // Selection functions
  handleRiverChange: (riverCode: number) => void;
  handleStretchChange: (stretchId: number) => void;
  handleDrainChange: (drainNo: number) => void;
  setSelectedCatchments: (catchmentCodes: number[]) => void;
  setSelectedVillages: (villageCodes: number[]) => void;
  
  // Area functions
  handleAreaConfirm: () => void;
  
  // Final actions
  lockSelections: () => void;
  resetSelections: () => void;
}

interface LocationProviderProps {
  children: ReactNode;
  geoServerBaseUrl?: string;
  villageApiBaseUrl?: string;
}

const LocationContext = createContext<LocationContextType>({
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  villages: [],
  selectedRiver: null,
  selectedStretch: null,
  selectedDrain: null,
  selectedCatchments: [],
  selectedVillages: [],
  selectionsLocked: false,
  isLoading: false,
  error: null,
  areaConfirmed: false,
  handleRiverChange: () => {},
  handleStretchChange: () => {},
  handleDrainChange: () => {},
  setSelectedCatchments: () => {},
  setSelectedVillages: () => {},
  handleAreaConfirm: () => {},
  lockSelections: () => {},
  resetSelections: () => {},
});

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
  geoServerBaseUrl = "/geoserver", // Updated default GeoServer base URL
  villageApiBaseUrl = "/django", // Default Village API base URL
}) => {
  // Location state
  const [rivers, setRivers] = useState<River[]>([]);
  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [drains, setDrains] = useState<Drain[]>([]);
  const [catchments, setCatchments] = useState<Catchment[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  
  // Selected values
  const [selectedRiver, setSelectedRiver] = useState<number | null>(null);
  const [selectedStretch, setSelectedStretch] = useState<number | null>(null);
  const [selectedDrain, setSelectedDrain] = useState<number | null>(null);
  const [selectedCatchments, setSelectedCatchments] = useState<number[]>([]);
  const [selectedVillages, setSelectedVillages] = useState<number[]>([]);
  
  // UI states
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [areaConfirmed, setAreaConfirmed] = useState(false);


  
// Helper function to fetch villages from API
const fetchVillagesFromAPI = async (drainNumbers: number[]) => {
  try {
    const allVillages: Village[] = [];
    
    // Fetch villages for each selected drain number
    for (const drainNo of drainNumbers) {
      console.log(`Fetching villages for Drain_No: ${drainNo}`);
      
      const response = await fetch(`${villageApiBaseUrl}/gwa/villagescatchment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Drain_No: drainNo }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} for Drain_No: ${drainNo}`);
      }
      
      const responseData = await response.json();
      console.log(`Villages response for Drain_No ${drainNo}:`, responseData);
      
      // Extract the villages array from the response
      const villages = responseData.villages || [];
      
      // Transform API response to our Village interface
      const villageData: Village[] = villages.map((village: any) => ({
        id: village.village_code,
        name: village.name || `Village ${village.village_code}`,
        code: village.village_code,
        village_code: village.village_code,
        catchment_gridcode: drainNo, // Now storing drain number instead of gridcode
      }));
      
      allVillages.push(...villageData);
    }
    
    // Remove duplicates based on village_code and sort by name
    const uniqueVillages = allVillages.filter((village, index, self) => 
      index === self.findIndex(v => v.village_code === village.village_code)
    ).sort((a, b) => a.name.localeCompare(b.name));
    
    return uniqueVillages;
  } catch (error) {
   console.log('Error fetching villages from API:', error);
    throw error;
  }
};

  const fetchGeoServerData = async (layerName: string, cqlFilter?: string) => {
    try {
      let url: string;
      
      if (cqlFilter) {
        url = `${geoServerBaseUrl}/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;
      } else {
        url = `${geoServerBaseUrl}/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json`;
      }

      console.log(`Fetching from GeoServer: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.features || [];
    } catch (error) {
     console.log(`Error fetching ${layerName}:`, error);
      throw error;
    }
  };

  // Fetch rivers on component mount
  useEffect(() => {
    const fetchRivers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching rivers from GeoServer");
        const features = await fetchGeoServerData('Rivers');
        
        const riverData: River[] = features.map((feature: any) => ({
          id: feature.properties.River_Code,
          name: feature.properties.River_Name,
          code: feature.properties.River_Code,
        }));
        
        // Remove duplicates and sort
        const uniqueRivers = riverData.filter((river, index, self) => 
          index === self.findIndex(r => r.code === river.code)
        ).sort((a, b) => a.name.localeCompare(b.name));
        
        setRivers(uniqueRivers);
        
        if (uniqueRivers.length === 0) {
          setError("No rivers found.");
        }
      } catch (error: any) {
       console.log("Error fetching rivers:", error);
        setError(`Failed to fetch rivers: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRivers();
  }, [geoServerBaseUrl]);

  // Fetch stretches when river is selected
  useEffect(() => {
    if (!selectedRiver) {
      setStretches([]);
      setSelectedStretch(null);
      setDrains([]);
      setSelectedDrain(null);
      setCatchments([]);
      setVillages([]);
      setSelectedCatchments([]);
      setSelectedVillages([]);
      return;
    }

    const fetchStretches = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching stretches for river:", selectedRiver);
        const cqlFilter = `River_Code=${selectedRiver}`;
        const features = await fetchGeoServerData('Stretches', cqlFilter);
        
        const stretchData: Stretch[] = features.map((feature: any) => ({
          id: feature.properties.Stretch_ID,
          name: `Stretch ${feature.properties.Stretch_ID}`,
          stretchId: feature.properties.Stretch_ID,
          riverCode: feature.properties.River_Code,
          riverName: feature.properties.River_Name,
        }));
        
        const sortedStretches = stretchData.sort((a, b) => a.stretchId - b.stretchId);
        setStretches(sortedStretches);
        
        if (sortedStretches.length === 0) {
          setError("No stretches found for the selected river.");
        }
      } catch (error: any) {
       console.log("Error fetching stretches:", error);
        setError(`Failed to fetch stretches: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStretches();
  }, [selectedRiver, geoServerBaseUrl]);

  // Fetch drains when stretch is selected
  useEffect(() => {
    if (!selectedStretch || !selectedRiver) {
      setDrains([]);
      setSelectedDrain(null);
      setCatchments([]);
      setVillages([]);
      setSelectedCatchments([]);
      setSelectedVillages([]);
      return;
    }

    const fetchDrains = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching drains for stretch:", selectedStretch, "and river:", selectedRiver);
        const cqlFilter = `Stretch_ID=${selectedStretch} AND River_Code=${selectedRiver}`;
        const features = await fetchGeoServerData('Drain', cqlFilter);
        
        const drainData: Drain[] = features.map((feature: any) => ({
          id: feature.properties.Drain_No,
          drainNo: feature.properties.Drain_No,
          riverCode: feature.properties.River_Code,
          stretchId: feature.properties.Stretch_ID,
        }));
        
        const sortedDrains = drainData.sort((a, b) => a.drainNo - b.drainNo);
        setDrains(sortedDrains);
        
        if (sortedDrains.length === 0) {
          setError("No drains found for the selected stretch.");
        }
      } catch (error: any) {
       console.log("Error fetching drains:", error);
        setError(`Failed to fetch drains: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDrains();
  }, [selectedStretch, selectedRiver, geoServerBaseUrl]);

  // Fetch catchments when drain is selected
  // PASTE THIS NEW CODE
// Fetch and automatically select catchments when drain is selected
useEffect(() => {
    if (!selectedDrain) {
      setCatchments([]);
      setSelectedCatchments([]); // Ensure these are cleared
      setVillages([]);
      setSelectedVillages([]);
      return;
    }

    const fetchAndSelectCatchment = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching catchments for drain:", selectedDrain);
        const cqlFilter = `Drain_No=${selectedDrain}`;
        const features = await fetchGeoServerData('Catchment', cqlFilter);

        const catchmentData: Catchment[] = features.map((feature: any) => ({
          id: feature.properties.OBJECTID,
          name: `Catchment ${feature.properties.GRIDCODE} (Drain ${feature.properties.Drain_No})`,
          objectId: feature.properties.OBJECTID,
          gridCode: feature.properties.GRIDCODE,
          drainNo: feature.properties.Drain_No,
        }));

        const sortedCatchments = catchmentData.sort((a, b) => a.gridCode - b.gridCode);
        setCatchments(sortedCatchments); // We still set this state for consistency

        if (sortedCatchments.length > 0) {
          // *** NEW LOGIC: AUTO-SELECT THE CATCHMENT(S) ***
          const catchmentIds = sortedCatchments.map(c => Number(c.objectId));
          console.log(`Automatically selecting catchment(s) for drain ${selectedDrain}:`, catchmentIds);
          setSelectedCatchments(catchmentIds); 
        } else {
          setError("No catchments found for the selected drain.");
          setSelectedCatchments([]); // Clear if none are found
          setVillages([]);
        }
      } catch (error: any) {
       console.log("Error fetching catchments:", error);
        setError(`Failed to fetch catchments: ${error.message}`);
        setSelectedCatchments([]);
        setVillages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSelectCatchment();
}, [selectedDrain, geoServerBaseUrl]);

  
 // Fetch villages when catchments are selected and auto-select all of them
  useEffect(() => {
    if (selectedCatchments.length === 0) {
      setVillages([]);
      setSelectedVillages([]);
      return;
    }

    const fetchAndSelectVillages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching villages for selected catchments:", selectedCatchments);
        
        const selectedCatchmentObjects = catchments.filter(c => 
          selectedCatchments.includes(Number(c.objectId))
        );
        const drainNumbers = [...new Set(selectedCatchmentObjects.map(c => c.drainNo))];
        
        console.log("Drain_No values to send to API:", drainNumbers);
        
        if (drainNumbers.length === 0) {
          setError("No valid Drain_No found for selected catchments.");
          return;
        }
        
        const villageData = await fetchVillagesFromAPI(drainNumbers);
        setVillages(villageData);
        
        if (villageData.length > 0) {
          // *** NEW: AUTO-SELECT ALL FETCHED VILLAGES ***
          const allVillageCodes = villageData.map(v => Number(v.code));
          console.log("Automatically selecting all villages:", allVillageCodes);
          setSelectedVillages(allVillageCodes);
        } else {
          setError("No villages found for the selected catchments.");
          setSelectedVillages([]); // Clear selection if no villages are found
        }
      } catch (error: any) {
       console.log("Error fetching villages:", error);
        setError(`Failed to fetch villages: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAndSelectVillages();
  }, [selectedCatchments, catchments, villageApiBaseUrl]);

  // Handle river selection
  const handleRiverChange = (riverCode: number): void => {
    console.log("River changed to:", riverCode);
    setSelectedRiver(riverCode);
    setSelectedStretch(null);
    setSelectedDrain(null);
    setSelectedCatchments([]);
    setSelectedVillages([]);
    setSelectionsLocked(false);
    setAreaConfirmed(false);
  };

  // Handle stretch selection
  const handleStretchChange = (stretchId: number): void => {
    console.log("Stretch changed to:", stretchId);
    setSelectedStretch(stretchId);
    setSelectedDrain(null);
    setSelectedCatchments([]);
    setSelectedVillages([]);
    setAreaConfirmed(false);
  };

  // Handle drain selection
  const handleDrainChange = (drainNo: number): void => {
    console.log("Drain changed to:", drainNo);
    setSelectedDrain(drainNo);
    setSelectedCatchments([]);
    setSelectedVillages([]);
    setAreaConfirmed(false);
  };

  // Handle area confirmation
  const handleAreaConfirm = () => {
    if (selectedVillages.length > 0 || selectedCatchments.length > 0) {
      setAreaConfirmed(true);
      console.log("Area selection confirmed");
    }
  };

  // Lock selections
  const lockSelections = () => {
    setSelectionsLocked(true);
  };

  // Reset all selections
  const resetSelections = (): void => {
    console.log("Resetting all selections");
    setSelectedRiver(null);
    setSelectedStretch(null);
    setSelectedDrain(null);
    setSelectedCatchments([]);
    setSelectedVillages([]);
    setSelectionsLocked(false);
    setError(null);
    setAreaConfirmed(false);
  };

  // Update catchments with area confirmation reset
  const updateSelectedCatchments = (catchmentCodes: number[]): void => {
    setSelectedCatchments(catchmentCodes);
    setAreaConfirmed(false);
  };

  // Update villages with area confirmation reset
  const updateSelectedVillages = (villageCodes: number[]): void => {
    setSelectedVillages(villageCodes);
    setAreaConfirmed(false);
  };

  // In LocationContext.tsx, REPLACE the old contextValue with this:

  const contextValue = useMemo(() => ({
    // Location data
    rivers,
    stretches,
    drains,
    catchments,
    villages,

    // Selected values
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,

    // UI states
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed,

    // Selection functions
    handleRiverChange,
    handleStretchChange,
    handleDrainChange,
    setSelectedCatchments: updateSelectedCatchments,
    setSelectedVillages: updateSelectedVillages,

    // Area functions
    handleAreaConfirm,

    // Final actions
    lockSelections,
    resetSelections,
  }), [
    rivers,
    stretches,
    drains,
    catchments,
    villages,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed
  ]);

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