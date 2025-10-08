'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';

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
  districtName: string;
  population?: number;
}

export type SelectedSubdistrict = {
  id: number;
  name: string;
  districtId: number;
  districtName: string;
  population?: number;
};

type LocationContextType = {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];

  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];

  selectedSubdistrictObjects: SelectedSubdistrict[];

  totalPopulation: number;
  selectionsLocked: boolean;
  isLoading: boolean;
  error: string | null;

  selectionConfirmed: boolean;
  initialDataLoaded: boolean; // NEW PROPERTY

  handleStateChange: (stateId: number) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;

  confirmSelection: () => void;

  lockSelections: () => void;
  resetSelections: () => void;

  getConfirmedSubdistrictIds: () => number[];
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);

  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<number[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<number[]>([]);

  const [selectedSubdistrictObjects, setSelectedSubdistrictObjects] = useState<SelectedSubdistrict[]>([]);

  const [totalPopulation, setTotalPopulation] = useState<number>(0);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false); // NEW STATE

  // NEW EFFECT: Read URL parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    
    const stateParam = searchParams.get('state');
    const districtsParam = searchParams.get('districts');
    const subdistrictsParam = searchParams.get('subdistricts');

    console.log('=== RECEIVING DATA FROM GROUNDWATER MODULE ===');
    console.log('State param:', stateParam);
    console.log('Districts param:', districtsParam);
    console.log('Subdistricts param:', subdistrictsParam);

    if (stateParam) {
      const stateId = parseInt(stateParam);
      console.log('Parsed State ID:', stateId);
      
      setSelectedState(stateId);

      if (districtsParam) {
        const districtIds = districtsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        console.log('Parsed District IDs:', districtIds);
        
        setTimeout(() => {
          setSelectedDistricts(districtIds);
        }, 1000);
      }

      if (subdistrictsParam) {
        const subdistrictIds = subdistrictsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        console.log('Parsed Subdistrict IDs:', subdistrictIds);
        
        setTimeout(() => {
          setSelectedSubDistricts(subdistrictIds);
          setInitialDataLoaded(true);
        }, 2000);
      }
    }

    console.log('=============================================');
  }, []);

  // NEW EFFECT: Auto-confirm selection if data came from URL
  useEffect(() => {
    if (initialDataLoaded && selectedSubDistricts.length > 0 && !selectionConfirmed) {
      console.log('Auto-confirming selection from URL parameters');
      setTimeout(() => {
        setSelectionConfirmed(true);
      }, 500);
    }
  }, [initialDataLoaded, selectedSubDistricts, selectionConfirmed]);

  // Fetch states
  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/django/state', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const stateData: State[] = Array.isArray(data) && data.length > 0
          ? data.map((s: any) => ({ id: s.state_code, name: s.state_name }))
          : [];
        setStates(stateData);
        if (!Array.isArray(data) || data.length === 0) setError('No states found.');
      } catch (e: any) {
        setError(`Failed to fetch states: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStates();
  }, []);

  // Fetch districts on state select
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      setSelectedDistricts([]);
      setSubDistricts([]);
      setSelectedSubDistricts([]);
      setSelectedSubdistrictObjects([]);
      setTotalPopulation(0);
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/django/district/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state_code: selectedState }),
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const districtData: District[] = (Array.isArray(data) ? data : []).map((d: any) => ({
          id: d.district_code,
          name: d.district_name,
          stateId: selectedState,
        }));
        const sortedDistricts = [...districtData].sort((a, b) => a.name.localeCompare(b.name));
        setDistricts(sortedDistricts);
        if (sortedDistricts.length === 0) setError('No districts found for the selected state.');
      } catch (e: any) {
        setError(`Failed to fetch districts: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDistricts();
  }, [selectedState]);

  // Fetch subdistricts on district select
  useEffect(() => {
    if (selectedDistricts.length === 0) {
      setSubDistricts([]);
      setSelectedSubDistricts([]);
      setSelectedSubdistrictObjects([]);
      setTotalPopulation(0);
      return;
    }

    const fetchSubDistricts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/django/subdistrict/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ district_code: selectedDistricts }),
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        const districtMap = new Map(districts.map((d) => [d.id.toString(), d.name]));
        const subDistrictData: SubDistrict[] = (Array.isArray(data) ? data : []).map((sd: any) => {
          const districtId = sd.district_code?.toString?.() ?? '';
          return {
            id: sd.subdistrict_code,
            name: sd.subdistrict_name,
            districtId: parseInt(districtId),
            districtName: districtMap.get(districtId) || 'Unknown District',
            population: sd.population_2011 || 0,
          };
        });

        const sorted = [...subDistrictData].sort((a, b) => {
          const d = a.districtName.localeCompare(b.districtName);
          return d !== 0 ? d : a.name.localeCompare(b.name);
        });
        setSubDistricts(sorted);
        if (sorted.length === 0) setError('No sub-districts found for the selected districts.');
      } catch (e: any) {
        setError(`Failed to fetch sub-districts: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubDistricts();
  }, [selectedDistricts, districts]);

  // Compute total population on subdistrict selection
  useEffect(() => {
    if (selectedSubDistricts.length > 0) {
      const picked = subDistricts.filter((sd) => selectedSubDistricts.includes(Number(sd.id)));
      const total = picked.reduce((sum, sd) => sum + (sd.population || 0), 0);
      setTotalPopulation(total);
    } else {
      setTotalPopulation(0);
    }
  }, [selectedSubDistricts, subDistricts]);

  // Build selectedSubdistrictObjects
  useEffect(() => {
    if (selectedSubDistricts.length === 0) {
      setSelectedSubdistrictObjects([]);
      return;
    }
    const picked = subDistricts.filter((sd) => selectedSubDistricts.includes(Number(sd.id)));
    const out: SelectedSubdistrict[] = picked.map((sd) => ({
      id: Number(sd.id),
      name: sd.name,
      districtId: Number(sd.districtId),
      districtName: sd.districtName,
      population: sd.population,
    }));
    setSelectedSubdistrictObjects(out);
  }, [selectedSubDistricts, subDistricts]);

  const handleStateChange = (stateId: number): void => {
    setSelectedState(stateId);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedSubdistrictObjects([]);
    setTotalPopulation(0);
    setSelectionsLocked(false);
    setSelectionConfirmed(false);
    setError(null);
  };

  const confirmSelection = () => {
    if (selectedSubDistricts.length > 0) setSelectionConfirmed(true);
  };

  const lockSelections = () => setSelectionsLocked(true);

  const resetSelections = (): void => {
    setSelectedState(null);
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedSubdistrictObjects([]);
    setTotalPopulation(0);
    setSelectionsLocked(false);
    setError(null);
    setSelectionConfirmed(false);
    setInitialDataLoaded(false); // RESET NEW STATE
  };

  const updateSelectedDistricts = (districtIds: number[]): void => {
    setSelectedDistricts(districtIds);
    setSelectionConfirmed(false);
  };

  const updateSelectedSubDistricts = (subDistrictIds: number[]): void => {
    setSelectedSubDistricts(subDistrictIds);
    setSelectionConfirmed(false);
  };

  const getConfirmedSubdistrictIds = useMemo(() => {
    return () => {
      if (!selectionConfirmed) return [];
      return [...selectedSubDistricts];
    };
  }, [selectionConfirmed, selectedSubDistricts]);

  const contextValue: LocationContextType = {
    states,
    districts,
    subDistricts,

    selectedState,
    selectedDistricts,
    selectedSubDistricts,

    selectedSubdistrictObjects,

    totalPopulation,
    selectionsLocked,
    isLoading,
    error,

    selectionConfirmed,
    initialDataLoaded, // ADDED TO CONTEXT

    handleStateChange,
    setSelectedDistricts: updateSelectedDistricts,
    setSelectedSubDistricts: updateSelectedSubDistricts,

    confirmSelection,

    lockSelections,
    resetSelections,

    getConfirmedSubdistrictIds,
  };

  return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>;
};

export const useLocationContext = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationContext must be used within a LocationProvider');
  return context;
};