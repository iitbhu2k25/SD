"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

/* ================= TYPES ================= */

export interface State {
  id: string;
  name: string;
}

export interface District {
  id: string;
  name: string;
  stateId: string;
}

export interface Block {
  id: string;
  name: string;
  districtCode: string;
}

export interface Village {
  id: string;
  name: string;
  blockCode: string;
}

interface LocationContextType {
  states: State[];
  districts: District[];
  blocks: Block[];
  villages: Village[];

  selectedState: string | null;
  selectedDistricts: string[];
  selectedBlocks: string[];
  selectedVillages: string[];

  isLoading: boolean;
  error: string | null;

  handleStateChange: (stateId: string) => void;
  setSelectedDistricts: (districtIds: string[]) => void;
  setSelectedBlocks: (blockIds: string[]) => void;
  setSelectedVillages: (villageIds: string[]) => void;

  resetSelections: () => void;
}

/* ================= CONTEXT ================= */

const LocationContext = createContext<LocationContextType>({
  states: [],
  districts: [],
  blocks: [],
  villages: [],
  selectedState: null,
  selectedDistricts: [],
  selectedBlocks: [],
  selectedVillages: [],
  isLoading: false,
  error: null,
  handleStateChange: () => {},
  setSelectedDistricts: () => {},
  setSelectedBlocks: () => {},
  setSelectedVillages: () => {},
  resetSelections: () => {},
});

