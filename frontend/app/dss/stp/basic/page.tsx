'use client'
import React, { useEffect, useState, useRef, useMemo } from "react"
import isEqual from 'lodash/isEqual';
import dynamic from "next/dynamic";
import StatusBar from "./components/statusbar"
import LocationSelector from "./components/locations"
import DrainLocationSelector from "./components/drainlocations"
import Population from "./populations/population"
import Water_Demand from "./water_demand/page"
import Water_Supply from "./water_supply/page"
import Sewage from "./seawage/page"
import SewageCalculationForm from "./seawage/components/SewageCalculationForm";
import WaterSupplyForm from "./water_supply/components/WaterSupplyForm";
import WaterDemandForm from "./water_demand/components/WaterDemandForm";
import IndCatchmentSelector from "./components/indlocation";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { BasicModuleInfoButton, useBasicModuleInfo } from './components/BasicModuleInfo';

const Map = dynamic(() => import("./components/map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full border-4 border-gray-300 rounded-xl">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
});


const DrainMap = dynamic(() => import("./components/drainmap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full border border-gray-900">
      <div className="text-gray-500">Loading drain map...</div>
    </div>
  )
});


const IndCatchmentMap = dynamic(() => import("./components/indmap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full border-4 border-purple-500 rounded-xl">
      <div className="text-purple-700">Loading catchment map...</div>
    </div>
  )
});


interface SelectedLocationData {
  villages: {
    id: number;
    name: string;
    subDistrictId: number;
    population: number;
  }[];
  subDistricts: {
    id: number;
    name: string;
    districtId: number;
  }[];
  totalPopulation: number;
}

interface SewageProps {
  villages_props?: any[];
  totalPopulation_props?: number;
  sourceMode?: 'admin' | 'drain' | 'catchment';
  selectedRiverData?: SelectedRiverData | null;
}


interface IntersectedVillage {
  shapeID: string;
  shapeName: string;
  drainNo: number;
  selected?: boolean;
}

interface VillagePopulation {
  village_code: string;
  subdistrict_code: string;
  district_code: string;
  state_code: string;
  total_population: number;
}


interface SelectedRiverData {
  drains: {
    id: string;
    name: string;
    stretchId: number;
  }[];
  allDrains?: {
    id: string;
    name: string;
    stretch: string;
    drainNo?: string;
  }[];
}

// Catchment mode types
interface Village {
  vlcode: string;
  village: string;
  population?: number;
  subdis_cod?: string;
}

interface WatershedInfo {
  features: number;
  geometryType?: string;
  properties?: Record<string, any>;
}

// Add TypeScript declarations for window properties
declare global {
  interface Window {
    villageChangeSource?: 'map' | 'dropdown' | null;
    selectedRiverData?: any;
    resetSubDistrictSelectionsInLocationSelector?: () => void;
    resetDistrictSelectionsInLocationSelector?: () => void;
    resetStretchSelectionsInDrainLocationsSelector?: () => void;
    resetDrainSelectionsInDrainLocationsSelector?: () => void;
    clearDrainMapData?: () => void;
    clearAdminMapData?: () => void;
    totalWaterSupply?: any;
    previousTotalWaterSupply?: any;
    selectedLocations?: any;
    populationData?: any;
    waterDemandData?: any;
    sewageData?: any;
    intersectedVillages?: any[];
    drainVillageData?: any;
    selectedDrainData?: any;
  }
}

