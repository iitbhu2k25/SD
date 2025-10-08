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
// New import for DrainMap
import SewageCalculationForm from "./seawage/components/SewageCalculationForm";
import WaterSupplyForm from "./water_supply/components/WaterSupplyForm";
import WaterDemandForm from "./water_demand/components/WaterDemandForm";
import { AiOutlineInfoCircle } from "react-icons/ai";


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
  sourceMode?: 'admin' | 'drain';
  selectedRiverData?: SelectedRiverData | null; // Add this
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
    id: string; // Change from number to string to match Drain_No
    name: string;
    stretchId: number;


  }[];

  allDrains?: { // Add this property
    id: string;
    name: string;
    stretch: string;
    drainNo?: string;
  }[];
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
  const [viewMode, setViewMode] = useState<'admin' | 'drain'>('admin'); // State for view toggle
  const [isMapLoading, setIsMapLoading] = useState<boolean>(true);
  // ADD THIS STATE FOR DRAIN MAP LOADING
  const [isDrainMapLoading, setIsDrainMapLoading] = useState<boolean>(true);
  // Separate completed steps for admin and drain views
  const [adminCompletedSteps, setAdminCompletedSteps] = useState<number[]>([]);
  const [drainCompletedSteps, setDrainCompletedSteps] = useState<number[]>([]);

  // Separate skipped steps for admin and drain views
  const [adminSkippedSteps, setAdminSkippedSteps] = useState<number[]>([]);
  const [drainSkippedSteps, setDrainSkippedSteps] = useState<number[]>([]);

  // Separate current step for admin and drain views
  const [adminCurrentStep, setAdminCurrentStep] = useState<number>(0);
  const [drainCurrentStep, setDrainCurrentStep] = useState<number>(0);

  // State for LocationSelector
  const [selectedStateCode, setSelectedStateCode] = useState<string>('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedSubDistricts, setSelectedSubDistricts] = useState<string[]>([]);
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]); // Add this line

  // State for RiverSelector
  const [selectedRiver, setSelectedRiver] = useState<string>('');
  const [selectedStretch, setSelectedStretch] = useState<string>('');
  const [selectedDrainIds, setSelectedDrainIds] = useState<string[]>([]);
  const [selectedDrains, setSelectedDrains] = useState<string[]>([]);
  const [intersectedVillages, setIntersectedVillages] = useState<IntersectedVillage[]>([]);
  const [villageChangeSource, setVillageChangeSource] = useState<'map' | 'dropdown' | null>(null);
  const [drainVillagePopulations, setDrainVillagePopulations] = useState<VillagePopulation[]>([]);
  const [drainSelectionsLocked, setDrainSelectionsLocked] = useState<boolean>(false);
  // water demand state
  // Add this state variable with your other state declarations
  const [perCapitaConsumption, setPerCapitaConsumption] = useState<number>(135);
  // Add this state variable with your other state declarations
  const [seasonalMultipliers, setSeasonalMultipliers] = useState({
    summer: 1.10,
    monsoon: 0.95,
    postMonsoon: 1.00,
    winter: 0.90
  });
  // Add these state variables with your other state declarations
  const [waterDemandResults, setWaterDemandResults] = useState<any>(null);
  const [floatingSeasonalDemands, setFloatingSeasonalDemands] = useState<any>(null);
  const [domesticSeasonalDemands, setDomesticSeasonalDemands] = useState<any>(null);

  // Refs for LocationSelector
  const stateRef = useRef<string>('');
  const districtsRef = useRef<string[]>([]);
  const subDistrictsRef = useRef<string[]>([]);
  const villagesRef = useRef<string[]>([]); // Add this line
  // Refs for RiverSelector
  const riverRef = useRef<string>('');
  const stretchRef = useRef<string[]>([]);
  const drainsRef = useRef<string[]>([]);

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
        //console.log('Clearing villageChangeSource in page.tsx:', villageChangeSource);
        setVillageChangeSource(null);

        // Also clear global flag if it matches
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
    } else {
      setCurrentStep(drainCurrentStep);
      setCompletedSteps(drainCompletedSteps);
      setSkippedSteps(drainSkippedSteps);
    }
  }, [viewMode, adminCurrentStep, drainCurrentStep, adminCompletedSteps, drainCompletedSteps, adminSkippedSteps, drainSkippedSteps]);
  // water demand handle 
  // Add this handler function
  const handleWaterDemandResultsChange = (results: any) => {
    setWaterDemandResults(results);
    // Store globally if needed by other components
    (window as any).waterDemandResults = results;
  };
  const handleFloatingSeasonalDemandsChange = (seasonalDemands: any) => {
    setFloatingSeasonalDemands(seasonalDemands);
    // Store globally if needed by other components
    (window as any).floatingSeasonalDemands = seasonalDemands;
  };

  const handleDomesticSeasonalDemandsChange = (seasonalDemands: any) => {
    setDomesticSeasonalDemands(seasonalDemands);
    // Store globally if needed by other components
    (window as any).domesticSeasonalDemands = seasonalDemands;
  };

  const handlePerCapitaConsumptionChange = (value: number) => {
    setPerCapitaConsumption(value);
    // Store globally if needed by other components
    (window as any).perCapitaConsumption = value;
  };
  // Add this handler function
  const handleSeasonalMultipliersChange = (multipliers: any) => {
    setSeasonalMultipliers(multipliers);
    // Store globally if needed by other components
    (window as any).seasonalMultipliers = multipliers;
  };
  // Handle confirm for LocationSelector
  const handleLocationConfirm = (data: SelectedLocationData): void => {
    //console.log('Received confirmed location data:', data);
    setSelectedLocationData(data);
    setSelectedRiverData(null); // Clear RiverSelector data
  };

  const memoizedIntersectedVillages = useMemo(() => intersectedVillages, [intersectedVillages]);

  // ADD THIS HANDLER FOR DRAIN MAP LOADING
  const handleDrainMapLoadingChange = (isLoading: boolean) => {
    setIsDrainMapLoading(isLoading);
  };

  // Handler for villages change from the map
  const handleVillagesChange = (villages: IntersectedVillage[], source: 'map' | 'dropdown' | null = null) => {
    // Determine the actual source with priority:
    // 1. Explicit source parameter
    // 2. Global window flag
    // 3. Default to 'unknown'
    let actualSource: 'map' | 'dropdown' | null = source;

    if (!actualSource && window.villageChangeSource) {
      actualSource = window.villageChangeSource;
    }

    // console.log(`Villages selection changed in page.tsx (source: ${actualSource || 'unknown'}):`,
    //   villages.filter(v => v.selected !== false).length, 'selected out of', villages.length);
    // console.log(`Source determination: param=${source}, global=${window.villageChangeSource}, final=${actualSource}`);

    // Always update if villages are different
    if (!isEqual(villages, intersectedVillages)) {
      //console.log('Villages have changed, updating state with source:', actualSource);
      setIntersectedVillages([...villages]);

      // Set the village change source
      setVillageChangeSource(actualSource);

      // Update global data
      if (window.selectedRiverData) {
        window.selectedRiverData = {
          ...window.selectedRiverData,
          selectedVillages: villages.filter(v => v.selected !== false),
        };
        //console.log('Updated window.selectedRiverData');
      }
    } else {
      //console.log('Villages unchanged, skipping update');
    }
  };

  const handleDistrictsChange = (districts: string[]): void => {
    //console.log('Districts changed to:', districts);
    if (JSON.stringify(districts) !== JSON.stringify(districtsRef.current)) {
      //console.log('Resetting subdistrict selections');
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
    //console.log(`Mapped village ${mappedVillage.name} (${mappedVillage.id}) population: ${mappedVillage.population}`);
    return mappedVillage;
  }) || [];


  const drainTotalPopulation = useMemo(() => {
    return drainVillagePopulations.reduce((sum, village) => sum + village.total_population, 0);
  }, [drainVillagePopulations]);



  // Handle subdistrict selection for LocationSelector
  const handleSubDistrictsChange = (subdistricts: string[]): void => {
    //console.log('Sub-districts changed to:', subdistricts);
    setSelectedSubDistricts([...subdistricts]);
    setDrainSelectionsLocked(true);
  };


  const handleRiverConfirm = (data: SelectedRiverData): void => {
    //console.log('Received confirmed river data:', data);
    setSelectedRiverData(data);
    setSelectedLocationData(null); // Clear LocationSelector data
  };
  // Handle state selection for LocationSelector
  const handleStateChange = (stateCode: string): void => {
    //console.log('State changed to:', stateCode);
    if (stateCode !== stateRef.current) {
      //console.log('Resetting district and subdistrict selections');
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
    //console.log('Villages changed to:', villages);
    setSelectedVillages([...villages]);
  };

  // Handle river selection for RiverSelector
  const handleRiverChange = (riverId: string): void => {
    //console.log('River changed to:', riverId);
    if (riverId !== riverRef.current) {
     // console.log('Resetting stretch and drain selections');
      setSelectedStretch('');
      setSelectedDrains([]);
      if (window.resetStretchSelectionsInDrainLocationsSelector) {
        window.resetStretchSelectionsInDrainLocationsSelector();
      }
      if (window.resetStretchSelectionsInDrainLocationsSelector) {
        window.resetStretchSelectionsInDrainLocationsSelector();
      }
    }
    setSelectedRiver(riverId);
  };

  // Handle stretch selection for RiverSelector
  const handleStretchChange = (stretchId: string): void => {
    //console.log('Stretch changed to:', stretchId);
    if (!stretchRef.current.includes(stretchId)) {
      //console.log('Resetting drain selections');
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
    //console.log("Selected drain IDs updated:", drainIds);
  };


  const handleVillagePopulationUpdate = (populations: VillagePopulation[]) => {
    //console.log('Village populations updated:', populations);
    setDrainVillagePopulations(populations);
  };


  const handleConfirm = (data: { drains: any[] }) => {
    const riverData: SelectedRiverData = {
      drains: data.drains.map(d => ({
        id: d.id.toString(), // Ensure ID is string (Drain_No)
        name: d.name,
        stretchId: d.stretchId,

      })),

      // FIXED: Ensure allDrains includes all necessary data
      allDrains: data.drains.map(d => ({
        id: d.id.toString(), // This is the Drain_No as string
        name: d.name,
        stretch: d.stretchName || 'Unknown Stretch',
        drainNo: d.id.toString(), // Explicitly set drainNo
      })),
    };

    //console.log('page.tsx: Setting selectedRiverData with complete drain data:', riverData);
    setSelectedRiverData(riverData);

    // FIXED: Ensure window.selectedRiverData includes selectedVillages
    window.selectedRiverData = {
      ...riverData,
      selectedVillages: intersectedVillages.filter(v => v.selected !== false),
    };

    //console.log('page.tsx: Updated window.selectedRiverData:', window.selectedRiverData);
  };

  const handleMapLoadingChange = (isLoading: boolean) => {
    setIsMapLoading(isLoading);
  };



  // Navigation handlers with view mode awareness - Updated for 5 steps (0-4)
  const handleNext = () => {
    if (currentStep < 4) { // Changed from 3 to 4
      if (viewMode === 'admin') {
        setAdminCompletedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setAdminSkippedSteps(prev => prev.filter(step => step !== currentStep));
        setAdminCurrentStep(prev => prev + 1);
      } else {
        setDrainCompletedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setDrainSkippedSteps(prev => prev.filter(step => step !== currentStep));
        setDrainCurrentStep(prev => prev + 1);
      }
      setTransitionDirection('forward');
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      if (viewMode === 'admin') {
        setAdminCurrentStep(prev => prev - 1);
      } else {
        setDrainCurrentStep(prev => prev - 1);
      }
      setTransitionDirection('backward');
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep > 0 && currentStep < 4) { // Changed from 3 to 4
      if (viewMode === 'admin') {
        setAdminSkippedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setAdminCompletedSteps(prev => prev.filter(step => step !== currentStep));
        setAdminCurrentStep(prev => prev + 1);
      } else {
        setDrainSkippedSteps(prev => [...prev.filter(step => step !== currentStep), currentStep]);
        setDrainCompletedSteps(prev => prev.filter(step => step !== currentStep));
        setDrainCurrentStep(prev => prev + 1);
      }
      setTransitionDirection('forward');
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleStepChange = (newStep: number) => {
    if (newStep < currentStep) {
      if (viewMode === 'admin') {
        setAdminCurrentStep(newStep);
      } else {
        setDrainCurrentStep(newStep);
      }
      setTransitionDirection('backward');
      setCurrentStep(newStep);
    }
  };

  // Complete reset handler
  const handleReset = (): void => {
    //console.log('FULL RESET triggered');
    setCurrentStep(0);
    setAdminCurrentStep(0);
    setDrainCurrentStep(0);
    setSkippedSteps([]);
    setAdminSkippedSteps([]);
    setDrainSkippedSteps([]);
    setCompletedSteps([]);
    setAdminCompletedSteps([]);
    setDrainCompletedSteps([]);

    // Reset LocationSelector data
    setSelectedLocationData(null);
    setSelectedStateCode('');
    setSelectedDistricts([]);
    setSelectedSubDistricts([]);
    setSelectedVillages([]); // Add this line
    stateRef.current = '';
    districtsRef.current = [];
    subDistrictsRef.current = [];
    villagesRef.current = []; // Add this line

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

  //added for perfect reset 
  // Add this useEffect to handle view mode changes and reset all data
  useEffect(() => {
    // Reset all step-related states
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

    // Reset all refs
    stateRef.current = '';
    districtsRef.current = [];
    subDistrictsRef.current = [];
    villagesRef.current = [];
    riverRef.current = '';
    stretchRef.current = [];
    drainsRef.current = [];

    // Clear all global variables that store calculation data
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

    // Reset any other global flags
    window.villageChangeSource = null;

    // Call reset functions for selectors if they exist
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

    // Clear map-specific data
    if (window.clearDrainMapData) {
      window.clearDrainMapData();
    }
    if (window.clearAdminMapData) {
      window.clearAdminMapData();
    }

    // Reset loading states based on view mode
    if (viewMode === 'drain') {
      setIsDrainMapLoading(true);
    } else {
      setIsMapLoading(true);
    }

  }, [viewMode]);
  // This will trigger whenever viewMode changes
  //added end in last for reset 

  // Toggle view mode handler
  const handleViewModeChange = (mode: 'admin' | 'drain') => {
    setViewMode(mode);
    if (mode === 'drain') {
      setDrainSelectionsLocked(false);
      setIsDrainMapLoading(true); // ADD THIS LINE - Reset loading state
    }
  };

  // Reset steps when new data is confirmed
  useEffect(() => {
    if (selectedLocationData || selectedRiverData) {
      setCurrentStep(0);
      setAdminCurrentStep(0);
      setDrainCurrentStep(0);
      setSkippedSteps([]);
      setAdminSkippedSteps([]);
      setDrainSkippedSteps([]);
      setCompletedSteps([]);
      setAdminCompletedSteps([]);
      setDrainCompletedSteps([]);
    }
  }, [selectedLocationData, selectedRiverData]);

  // Check if we have selected data to show map and content
  const hasSelectedData = (selectedLocationData && viewMode === 'admin') || (selectedRiverData && viewMode === 'drain');

  return (
    <div className="flex flex-col w-full min-h-0">
      <div className="w-full relative flex flex-col">
        <div className="w-full bg-gradient-to-r from-blue-500 to-blue-200 py-6 px-2">
          <div className="w-full px-8 flex items-center justify-between">
            {/* Heading on the left */}
            <h2 className="text-white text-4xl font-bold select-none">
              Basic Module
            </h2>

            {/* Toggle controls */}
            <div className="flex items-center space-x-6 mr-100">
              <span
                className={`text-2xl font-semibold transition-colors duration-300 cursor-pointer select-none ${viewMode === "admin" ? "text-white drop-shadow-lg" : "text-white/80"
                  }`}
                onClick={() => {
                  if (viewMode !== "admin") handleViewModeChange("admin")
                }}
              >
                Administrative
              </span>

              <div
                className="relative w-24 h-12 bg-gray-200 rounded-full cursor-pointer transition-all duration-300 hover:bg-gray-300"
                onClick={() => handleViewModeChange(viewMode === "admin" ? "drain" : "admin")}
                role="switch"
                aria-checked={viewMode === "drain"}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleViewModeChange(viewMode === "admin" ? "drain" : "admin")
                  }
                }}
              >
                <div
                  className={`absolute top-1 left-1 w-10 h-10 rounded-full shadow-lg transition-all duration-300 ease-in-out transform ${viewMode === "drain" ? "translate-x-12 bg-green-500" : "bg-blue-500"
                    } flex items-center justify-center`}
                >
                  <div className="flex items-center justify-center w-full h-full">
                    {viewMode === "admin" ? (
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zM12 14a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              <span
                className={`text-2xl font-semibold transition-colors duration-300 cursor-pointer select-none ${viewMode === "drain" ? "text-white drop-shadow-lg" : "text-white/80"
                  }`}
                onClick={() => {
                  if (viewMode !== "drain") handleViewModeChange("drain")
                }}
              >
                Drain
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


        {/* Main Content Layout with Persistent Map - UPDATED HEIGHTS */}
        <div className="flex flex-col lg:flex-row w-full gap-4 px-4">

          {/* Left Side - Content based on current step - INCREASED HEIGHT */}
          <div className="w-full lg:w-[60%] order-2 lg:order-1">
            <div className="transition-all duration-300 transform h-[75vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">

              {/* STEP 0: Location/Drain Selection - INCREASED HEIGHT */}
              <div className={currentStep === 0 ? 'block' : 'hidden'}>
                <div className="h-[75vh]">
                  {viewMode === 'admin' ? (
                    <LocationSelector
                      onConfirm={handleLocationConfirm}
                      onReset={handleReset}
                      onStateChange={handleStateChange}
                      onDistrictsChange={handleDistrictsChange}
                      onSubDistrictsChange={handleSubDistrictsChange}
                      onVillagesChange={handleVillagesChangeAdmin}
                      isMapLoading={isMapLoading}
                    />
                  ) : (
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
              </div>

              {/* STEP 2: Water Demand */}
              <div className={`${currentStep === 2 ? 'block' : 'hidden'} p-4`}>
                {hasSelectedData && (
                  <>
                    {viewMode === 'admin' && (
                      <WaterDemandForm
                        onPerCapitaConsumptionChange={handlePerCapitaConsumptionChange}
                        onSeasonalMultipliersChange={handleSeasonalMultipliersChange} // Add this prop
                        onWaterDemandResultsChange={handleWaterDemandResultsChange} // Add this prop
                        onFloatingSeasonalDemandsChange={handleFloatingSeasonalDemandsChange} // Add this prop
                        onDomesticSeasonalDemandsChange={handleDomesticSeasonalDemandsChange} // 
                      />
                    )}
                    {viewMode === 'drain' && (
                      <WaterDemandForm
                        onPerCapitaConsumptionChange={handlePerCapitaConsumptionChange}
                        onSeasonalMultipliersChange={handleSeasonalMultipliersChange} // Add this prop
                        onWaterDemandResultsChange={handleWaterDemandResultsChange} // Add this prop
                        onFloatingSeasonalDemandsChange={handleFloatingSeasonalDemandsChange} // Add this prop
                        onDomesticSeasonalDemandsChange={handleDomesticSeasonalDemandsChange} // 
                      />
                    )}
                  </>
                )}
              </div>

              {/* STEP 3: Water Supply */}
              <div className={`${currentStep === 3 ? 'block' : 'hidden'} p-4`}>
                {hasSelectedData && (
                  <>
                    {viewMode === 'admin' && <Water_Supply />}
                    {viewMode === 'drain' && <Water_Supply />}
                  </>
                )}
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
                        perCapitaConsumption={perCapitaConsumption} // Add this prop
                        seasonalMultipliers={seasonalMultipliers} // Add this
                        waterDemandResults={waterDemandResults} // Add this prop
                        floatingSeasonalDemands={floatingSeasonalDemands} // Add this prop
                        domesticSeasonalDemands={domesticSeasonalDemands} // Add this
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
                        perCapitaConsumption={perCapitaConsumption} // Add this prop
                        seasonalMultipliers={seasonalMultipliers} // Add this prop
                        waterDemandResults={waterDemandResults} // Add this prop
                        floatingSeasonalDemands={floatingSeasonalDemands} // Add this prop
                        domesticSeasonalDemands={domesticSeasonalDemands}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Navigation buttons - Now inside left section */}
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

          {/* Right Side - Persistent Map - INCREASED HEIGHT */}
          <div className="w-full lg:w-[40%] order-1 lg:order-2">
            <div className="h-[75vh] relative">
              {/* Show map loading overlay */}
              {((viewMode === 'admin' && isMapLoading) || (viewMode === 'drain' && isDrainMapLoading)) && (
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

              {/* Always show the map based on current view mode */}
              {viewMode === 'admin' ? (
                <Map
                  selectedState={selectedStateCode}
                  selectedDistricts={selectedDistricts}
                  selectedSubDistricts={selectedSubDistricts}
                  selectedVillages={selectedVillages}
                  className="admin-map h-full"
                  onLoadingChange={handleMapLoadingChange}
                />
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Basic