/* ================= PROVIDER ================= */

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);

  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistricts, setSelectedDistrictsState] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocksState] = useState<string[]>([]);
  const [selectedVillages, setSelectedVillagesState] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= FETCH STATES ================= */

  useEffect(() => {
    const fetchStates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/django/state");
        const data = await response.json();

        const formatted: State[] = data.map((s: any) => ({
          id: String(s.state_code).padStart(2, '0'),
          name: s.state_name,
        }));

        console.log('🌟 States loaded:', formatted.length);
        setStates(formatted);
      } catch (err) {
        console.error('❌ States fetch failed:', err);
        setError("Failed to fetch states");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStates();
  }, []);

  /* ================= FETCH DISTRICTS ================= */

  useEffect(() => {
    console.log('🔄 Districts useEffect triggered:', { selectedState });
    
    if (!selectedState) {
      console.log('❌ No selectedState, clearing districts');
      setDistricts([]);
      setSelectedDistrictsState([]);
      setBlocks([]);
      setVillages([]);
      setSelectedBlocksState([]);
      setSelectedVillagesState([]);
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      try {
        console.log('📤 Fetching districts for state:', selectedState);
        const response = await fetch("/django/district/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state_code: selectedState }),
        });

        const data = await response.json();
        const formatted: District[] = data.map((d: any) => ({
          id: String(d.district_code).padStart(3, '0'),
          name: d.district_name,
          stateId: selectedState,
        }));

        console.log('🌟 Districts loaded:', formatted.length);
        setDistricts(formatted);
      } catch (err) {
        console.error('❌ Districts fetch failed:', err);
        setError("Failed to fetch districts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistricts();
  }, [selectedState]);

  /* ================= FETCH BLOCKS (MULTI DISTRICT) ================= */

  useEffect(() => {
    console.log('🔄 Blocks useEffect triggered:', { selectedDistricts: selectedDistricts.length });
    
    if (selectedDistricts.length === 0) {
      console.log('❌ No selectedDistricts, clearing blocks');
      setBlocks([]);
      setVillages([]);
      setSelectedBlocksState([]);
      setSelectedVillagesState([]);
      return;
    }

    const fetchBlocks = async () => {
      setIsLoading(true);
      try {
        console.log('📤 Fetching blocks for districts:', selectedDistricts);
        const response = await fetch("/django/rsq/getblocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            districtcodes: selectedDistricts,
          }),
        });

        const data = await response.json();
        const formatted: Block[] = data.map((b: any) => ({
          id: String(b.blockcode).padStart(4, '0'),
          name: b.block,
          districtCode: String(b.districtcode).padStart(3, '0'),
        }));

        console.log('🌟 Blocks loaded:', formatted.length);
        setBlocks(formatted);
        setVillages([]);
        setSelectedBlocksState([]);
        setSelectedVillagesState([]);
      } catch (err) {
        console.error('❌ Blocks fetch failed:', err);
        setError("Failed to fetch blocks");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlocks();
  }, [selectedDistricts]);

  /* ================= FETCH VILLAGES (MULTI BLOCK) ================= */

  useEffect(() => {
    console.log('🔄 Villages useEffect triggered:', { selectedBlocks: selectedBlocks.length });
    
    if (selectedBlocks.length === 0) {
      console.log('❌ No selectedBlocks, clearing villages');
      setVillages([]);
      setSelectedVillagesState([]);
      return;
    }

    const fetchVillages = async () => {
      setIsLoading(true);
      try {
        console.log('📤 Fetching villages for blocks:', selectedBlocks);
        const response = await fetch("/django/rsq/getvillages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockcodes: selectedBlocks,
          }),
        });

        const data = await response.json();
        const formatted: Village[] = data.map((v: any) => ({
          id: String(v.vlcode).padStart(6, '0'),
          name: v.village,
          blockCode: String(v.blockcode).padStart(4, '0'),
        }));

        console.log('🌟 Villages loaded:', formatted.length, 'first few:', formatted.slice(0, 3));
        setVillages(formatted);
        setSelectedVillagesState([]);
      } catch (err) {
        console.error('❌ Villages fetch failed:', err);
        setError("Failed to fetch villages");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVillages();
  }, [selectedBlocks]);

  /* ================= HANDLERS ================= */

  const handleStateChange = (stateId: string) => {
    console.log('🏠 State changed to:', stateId);
    setSelectedState(stateId);
    setSelectedDistrictsState([]);
    setSelectedBlocksState([]);
    setSelectedVillagesState([]);
    setBlocks([]);
    setVillages([]);
  };

  const updateSelectedDistricts = (districtIds: string[]) => {
    console.log('🏢 Districts selected:', districtIds);
    setSelectedDistrictsState(districtIds);
    setSelectedBlocksState([]);
    setSelectedVillagesState([]);
    setBlocks([]);
    setVillages([]);
  };

  const updateSelectedBlocks = (blockIds: string[]) => {
    console.log('🏭 Blocks selected:', blockIds);
    setSelectedBlocksState(blockIds);
    setSelectedVillagesState([]);
    setVillages([]);
  };

  const updateSelectedVillages = (villageIds: string[]) => {
    console.log('🚀 🏘️ VILLAGES SELECTED:', villageIds, 'Previous:', selectedVillages);
    setSelectedVillagesState(villageIds);
  };

  const resetSelections = () => {
    console.log('🔄 Reset all selections');
    setSelectedState(null);
    setSelectedDistrictsState([]);
    setSelectedBlocksState([]);
    setSelectedVillagesState([]);
    setBlocks([]);
    setVillages([]);
    setError(null);
  };

  /* ================= PROVIDER VALUE ================= */

  const contextValue: LocationContextType = {
    states,
    districts,
    blocks,
    villages,
    selectedState,
    selectedDistricts,
    selectedBlocks,
    selectedVillages,
    isLoading,
    error,
    handleStateChange,
    setSelectedDistricts: updateSelectedDistricts,
    setSelectedBlocks: updateSelectedBlocks,
    setSelectedVillages: updateSelectedVillages,
    resetSelections,
  };

  // ✅ DEBUG: Log context state changes
  useEffect(() => {
    console.log('📊 LocationContext State:', {
      selectedState,
      selectedDistricts: selectedDistricts.length,
      selectedBlocks: selectedBlocks.length,
      selectedVillages: selectedVillages.length,
      totalVillages: villages.length
    });
  }, [selectedState, selectedDistricts, selectedBlocks, selectedVillages, villages.length]);

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

/* ================= HOOK ================= */

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used inside LocationProvider");
  }
  return context;
};