const Basic: React.FC = () => {
  const [selectedLocationData, setSelectedLocationData] = useState<SelectedLocationData | null>(null);
  const [selectedRiverData, setSelectedRiverData] = useState<SelectedRiverData | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'admin' | 'drain' | 'catchment'>('admin');
  const [isMapLoading, setIsMapLoading] = useState<boolean>(true);
  const [isDrainMapLoading, setIsDrainMapLoading] = useState<boolean>(true);
  const [isCatchmentMapLoading, setIsCatchmentMapLoading] = useState<boolean>(true);

  // Separate completed steps for admin, drain, and catchment views
  const [adminCompletedSteps, setAdminCompletedSteps] = useState<number[]>([]);
  const [drainCompletedSteps, setDrainCompletedSteps] = useState<number[]>([]);
  const [catchmentCompletedSteps, setCatchmentCompletedSteps] = useState<number[]>([]);

  // Separate skipped steps for admin, drain, and catchment views
  const [adminSkippedSteps, setAdminSkippedSteps] = useState<number[]>([]);
  const [drainSkippedSteps, setDrainSkippedSteps] = useState<number[]>([]);
  const [catchmentSkippedSteps, setCatchmentSkippedSteps] = useState<number[]>([]);

  // Separate current step for admin, drain, and catchment views
  const [adminCurrentStep, setAdminCurrentStep] = useState<number>(0);
  const [drainCurrentStep, setDrainCurrentStep] = useState<number>(0);
  const [catchmentCurrentStep, setCatchmentCurrentStep] = useState<number>(0);

  // State for LocationSelector
  const [selectedStateCode, setSelectedStateCode] = useState<string>('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<string[]>([]);
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);

  // State for RiverSelector
  const [selectedRiver, setSelectedRiver] = useState<string>('');
  const [selectedStretch, setSelectedStretch] = useState<string>('');
  const [selectedDrainIds, setSelectedDrainIds] = useState<string[]>([]);
  const [selectedDrains, setSelectedDrains] = useState<string[]>([]);
  const [intersectedVillages, setIntersectedVillages] = useState<IntersectedVillage[]>([]);
  const [villageChangeSource, setVillageChangeSource] = useState<'map' | 'dropdown' | null>(null);
  const [drainVillagePopulations, setDrainVillagePopulations] = useState<VillagePopulation[]>([]);
  const [drainSelectionsLocked, setDrainSelectionsLocked] = useState<boolean>(false);

  // Catchment mode state
  const [catchmentPoint, setCatchmentPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [catchmentWatershed, setCatchmentWatershed] = useState<WatershedInfo | null>(null);
  const [catchmentVillages, setCatchmentVillages] = useState<Village[]>([]);
  const [catchmentSelectedVlCodes, setCatchmentSelectedVlCodes] = useState<string[]>([]);
  const [catchmentApiTotalPopulation, setCatchmentApiTotalPopulation] = useState<number>(0);

  // Water demand state
  const [perCapitaConsumption, setPerCapitaConsumption] = useState<number>(135);
  const [seasonalMultipliers, setSeasonalMultipliers] = useState({
    summer: 1.10,
    monsoon: 0.95,
    postMonsoon: 1.00,
    winter: 0.90
  });
  const [waterDemandResults, setWaterDemandResults] = useState<any>(null);
  const [floatingSeasonalDemands, setFloatingSeasonalDemands] = useState<any>(null);
  const [domesticSeasonalDemands, setDomesticSeasonalDemands] = useState<any>(null);

  // Refs for LocationSelector
  const stateRef = useRef<string>('');
  const districtsRef = useRef<string[]>([]);
  const subDistrictsRef = useRef<string[]>([]);
  const villagesRef = useRef<string[]>([]);
  // Refs for RiverSelector
  const riverRef = useRef<string>('');
  const stretchRef = useRef<string[]>([]);
  const drainsRef = useRef<string[]>([]);

  const { modal, openModal } = useBasicModuleInfo();

  // Sync refs with state for LocationSelector
  useEffect(() => {
    stateRef.current = selectedStateCode;
  }, [selectedStateCode]);

  useEffect(() => {
    districtsRef.current = [...selectedDistricts];
  }, [selectedDistricts]);

  useEffect(() => {
    subDistrictsRef.current = [...selectedSubDistricts];
  }, [selectedSubDistricts]);

  useEffect(() => {
    villagesRef.current = [...selectedVillages];
  }, [selectedVillages]);

  // Sync refs with state for RiverSelector
  useEffect(() => {
    riverRef.current = selectedRiver;
  }, [selectedRiver]);

  useEffect(() => {
    stretchRef.current = [selectedStretch];
  }, [selectedStretch]);

  useEffect(() => {
    drainsRef.current = [...selectedDrains];
  }, [selectedDrains]);


  useEffect(() => {
    if (villageChangeSource) {
      const timer = setTimeout(() => {
        setVillageChangeSource(null);
        if (window.villageChangeSource === villageChangeSource) {
          window.villageChangeSource = null;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [villageChangeSource]);

  // Update current step based on view mode
  useEffect(() => {
    if (viewMode === 'admin') {
      setCurrentStep(adminCurrentStep);
      setCompletedSteps(adminCompletedSteps);
      setSkippedSteps(adminSkippedSteps);
    } else if (viewMode === 'drain') {
      setCurrentStep(drainCurrentStep);
      setCompletedSteps(drainCompletedSteps);
      setSkippedSteps(drainSkippedSteps);
    } else {
      setCurrentStep(catchmentCurrentStep);
      setCompletedSteps(catchmentCompletedSteps);
      setSkippedSteps(catchmentSkippedSteps);
    }
  }, [
    viewMode,
    adminCurrentStep, drainCurrentStep, catchmentCurrentStep,
    adminCompletedSteps, drainCompletedSteps, catchmentCompletedSteps,
    adminSkippedSteps, drainSkippedSteps, catchmentSkippedSteps
  ]);

  // ── Catchment handlers ──────────────────────────────────────────────────

  const handleCatchmentVillageToggle = (vlcode: string) => {
    setCatchmentSelectedVlCodes(prev =>
      prev.includes(vlcode) ? prev.filter(v => v !== vlcode) : [...prev, vlcode]
    );
  };

  const handleCatchmentSelectAll = () => {
    setCatchmentSelectedVlCodes(catchmentVillages.map(v => v.vlcode));
  };

  const handleCatchmentDeselectAll = () => {
    setCatchmentSelectedVlCodes([]);
  };

  const handleCatchmentConfirm = () => {
    console.info("Catchment selection confirmed");
  };

  const handleCatchmentReset = () => {
    setCatchmentPoint(null);
    setCatchmentWatershed(null);
    setCatchmentVillages([]);
    setCatchmentSelectedVlCodes([]);
    setCatchmentApiTotalPopulation(0);
  };

  const handleCatchmentWatershedSelected = (data: WatershedInfo, point: { lat: number; lng: number }) => {
    setCatchmentWatershed(data);
    setCatchmentPoint(point);
  };

  const handleCatchmentVillagesLoaded = (villages: Village[], total: number) => {
    setCatchmentVillages(villages);
    setCatchmentApiTotalPopulation(total || 0);
  };

  // ── Normalized data for catchment downstream components ─────────────────

  const catchmentNormalizedVillages = useMemo(() =>
    catchmentVillages
      .filter(v => catchmentSelectedVlCodes.includes(v.vlcode))
      .map(v => ({
        id: Number(v.vlcode || 0),
        name: v.village || "Unknown",
        subDistrictId: Number(v.subdis_cod || 0),
        population: Number(v.population || 0),
      })),
    [catchmentVillages, catchmentSelectedVlCodes]);

  const catchmentTotalPopulation = useMemo(() => {
    if (catchmentSelectedVlCodes.length === catchmentVillages.length && catchmentApiTotalPopulation > 0) {
      return catchmentApiTotalPopulation;
    }
    return catchmentNormalizedVillages.reduce((sum, v) => sum + v.population, 0);
  }, [catchmentNormalizedVillages, catchmentSelectedVlCodes.length, catchmentVillages.length, catchmentApiTotalPopulation]);

  // ── Water demand handlers ───────────────────────────────────────────────

  const handleWaterDemandResultsChange = (results: any) => {
    setWaterDemandResults(results);
    (window as any).waterDemandResults = results;
  };

  const handleFloatingSeasonalDemandsChange = (seasonalDemands: any) => {
    setFloatingSeasonalDemands(seasonalDemands);
    (window as any).floatingSeasonalDemands = seasonalDemands;
  };

  const handleDomesticSeasonalDemandsChange = (seasonalDemands: any) => {
    setDomesticSeasonalDemands(seasonalDemands);
    (window as any).domesticSeasonalDemands = seasonalDemands;
  };

  const handlePerCapitaConsumptionChange = (value: number) => {
    setPerCapitaConsumption(value);
    (window as any).perCapitaConsumption = value;
  };

  const handleSeasonalMultipliersChange = (multipliers: any) => {
    setSeasonalMultipliers(multipliers);
    (window as any).seasonalMultipliers = multipliers;
  };

  // Handle confirm for LocationSelector
  const handleLocationConfirm = (data: SelectedLocationData): void => {
    setSelectedLocationData(data);
    setSelectedRiverData(null);
  };

  const memoizedIntersectedVillages = useMemo(() => intersectedVillages, [intersectedVillages]);

  const handleDrainMapLoadingChange = (isLoading: boolean) => {
    setIsDrainMapLoading(isLoading);
  };

  // Handler for villages change from the map
  const handleVillagesChange = (villages: IntersectedVillage[], source: 'map' | 'dropdown' | null = null) => {
    let actualSource: 'map' | 'dropdown' | null = source;

    if (!actualSource && window.villageChangeSource) {
      actualSource = window.villageChangeSource;
    }

    if (!isEqual(villages, intersectedVillages)) {
      setIntersectedVillages([...villages]);
      setVillageChangeSource(actualSource);

      if (window.selectedRiverData) {
        window.selectedRiverData = {
          ...window.selectedRiverData,
          selectedVillages: villages.filter(v => v.selected !== false),
        };
      }
    }
  };

  const handleDistrictsChange = (districts: string[]): void => {
    if (JSON.stringify(districts) !== JSON.stringify(districtsRef.current)) {
      setSelectedSubDistricts([]);
      if (window.resetSubDistrictSelectionsInLocationSelector) {
        window.resetSubDistrictSelectionsInLocationSelector();
      }
    }
    setSelectedDistricts([...districts]);
  };

  const villageProps = drainVillagePopulations?.map(vp => {
    const mappedVillage = {
      id: parseInt(vp.village_code) || 0,
      name: intersectedVillages.find(v => v.shapeID === vp.village_code)?.shapeName || 'Unknown Village',
      subDistrictId: parseInt(vp.subdistrict_code) || 0,
      population: vp.total_population || 0
    };
    return mappedVillage;
  }) || [];


  const drainTotalPopulation = useMemo(() => {
    return drainVillagePopulations.reduce((sum, village) => sum + village.total_population, 0);
  }, [drainVillagePopulations]);


  // Handle subdistrict selection for LocationSelector
  const handleSubDistrictsChange = (subdistricts: string[]): void => {
    setSelectedSubDistricts([...subdistricts]);
    setDrainSelectionsLocked(true);
  };


  const handleRiverConfirm = (data: SelectedRiverData): void => {
    setSelectedRiverData(data);
    setSelectedLocationData(null);
  };

  // Handle state selection for LocationSelector
  const handleStateChange = (stateCode: string): void => {
    if (stateCode !== stateRef.current) {
      setSelectedDistricts([]);
      setSelectedSubDistricts([]);
      if (window.resetDistrictSelectionsInLocationSelector) {
        window.resetDistrictSelectionsInLocationSelector();
      }
      if (window.resetSubDistrictSelectionsInLocationSelector) {
        window.resetSubDistrictSelectionsInLocationSelector();
      }
    }
    setSelectedStateCode(stateCode);
  };

  const handleVillagesChangeAdmin = (villages: string[]): void => {
    setSelectedVillages([...villages]);
  };

  // Handle river selection for RiverSelector
  const handleRiverChange = (riverId: string): void => {
    if (riverId !== riverRef.current) {
      setSelectedStretch('');
      setSelectedDrains([]);
      if (window.resetStretchSelectionsInDrainLocationsSelector) {
        window.resetStretchSelectionsInDrainLocationsSelector();
      }
    }
    setSelectedRiver(riverId);
  };

  // Handle stretch selection for RiverSelector
  const handleStretchChange = (stretchId: string): void => {
    if (!stretchRef.current.includes(stretchId)) {
      setSelectedDrains([]);
      if (window.resetDrainSelectionsInDrainLocationsSelector) {
        window.resetDrainSelectionsInDrainLocationsSelector();
      }
    }
    setSelectedStretch(stretchId);
  };

  // Handle drains selection for RiverSelector
  const handleDrainsChange = (drainIds: string[]) => {
    setSelectedDrainIds(drainIds);
  };


  const handleVillagePopulationUpdate = (populations: VillagePopulation[]) => {
    setDrainVillagePopulations(populations);
  };


  const handleConfirm = (data: { drains: any[] }) => {
    const riverData: SelectedRiverData = {
      drains: data.drains.map(d => ({
        id: d.id.toString(),
        name: d.name,
        stretchId: d.stretchId,
      })),
      allDrains: data.drains.map(d => ({
        id: d.id.toString(),
        name: d.name,
        stretch: d.stretchName || 'Unknown Stretch',
        drainNo: d.id.toString(),
      })),
    };

    setSelectedRiverData(riverData);

    window.selectedRiverData = {
      ...riverData,
      selectedVillages: intersectedVillages.filter(v => v.selected !== false),
    };
  };

  const handleMapLoadingChange = (isLoading: boolean) => {
    setIsMapLoading(isLoading);
  };


  // Navigation handlers with view mode awareness - Updated for 5 steps (0-4)
  const handleNext = () => {
    if (currentStep < 4) {
      if (viewMode === 'admin') {
        setAdminCompletedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setAdminSkippedSteps(prev => prev.filter(step => step !== currentStep));
        setAdminCurrentStep(prev => prev + 1);
      } else if (viewMode === 'drain') {
        setDrainCompletedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setDrainSkippedSteps(prev => prev.filter(step => step !== currentStep));
        setDrainCurrentStep(prev => prev + 1);
      } else {
        setCatchmentCompletedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setCatchmentSkippedSteps(prev => prev.filter(step => step !== currentStep));
        setCatchmentCurrentStep(prev => prev + 1);
      }
      setTransitionDirection('forward');
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      if (viewMode === 'admin') {
        setAdminCurrentStep(prev => prev - 1);
      } else if (viewMode === 'drain') {
        setDrainCurrentStep(prev => prev - 1);
      } else {
        setCatchmentCurrentStep(prev => prev - 1);
      }
      setTransitionDirection('backward');
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep > 0 && currentStep < 4) {
      if (viewMode === 'admin') {
        setAdminSkippedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setAdminCompletedSteps(prev => prev.filter(step => step !== currentStep));
        setAdminCurrentStep(prev => prev + 1);
      } else if (viewMode === 'drain') {
        setDrainSkippedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setDrainCompletedSteps(prev => prev.filter(step => step !== currentStep));
        setDrainCurrentStep(prev => prev + 1);
      } else {
        setCatchmentSkippedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setCatchmentCompletedSteps(prev => prev.filter(step => step !== currentStep));
        setCatchmentCurrentStep(prev => prev + 1);
      }
      setTransitionDirection('forward');
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleStepChange = (newStep: number) => {
    if (newStep < currentStep) {
      if (viewMode === 'admin') {
        setAdminCurrentStep(newStep);
      } else if (viewMode === 'drain') {
        setDrainCurrentStep(newStep);
      } else {
        setCatchmentCurrentStep(newStep);
      }
      setTransitionDirection('backward');
      setCurrentStep(newStep);
    }
  };

  // Complete reset handler
  const handleReset = (): void => {
    setCurrentStep(0);
    setAdminCurrentStep(0);
    setDrainCurrentStep(0);
    setCatchmentCurrentStep(0);
    setSkippedSteps([]);
    setAdminSkippedSteps([]);
    setDrainSkippedSteps([]);
    setCatchmentSkippedSteps([]);
    setCompletedSteps([]);
    setAdminCompletedSteps([]);
    setDrainCompletedSteps([]);
    setCatchmentCompletedSteps([]);

    // Reset LocationSelector data
    setSelectedLocationData(null);
    setSelectedStateCode('');
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedVillages([]);
    stateRef.current = '';
    districtsRef.current = [];
    subDistrictsRef.current = [];
    villagesRef.current = [];

    // Reset RiverSelector data
    setSelectedRiverData(null);
    setSelectedRiver('');
    setSelectedStretch('');
    setSelectedDrains([]);
    setIntersectedVillages([]);
    setDrainSelectionsLocked(false);
    riverRef.current = '';
    stretchRef.current = [];
    drainsRef.current = [];

    // Reset Catchment data
    setCatchmentPoint(null);
    setCatchmentWatershed(null);
    setCatchmentVillages([]);
    setCatchmentSelectedVlCodes([]);
    setCatchmentApiTotalPopulation(0);

    // Clear global variables
    (window as any).totalWaterSupply = undefined;
    (window as any).previousTotalWaterSupply = undefined;
    (window as any).selectedLocations = undefined;
    (window as any).selectedRiverData = undefined;

    // Reset view mode to admin
    setViewMode('admin');

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // Reset all data when view mode changes
  useEffect(() => {
    setCurrentStep(0);
    setSkippedSteps([]);
    setCompletedSteps([]);

    // Reset location data (admin mode)
    setSelectedLocationData(null);
    setSelectedStateCode('');
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedVillages([]);

    // Reset river data (drain mode)
    setSelectedRiverData(null);
    setSelectedRiver('');
    setSelectedStretch('');
    setSelectedDrains([]);
    setSelectedDrainIds([]);
    setIntersectedVillages([]);
    setDrainVillagePopulations([]);
    setDrainSelectionsLocked(false);
    setVillageChangeSource(null);

    // Reset catchment data
    setCatchmentPoint(null);
    setCatchmentWatershed(null);
    setCatchmentVillages([]);
    setCatchmentSelectedVlCodes([]);
    setCatchmentApiTotalPopulation(0);

    // Reset all refs
    stateRef.current = '';
    districtsRef.current = [];
    subDistrictsRef.current = [];
    villagesRef.current = [];
    riverRef.current = '';
    stretchRef.current = [];
    drainsRef.current = [];

    // Clear all global variables
    (window as any).totalWaterSupply = undefined;
    (window as any).previousTotalWaterSupply = undefined;
    (window as any).selectedLocations = undefined;
    (window as any).selectedRiverData = undefined;
    (window as any).populationData = undefined;
    (window as any).waterDemandData = undefined;
    (window as any).sewageData = undefined;
    (window as any).intersectedVillages = [];
    (window as any).drainVillageData = undefined;
    (window as any).selectedDrainData = undefined;

    window.villageChangeSource = null;

    if (window.resetDistrictSelectionsInLocationSelector) {
      window.resetDistrictSelectionsInLocationSelector();
    }
    if (window.resetSubDistrictSelectionsInLocationSelector) {
      window.resetSubDistrictSelectionsInLocationSelector();
    }
    if (window.resetStretchSelectionsInDrainLocationsSelector) {
      window.resetStretchSelectionsInDrainLocationsSelector();
    }
    if (window.resetDrainSelectionsInDrainLocationsSelector) {
      window.resetDrainSelectionsInDrainLocationsSelector();
    }
    if (window.clearDrainMapData) {
      window.clearDrainMapData();
    }
    if (window.clearAdminMapData) {
      window.clearAdminMapData();
    }

    // Reset loading states based on view mode
    if (viewMode === 'drain') {
      setIsDrainMapLoading(true);
    } else if (viewMode === 'catchment') {
      setIsCatchmentMapLoading(true);
    } else {
      setIsMapLoading(true);
    }

  }, [viewMode]);

  // Toggle view mode handler
  const handleViewModeChange = (mode: 'admin' | 'drain' | 'catchment') => {
    setViewMode(mode);
    if (mode === 'drain') {
      setDrainSelectionsLocked(false);
      setIsDrainMapLoading(true);
    }
    if (mode === 'catchment') {
      setIsCatchmentMapLoading(true);
    }
  };

  // Reset steps when new data is confirmed
  useEffect(() => {
    if (selectedLocationData || selectedRiverData) {
      setCurrentStep(0);
      setAdminCurrentStep(0);
      setDrainCurrentStep(0);
      setCatchmentCurrentStep(0);
      setSkippedSteps([]);
      setAdminSkippedSteps([]);
      setDrainSkippedSteps([]);
      setCatchmentSkippedSteps([]);
      setCompletedSteps([]);
      setAdminCompletedSteps([]);
      setDrainCompletedSteps([]);
      setCatchmentCompletedSteps([]);
    }
  }, [selectedLocationData, selectedRiverData]);

  // Check if we have selected data to show map and content
  const hasSelectedData =
    (selectedLocationData && viewMode === 'admin') ||
    (selectedRiverData && viewMode === 'drain') ||
    (viewMode === 'catchment' && catchmentSelectedVlCodes.length > 0);

  return (
    <div className="flex flex-col w-full min-h-0">
      <div className="w-full relative flex flex-col">
        <div className="w-full bg-gradient-to-r from-blue-500 to-blue-200 py-6 px-2">
          <div className="w-full px-8 flex items-center justify-between">
            {/* Heading on the left */}
            <div className="flex items-center">
    <h2 className="text-white text-4xl font-bold select-none">
      Basic Module
    </h2>
    <BasicModuleInfoButton onClick={openModal} />
  </div>

            {/* Toggle controls */}
            <div className="flex items-center space-x-10">
              <span
                className={`text-2xl font-semibold cursor-pointer transition-all select-none ${
                  viewMode === "admin" ? "text-white drop-shadow-lg scale-105" : "text-white/70 hover:text-white"
                }`}
                onClick={() => { if (viewMode !== "admin") handleViewModeChange("admin"); }}
              >
                Administrative
              </span>

              <span
                className={`text-2xl font-semibold cursor-pointer transition-all select-none ${
                  viewMode === "drain" ? "text-white drop-shadow-lg scale-105" : "text-white/70 hover:text-white"
                }`}
                onClick={() => { if (viewMode !== "drain") handleViewModeChange("drain"); }}
              >
                Drain
              </span>

              <span
                className={`text-2xl font-semibold cursor-pointer transition-all select-none ${
                  viewMode === "catchment" ? "text-white drop-shadow-lg scale-105" : "text-white/70 hover:text-white"
                }`}
                onClick={() => { if (viewMode !== "catchment") handleViewModeChange("catchment"); }}
              >
                Catchment
              </span>
            </div>
          </div>
        </div>

        <div className="w-full border-b border-gray-200">
          <StatusBar
            currentStep={currentStep}
            onStepChange={handleStepChange}
            skippedSteps={skippedSteps}
            completedSteps={completedSteps}
            viewMode={viewMode}
          />
        </div>


        <div className="relative overflow-hidden w-full h-6 mb-4 flex items-center justify-center space-x-2">
          <AiOutlineInfoCircle className="text-blue-700" />
          <a
            href="https://example.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 font-semibold text-sm"
          >
            This module contains data only for the Varuna River Basin, so it works for only five districts within the basin.
          </a>
        </div>


        {/* Main Content Layout with Persistent Map */}
        <div className="flex flex-col lg:flex-row w-full gap-4 px-4">

          {/* Left Side - Content based on current step */}
          <div className="w-full lg:w-[60%] order-2 lg:order-1">
            <div className="transition-all duration-300 transform h-[75vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">

              {/* STEP 0: Location/Drain/Catchment Selection */}
              <div className={currentStep === 0 ? 'block' : 'hidden'}>
                <div className="h-[75vh]">
                  {viewMode === 'admin' && (
                    <LocationSelector
                      onConfirm={handleLocationConfirm}
                      onReset={handleReset}
                      onStateChange={handleStateChange}
                      onDistrictsChange={handleDistrictsChange}
                      onSubDistrictsChange={handleSubDistrictsChange}
                      onVillagesChange={handleVillagesChangeAdmin}
                      isMapLoading={isMapLoading}
                    />
                  )}

                  {viewMode === 'drain' && (
                    <DrainLocationSelector
                      onConfirm={handleRiverConfirm}
                      onReset={handleReset}
                      onRiverChange={handleRiverChange}
                      onStretchChange={handleStretchChange}
                      onDrainsChange={handleDrainsChange}
                      onVillagesChange={(villages) => handleVillagesChange(villages, 'dropdown')}
                      villages={intersectedVillages}
                      villageChangeSource={villageChangeSource}
                      onVillagePopulationUpdate={handleVillagePopulationUpdate}
                      selectionsLocked={drainSelectionsLocked}
                      onLockChange={setDrainSelectionsLocked}
                      isDrainMapLoading={isDrainMapLoading}
                    />
                  )}

                  {viewMode === 'catchment' && (
                    <IndCatchmentSelector
                      watershedData={catchmentWatershed}
                      selectedPoint={catchmentPoint}
                      villages={catchmentVillages}
                      selectedVillages={catchmentSelectedVlCodes}
                      apiTotalPopulation={catchmentApiTotalPopulation}
                      onVillageToggle={handleCatchmentVillageToggle}
                      onSelectAll={handleCatchmentSelectAll}
                      onDeselectAll={handleCatchmentDeselectAll}
                      onConfirm={handleCatchmentConfirm}
                      onReset={handleCatchmentReset}
                      isMapLoading={isCatchmentMapLoading}
                    />
                  )}
                </div>
              </div>

              {/* STEP 1: Population */}
              <div className={`${currentStep === 1 ? 'block' : 'hidden'} p-4`}>
                {selectedLocationData && viewMode === 'admin' && (
                  <Population
                    villages_props={selectedLocationData.villages}
                    subDistricts_props={selectedLocationData.subDistricts}
                    totalPopulation_props={selectedLocationData.totalPopulation}
                    sourceMode="admin"
                  />
                )}

                {viewMode === 'drain' && selectedRiverData && drainVillagePopulations.length > 0 && (
                  <>
                    {/* Debug info for drain mode */}
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 mb-2">Total Population:</h4>
                      <div className="text-sm text-yellow-700 space-y-1">
                        <div>Total Population: {drainTotalPopulation.toLocaleString()}</div>
                        <div>Valid Villages: {villageProps.filter(v => v.population > 0).length}</div>
                      </div>
                    </div>

                    <Population
                      villages_props={villageProps}
                      subDistricts_props={
                        Array.from(
                          new Set(
                            drainVillagePopulations
                              ?.filter(vp => vp.subdistrict_code)
                              .map(vp => vp.subdistrict_code)
                          ) || []
                        ).map(subId => ({
                          id: parseInt(subId) || 0,
                          name: `Sub-district ${subId}`,
                          districtId: 0
                        })) || []
                      }
                      totalPopulation_props={drainTotalPopulation || 0}
                      sourceMode="drain"
                      state_props={
                        drainVillagePopulations.length > 0 ? {
                          id: drainVillagePopulations[0].state_code,
                          name: `State ${drainVillagePopulations[0].state_code}`
                        } : undefined
                      }
                      district_props={
                        drainVillagePopulations.length > 0 ? {
                          id: drainVillagePopulations[0].district_code,
                          name: `District ${drainVillagePopulations[0].district_code}`
                        } : undefined
                      }
                    />
                  </>
                )}

                {viewMode === 'drain' && selectedRiverData && drainVillagePopulations.length === 0 && (
                  <div className="p-6 bg-orange-50 border border-orange-200 rounded-lg text-center">
                    <div className="text-orange-800 mb-2">
                      <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <h3 className="text-lg font-semibold">No Village Data Available</h3>
                      <p className="text-sm mt-1">
                        Please ensure villages are properly selected in the drain location selector.
                        Population calculations require village data to proceed.
                      </p>
                    </div>
                  </div>
                )}

                {viewMode === 'catchment' && catchmentVillages.length > 0 && (
                  <Population
                    villages_props={catchmentNormalizedVillages}
                    subDistricts_props={
                      Array.from(
                        new Set(
                          catchmentVillages
                            .filter(v => catchmentSelectedVlCodes.includes(v.vlcode) && v.subdis_cod)
                            .map(v => v.subdis_cod as string)
                        )
                      ).map(subId => ({
                        id: parseInt(subId) || 0,
                        name: `Sub-district ${subId}`,
                        districtId: 0
                      }))
                    }
                    totalPopulation_props={catchmentTotalPopulation}
                    sourceMode="catchment"
                  />
                )}
              </div>

              {/* STEP 2: Water Demand */}
              <div className={`${currentStep === 2 ? 'block' : 'hidden'} p-4`}>
                {hasSelectedData && (
                  <WaterDemandForm
                    onPerCapitaConsumptionChange={handlePerCapitaConsumptionChange}
                    onSeasonalMultipliersChange={handleSeasonalMultipliersChange}
                    onWaterDemandResultsChange={handleWaterDemandResultsChange}
                    onFloatingSeasonalDemandsChange={handleFloatingSeasonalDemandsChange}
                    onDomesticSeasonalDemandsChange={handleDomesticSeasonalDemandsChange}
                  />
                )}
              </div>

              {/* STEP 3: Water Supply */}
              <div className={`${currentStep === 3 ? 'block' : 'hidden'} p-4`}>
                {hasSelectedData && <Water_Supply />}
              </div>

              {/* STEP 4: Sewage */}
              <div className={`${currentStep === 4 ? 'block' : 'hidden'} p-4`}>
                {hasSelectedData && (
                  <>
                    {selectedLocationData && viewMode === 'admin' && (
                      <SewageCalculationForm
                        sourceMode="admin"
                        villages_props={selectedLocationData.villages}
                        totalPopulation_props={selectedLocationData.totalPopulation}
                        perCapitaConsumption={perCapitaConsumption}
                        seasonalMultipliers={seasonalMultipliers}
                        waterDemandResults={waterDemandResults}
                        floatingSeasonalDemands={floatingSeasonalDemands}
                        domesticSeasonalDemands={domesticSeasonalDemands}
                      />
                    )}

                    {viewMode === 'drain' && (
                      <SewageCalculationForm
                        villages_props={drainVillagePopulations.map(vp => ({
                          id: vp.village_code,
                          name: intersectedVillages.find(v => v.shapeID === vp.village_code)?.shapeName || 'Unknown',
                          subDistrictId: vp.subdistrict_code,
                          population: vp.total_population
                        }))}
                        totalPopulation_props={drainTotalPopulation}
                        sourceMode="drain"
                        selectedRiverData={selectedRiverData}
                        perCapitaConsumption={perCapitaConsumption}
                        seasonalMultipliers={seasonalMultipliers}
                        waterDemandResults={waterDemandResults}
                        floatingSeasonalDemands={floatingSeasonalDemands}
                        domesticSeasonalDemands={domesticSeasonalDemands}
                      />
                    )}

                    {viewMode === 'catchment' && (
                      <SewageCalculationForm
                        villages_props={catchmentNormalizedVillages}
                        totalPopulation_props={catchmentTotalPopulation}
                        sourceMode="catchment"
                        perCapitaConsumption={perCapitaConsumption}
                        seasonalMultipliers={seasonalMultipliers}
                        waterDemandResults={waterDemandResults}
                        floatingSeasonalDemands={floatingSeasonalDemands}
                        domesticSeasonalDemands={domesticSeasonalDemands}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Navigation buttons - Inside left section */}
            {hasSelectedData && (
              <div className="mt-6 mx-4 border border-gray-300 rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow duration-300">
                <div className="flex justify-between items-center">
                  <div className="flex space-x-4">
                    <button
                      className={`${currentStep === 0 || currentStep === 4
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                        } text-white font-medium py-2 px-4 rounded-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                      disabled={currentStep === 0 || currentStep === 4}
                      onClick={handleSkip}
                    >
                      Skip
                    </button>

                    {currentStep > 0 && (
                      <button
                        className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                        onClick={handlePrevious}
                      >
                        Previous
                      </button>
                    )}
                  </div>

                  {/* Show Next button only if not on the last step */}
                  {currentStep < 4 && (
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                      onClick={handleNext}
                    >
                      Save and Next
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Persistent Map */}
          <div className="w-full lg:w-[40%] order-1 lg:order-2">
            <div className="h-[75vh] relative">
              {/* Map loading overlay */}
              {((viewMode === 'admin' && isMapLoading) ||
                (viewMode === 'drain' && isDrainMapLoading) ||
                (viewMode === 'catchment' && isCatchmentMapLoading)) && (
                <div className="absolute inset-0 bg-gray-100 border-4 border-blue-500 rounded-xl flex items-center justify-center z-10">
                  <div className="flex flex-col items-center">
                    <svg
                      className="animate-spin h-8 w-8 text-blue-500 mb-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-sm text-gray-600">Loading Map...</span>
                  </div>
                </div>
              )}

              {/* Map based on current view mode */}
              {viewMode === 'admin' ? (
                <Map
                  selectedState={selectedStateCode}
                  selectedDistricts={selectedDistricts}
                  selectedSubDistricts={selectedSubDistricts}
                  selectedVillages={selectedVillages}
                  className="admin-map h-full"
                  onLoadingChange={handleMapLoadingChange}
                />
              ) : viewMode === 'drain' ? (
                <DrainMap
                  selectedRiver={selectedRiver}
                  selectedStretch={selectedStretch}
                  selectedDrains={selectedDrainIds}
                  onVillagesChange={(villages) => handleVillagesChange(villages)}
                  villageChangeSource={villageChangeSource}
                  selectionsLocked={drainSelectionsLocked}
                  className="drain-map h-full"
                  onLoadingChange={handleDrainMapLoadingChange}
                />
              ) : (
                <IndCatchmentMap
                  selectedVillages={catchmentSelectedVlCodes}
                  onLoadingChange={(l) => setIsCatchmentMapLoading(l)}
                  onWatershedSelected={handleCatchmentWatershedSelected}
                  onVillagesLoaded={handleCatchmentVillagesLoaded}
                  onVillageClick={handleCatchmentVillageToggle}
                  onClearMap={handleCatchmentReset}
                  className="h-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Basic