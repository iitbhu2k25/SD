//frontend\app\dss\basic\seawage\components\SewageCalculationForm.tsx
'use client';
import React, { useState, useMemo, useEffect, JSX } from 'react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import isEqual from 'lodash/isEqual';
import html2canvas from 'html2canvas';
import domToImage from 'dom-to-image';
import L from 'leaflet';
import Colorizr from 'colorizr';

type DomesticLoadMethod = 'manual' | 'modeled' | '';
type PeakFlowSewageSource = 'population_based' | 'drain_based' | 'water_based' | 'floating_sewage' | 'institutional_sewage' | 'firefighting_sewage' | '';


export interface PollutionItem {
  name: string;
  perCapita: number;
  designCharacteristic?: number;
}

export interface DrainItem {
  id: string;
  name: string;
  discharge: number | '';
}


interface SelectedRiverData {
  drains: {
    id: string; // Change from number to string
    name: string;
    stretchId: number;

  }[];

  allDrains?: {
    id: string; // This should be Drain_No as string
    name: string;
    stretch: string;
    drainNo?: string;
  }[];

  river?: string;
  stretch?: string;
  selectedVillages?: any[];
}

interface Village {
  id: number;
  name: string;
  subDistrictId: number;
  population: number;
}

// Add props interface for SewageCalculationForm
interface SewageCalculationFormProps {
  villages_props?: any[];
  totalPopulation_props?: number;
  sourceMode?: 'admin' | 'drain';
  selectedRiverData?: SelectedRiverData | null; // Add this
  perCapitaConsumption?: number; // Add this line
  seasonalMultipliers?: { // Add this
    summer: number;
    monsoon: number;
    postMonsoon: number;
    winter: number;
  };
  waterDemandResults?: any; // Add this
  floatingSeasonalDemands?: any; // Add this
  domesticSeasonalDemands?: any; // Add this
}

interface SubDistrict {
  id: number;
  name: string;
  districtId: number;
}



interface PopulationProps {
  villages_props: Village[];
  subDistricts_props: SubDistrict[];
  totalPopulation_props: number;

  state_props?: { id: string; name: string };
  district_props?: { id: string; name: string };
  sourceMode?: 'admin' | 'drain';
}

const defaultPollutionItems: PollutionItem[] = [
  { name: "BOD", perCapita: 27.0 },
  { name: "COD", perCapita: 45.9 },
  { name: "TSS", perCapita: 40.5 },
  { name: "VSS", perCapita: 28.4 },
  { name: "Total Nitrogen", perCapita: 5.4 },
  { name: "Organic Nitrogen", perCapita: 1.4 },
  { name: "Ammonia Nitrogen", perCapita: 3.5 },
  { name: "Nitrate Nitrogen", perCapita: 0.5 },
  { name: "Total Phosphorus", perCapita: 0.8 },
  { name: "Ortho Phosphorous", perCapita: 0.5 },
];


const SewageCalculationForm: React.FC<SewageCalculationFormProps> = ({
  villages_props = [],
  totalPopulation_props = 0,
  sourceMode, // FIXED: Remove default value since it's now required
  selectedRiverData = null,
  perCapitaConsumption = 135,
  seasonalMultipliers = { // Add this with defaults
    summer: 1.10,
    monsoon: 0.95,
    postMonsoon: 1.00,
    winter: 0.90
  },
  waterDemandResults = null, // Add this with default
  floatingSeasonalDemands = null

  // Add this with default value
}) => {
  // --- States for Water Supply Method ---
  const [totalSupplyInput, setTotalSupplyInput] = useState<number | ''>('');///---
  const [waterSupplyResult, setWaterSupplyResult] = useState<any>(null);
  const results = typeof window !== 'undefined' ? (window as any).populationForecastResults || {} : {};
  // --- States for Domestic Sewage Method ---
  const [domesticLoadMethod, setDomesticLoadMethod] = useState<DomesticLoadMethod>('');
  const [domesticSupplyInput, setDomesticSupplyInput] = useState<number | ''>('');
  const [unmeteredSupplyInput, setUnmeteredSupplyInput] = useState<number | ''>(15);
  const [domesticSewageResult, setDomesticSewageResult] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  // --- Common States ---
  const [error, setError] = useState<string | null>(null);
  const [showPeakFlow, setShowPeakFlow] = useState(false);
  const [showRawSewage, setShowRawSewage] = useState(false);
  const [peakFlowSewageSource, setPeakFlowSewageSource] = useState<PeakFlowSewageSource>('');
  const [drainCount, setDrainCount] = useState<number | ''>(1);
  const [drainItems, setDrainItems] = useState<DrainItem[]>([]);
  const [totalDrainDischarge, setTotalDrainDischarge] = useState<number>(0);
  const [previousTotalWaterSupply, setpreviousTotalWaterSupply] = useState<number>(0);

  const [checkboxes, setCheckboxes] = useState({
    populationForecasting: false,
    waterDemand: false,
    waterSupply: false,
    sewageCalculation: false,
    rawSewageCharacteristics: false,
  });

  const computedPopulation = typeof window !== 'undefined' ? (window as any).selectedPopulationForecast || {} : {};
  const [pollutionItemsState, setPollutionItemsState] = useState<PollutionItem[]>(defaultPollutionItems);
  const [rawSewageTable, setRawSewageTable] = useState<JSX.Element | null>(null);
  const [peakFlowTable, setPeakFlowTable] = useState<JSX.Element | null>(null);
  const [peakFlowMethods, setPeakFlowMethods] = useState({
    cpheeo: false,
    harmon: false,
    babbitt: false,
  });

  // const areAllCheckboxesChecked = Object.values(checkboxes).every(checked => checked);

  const areAllCheckboxesChecked =
    checkboxes.populationForecasting &&
    checkboxes.waterDemand &&
    checkboxes.sewageCalculation &&
    checkboxes.rawSewageCharacteristics;


  // Add these new state variables
  const [sewageTreatmentCapacity, setSewageTreatmentCapacity] = useState<number | ''>('');
  const [selectedTreatmentMethod, setSelectedTreatmentMethod] = useState<'cpheeo' | 'harmon' | 'babbitt' | ''>('');
  const [treatmentCapacityTable, setTreatmentCapacityTable] = useState<JSX.Element | null>(null);



  // Storm Water Runoff states (add these to your existing state declarations)

  const [stormWaterData, setStormWaterData] = useState<any>(null);
  const [selectedLandUseType, setSelectedLandUseType] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [stormWaterResult, setStormWaterResult] = useState<any>(null);
  const [stormWaterLoading, setStormWaterLoading] = useState(false);
  const [stormWaterError, setStormWaterError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [rainfallIntensity, setRainfallIntensity] = useState<number | ''>('');

  // Reset all storm water values
  const resetStormWaterValues = () => {
    setStormWaterData(null);
    setSelectedLandUseType('');
    setSelectedTime('');
    setStormWaterResult(null);
    setStormWaterError(null);
    setRainfallIntensity('');
  };

  // Initialize storm water analysis
  // Initialize storm water analysis (modified to allow multiple initializations)
  const initializeStormWater = async () => {
    // Reset all state values first
    resetStormWaterValues();

    setIsInitialized(true);
    setStormWaterError(null);
    setStormWaterLoading(true);

    try {
      const villageCodesArray = villages_props?.map(v => v.id) || [];
      if (villageCodesArray.length === 0) {
        throw new Error('No village data available');
      }

      const response = await fetch('/django/swrunoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          village_codes: villageCodesArray
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to fetch storm water data'}`);
      }

      const data = await response.json();
      setStormWaterData(data);

      // Set default selections to enable the Calculate button
      if (data.shape_attributes && data.shape_attributes.length > 0) {
        setSelectedLandUseType(data.shape_attributes[0]);
      }
      if (data.all_duration_values && data.all_duration_values.length > 0) {
        setSelectedTime(data.all_duration_values[0].toString());
      }

    } catch (error) {
      //console.log('Error fetching storm water data:', error);
      setStormWaterError(`Failed to fetch storm water data: ${(error as Error).message}`);
    }
    finally {
      setStormWaterLoading(false);
    }
  };


  // Calculate storm water runoff (second API call)
  // Calculate storm water runoff (modified with initialization check)
  const calculateStormWaterRunoff = async () => {
    // Check if initialized first
    if (!isInitialized) {
      setStormWaterError('Please initialize storm water analysis first!');
      return;
    }

    if (!stormWaterData || !selectedLandUseType || !selectedTime || !rainfallIntensity) {
      setStormWaterError('Please fill in all required fields: land use type, time duration, and rainfall intensity');
      return;
    }

    setStormWaterLoading(true);
    setStormWaterError(null);

    try {
      const payload = {
        area: stormWaterData.total_area_hectares,
        selected_time: parseInt(selectedTime),
        shape: stormWaterData.overall_shape_type,
        selected_land_use_type: selectedLandUseType,
        rainfall_intensity: Number(rainfallIntensity)
      };

      const response = await fetch('/django/stormwaterrunoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to calculate storm water runoff'}`);
      }

      const result = await response.json();
      setStormWaterResult(result);
    } catch (error) {
      //console.log('Error calculating storm water runoff:', error);
      setStormWaterError(`Failed to calculate storm water runoff: ${(error as Error).message}`);
    }
    finally {
      setStormWaterLoading(false);
    }
  };


  // --- Initialize and Update Total Water Supply ---
  useEffect(() => {
    // Check if we're in the browser
    if (typeof window !== 'undefined' && (window as any).totalWaterSupply !== undefined) {
      if (totalSupplyInput === '' || totalSupplyInput === (window as any).previousTotalWaterSupply) {
        const newSupply = Number((window as any).totalWaterSupply);
        setTotalSupplyInput(newSupply);
        (window as any).previousTotalWaterSupply = newSupply;
      }
    }
  }); // ✅ Remove dependency array for now

  // --- NEW: Initialize drain items from selected drains in drain mode ---
  useEffect(() => {
    // console.log('SewageCalculationForm useEffect triggered:', {
    //   sourceMode,
    //   selectedRiverData: selectedRiverData ? 'present' : 'null',
    //   windowSelectedRiverData: window.selectedRiverData ? 'present' : 'null',
    //   windowAllDrains: window.selectedRiverData?.allDrains?.length || 0
    // });

    // FIXED: Only proceed if sourceMode is actually 'drain'
    if (sourceMode === 'drain') {
      //console.log('Processing drain mode initialization...');

      // FIXED: Since window.selectedRiverData has the data, use it primarily
      let drainData = null;

      // Priority 1: window.selectedRiverData.allDrains (this has your data)
      if (window.selectedRiverData?.allDrains && window.selectedRiverData.allDrains.length > 0) {
        drainData = window.selectedRiverData.allDrains;
        //console.log('Using window.selectedRiverData.allDrains:', drainData);
      }
      // Priority 2: selectedRiverData prop
      else if (selectedRiverData?.allDrains && selectedRiverData.allDrains.length > 0) {
        drainData = selectedRiverData.allDrains;
        //console.log('Using selectedRiverData prop:', drainData);
      }
      // Priority 3: window.selectedRiverData.drains as fallback
      else if (window.selectedRiverData?.drains && window.selectedRiverData.drains.length > 0) {
        drainData = window.selectedRiverData.drains.map((d: { id: { toString: () => any; }; name: any; }) => ({
          id: d.id.toString(),
          name: d.name,
          stretch: 'Unknown Stretch',
          drainNo: d.id.toString()
        }));
        //console.log('Using window.selectedRiverData.drains as fallback:', drainData);
      }

      if (drainData && drainData.length > 0) {
        //console.log('Creating drain items from data:', drainData);

        const newDrainItems: DrainItem[] = drainData.map((drain: any) => ({
          id: drain.id.toString(), // This should be "33" from your debug
          name: drain.name || `Drain ${drain.id}`, // This should be "Drain 33"
          discharge: '', // Start with empty discharge
        }));

        //console.log('New drain items created:', newDrainItems);

        // Always update in drain mode to ensure correct data
        setDrainCount(drainData.length);
        setDrainItems(newDrainItems);

        //console.log('Updated drainCount and drainItems');
      } else {
        //console.log('No drain data found for initialization');
      }
    } else {
      //console.log('Not in drain mode, sourceMode is:', sourceMode);
    }
  }, [sourceMode, selectedRiverData]);

  // --- Update Drain Items (only when not in drain mode or when manually changed) ---
  useEffect(() => {
    // Only auto-generate drain items if not in drain mode
    if (sourceMode !== 'drain') {
      if (typeof drainCount === 'number' && drainCount > 0) {
        const newDrainItems: DrainItem[] = Array.from({ length: drainCount }, (_, index) => ({
          id: `D${index + 1}`,
          name: `Drain ${index + 1}`,
          discharge: '',
        }));
        setDrainItems(newDrainItems);
      } else {
        setDrainItems([]);
      }
    }
    // ✅ Remove the drain mode handling from this useEffect to prevent interference
  }, [drainCount, sourceMode]);

  // Also add this additional useEffect to sync with window.selectedRiverData changes:

  // useEffect(() => {
  //   const handleDrainDataUpdate = (event: CustomEvent) => {
  //     console.log('Received drain data update event:', event.detail);
  //     if (sourceMode === 'drain' && event.detail?.allDrains) {
  //       // Force update drain items
  //       const newDrainItems = event.detail.allDrains.map((drain: any) => ({
  //         id: drain.id.toString(),
  //         name: drain.name,
  //         discharge: '',
  //       }));
  //       setDrainCount(newDrainItems.length);
  //       setDrainItems(newDrainItems);
  //     }
  //   };

  //   window.addEventListener('drainDataUpdated', handleDrainDataUpdate);
  //   return () => window.removeEventListener('drainDataUpdated', handleDrainDataUpdate);
  // }, [sourceMode]);


  useEffect(() => {
    if (sourceMode === 'drain') {
      const handleWindowDataChange = () => {
        if (window.selectedRiverData?.allDrains && window.selectedRiverData.allDrains.length > 0) {
          const windowDrains = window.selectedRiverData.allDrains;

          const currentIds = drainItems.map(d => d.id).sort();
          const windowIds = windowDrains.map((d: any) => d.id.toString()).sort();

          if (!isEqual(currentIds, windowIds)) {
            //console.log('Updating drain structure while preserving discharge values');

            const newDrainItems: DrainItem[] = windowDrains.map((drain: any) => {
              const existingItem = drainItems.find(existing => existing.id === drain.id.toString());
              return {
                id: drain.id.toString(),
                name: drain.name || `Drain ${drain.id}`,
                discharge: existingItem?.discharge || '',
              };
            });

            setDrainCount(windowDrains.length);
            setDrainItems(newDrainItems);
          }
        }
      };


      handleWindowDataChange();


    }
  }, [sourceMode]);

  // --- Calculate Total Drain Discharge ---
  useEffect(() => {
    const total = drainItems.reduce((sum, item) => {
      return sum + (typeof item.discharge === 'number' ? item.discharge : 0);
    }, 0);
    setTotalDrainDischarge(total);
  }, [drainItems]);

  // Auto-select peak flow source based on maximum sewage value
  useEffect(() => {
    if ((waterSupplyResult || domesticSewageResult) && computedPopulation && Object.keys(computedPopulation).length > 0) {
      // Get a sample year to compare values (preferably 2025 or first available)
      const sampleYear = computedPopulation["2025"] ? "2025" : Object.keys(computedPopulation)[0];
      const samplePop = computedPopulation[sampleYear] || 0;

      let popBasedValue = 0;
      let drainBasedValue = 0;
      let waterBasedValue = 0;
      let floatingBasedValue = 0;
      let institutionalBasedValue = 0;
      let firefightingBasedValue = 0;

      // Calculate population-based sewage value
      if (domesticLoadMethod === 'modeled' && domesticSewageResult && domesticSewageResult[sampleYear]) {
        popBasedValue = domesticSewageResult[sampleYear];
      } else if (domesticLoadMethod === 'manual' && domesticSupplyInput) {
        const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        const multiplier = (perCapitaConsumption + Number(unmeteredSupplyInput)) / 1000000;
        popBasedValue = referencePopulation > 0
          ? ((samplePop / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
          : 0;
      } else if (waterSupplyResult && waterSupplyResult[sampleYear]) {
        popBasedValue = waterSupplyResult[sampleYear];
      }
      // console.log('perCapitaConsumption', perCapitaConsumption);
      // console.log('seasonalMultipliers', seasonalMultipliers);
      // console.log('floatingSeasonalDemands', floatingSeasonalDemands);
      // console.log('waterDemandResults', waterDemandResults);
      // Calculate drain-based sewage value
      if (totalDrainDischarge > 0) {
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        drainBasedValue = referencePopulation > 0
          ? (samplePop / referencePopulation) * totalDrainDischarge
          : totalDrainDischarge;
      }

      // Calculate water-based sewage value
      if (Number(totalSupplyInput) > 0) {
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        waterBasedValue = referencePopulation > 0
          ? (samplePop / referencePopulation) * Number(totalSupplyInput) * 0.80
          : Number(totalSupplyInput) * 0.80;
      }

      // Calculate floating-based sewage value
      if (waterDemandResults?.floating?.[sampleYear]) {
        floatingBasedValue = waterDemandResults.floating[sampleYear] * 0.8;
      } else if ((window as any).floatingWaterDemand?.[sampleYear]) {
        floatingBasedValue = (window as any).floatingWaterDemand[sampleYear] * 0.8;
      }

      // Calculate institutional-based sewage value
      if (waterDemandResults?.institutional?.[sampleYear]) {
        institutionalBasedValue = waterDemandResults.institutional[sampleYear] * 0.8;
      } else if ((window as any).institutionalWaterDemand?.[sampleYear]) {
        institutionalBasedValue = (window as any).institutionalWaterDemand[sampleYear] * 0.8;
      }

      // Calculate firefighting-based sewage value
      const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
      if (waterDemandResults?.firefighting?.[method]?.[sampleYear]) {
        firefightingBasedValue = waterDemandResults.firefighting[method][sampleYear] * 0.8;
      } else if ((window as any).firefightingWaterDemand?.[method]?.[sampleYear]) {
        firefightingBasedValue = (window as any).firefightingWaterDemand[method][sampleYear] * 0.8;
      }

      // console.log('Auto-selecting peak flow source:', {
      //   popBasedValue,
      //   drainBasedValue,
      //   waterBasedValue,
      //   floatingBasedValue,
      //   institutionalBasedValue,
      //   firefightingBasedValue,
      //   domesticLoadMethod,
      //   totalDrainDischarge,
      //   totalSupplyInput
      // });

      // Select the method with highest value
      // Calculate floating-based sewage value


      // Update the selection logic to include all values
      const allValues = [
        { type: 'population_based', value: popBasedValue },
        { type: 'drain_based', value: drainBasedValue },
        { type: 'water_based', value: waterBasedValue },
        { type: 'floating_sewage', value: floatingBasedValue },
        { type: 'institutional_sewage', value: institutionalBasedValue },
        { type: 'firefighting_sewage', value: firefightingBasedValue }
      ];

      // Select the method with highest value
      const maxValue = Math.max(...allValues.map(v => v.value));
      const selectedSource = allValues.find(v => v.value === maxValue);

      if (selectedSource && selectedSource.value > 0) {
        setPeakFlowSewageSource(selectedSource.type as PeakFlowSewageSource);
      }

    }
  }, [waterSupplyResult, domesticSewageResult, totalDrainDischarge, totalSupplyInput, domesticLoadMethod, domesticSupplyInput, unmeteredSupplyInput, computedPopulation]);

  // Auto-select peak flow source based on maximum sewage value


  // --- Handlers ---
  const handleDomesticLoadMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDomesticLoadMethod(e.target.value as DomesticLoadMethod);
    setDomesticSewageResult(null);
    setShowPeakFlow(false);
    setShowRawSewage(false);
  };

  const handleDrainCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? '' : Number(e.target.value);
    setDrainCount(value);
  };

  const handleDrainItemChange = (index: number, field: keyof DrainItem, value: string | number) => {
    //console.log(`🔧 Drain item change - Index: ${index}, Field: ${field}, Value: ${value}, Type: ${typeof value}`);

    const newDrainItems = [...drainItems];

    if (field === 'discharge') {
      // Handle discharge field specifically
      if (value === '' || value === null || value === 'helvetica') {
        newDrainItems[index].discharge = '';
        //console.log(`✅ Set discharge to empty for drain ${index}`);
      } else {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          newDrainItems[index].discharge = numValue;
          //console.log(`✅ Set discharge to ${numValue} for drain ${index}`);
        } else {
          //console.warn(`⚠️ Invalid discharge value: ${value}`);
          newDrainItems[index].discharge = '';
        }
      }
    } else {
      // Handle other fields (id, name)
      newDrainItems[index][field] = value as string;
      //console.log(`✅ Set ${field} to ${value} for drain ${index}`);
    }

    //console.log('Updated drain items:', newDrainItems);
    setDrainItems(newDrainItems);
  };

  // Rest of your existing handlers and functions remain the same...
  const handleCalculateSewage = async () => {
    setError(null);
    setWaterSupplyResult(null);
    setDomesticSewageResult(null);
    setShowPeakFlow(true);
    setShowRawSewage(false);

    let hasError = false;
    const payloads: any[] = [];

    // --- Water Supply Payload (OPTIONAL) ---
    // Only add water supply payload if user has provided water supply input
    if (totalSupplyInput !== '' && Number(totalSupplyInput) > 0) {
      payloads.push({
        method: 'water_supply',
        total_supply: Number(totalSupplyInput),
        drain_items: drainItems.map(item => ({
          id: item.id,
          name: item.name,
          discharge: typeof item.discharge === 'number' ? item.discharge : 0
        })),
        total_drain_discharge: totalDrainDischarge
      });
    }

    // --- Domestic Sewage Payload (REQUIRED) ---
    if (!domesticLoadMethod) {
      setError(prev => prev ? `${prev} Please select a domestic sewage sector method. ` : 'Please select a domestic sewage sector method. ');
      hasError = true;
    } else {
      const payload: any = {
        method: 'domestic_sewage',
        load_method: domesticLoadMethod,
        drain_items: drainItems.map(item => ({
          id: item.id,
          name: item.name,
          discharge: typeof item.discharge === 'number' ? item.discharge : 0
        })),
        total_drain_discharge: totalDrainDischarge
      };

      if (domesticLoadMethod === 'manual') {
        if (domesticSupplyInput === '' || Number(domesticSupplyInput) <= 0) {
          setError(prev => prev ? `${prev} Invalid domestic supply. ` : 'Invalid domestic supply. ');
          hasError = true;
        } else {
          payload.domestic_supply = Number(domesticSupplyInput);
          payloads.push(payload);
        }
      } else if (domesticLoadMethod === 'modeled') {
        payload.unmetered_supply = Number(unmeteredSupplyInput);
        payload.computed_population = computedPopulation;
        payloads.push(payload);
      }
    }

    // Check if we have at least one payload to process
    if (payloads.length === 0) {
      setError('Please provide either water supply input or select a domestic sewage method with required inputs.');
      hasError = true;
    }

    if (hasError) return;

    try {
      const responses = await Promise.all(payloads.map(payload =>
        fetch('/django/sewage_calculation/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      ));

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (!response.ok) {
          const err = await response.json();
          setError(prev => prev ? `${prev} ${err.error || 'Error calculating sewage.'} ` : err.error || 'Error calculating sewage.');
          continue;
        }
        const data = await response.json();
        if (payloads[i].method === 'water_supply') {
          setWaterSupplyResult(data.sewage_demand);
        } else if (payloads[i].method === 'domestic_sewage') {
          if (payloads[i].load_method === 'manual') {
            setDomesticSewageResult(data.sewage_demand);
          } else {
            setDomesticSewageResult(data.sewage_result);
          }
        }
      }

      // Show peak flow section if we have any sewage results
      if (waterSupplyResult || domesticSewageResult || payloads.length > 0) {
        setShowPeakFlow(true);
      }
    } catch (error) {
      //console.log(error);
      setError('Error connecting to backend.');
    }
  };

  const handlePeakFlowMethodToggle = (method: keyof typeof peakFlowMethods) => {
    setPeakFlowMethods({
      ...peakFlowMethods,
      [method]: !peakFlowMethods[method],
    });
  };

  const handlePeakFlowSewageSourceChange = (source: PeakFlowSewageSource) => {
    setPeakFlowSewageSource(source);
  };

  const getCPHEEOFactor = (pop: number) => {
    if (pop < 20000) return 3.0;
    if (pop <= 50000) return 2.5;
    if (pop <= 75000) return 2.25;
    return 2.0;
  };

  const getHarmonFactor = (pop: number) => 1 + 14 / (4 + Math.sqrt(pop / 1000));
  const getBabbittFactor = (pop: number) => 5 / (pop / 1000) ** 0.2;

  const calculateDrainBasedSewFlow = (popVal: number) => {
    if (totalDrainDischarge <= 0) return 0;
    const referencePopulation = (window as any).population2025;
    if (referencePopulation && referencePopulation > 0) {
      return (popVal / referencePopulation) * totalDrainDischarge;
    }
    return totalDrainDischarge;
  };


  const calculatewaterBasedSewFlow = (popVal: number) => {
    if (!totalSupplyInput || totalSupplyInput === 0) return 0;

    const referencePopulation = (window as any).population2025;
    if (referencePopulation && referencePopulation > 0) {
      return ((popVal / referencePopulation) * Number(totalSupplyInput));
    }
    return Number(totalSupplyInput);
  };

  const handleCalculatePeakFlow = () => {
    if (!computedPopulation || (!waterSupplyResult && !domesticSewageResult)) {
      alert('Population or sewage data not available.');
      return;
    }

    const selectedMethods = Object.entries(peakFlowMethods)
      .filter(([_, selected]) => selected)
      .map(([method]) => method);
    if (selectedMethods.length === 0) {
      alert('Please select at least one Peak Flow method.');
      return;
    }

    // Auto-select peak flow source if not selected
    if (!peakFlowSewageSource) {
      // Get a sample year to compare values
      const sampleYear = Object.keys(computedPopulation)[0];
      const samplePop = computedPopulation[sampleYear] || 0;

      let popBasedValue = 0;
      let drainBasedValue = 0;
      let waterBasedValue = 0;

      if (domesticLoadMethod === 'modeled' && domesticSewageResult) {
        popBasedValue = domesticSewageResult[sampleYear] || 0;
      } else if (domesticLoadMethod === 'manual' && domesticSupplyInput) {
        const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
        popBasedValue = referencePopulation > 0
          ? ((samplePop / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
          : 0;
      }

      if (totalDrainDischarge > 0) {
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        drainBasedValue = referencePopulation > 0 ? (samplePop / referencePopulation) * totalDrainDischarge : totalDrainDischarge;
      }

      if (Number(totalSupplyInput) > 0) {
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        waterBasedValue = referencePopulation > 0 ? (samplePop / referencePopulation) * Number(totalSupplyInput) * 0.80 : Number(totalSupplyInput) * 0.80;
      }

      // Select the method with highest value
      if (drainBasedValue >= popBasedValue && drainBasedValue >= waterBasedValue && totalDrainDischarge > 0) {
        setPeakFlowSewageSource('drain_based');
      } else if (waterBasedValue >= popBasedValue && Number(totalSupplyInput) > 0) {
        setPeakFlowSewageSource('water_based');
      } else {
        setPeakFlowSewageSource('population_based');
      }

      // Re-run this function after state update
      setTimeout(() => handleCalculatePeakFlow(), 100);
      return;
    }

    // Get sewage result based on method
    let sewageResult: { [x: string]: number; };
    if (domesticLoadMethod === 'modeled') {
      sewageResult = domesticSewageResult;
    } else if (domesticLoadMethod === 'manual') {
      // Create manual sewage result object for population-based calculations
      sewageResult = {};
      Object.keys(computedPopulation).forEach(year => {
        const domesticPop = computedPopulation[year];
        const k = Number(domesticSupplyInput); // User input population
        const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;

        sewageResult[year] = referencePopulation > 0
          ? ((domesticPop / referencePopulation) * k) * multiplier * 0.80
          : 0;
      });
    } else {
      sewageResult = waterSupplyResult || domesticSewageResult;
    }

    const rows = Object.keys(sewageResult || {}).map((year) => {
      const popVal = computedPopulation[year] || 0;
      const popBasedSewFlow = sewageResult[year] || 0;

      // Calculate drain and water based flows
      let drainBasedSewFlow, waterBasedSewFlow;

      if (domesticLoadMethod === 'manual') {
        // Manual case calculations with ratio
        const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];

        drainBasedSewFlow = referencePopulation > 0
          ? (popVal / referencePopulation) * totalDrainDischarge
          : 0;

        waterBasedSewFlow = referencePopulation > 0
          ? (popVal / referencePopulation) * Number(totalSupplyInput) * 0.80
          : 0;
      } else {
        // Modeled case - use existing functions
        drainBasedSewFlow = calculateDrainBasedSewFlow(popVal);
        waterBasedSewFlow = calculatewaterBasedSewFlow(popVal);
      }

      // Calculate the combined domestic sewage (same as in sewage generation table)
      let combinedDomesticSewage;
      if (domesticLoadMethod === 'manual') {
        // Manual case - calculate combined domestic sewage
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
        const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
        const populationBasedSewage = referencePopulation > 0
          ? ((popVal / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
          : domesticSewageResult;

        // Add floating sewage
        const floatingSewage = (() => {
          if (waterDemandResults?.floating?.[year]) {
            return waterDemandResults.floating[year] * 0.8;
          }
          if (waterDemandResults?.floating?.base_demand?.[year]) {
            return waterDemandResults.floating.base_demand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.[year]) {
            return (window as any).floatingWaterDemand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.base_demand?.[year]) {
            return (window as any).floatingWaterDemand.base_demand[year] * 0.8;
          }
          return 0;
        })();

        // Add institutional sewage
        const institutionalSewage = (() => {
          if (waterDemandResults?.institutional?.[year]) {
            return waterDemandResults.institutional[year] * 0.8;
          }
          if ((window as any).institutionalWaterDemand?.[year]) {
            return (window as any).institutionalWaterDemand[year] * 0.8;
          }
          return 0;
        })();

        // Add firefighting sewage
        const firefightingSewage = (() => {
          const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
          if (waterDemandResults?.firefighting?.[method]?.[year]) {
            return waterDemandResults.firefighting[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
            return (window as any).firefightingWaterDemand[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
            return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
          }
          return 0;
        })();

        combinedDomesticSewage = populationBasedSewage + floatingSewage + institutionalSewage;
      } else {
        // Modeled case - calculate combined domestic sewage
        const domesticSewageValue = Number(popBasedSewFlow);

        // Add floating sewage
        const floatingSewage = (() => {
          if (waterDemandResults?.floating?.[year]) {
            return waterDemandResults.floating[year] * 0.8;
          }
          if (waterDemandResults?.floating?.base_demand?.[year]) {
            return waterDemandResults.floating.base_demand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.[year]) {
            return (window as any).floatingWaterDemand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.base_demand?.[year]) {
            return (window as any).floatingWaterDemand.base_demand[year] * 0.8;
          }
          return 0;
        })();

        // Add institutional sewage
        const institutionalSewage = (() => {
          if (waterDemandResults?.institutional?.[year]) {
            return waterDemandResults.institutional[year] * 0.8;
          }
          if ((window as any).institutionalWaterDemand?.[year]) {
            return (window as any).institutionalWaterDemand[year] * 0.8;
          }
          return 0;
        })();

        // Add firefighting sewage
        const firefightingSewage = (() => {
          const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
          if (waterDemandResults?.firefighting?.[method]?.[year]) {
            return waterDemandResults.firefighting[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
            return (window as any).firefightingWaterDemand[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
            return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
          }
          return 0;
        })();

        combinedDomesticSewage = domesticSewageValue + floatingSewage + institutionalSewage;
      }

      // Determine average sewage flow based on selected source
      let avgSewFlow;
      if (peakFlowSewageSource === 'drain_based' && totalDrainDischarge > 0) {
        avgSewFlow = drainBasedSewFlow;
      } else if (peakFlowSewageSource === 'water_based' && Number(totalSupplyInput) > 0) {
        avgSewFlow = waterBasedSewFlow;
      } else if (peakFlowSewageSource === 'floating_sewage') {
        // Calculate floating sewage flow
        const floatingSewage = (() => {
          if (waterDemandResults?.floating?.[year]) {
            return waterDemandResults.floating[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.[year]) {
            return (window as any).floatingWaterDemand[year] * 0.8;
          }
          return 0;
        })();
        avgSewFlow = floatingSewage;
      } else if (peakFlowSewageSource === 'institutional_sewage') {
        // Calculate institutional sewage flow
        const institutionalSewage = (() => {
          if (waterDemandResults?.institutional?.[year]) {
            return waterDemandResults.institutional[year] * 0.8;
          }
          if ((window as any).institutionalWaterDemand?.[year]) {
            return (window as any).institutionalWaterDemand[year] * 0.8;
          }
          return 0;
        })();
        avgSewFlow = institutionalSewage;
      } else if (peakFlowSewageSource === 'firefighting_sewage') {
        // Calculate firefighting sewage flow
        const firefightingSewage = (() => {
          const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
          if (waterDemandResults?.firefighting?.[method]?.[year]) {
            return waterDemandResults.firefighting[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
            return (window as any).firefightingWaterDemand[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
            return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
          }
          return 0;
        })();
        avgSewFlow = firefightingSewage;
      } else {
        // Default to combined domestic sewage (same as displayed in sewage generation table)
        avgSewFlow = combinedDomesticSewage;
      }

      const row: any = {
        year,
        population: popVal,
        avgSewFlow: avgSewFlow.toFixed(2)
      };

      if (selectedMethods.includes('cpheeo')) {
        row.cpheeo = (avgSewFlow * getCPHEEOFactor(popVal)).toFixed(2);
      }
      if (selectedMethods.includes('harmon')) {
        row.harmon = (avgSewFlow * getHarmonFactor(popVal)).toFixed(2);
      }
      if (selectedMethods.includes('babbitt')) {
        row.babbitt = (avgSewFlow * getBabbittFactor(popVal)).toFixed(2);
      }
      return row;
    });

    const tableJSX = (
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">Year</th>
            <th className="border px-2 py-1">Population</th>
            <th className="border px-2 py-1">Avg Sewage Flow (MLD)</th>
            {selectedMethods.includes('cpheeo') && (
              <th className="border px-2 py-1">CPHEEO Peak (MLD)</th>
            )}
            {selectedMethods.includes('harmon') && (
              <th className="border px-2 py-1">Harmon's Peak (MLD)</th>
            )}
            {selectedMethods.includes('babbitt') && (
              <th className="border px-2 py-1">Babbit's Peak (MLD)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td className="border px-2 py-1">{row.year}</td>
              <td className="border px-2 py-1">{row.population.toLocaleString()}</td>
              <td className="border px-2 py-1">{row.avgSewFlow}</td>
              {selectedMethods.includes('cpheeo') && (
                <td className="border px-2 py-1">{row.cpheeo}</td>
              )}
              {selectedMethods.includes('harmon') && (
                <td className="border px-2 py-1">{row.harmon}</td>
              )}
              {selectedMethods.includes('babbitt') && (
                <td className="border px-2 py-1">{row.babbitt}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
    setPeakFlowTable(tableJSX);
  };

  const handleCalculateRawSewage = () => {
    const basePop = computedPopulation["2011"] || 0;
    const baseCoefficient = basePop >= 1000000 ? 150 : 135;
    const unmetered = Number(unmeteredSupplyInput) || 0;
    const totalCoefficient = (baseCoefficient + unmetered) * 0.80;

    const tableRows = pollutionItemsState.map((item, index) => {
      const concentration = (item.perCapita / totalCoefficient) * 1000;
      return (
        <tr key={index}>
          <td className="border px-2 py-1">{item.name}</td>
          <td className="border px-2 py-1">
            <input
              type="number"
              value={item.perCapita}
              onChange={(e) => {
                const newVal = Number(e.target.value);
                setPollutionItemsState(prev => {
                  const newItems = [...prev];
                  newItems[index] = { ...newItems[index], perCapita: newVal };
                  return newItems;
                });
              }}
              className="w-20 border rounded px-1 py-0.5"
            />
          </td>
          <td className="border px-2 py-1">{concentration.toFixed(1)}</td>
          <td className="border px-2 py-1">
            <input
              type="number"
              value={item.designCharacteristic || concentration.toFixed(1)}
              onChange={(e) => {
                const newVal = Number(e.target.value);
                setPollutionItemsState(prev => {
                  const newItems = [...prev];
                  newItems[index] = {
                    ...newItems[index],
                    designCharacteristic: newVal
                  };
                  return newItems;
                });
              }}
              className="w-20 border rounded px-1 py-0.5"
            />
          </td>
        </tr>
      );
    });

    const tableJSX = (
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">Item</th>
            <th className="border px-2 py-1">Per Capita Contribution (g/c/d)</th>
            <th className="border px-2 py-1">Concentration (mg/l)</th>
            <th className="border px-2 py-1">Design Characteristic (mg/l)</th>
          </tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
    );
    setRawSewageTable(tableJSX);
    setShowRawSewage(true);
  };

  const handleCalculateTreatmentCapacity = () => {
    if (!sewageTreatmentCapacity || sewageTreatmentCapacity <= 0) {
      alert('Please enter a valid sewage treatment capacity.');
      return;
    }

    if (!selectedTreatmentMethod) {
      alert('Please select a treatment method.');
      return;
    }

    // Check if we have computed population data
    if (!computedPopulation || Object.keys(computedPopulation).length === 0) {
      alert('Population data not available. Please ensure population forecasting is completed first.');
      return;
    }

    // Get sewage result based on method - prioritize domesticSewageResult
    const sewageResult = domesticSewageResult || waterSupplyResult;

    if (!sewageResult) {
      alert('Sewage calculation data not available. Please calculate sewage first.');
      return;
    }

    // console.log('Treatment Capacity Calculation:', {
    //   sewageTreatmentCapacity,
    //   selectedTreatmentMethod,
    //   computedPopulation,
    //   sewageResult,
    //   domesticLoadMethod
    // });

    const treatmentRows = Object.keys(computedPopulation).map((year) => {
      const popVal = computedPopulation[year] || 0;

      // Calculate the combined domestic sewage (same as in sewage generation table)
      let combinedDomesticSewage;
      if (domesticLoadMethod === 'manual') {
        // Manual case - calculate combined domestic sewage
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
        const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
        const populationBasedSewage = referencePopulation > 0
          ? ((popVal / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
          : (typeof sewageResult === 'number' ? sewageResult : 0);

        // Add floating sewage
        const floatingSewage = (() => {
          if (waterDemandResults?.floating?.[year]) {
            return waterDemandResults.floating[year] * 0.8;
          }
          if (waterDemandResults?.floating?.base_demand?.[year]) {
            return waterDemandResults.floating.base_demand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.[year]) {
            return (window as any).floatingWaterDemand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.base_demand?.[year]) {
            return (window as any).floatingWaterDemand.base_demand[year] * 0.8;
          }
          return 0;
        })();

        // Add institutional sewage
        const institutionalSewage = (() => {
          if (waterDemandResults?.institutional?.[year]) {
            return waterDemandResults.institutional[year] * 0.8;
          }
          if ((window as any).institutionalWaterDemand?.[year]) {
            return (window as any).institutionalWaterDemand[year] * 0.8;
          }
          return 0;
        })();

        // Add firefighting sewage
        const firefightingSewage = (() => {
          const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
          if (waterDemandResults?.firefighting?.[method]?.[year]) {
            return waterDemandResults.firefighting[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
            return (window as any).firefightingWaterDemand[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
            return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
          }
          return 0;
        })();

        combinedDomesticSewage = populationBasedSewage + floatingSewage + institutionalSewage;
      } else {
        // Modeled case - calculate combined domestic sewage
        const domesticSewageValue = typeof sewageResult === 'number' ? sewageResult : (sewageResult[year] || 0);

        // Add floating sewage
        const floatingSewage = (() => {
          if (waterDemandResults?.floating?.[year]) {
            return waterDemandResults.floating[year] * 0.8;
          }
          if (waterDemandResults?.floating?.base_demand?.[year]) {
            return waterDemandResults.floating.base_demand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.[year]) {
            return (window as any).floatingWaterDemand[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.base_demand?.[year]) {
            return (window as any).floatingWaterDemand.base_demand[year] * 0.8;
          }
          return 0;
        })();

        // Add institutional sewage
        const institutionalSewage = (() => {
          if (waterDemandResults?.institutional?.[year]) {
            return waterDemandResults.institutional[year] * 0.8;
          }
          if ((window as any).institutionalWaterDemand?.[year]) {
            return (window as any).institutionalWaterDemand[year] * 0.8;
          }
          return 0;
        })();

        // Add firefighting sewage
        const firefightingSewage = (() => {
          const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
          if (waterDemandResults?.firefighting?.[method]?.[year]) {
            return waterDemandResults.firefighting[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
            return (window as any).firefightingWaterDemand[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
            return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
          }
          return 0;
        })();

        combinedDomesticSewage = domesticSewageValue + floatingSewage + institutionalSewage;
      }

      // Get base sewage flow for the year
      let avgSewFlow = 0;

      // Handle different peak flow sources
      if (peakFlowSewageSource === 'drain_based' && totalDrainDischarge > 0) {
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
        avgSewFlow = referencePopulation > 0
          ? (popVal / referencePopulation) * totalDrainDischarge
          : totalDrainDischarge;
      } else if (peakFlowSewageSource === 'water_based' && Number(totalSupplyInput) > 0) {
        const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
        avgSewFlow = referencePopulation > 0
          ? (popVal / referencePopulation) * Number(totalSupplyInput) * 0.80
          : Number(totalSupplyInput) * 0.80;
      } else if (peakFlowSewageSource === 'floating_sewage') {
        const floatingSewage = (() => {
          if (waterDemandResults?.floating?.[year]) {
            return waterDemandResults.floating[year] * 0.8;
          }
          if ((window as any).floatingWaterDemand?.[year]) {
            return (window as any).floatingWaterDemand[year] * 0.8;
          }
          return 0;
        })();
        avgSewFlow = floatingSewage;
      } else if (peakFlowSewageSource === 'institutional_sewage') {
        const institutionalSewage = (() => {
          if (waterDemandResults?.institutional?.[year]) {
            return waterDemandResults.institutional[year] * 0.8;
          }
          if ((window as any).institutionalWaterDemand?.[year]) {
            return (window as any).institutionalWaterDemand[year] * 0.8;
          }
          return 0;
        })();
        avgSewFlow = institutionalSewage;
      } else if (peakFlowSewageSource === 'firefighting_sewage') {
        const firefightingSewage = (() => {
          const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
          if (waterDemandResults?.firefighting?.[method]?.[year]) {
            return waterDemandResults.firefighting[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
            return (window as any).firefightingWaterDemand[method][year] * 0.8;
          }
          if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
            return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
          }
          return 0;
        })();
        avgSewFlow = firefightingSewage;
      } else {
        // Default to combined domestic sewage (same as displayed in sewage generation table)
        avgSewFlow = combinedDomesticSewage;
      }

      // Calculate peak flow based on selected treatment method
      let peakSewageGeneration;
      if (selectedTreatmentMethod === 'cpheeo') {
        peakSewageGeneration = avgSewFlow * getCPHEEOFactor(popVal);
      } else if (selectedTreatmentMethod === 'harmon') {
        peakSewageGeneration = avgSewFlow * getHarmonFactor(popVal);
      } else if (selectedTreatmentMethod === 'babbitt') {
        peakSewageGeneration = avgSewFlow * getBabbittFactor(popVal);
      } else {
        peakSewageGeneration = avgSewFlow;
      }

      // Calculate gap (Treatment Capacity - Sewage Generation)
      const gap = Number(sewageTreatmentCapacity) - peakSewageGeneration;
      const status = gap >= 0 ? 'Sufficient' : 'Deficit';
      const statusColor = gap >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';

      // console.log(`Year ${year}:`, {
      //   population: popVal,
      //   avgSewFlow,
      //   peakSewageGeneration,
      //   treatmentCapacity: Number(sewageTreatmentCapacity),
      //   gap,
      //   status
      // });

      return {
        year,
        population: popVal,
        treatmentCapacity: Number(sewageTreatmentCapacity),
        sewageGeneration: peakSewageGeneration,
        gap: gap,
        status: status,
        statusColor: statusColor
      };
    });

    //console.log('All treatment rows:', treatmentRows);

    const tableJSX = (
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1 bg-gray-100">Year</th>
            <th className="border px-2 py-1 bg-gray-100">Population</th>
            <th className="border px-2 py-1 bg-gray-100">Sewage Treatment Capacity (MLD)</th>
            <th className="border px-2 py-1 bg-gray-100">Sewage Generation ({selectedTreatmentMethod.toUpperCase()}) (MLD)</th>
            <th className="border px-2 py-1 bg-gray-100">Gap (MLD)</th>
            <th className="border px-2 py-1 bg-gray-100">Status</th>
          </tr>
        </thead>
        <tbody>
          {treatmentRows.map((row, idx) => (
            <tr key={idx}>
              <td className="border px-2 py-1">{row.year}</td>
              <td className="border px-2 py-1">{row.population.toLocaleString()}</td>
              <td className="border px-2 py-1">{row.treatmentCapacity.toFixed(2)}</td>
              <td className="border px-2 py-1">{row.sewageGeneration.toFixed(2)}</td>
              <td className={`border px-2 py-1 font-medium ${row.statusColor}`}>
                {row.gap >= 0 ? '+' : ''}{row.gap.toFixed(2)}
              </td>
              <td className={`border px-2 py-1 font-medium ${row.statusColor}`}>
                {row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    setTreatmentCapacityTable(tableJSX);
  };



  const rawSewageJSX = useMemo(() => {
    const basePop = computedPopulation["2011"] || 0;
    const baseCoefficient = basePop >= 1000000 ? 150 : 135;
    const unmetered = Number(unmeteredSupplyInput) || 0;
    const totalCoefficient = (baseCoefficient + unmetered) * 0.80;

    return (
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">Item</th>
            <th className="border px-2 py-1">Per Capita Contribution (g/c/d)</th>
            <th className="border px-2 py-1">Raw Sewage Characteristics (mg/l)</th>
            <th className="border px-2 py-1">Design Characteristics (mg/l)</th>
          </tr>
        </thead>
        <tbody>
          {pollutionItemsState.map((item, index) => {
            const concentration = (item.perCapita / totalCoefficient) * 1000;
            return (
              <tr key={index}>
                <td className="border px-2 py-1">{item.name}</td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    value={item.perCapita}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      setPollutionItemsState(prev => {
                        const newItems = [...prev];
                        newItems[index] = { ...newItems[index], perCapita: newVal };
                        return newItems;
                      });
                    }}
                    className="w-20 border rounded px-1 py-0.5"
                  />
                </td>
                <td className="border px-2 py-1">{concentration.toFixed(1)}</td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    value={item.designCharacteristic || concentration.toFixed(1)}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      setPollutionItemsState(prev => {
                        const newItems = [...prev];
                        newItems[index] = {
                          ...newItems[index],
                          designCharacteristic: newVal
                        };
                        return newItems;
                      });
                    }}
                    className="w-20 border rounded px-1 py-0.5"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }, [pollutionItemsState, unmeteredSupplyInput, computedPopulation]);


  const drainItemsTableJSX = (
    <div className="mt-4">
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">Drain ID</th>
            <th className="border px-2 py-1">Drain Name</th>
            <th className="border px-2 py-1">Measured Discharge (MLD)</th>
          </tr>
        </thead>
        <tbody>
          {drainItems.map((item, index) => (
            <tr key={`drain-${item.id}-${index}`}>
              <td className="border px-2 py-1">
                <input
                  type="text"
                  value={item.id}
                  onChange={(e) => handleDrainItemChange(index, 'id', e.target.value)}
                  className={`w-20 border rounded px-1 py-0.5 ${sourceMode === 'drain' ? 'bg-gray-100' : ''}`}
                  readOnly={sourceMode === 'drain'}
                  title={sourceMode === 'drain' ? 'Drain ID is automatically set from drain selection' : ''}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleDrainItemChange(index, 'name', e.target.value)}
                  className={`w-full border rounded px-1 py-0.5 ${sourceMode === 'drain' ? 'bg-gray-100' : ''}`}
                />
              </td>

              <td className="border px-2 py-1">
                <input
                  type="number"
                  value={item.discharge === '' ? '' : item.discharge}
                  onChange={(e) => {
                    //console.log(`🎯 Discharge input change for drain ${index}:`, e.target.value);
                    handleDrainItemChange(index, 'discharge', e.target.value);
                  }}
                  className="w-20 border rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  onFocus={(e) => {
                    ///console.log(`🎯 Discharge input focused for drain ${index}`);
                    e.target.select(); // Select all text when focused
                  }}
                  onBlur={(e) => {
                    //console.log(`🎯 Discharge input blurred for drain ${index}:`, e.target.value);
                  }}
                />
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="border px-2 py-1 font-bold text-right">
              Total Discharge:
            </td>
            <td className="border px-2 py-1 font-bold">
              {totalDrainDischarge.toFixed(2)} MLD
            </td>
          </tr>
        </tbody>
      </table>
      {sourceMode === 'drain' && (
        <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
          <strong>Note:</strong> Drain IDs and names are automatically populated from your drain selection.

        </div>
      )}
    </div>
  );


  const convertOklchToRgb = (element: HTMLElement) => {
    // Create a temporary element for color parsing
    const tempDiv = document.createElement('div');
    document.body.appendChild(tempDiv);

    const elements = [element, ...element.querySelectorAll('*')];
    elements.forEach((el: any) => {
      const style = window.getComputedStyle(el);
      const colorProps = [
        'color',
        'backgroundColor',
        'borderColor',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'fill',
        'stroke',
      ];

      colorProps.forEach(prop => {
        const value = style.getPropertyValue(prop);
        if (value && value.includes('oklch')) {
          try {
            // Use the browser to parse oklch to rgb
            tempDiv.style.backgroundColor = value;
            const computedColor = window.getComputedStyle(tempDiv).backgroundColor;

            // Validate and format with Colorizr
            const color = new Colorizr(computedColor);
            const rgb = computedColor; // Get rgb string, e.g., "rgb(59, 130, 246)"

            // Apply the converted color
            el.style.setProperty(prop, rgb);

            // Log for debugging
            //console.log(`Converted ${prop} from ${value} to ${rgb} on element`, el);
          } catch (err) {
            //console.warn(`Failed to convert color ${value} for property ${prop}:`, err);
            // Fallback to a safe color
            el.style.setProperty(prop, 'rgb(0, 0, 0)');
          }
        }
      });
    });

    // Clean up temporary element
    document.body.removeChild(tempDiv);
  };


  const fetchMapFromAPI = async (villageCodes: number[]): Promise<string | null> => {
    try {
      //console.log('Fetching map from API with village codes:', villageCodes);

      const response = await fetch('/django/studyareamap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          village_codes: villageCodes.map(String) // Convert to strings as API expects
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.map_base64) {
        //console.log('Map successfully retrieved from API');
        //console.log('Map bounds:', data.bounds);
        return data.map_base64; // This already includes the data:image/png;base64, prefix
      } else {
        throw new Error('No map_base64 in API response');
      }
    } catch (error) {
      //console.log('Failed to fetch map from API:', error);
      return null;
    }
  };

  const handle1pdfDownload = async () => {
    setIsDownloading(true);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width; // 210mm
    const pageHeight = doc.internal.pageSize.height; // 297mm
    const leftMargin = 14;
    const rightMargin = 14;
    const bottomMargin = 20;
    const maxTextWidth = 180;
    const pageCount = doc.internal.pages.length;

    const addLogos = async () => {
      try {
        const iitLogo = new Image();
        iitLogo.crossOrigin = "Anonymous";
        const leftLogoPromise = new Promise((resolve, reject) => {
          iitLogo.onload = () => resolve(true);
          iitLogo.onerror = () => reject(false);
          iitLogo.src = "/Images/export/logo_iitbhu.png";
        });

        const rightLogo = new Image();
        rightLogo.crossOrigin = "Anonymous";
        const rightLogoPromise = new Promise((resolve, reject) => {
          rightLogo.onload = () => resolve(true);
          rightLogo.onerror = () => reject(false);
          rightLogo.src = "/Images/export/right1_slcr.png";
        });

        await Promise.all([leftLogoPromise, rightLogoPromise]);
        doc.addImage(iitLogo, 'PNG', 14, 5, 25, 25);
        doc.addImage(rightLogo, 'PNG', pageWidth - 39, 5, 25, 25);
      } catch (err) {
        //console.log("Failed to load logos:", err);
      }
    };



    const continueWithReport = async () => {
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      const headerText = "Comprehensive Report of Sewage Generation";
      doc.text(headerText, pageWidth / 2, 20, { align: 'center' });

      const today = new Date().toLocaleDateString();
      const time = new Date().toLocaleTimeString('en-US', { hour12: true });

      // Add horizontal line below header
      doc.setLineWidth(1);
      doc.setDrawColor(0, 0, 0); // Black
      doc.line(0, 32, pageWidth, 32);

      let yPos = 40;

      // Helper function to add justified text
      const addJustifiedText = (text: string, x: number, y: number, maxWidth: number, lineHeight = 5) => {
        autoTable(doc, {
          startY: y,
          body: [[text]],
          theme: 'plain',
          styles: {
            halign: 'justify',
            fontSize: 12,
            font: 'times',
            cellPadding: 0,
            overflow: 'linebreak',
            minCellHeight: lineHeight,
          },
          margin: { left: x, right: pageWidth - x - maxWidth },
        });
        return (doc as any).lastAutoTable?.finalY + 5; // Return new y position
      };

      // Helper function to add a section heading
      const addSectionHeading = (text: string | string[], level = 1) => {
        const fontSize = level === 1 ? 14 : 12;
        const spacingBelow = level === 1 ? 8 : 6;
        doc.setFontSize(fontSize);
        doc.setFont('times', 'bold');
        if (yPos > pageHeight - bottomMargin - fontSize) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(text, leftMargin, yPos, { maxWidth: 180 });
        yPos += spacingBelow;
      };

      // Helper function to add a paragraph
      const addParagraph = (text: string) => {
        doc.setFontSize(12);
        doc.setFont('times', 'normal');
        yPos = addJustifiedText(text, leftMargin, yPos, maxTextWidth);
        yPos += 0; // Add padding after paragraph
        if (yPos > pageHeight - bottomMargin) {
          doc.addPage();
          yPos = 20;
        }
      };

      // Add datetime paragraph
      const datetime = `This report was created with the Decision Support System Water Resource Management on <${today}> at <${time}>`;
      addParagraph(datetime);

      yPos += 8;

      // Add horizontal line below datetime
      const textWidth = doc.getTextWidth(datetime);
      doc.setLineWidth(0.1);
      doc.setDrawColor(0, 0, 0); // Black
      doc.line(leftMargin, 50, leftMargin + textWidth - 29, 50);

      // Calculate total sewage volume
      let totalSewageVolume = '0.00';
      const sewageResult = domesticLoadMethod === 'modeled' ? domesticSewageResult : (waterSupplyResult || domesticSewageResult);
      if (sewageResult && Object.keys(sewageResult).length > 0) {
        const years = Object.keys(sewageResult).sort();
        const lastYear = years[years.length - 1];
        const lastPopulation = computedPopulation[lastYear] || 0;

        if (
          peakFlowSewageSource === 'drain_based' &&
          domesticLoadMethod === 'modeled' &&
          totalDrainDischarge > 0
        ) {
          totalSewageVolume = Number(calculateDrainBasedSewFlow(lastPopulation) || 0).toFixed(2);
        } else if (
          peakFlowSewageSource === 'water_based' &&
          (window as any).totalWaterSupply > 0
        ) {
          totalSewageVolume = Number(calculatewaterBasedSewFlow(lastPopulation) || 0).toFixed(2);
        } else {
          totalSewageVolume = Number(sewageResult[lastYear] ?? 0).toFixed(2);
        }
      }



      (window as any).totalSewageVolume = totalSewageVolume;

      try {
        let locationData: any = {};
        let villagesData: any = villages_props || [];
        let hasLocationData = false;

        if (sourceMode === 'drain') {
          locationData = {
            state: '',
            districts: [],
            subDistricts: [],
            villages: [],
            totalPopulation: totalPopulation_props || 0,
            river: selectedRiverData?.river || (window as any).selectedRiverData?.river || 'Unknown River',
            stretch: selectedRiverData?.stretch || (window as any).selectedRiverData?.stretch || 'Unknown Stretch',
            selectedDrains: drainItems.map(d => d.name).join(', ')
          };
          villagesData = villages_props || [];
          if (villages_props && villages_props.length > 0) {
            const firstVillage = villages_props[0];
            if (firstVillage.subDistrictId) {
              locationData.subDistricts = [`Sub-district ID: ${firstVillage.subDistrictId}`];
            }
          }
          hasLocationData = villagesData.length > 0 || drainItems.length > 0;
        } else {
          locationData = (window as any).selectedLocations || {
            state: '',
            districts: [],
            subDistricts: [],
            villages: [],
            totalPopulation: 0
          };
          villagesData = villages_props && villages_props.length > 0 ? villages_props : locationData.villages;
          hasLocationData = locationData && (locationData.state || locationData.districts.length > 0);
        }

        if (hasLocationData) {
          const state = locationData.state || 'Unknown State';
          const districtsText = Array.isArray(locationData.districts) && locationData.districts.length > 0
            ? locationData.districts.join(', ')
            : (locationData.districts.toString() || 'Unknown District');
          const subDistrictsText = Array.isArray(locationData.subDistricts) && locationData.subDistricts.length > 0
            ? locationData.subDistricts.join(', ')
            : (locationData.subDistricts.toString() || 'Unknown Sub-District');
          const totalPopulation = locationData.totalPopulation && locationData.totalPopulation > 0
            ? locationData.totalPopulation.toLocaleString()
            : 'Unknown Population';
          const numVillages = villagesData.length > 0 ? villagesData.length : 'Unknown Number of Villages';
          const numSubDistricts = locationData.subDistricts.length > 0 ? locationData.subDistricts.length : 'Unknown Number of Sub-Districts';

          // 1. Executive Summary
          addSectionHeading("1. Executive Summary");
          if (sourceMode === 'drain' && villagesData && villagesData.length > 0) {
            const villageObjects = villagesData[0]?.subDistrictName ? villagesData : (window as any).selectedRiverData?.selectedVillages || [];
            if (villageObjects.length > 0) {
              const uniqueStates = [...new Set(villageObjects.map((v: { stateName: any; }) => v.stateName))].filter(Boolean);
              const uniqueDistricts = [...new Set(villageObjects.map((v: { districtName: any; }) => v.districtName))].filter(Boolean);
              const totalCatchmentPopulation = villageObjects.reduce((sum: any, v: { population: any; }) => sum + (v.population || 0), 0);

              const locationSummary = uniqueStates.length > 1
                ? ` (${uniqueStates.join(', ')})`
                : uniqueStates[0] || 'the study region';
              const districtSummary = uniqueDistricts.length > 1
                ? `${uniqueDistricts.length} districts (${uniqueDistricts.join(', ')})`
                : uniqueDistricts[0] || 'the study district';

              addParagraph(`This report presents a detailed analysis of sewage generation in the selected administrative regions of ${districtSummary}, ${locationSummary}. Based on the 2011 population data and standard sewage estimation methodology, the total sewage generation for the area is projected at approximately ${totalSewageVolume} MLD.`);
              addParagraph("The report identifies high sewage-generating settlements and provides spatial visualizations to support infrastructure planning. The insights generated from this Decision Support System (DSS) are intended to guide local authorities in prioritizing sanitation interventions, planning treatment capacities, and identifying underserved areas.");
            } else {
              addParagraph(`This report presents a detailed analysis of sewage generation in the selected administrative regions of ${districtsText}, ${state}. Based on the 2011 population data and standard sewage estimation methodology, the total sewage generation for the area is projected at approximately ${totalSewageVolume} MLD.`);
              addParagraph("The report identifies high sewage-generating settlements and provides spatial visualizations to support infrastructure planning. The insights generated from this Decision Support System (DSS) are intended to guide local authorities in prioritizing sanitation interventions, planning treatment capacities, and identifying underserved areas.");
            }
          } else {
            addParagraph(`This report presents a detailed analysis of sewage generation in the selected administrative regions of ${districtsText}, ${state}. Based on the 2011 population data and standard sewage estimation methodology, the total sewage generation for the area is projected at approximately ${totalSewageVolume} MLD.`);
            addParagraph("The report identifies high sewage-generating settlements and provides spatial visualizations to support infrastructure planning. The insights generated from this Decision Support System (DSS) are intended to guide local authorities in prioritizing sanitation interventions, planning treatment capacities, and identifying underserved areas.");
          }
          yPos += 7;

          // 2. Study Area Overview
          addSectionHeading("2. Study Area Overview");
          if (sourceMode === 'drain' && villagesData && villagesData.length > 0) {
            const villageObjects = villagesData[0]?.subDistrictName ? villagesData : (window as any).selectedRiverData?.selectedVillages || [];
            if (villageObjects.length > 0) {
              const uniqueStates = [...new Set(villageObjects.map((v: { stateName: any; }) => v.stateName))].filter(Boolean);
              const uniqueDistricts = [...new Set(villageObjects.map((v: { districtName: any; }) => v.districtName))].filter(Boolean);
              const uniqueSubDistricts = [...new Set(villageObjects.map((v: { subDistrictName: any; }) => v.subDistrictName))].filter(Boolean);
              const totalCatchmentPopulation = villageObjects.reduce((sum: any, v: { population: any; }) => sum + (v.population || 0), 0);
              const locationSummary = uniqueStates.length > 1
                ? ` (${uniqueStates.join(', ')})`
                : uniqueStates[0] || 'the study region';
              const districtSummary = uniqueDistricts.length > 1
                ? `${uniqueDistricts.length} districts (${uniqueDistricts.join(', ')})`
                : uniqueDistricts[0] || 'the study district';

              addParagraph(`The area under study includes ${villageObjects.length} villages across ${uniqueSubDistricts.length} sub-districts in the district of ${districtSummary}, ${locationSummary}. The total population (Census 2011) covered in this analysis is ${totalCatchmentPopulation.toLocaleString()}.`);
              addParagraph("The geographic extent of the study area is displayed in Figure 1, showing administrative boundaries including villages, sub-districts, and districts. This administrative base is crucial for linking population data and infrastructural indicators to spatial units for localized planning.");
            } else {
              addParagraph(`The area under study includes ${numVillages} villages across ${numSubDistricts} sub-districts in the district of ${districtsText}, ${state}. The total population (Census 2011) covered in this analysis is ${totalPopulation}.`);
              addParagraph("The geographic extent of the study area is displayed in Figure 1, showing administrative boundaries including villages, sub-districts, and districts. This administrative base is crucial for linking population data and infrastructural indicators to spatial units for localized planning.");
            }
          } else {
            addParagraph(`The area under study includes ${numVillages} villages across ${numSubDistricts} sub-districts in the district of ${districtsText}, ${state}. The total population (Census 2011) covered in this analysis is ${totalPopulation}.`);
            addParagraph("The geographic extent of the study area is displayed in Figure 1, showing administrative boundaries including villages, sub-districts, and districts. This administrative base is crucial for linking population data and infrastructural indicators to spatial units for localized planning.");
          }


          // Map Capture from API
          const villageCodesForMap = villages_props?.map(v => v.id) || [];
          //console.log('Fetching map for village codes:', villageCodesForMap);

          if (villageCodesForMap.length > 0) {
            const mapImage = await fetchMapFromAPI(villageCodesForMap);

            if (mapImage) {
              const maxMapWidth = pageWidth - 28;
              const mapAspectRatio = 1.0; // Adjust if needed based on your API output
              const mapWidth = Math.min(maxMapWidth, 180);
              const mapHeight = mapWidth / mapAspectRatio;

              if (yPos + mapHeight + 20 > pageHeight - bottomMargin) {
                doc.addPage();
                yPos = 20;
              }

              const mapX = (pageWidth - mapWidth) / 2;
              doc.addImage(mapImage, 'PNG', mapX, yPos, mapWidth, mapHeight);
              yPos += mapHeight + 10;

              doc.setFontSize(8);
              doc.setFont('helvetica', 'italic');
              doc.text('Figure 1: Study Area Map', pageWidth / 2, yPos, { align: 'center' });
              yPos += 10;

              if (yPos > pageHeight - bottomMargin) {
                doc.addPage();
                yPos = 20;
              }
            } else {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'italic');
              addParagraph('Map not available - API request failed. Please ensure the map service is running.');
            }
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            addParagraph('Map not available - No village data selected.');
          }

          // Methodology
          addSectionHeading("3. Methodology");
          addParagraph("The estimation of sewage generation is carried out in four steps, using the standard empirical formula followed by the CPHEEO, 2024:");
          // ... (Rest of the methodology sections unchanged)
          yPos += 7;
          addSectionHeading("3.1 Population Forecasting", 2);
          addParagraph("Population forecasting in this study has been carried out using multiple methods such as Arithmetic Growth, Geometric Growth, Exponential Models, Demographic, and the Cohort Component Method. Presently, all data are for the ‘Varuna River Basin’. These methods enable detailed demographic projections at different administrative levels (district, tehsil, village, etc.). Each method accounts for vital statistics like birth, death, emigration, and immigration rates. For example, the Arithmetic Growth method uses historical population data and effective growth rates to estimate future populations, while the Cohort Component Method considers age and sex cohorts for more granular forecasts.");
          addParagraph("To enhance the accuracy and demographic resolution of our population forecasting, we utilized the official dataset titled 'Population Projections for India and States: 2011–2036', published by the National Commission on Population, Ministry of Health & Family Welfare (2019). This cohort-based projection dataset, originally available at the state and national levels, was systematically downscaled to the village level using demographic normalization techniques. Age-sex cohort proportions from the official dataset were applied proportionally to the Census 2011 village population figures. This granular disaggregation enables village-level demographic analysis with temporal projections aligned to national demographic trends, thereby increasing the reliability of downstream water demand and sewage generation estimates (National Commission on Population, 2019).");
          addParagraph("This flexibility allows users to choose the most suitable forecasting model for their region and timeframe.");
          yPos += 7;
          addSectionHeading("3.2 Water Demand", 2);
          addParagraph("Water demand estimation is based on guidelines from the CPHEEO Manual (2024), covering various sectors such as domestic, floating population, institutional, and fire-fighting needs. For domestic demand, per capita norms are applied as in Table 1. Detailed Floating and Institutional Demand is calculated as per Table 2 and Table 3, respectively. Floating population demand is adjusted according to the nature of facilities used, ranging from 15–45 lpcd. Institutional demand incorporates specific metrics for hospitals, hostels, offices, factories, etc., based on population loads and occupancy characteristics. For fire-fighting requirements, the methodology includes options like Kuchling’s, Freeman’s, and Harmon’s methods, depending on regional needs. The tool also supports a consolidated total demand estimate by summing all sectoral demands, allowing comprehensive regional planning (CPHEEO, 2024).");

          yPos += 5;

          addSectionHeading("Table 1: Recommended Per Capita Water Supply Levels for Designing Schemes (Source: CPHEEO, 1999)", 2);
          autoTable(doc, {
            startY: yPos,
            head: [['S. No.', 'Classification of towns / cities', 'Recommended Maximum Water Supply Levels (lpcd)']],
            body: [
              ['1', 'Towns provided with piped water supply but without sewerage system', '70'],
              ['2', 'Cities provided with piped water supply where sewerage system is existing/contemplated', '135'],
              ['3', 'Metropolitan and Mega cities provided with piped water supply where sewerage system is existing/contemplated', '150']
            ],
            styles: { font: 'helvetica', fontSize: 10 },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
            columnStyles: {
              0: { cellWidth: 20 },
              1: { cellWidth: 120 },
              2: { cellWidth: 40 }
            },
            margin: { left: 14 }
          });
          yPos = (doc as any).lastAutoTable?.finalY + 10;
          if (yPos > doc.internal.pageSize.height - 20) {
            doc.addPage();
            yPos = 20;
          }

          // Table 2
          addSectionHeading('Table 2: Rate of The Floating Water Demand', 2);
          const estimatedTable2Height = 4 * 10 + 10;
          if (yPos + estimatedTable2Height > pageHeight - bottomMargin) {
            doc.addPage();
            yPos = 20;
          }
          autoTable(doc, {
            startY: yPos,
            head: [['S. No.', 'Facility', 'Litres per capita per day (LPCD)']],
            body: [
              ['1', 'Bathing facilities provided', '45'],
              ['2', 'Bathing facilities not provided', '25'],
              ['3', 'Floating population using only public facilities (such as market traders, hawkers, non-residential tourists, picnickers, religious tourists, etc.)', '15']
            ],
            styles: { font: 'helvetica', fontSize: 10 },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
            columnStyles: {
              0: { cellWidth: 20 },
              1: { cellWidth: 120 },
              2: { cellWidth: 40 }
            },
            margin: { left: 14 }
          });
          yPos = (doc as any).lastAutoTable?.finalY + 10;
          if (yPos > pageHeight - bottomMargin) {
            doc.addPage();
            yPos = 20;
          }

          // Table 3
          addSectionHeading("Table 3: Rate of the Institutional Water Demand", 2);
          autoTable(doc, {
            startY: yPos,
            head: [['S. No.', 'Institutions', 'Litres per head per day']],
            body: [
              ['1', 'Hospital (including laundry)\n(a) No. of beds exceeding 100\n(b) No. of beds not exceeding 100', '450 (per bed)\n340 (per bed)'],
              ['2', 'Hotels', '180 (per bed)'],
              ['3', 'Hostels', '135'],
              ['4', 'Nurses’ homes and medical quarters', '135'],
              ['5', 'Boarding schools / colleges', '135'],
              ['6', 'Restaurants', '70 (per seat)'],
              ['7', 'Airports and seaports', '70'],
              ['8', 'Junction Stations and intermediate stations where mail or express stoppage (both railways and bus stations) is presided', '70'],
              ['9', 'Terminal stations', '45'],
              ['10', 'Intermediate stations (excluding mail and express stops)', '45 (could be reduced to 25 where bathing facilities are not provided)'],
              ['11', 'Day schools / colleges', '45'],
              ['12', 'Offices', '45'],
              ['13', 'Factories', '45 (could be reduced to 30 where no bathrooms are provided)'],
              ['14', 'Cinema, concert halls, and theatre', '15']
            ],
            styles: { font: 'helvetica', fontSize: 10 },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
            columnStyles: {
              0: { cellWidth: 20 },
              1: { cellWidth: 120 },
              2: { cellWidth: 40 }
            },
            margin: { left: 14 }
          });
          yPos = (doc as any).lastAutoTable?.finalY + 10;
          if (yPos > doc.internal.pageSize.height - 20) {
            doc.addPage();
            yPos = 20;
          }

          // 3.3 Water Supply
          addSectionHeading("3.3 Water Supply", 2);
          addParagraph("Water supply analysis aligns with the demand forecasts and is based on either modeled or user-provided data. The water supply values serve as a crucial input for evaluating adequacy and potential deficits in infrastructure. Where data is available, historical supply records are compared with estimated future demands. This allows planners to assess whether current supply infrastructure meets future needs or if upgrades are warranted. Moreover, integration with GIS and demographic modules ensures spatial consistency in water supply planning, strengthening the foundation for sewage and wastewater projections.");
          yPos += 7;
          // 3.4 Sewage
          addSectionHeading("3.4 Sewage", 2);
          addParagraph("Sewage generation estimation is carried out using two approaches: (a) Sector-based estimation and (b) Water supply-based estimation. The sector-based approach estimates wastewater as a fixed percentage of sectoral water demands, such as 80% of domestic water demand as per CPHEEO standards. The water supply-based approach uses the total water supply figure and applies a wastewater generation factor to calculate total sewage output. Peak sewage flow is computed using recognized methods like CPHEEO’s formula, Harmon’s, and Babbitt’s formula, incorporating appropriate peak factors relative to projected population size. These calculations ensure realistic design flows for downstream treatment infrastructure, including STPs and drainage systems (CPHEEO, 2024).                                                                                                  ");




          // Helper functions for village data
          const getVillageObjects = (villagesData: any[], sourceMode: string) => {
            if (sourceMode === 'drain' && (!villagesData[0]?.subDistrictName || !villagesData[0]?.population)) {
              return (typeof window !== 'undefined' && (window as any).selectedRiverData?.selectedVillages) || [];
            }
            if (sourceMode === 'admin' && (!villagesData[0] || typeof villagesData[0] === 'string')) {
              return (typeof window !== 'undefined' && (window as any).selectedLocations?.allVillages) || [];
            }
            return villagesData;
          };

          const groupVillagesByLocation = (villageObjects: any[]) => {
            const villagesByLocation: { [state: string]: { [district: string]: { [subDistrict: string]: any[] } } } = {};
            villageObjects.forEach((village) => {
              const state = village.stateName || 'Unknown State';
              const district = village.districtName || 'Unknown District';
              const subDistrict = village.subDistrictName || 'Unknown Sub-District';
              if (!villagesByLocation[state]) villagesByLocation[state] = {};
              if (!villagesByLocation[state][district]) villagesByLocation[state][district] = {};
              if (!villagesByLocation[state][district][subDistrict]) villagesByLocation[state][district][subDistrict] = [];
              villagesByLocation[state][district][subDistrict].push(village);
            });
            return villagesByLocation;
          };

          const updateYPosWithPageBreak = (doc: any, yPos: number, increment: number) => {
            yPos += increment;
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
            return yPos;
          };

          const baseTableStyles = {
            styles: { font: 'times', fontSize: 12 },
            headStyles: {
              fillColor: [66, 139, 202] as [number, number, number],  // <-- this fixes it
            },
            margin: { left: 16 },
            halign: 'center'
          };

          // 1.3 Village Table
          // Add Results and Interpretation section
          addSectionHeading("4. Results and Interpretation", 2);


          // Estimate table height (approximate rows * row height)
          // const estimatedRowHeight = 20; // Adjust based on actual row height (e.g., font size 10-12, padding)
          // const estimatedHeadingHeight = 12 + 6 ; // Height for "4." and "4.1" headings (<= fontSize + spacingBelow)
          // const estimatedTableHeight = (villagesData?.length || 0) * estimatedRowHeight + 15; // Include header and padding
          // const totalEstimatedHeight = estimatedHeadingHeight + estimatedTableHeight;

          // Check if there's enough space for both headings and table
          // if (yPos + totalEstimatedHeight > pageHeight - bottomMargin) {
          //   doc.addPage();
          //   yPos = 20;
          // }
          yPos += 7;

          if (villagesData && villagesData.length > 0) {
            try {
              const villageObjects = getVillageObjects(villagesData, sourceMode ?? 'default');

              if (sourceMode === 'drain') {
                addSectionHeading("4.1 Selected Villages with Population:", 2);

                const villagesByLocation = groupVillagesByLocation(villageObjects);
                const villageRows = villageObjects.map((village: { shapeName: any; name: any; drainNo: any; subDistrictName: any; districtName: any; stateName: any; population: { toLocaleString: () => any; }; }) => [
                  village.shapeName || village.name || 'N/A',
                  village.subDistrictName || 'Unknown Sub-District',
                  village.districtName || 'Unknown District',
                  village.population ? village.population.toLocaleString() : 'N/A'
                ]);

                autoTable(doc, {
                  head: [['Village Name', 'Sub-District', 'District', 'Population (2011)']],
                  body: villageRows,
                  startY: yPos,
                  ...baseTableStyles,
                  // pageBreak: 'avoid', // Prevent table from splitting across pages
                  columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 25 }
                  }
                });
              } else {
                addSectionHeading("4.1 Selected Villages with Population:", 2);

                const villageRows = villageObjects.map((village: { name: any; subDistrictName: any; subDistrict: any; districtName: any; district: any; population: { toLocaleString: () => any; }; }) => [
                  village.name || 'N/A',
                  village.subDistrictName || village.subDistrict || 'N/A',
                  village.districtName || village.district || 'N/A',
                  village.population ? village.population.toLocaleString() : 'N/A'
                ]);

                autoTable(doc, {
                  head: [['Village Name', 'Sub-District', 'District', 'Population (2011)']],
                  body: villageRows,
                  startY: yPos,
                  ...baseTableStyles,
                  // pageBreak: 'avoid', // Prevent table from splitting across pages
                  columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 25 }
                  }
                });
              }

              yPos = (doc as any).lastAutoTable?.finalY + 5;
              // yPos = updateYPosWithPageBreak(doc, yPos, 0);
            } catch (error) {
              //console.log("Error adding village table:", error);
              yPos = updateYPosWithPageBreak(doc, yPos, 5);
            }
          }

          //--------------------------------------------------------
          if (yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          yPos += 5;

          addSectionHeading("4.2. Population Forecasting Results");

          try {
            // Get population forecasting results from window
            const populationResults = (window as any).populationForecastResults;
            //console.log('Population results for PDF:', populationResults);

            if (populationResults && Object.keys(populationResults).length > 0) {
              // addParagraph("Population forecasting has been carried out using multiple methods to provide comprehensive demographic projections. The following table shows the forecasted population for different years using various forecasting methodologies:");

              // Helper function to get all years from population results
              const getPopulationYears = (data: { [x: string]: any; }) => {
                const allYears = new Set();

                Object.keys(data || {}).forEach((methodName) => {
                  const method = data[methodName];
                  if (typeof method === 'object' && method !== null) {
                    Object.keys(method || {}).forEach((year) => {
                      const yearNum = Number(year);
                      if (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2200) {
                        allYears.add(yearNum);
                      }
                    });
                  }
                });

                return Array.from(allYears).sort((a: unknown, b: unknown) => Number(a) - Number(b));
              };

              const populationYears = getPopulationYears(populationResults);
              const availableMethods = Object.keys(populationResults).filter(method =>
                populationResults[method] &&
                typeof populationResults[method] === 'object' &&
                Object.keys(populationResults[method]).length > 0
              );

              //console.log('Years found:', populationYears);
              //console.log('Methods found:', availableMethods);

              if (populationYears.length > 0 && availableMethods.length > 0) {
                // Create table headers
                const headers = ['Year', ...availableMethods];

                // Create table rows
                const populationRows = (populationYears as number[]).map((year: number) => {
                  const row = [year.toString()];
                  availableMethods.forEach(method => {
                    const value = populationResults[method] && populationResults[method][year];
                    row.push(value ? Math.round(value).toLocaleString() : '-');
                  });
                  return row;
                });

                // Calculate column widths based on number of methods
                const totalWidth = 180;
                const yearColumnWidth = 25;
                const methodColumnWidth = Math.min(40, (totalWidth - yearColumnWidth) / availableMethods.length);

                const columnStyles: { [key: number]: { cellWidth: number } } = {
                  0: { cellWidth: yearColumnWidth }
                };

                for (let i = 1; i <= availableMethods.length; i++) {
                  columnStyles[i] = { cellWidth: methodColumnWidth };
                }

                // Add the population forecasting table
                autoTable(doc, {
                  head: [headers],
                  body: populationRows,
                  startY: yPos,
                  styles: {
                    font: 'times',
                    fontSize: availableMethods.length > 4 ? 10 : 12,
                    halign: 'center'
                  },
                  headStyles: {
                    fillColor: [66, 139, 202],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                  },
                  columnStyles: columnStyles,
                  margin: { left: 14 },
                  theme: 'striped',
                  alternateRowStyles: { fillColor: [245, 245, 245] }
                });

                yPos = (doc as any).lastAutoTable?.finalY + 10;

                // Add interpretation paragraph
                addParagraph(`The table above shows population projections using ${availableMethods.length} different forecasting methods: ${availableMethods.join(', ')}. These projections span from ${populationYears[0]} to ${populationYears[populationYears.length - 1]}.`);

                // Add selected method information if available
                const selectedMethod = window.selectedPopulationMethod || window.selectedMethod;
                if (selectedMethod && availableMethods.includes(selectedMethod)) {
                  addParagraph(`For subsequent analysis and calculations, the ${selectedMethod} method has been selected as the primary population forecasting approach. This method's projections will be used for water demand estimation,and sewage generation calculations.`);
                }

                if (yPos > doc.internal.pageSize.height - 20) {
                  doc.addPage();
                  yPos = 20;
                }
              } else {
                addParagraph("Population forecasting data structure is available but contains no valid year/population pairs.");
              }

            } else {
              // Fallback to show basic population info
              addParagraph("Population forecasting analysis has not been completed. ");

              if (totalPopulation_props && totalPopulation_props > 0) {
                addParagraph(`The study area has a base population of ${totalPopulation_props.toLocaleString()} people according to the 2011 Census.`);

                // Simple table with base population
                autoTable(doc, {
                  head: [['Census Year', 'Population']],
                  body: [['2011', totalPopulation_props.toLocaleString()]],
                  startY: yPos,
                  styles: {
                    font: 'times',
                    fontSize: 10,
                    halign: 'center'
                  },
                  headStyles: {
                    fillColor: [66, 139, 202],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                  },
                  columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 80 }
                  },
                  margin: { left: 14 }
                });

                yPos = (doc as any).lastAutoTable?.finalY + 10;
              }
            }

          } catch (error) {
            //console.log("Error adding population forecasting data:", error);
            addParagraph("Error occurred while processing population forecasting data.");
            yPos += 10;
          }

          //----------------------------------------------------------

          // 4. Water Demand Analysis
          // 4. Water Demand Analysis
          if (yPos > 230) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("4.2. Water Demand Analysis");
          try {
            const waterDemandData = (window as any).totalWaterDemand || {};
            const domesticWaterDemand = (window as any).domesticWaterDemand || {};
            const floatingWaterDemand = (window as any).floatingWaterDemand || {};
            const institutionalWaterDemand = (window as any).institutionalWaterDemand || {};
            const firefightingDemand = (window as any).firefightingWaterDemand || {};

            addParagraph("Water demand is estimated based on various contributing factors including domestic, floating, commercial, institutional, and firefighting demands as per CPHEEO guidelines.");

            if (Object.keys(waterDemandData).length > 0) {
              const waterDemandYears = Object.keys(waterDemandData).sort();
              if (waterDemandYears.length > 0) {
                const waterDemandRows = waterDemandYears.map(year => {
                  // Use base_demand for floating water demand
                  const floatingDemand = floatingWaterDemand?.base_demand?.[year] ||
                    floatingWaterDemand?.[year] || 0;

                  // Use base_demand for domestic water demand
                  const domesticDemand = domesticWaterDemand?.base_demand?.[year] ||
                    domesticWaterDemand?.[year] || 0;

                  // Use the selected method or default to Kuchling (capital K)
                  const firefightingMethod = waterDemandResults?.selectedFirefightingMethod || 'Kuchling';
                  const firefightingValue = firefightingDemand?.[firefightingMethod]?.[year] ||
                    firefightingDemand?.Kuchling?.[year] || 0;

                  return [
                    year,
                    Math.round(computedPopulation[year] || 0).toLocaleString(),
                    domesticDemand.toFixed(2),
                    floatingDemand.toFixed(2),
                    (institutionalWaterDemand[year] || 0).toFixed(2),
                    firefightingValue.toFixed(2),
                    (waterDemandData[year] || 0).toFixed(2)
                  ];
                });

                autoTable(doc, {
                  head: [['Year', 'Forecasted Population', 'Domestic Water Demand (MLD)', 'Floating Water Demand (MLD)', 'Institutional Water Demand (MLD)', 'Firefighting Demand (Kuchling) (MLD)', 'Total Water Demand (MLD)']],
                  body: waterDemandRows,
                  startY: yPos,
                  styles: { font: 'times', fontSize: 12 },
                  headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255] },
                  columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 28 },
                    3: { cellWidth: 28 },
                    4: { cellWidth: 28 },
                    5: { cellWidth: 28 },
                    6: { cellWidth: 28 }
                  },
                  margin: { left: 14, right: 14 },
                });
                yPos = (doc as any).lastAutoTable?.finalY + 10;
                if (yPos > doc.internal.pageSize.height - 20) {
                  doc.addPage();
                  yPos = 20;
                }
              }
            } else {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'italic');
              addParagraph("Water demand data not available");
            }
          } catch (error) {
            //console.log("Error adding water demand data:", error);
            yPos += 5;
          }


          if (yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("4.4.6 Seasonal Analysis Parameters", 2);

          // 6.6.1 Domestic Seasonal Multipliers Table
          if (seasonalMultipliers) {
            addSectionHeading("4.4.6.1 Domestic Seasonal Multipliers", 2);

            const multiplierRows = [
              ["Summer (Apr-Jun)", seasonalMultipliers.summer.toFixed(2), `${(perCapitaConsumption * seasonalMultipliers.summer).toFixed(1)} LPCD`],
              ["Monsoon (Jul-Sep)", seasonalMultipliers.monsoon.toFixed(2), `${(perCapitaConsumption * seasonalMultipliers.monsoon).toFixed(1)} LPCD`],
              ["Post-Monsoon (Oct-Nov)", seasonalMultipliers.postMonsoon.toFixed(2), `${(perCapitaConsumption * seasonalMultipliers.postMonsoon).toFixed(1)} LPCD`],
              ["Winter (Dec-Mar)", seasonalMultipliers.winter.toFixed(2), `${(perCapitaConsumption * seasonalMultipliers.winter).toFixed(1)} LPCD`]
            ];

            autoTable(doc, {
              head: [["Season", "Multiplier", "Effective Demand"]],
              body: multiplierRows,
              startY: yPos,
              styles: { font: 'times', fontSize: 11 },
              headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255] },
              columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 40 },
                2: { cellWidth: 80 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 10;

            addParagraph("Domestic seasonal multipliers account for variations in water consumption patterns throughout the year, affecting both water demand and subsequent sewage generation.");

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.6.2 Floating Seasonal Multipliers Table (if available)
          if (waterDemandResults?.floating && floatingSeasonalDemands) {
            addSectionHeading("4.4.6.2 Floating Population Seasonal Analysis", 2);

            const floatingMultipliers = waterDemandResults.floating.seasonal_multipliers || {
              summer: 1.15,
              monsoon: 1.25,
              postMonsoon: 1.10,
              winter: 0.85
            };

            const floatingMultiplierRows = [
              ["Summer (Apr-Jun)", floatingMultipliers.summer.toFixed(2), "Higher tourism/travel activity"],
              ["Monsoon (Jul-Sep)", floatingMultipliers.monsoon.toFixed(2), "Peak tourist season in some regions"],
              ["Post-Monsoon (Oct-Nov)", floatingMultipliers.postMonsoon.toFixed(2), "Festival and travel season"],
              ["Winter (Dec-Mar)", floatingMultipliers.winter.toFixed(2), "Reduced travel activity"]
            ];

            autoTable(doc, {
              head: [["Season", "Multiplier", "Description"]],
              body: floatingMultiplierRows,
              startY: yPos,
              styles: { font: 'times', fontSize: 11 },
              headStyles: { fillColor: [255, 165, 0], textColor: [255, 255, 255] },
              columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 30 },
                2: { cellWidth: 100 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 10;

            addParagraph("Floating population seasonal multipliers reflect variations in temporary population due to tourism, migration, and seasonal work patterns, directly impacting sewage generation volumes.");

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.7 Seasonal Domestic Water Demand Table
          if (seasonalMultipliers && domesticSewageResult && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (seasonalMultipliers && domesticSewageResult) {
            addSectionHeading("4.4.7 Seasonal Domestic Water Demand", 2);

            // Get domestic water demand data from window
            const domesticWaterDemand = (window as any).domesticWaterDemand;

            if (domesticWaterDemand?.seasonal_demands) {
              const domesticSeasonalRows = Object.keys(computedPopulation).map((year) => {
                const domesticPop = computedPopulation[year];

                return [
                  year,
                  domesticPop.toLocaleString(),
                  (domesticWaterDemand.seasonal_demands.summer?.[year] || 0).toFixed(2),
                  (domesticWaterDemand.seasonal_demands.monsoon?.[year] || 0).toFixed(2),
                  (domesticWaterDemand.seasonal_demands.postMonsoon?.[year] || 0).toFixed(2),
                  (domesticWaterDemand.seasonal_demands.winter?.[year] || 0).toFixed(2)
                ];
              });

              autoTable(doc, {
                head: [["Year", "Population", "Summer (MLD)", "Monsoon (MLD)", "Post-Monsoon (MLD)", "Winter (MLD)"]],
                body: domesticSeasonalRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 11 },
                headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255] },
                columnStyles: {
                  0: { cellWidth: 25 },
                  1: { cellWidth: 35 },
                  2: { cellWidth: 25 },
                  3: { cellWidth: 25 },
                  4: { cellWidth: 30 },
                  5: { cellWidth: 25 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;

              addParagraph(`Seasonal domestic water demand values are calculated using seasonal multipliers - Summer: ${seasonalMultipliers.summer}, Monsoon: ${seasonalMultipliers.monsoon}, Post-Monsoon: ${seasonalMultipliers.postMonsoon}, Winter: ${seasonalMultipliers.winter}. These multipliers account for variations in water consumption patterns throughout the year.`);
            } else {
              addParagraph("Seasonal domestic water demand data not available. Please ensure domestic water demand calculation is completed with seasonal analysis enabled.");
            }

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.8 Seasonal Floating Water Demand Table
          if (floatingSeasonalDemands && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (floatingSeasonalDemands) {
            addSectionHeading("4.4.8 Seasonal Floating Water Demand", 2);

            // Get floating water demand data from window
            const floatingWaterDemand = (window as any).floatingWaterDemand;

            if (floatingWaterDemand?.seasonal_demands) {
              const floatingSeasonalRows = Object.keys(computedPopulation).map((year) => {
                const domesticPop = computedPopulation[year];

                return [
                  year,
                  domesticPop.toLocaleString(),
                  (floatingWaterDemand.seasonal_demands.summer?.[year] || 0).toFixed(2),
                  (floatingWaterDemand.seasonal_demands.monsoon?.[year] || 0).toFixed(2),
                  (floatingWaterDemand.seasonal_demands.postMonsoon?.[year] || 0).toFixed(2),
                  (floatingWaterDemand.seasonal_demands.winter?.[year] || 0).toFixed(2)
                ];
              });

              autoTable(doc, {
                head: [["Year", "Population", "Summer (MLD)", "Monsoon (MLD)", "Post-Monsoon (MLD)", "Winter (MLD)"]],
                body: floatingSeasonalRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 11 },
                headStyles: { fillColor: [255, 165, 0], textColor: [255, 255, 255] },
                columnStyles: {
                  0: { cellWidth: 25 },
                  1: { cellWidth: 35 },
                  2: { cellWidth: 25 },
                  3: { cellWidth: 25 },
                  4: { cellWidth: 30 },
                  5: { cellWidth: 25 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;

              // Get floating seasonal multipliers for documentation
              const floatingMultipliers = floatingWaterDemand.seasonal_multipliers || {
                summer: 1.15,
                monsoon: 1.25,
                postMonsoon: 1.10,
                winter: 0.85
              };

              addParagraph(`Seasonal floating water demand values are calculated using floating population seasonal multipliers - Summer: ${floatingMultipliers.summer}, Monsoon: ${floatingMultipliers.monsoon}, Post-Monsoon: ${floatingMultipliers.postMonsoon}, Winter: ${floatingMultipliers.winter}. These multipliers reflect variations in temporary population due to tourism, migration, and seasonal work patterns.`);
            } else {
              addParagraph("Seasonal floating water demand data not available. Please ensure floating water demand calculation is completed with seasonal analysis enabled.");
            }

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }


          // 5. Water Supply Analysis
          if (yPos > 230) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("4.3. Water Supply Analysis");
          try {
            const waterSupply = Number(totalSupplyInput) || 0;
            const waterDemandData = (window as any).totalWaterDemand || {};

            doc.setFontSize(10);
            doc.setFont('times', 'normal');
            doc.text("Water supply plays a critical role in determining sewage generation within a region.", 14, yPos);
            yPos += 6;
            if (waterSupply > 0) {
              doc.setFontSize(10);
              doc.setFont('times', 'normal');
              doc.text(`The estimated total water supply is: ${waterSupply.toFixed(2)} MLD`, 14, yPos);
              yPos += 10;

              addSectionHeading("4.3.1 Water Supply Details", 2);
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              doc.text("Total Water Supply:", 14, yPos);
              doc.text(`${totalSupplyInput} MLD`, 80, yPos);
              yPos += 5;

              if (unmeteredSupplyInput && Number(unmeteredSupplyInput) > 0) {
                doc.text("Unmetered Water Supply:", 14, yPos);
                doc.text(`${unmeteredSupplyInput} MLD`, 80, yPos);
                yPos += 5;
              }

              yPos += 5;
              const waterDemandYears = Object.keys(waterDemandData).sort();
              if (waterDemandYears.length > 0) {
                addSectionHeading("4.3.2 Water Gap Analysis", 2);
                const waterGapRows = waterDemandYears.map(year => {
                  const demand = waterDemandData[year];
                  const gap = waterSupply - demand;
                  const status = gap >= 0 ? 'Sufficient' : 'Deficit';
                  return [
                    year,
                    waterSupply.toFixed(2),
                    demand.toFixed(2),
                    gap.toFixed(2),
                    status
                  ];
                });
                autoTable(doc, {
                  head: [['Year', 'Supply (MLD)', 'Demand (MLD)', 'Gap (MLD)', 'Status']],
                  body: waterGapRows,
                  startY: yPos,
                  styles: { font: 'times', fontSize: 12 },
                  headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255] },
                  columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 40 },
                    4: { cellWidth: 30 }
                  },
                  margin: { left: 14 }
                });
                yPos = (doc as any).lastAutoTable?.finalY + 10;
                if (yPos > doc.internal.pageSize.height - 20) {
                  doc.addPage();
                  yPos = 20;
                }
              }
            } else {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'italic');
              addParagraph("Water supply data not available");
            }
          } catch (error) {
            //console.log("Error adding water supply data:", error);
            yPos += 5;
          }

          // 6. Sewage Generation Analysis
          if (yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("4.4. Sewage Generation Analysis");
          if (sourceMode) {
            doc.setFontSize(12);
            doc.setFont('times', 'normal');
            doc.text(`Analysis Mode: ${sourceMode === 'drain' ? 'Drain-based Analysis' : 'Administrative Area Analysis'}`, 14, yPos);
            yPos += 8;
          }

          // 6.1 Water Supply Method
          addSectionHeading("4.4.1 Water Supply Method", 2);
          doc.setFontSize(12);
          doc.setFont('times', 'normal');
          doc.text("Sewage Calculation Method: Water Supply", 14, yPos);
          yPos += 5;
          doc.text("Total Water Supply:", 14, yPos);
          doc.text(`${totalSupplyInput || 0} MLD`, 80, yPos);
          yPos += 10;

          if (waterSupplyResult) {
            if (typeof waterSupplyResult === 'number') {
              const sewageRows = [["Sewage Generation", `${waterSupplyResult.toFixed(2)} MLD`]];
              autoTable(doc, {
                body: sewageRows,
                startY: yPos,
                styles: { font: 'helvetica', fontSize: 10 },
                columnStyles: {
                  0: { cellWidth: 90 },
                  1: { cellWidth: 90 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;
            } else {
              const sewageRows = Object.entries(waterSupplyResult).map(([year, value]) => [
                year,
                computedPopulation[year] ? computedPopulation[year].toLocaleString() : '0',
                `${Number(value).toFixed(2)} MLD`
              ]);
              autoTable(doc, {
                head: [["Year", "Population", "Sewage Generation (MLD)"]],
                body: sewageRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 12 },
                headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255] },
                columnStyles: {
                  0: { cellWidth: 30 },
                  1: { cellWidth: 60 },
                  2: { cellWidth: 90 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;
            }
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            addParagraph("Water supply method results not available");
          }

          // 6.2 Domestic Sewage Load Estimation
          if (yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("4.4.2 Domestic Sewage Load Estimation", 2);
          doc.setFontSize(12);
          doc.setFont('times', 'normal');
          doc.text("Domestic Load Method:", 14, yPos);
          doc.text(domesticLoadMethod === 'manual' ? "Manual Input" :
            domesticLoadMethod === 'modeled' ? "Population-based Modeling" : "Not Selected", 80, yPos);
          yPos += 5;

          if (domesticLoadMethod === 'manual' && domesticSupplyInput) {
            doc.text("Domestic Water Supply:", 14, yPos);
            doc.text(`${domesticSupplyInput} MLD`, 80, yPos);
            yPos += 5;
          }

          if (domesticLoadMethod === 'modeled' && unmeteredSupplyInput) {
            doc.text("Unmetered Water Supply:", 14, yPos);
            doc.text(`${unmeteredSupplyInput} MLD`, 80, yPos);
            yPos += 5;
          }

          yPos += 5;

          if (domesticSewageResult) {
            if (typeof domesticSewageResult === 'number') {
              const sewageRows = [["Sewage Generation", `${domesticSewageResult.toFixed(2)} MLD`]];
              autoTable(doc, {
                body: sewageRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 10 },
                columnStyles: {
                  0: { cellWidth: 90 },
                  1: { cellWidth: 90 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;
            } else {
              let headers = ["Year", "Population", "Population-Based Sewage (MLD)"];
              if ((window as any).totalWaterSupply > 0) {
                headers.push("Water-Based Sewage (MLD)");
              }
              if (domesticLoadMethod === 'modeled' && totalDrainDischarge > 0) {
                headers.push("Drain-Based Sewage (MLD)");
              }

              const sewageRows = Object.entries(domesticSewageResult).map(([year, value]) => {
                const popValue = computedPopulation[year] || 0;
                const row = [
                  year,
                  popValue.toLocaleString(),
                  `${Number(value).toFixed(2)} MLD`
                ];
                if ((window as any).totalWaterSupply > 0) {
                  const result = calculatewaterBasedSewFlow(popValue);
                  const waterSewage = typeof result === 'number' ? result : 0;
                  row.push(`${waterSewage.toFixed(2)} MLD`);
                }
                if (domesticLoadMethod === 'modeled' && totalDrainDischarge > 0) {
                  const drainSewage = calculateDrainBasedSewFlow(popValue);
                  row.push(`${drainSewage.toFixed(2)} MLD`);
                }
                return row;
              });

              autoTable(doc, {
                head: [headers],
                body: sewageRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 12 },
                headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255] },
                columnStyles: headers.length === 3 ? {
                  0: { cellWidth: 30 },
                  1: { cellWidth: 60 },
                  2: { cellWidth: 90 }
                } : headers.length === 4 ? {
                  0: { cellWidth: 25 },
                  1: { cellWidth: 45 },
                  2: { cellWidth: 55 },
                  3: { cellWidth: 55 }
                } : {
                  0: { cellWidth: 20 },
                  1: { cellWidth: 40 },
                  2: { cellWidth: 40 },
                  3: { cellWidth: 40 },
                  4: { cellWidth: 40 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;
            }
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            addParagraph("Domestic sewage method results not available");
          }

          // 6.3 Drain Information
          if (yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("4.4.3 Drain Information", 2);
          doc.setFontSize(12);
          doc.setFont('times', 'normal');
          if (sourceMode === 'drain') {
            doc.text("Analysis Mode: Drain-based (drains selected from river system)", 14, yPos);
            yPos += 5;
            if (selectedRiverData && selectedRiverData.river) {
              doc.text(`River: ${selectedRiverData.river}`, 14, yPos);
              yPos += 5;
            }
            if (selectedRiverData && selectedRiverData.stretch) {
              doc.text(`Stretch: ${selectedRiverData.stretch}`, 14, yPos);
              yPos += 5;
            }
          }
          doc.text("Number of Drains to be Tapped:", 14, yPos);
          doc.text(`${drainCount || drainItems.length}`, 120, yPos);
          yPos += 5;
          doc.text("Total Drain Discharge:", 14, yPos);
          doc.text(`${totalDrainDischarge.toFixed(2)} MLD`, 120, yPos);
          yPos += 10;

          if (drainItems.length > 0) {
            const drainRows = drainItems.map((item) => [
              item.id,
              item.name,
              typeof item.discharge === 'number' ? `${item.discharge.toFixed(2)} MLD` : '0.00 MLD'
            ]);
            autoTable(doc, {
              head: [["Drain ID", "Drain Name", "Discharge (MLD)"]],
              body: drainRows,
              startY: yPos,
              styles: { font: 'times', fontSize: 12 },
              headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255] },
              columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 90 },
                2: { cellWidth: 60 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 10;
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.4 Peak Flow Calculation
          // 6.4 Peak Flow Calculation - FIXED VERSION
          if (peakFlowTable && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (peakFlowTable) {
            addSectionHeading("4.4.4 Peak Flow Calculation Results", 2);

            // Add peak flow source information
            doc.setFontSize(10);
            doc.setFont('times', 'normal');
            doc.text(`Peak Flow Source: ${peakFlowSewageSource.replace('_', ' ').toUpperCase()}`, 14, yPos);
            yPos += 5;

            const selectedMethods = Object.entries(peakFlowMethods)
              .filter(([_, selected]) => selected)
              .map(([method]) => method.toUpperCase());
            doc.text(`Selected Methods: ${selectedMethods.join(', ')}`, 14, yPos);
            yPos += 8;

            // Get the sewage result for calculations
            const sewageResult = domesticLoadMethod === 'modeled' ? domesticSewageResult : (waterSupplyResult || domesticSewageResult);

            if (sewageResult && computedPopulation) {
              // Create table headers
              const headers = ["Year", "Population", "Avg Sewage Flow (MLD)"];
              if (selectedMethods.includes('CPHEEO')) headers.push("CPHEEO Peak (MLD)");
              if (selectedMethods.includes('HARMON')) headers.push("Harmon's Peak (MLD)");
              if (selectedMethods.includes('BABBITT')) headers.push("Babbit's Peak (MLD)");

              // Create table rows - FIXED DATA ACCESS
              const peakRows = Object.keys(computedPopulation).map((year) => {
                const popVal = computedPopulation[year] || 0;

                // Calculate average sewage flow based on selected peak flow source
                let avgSewFlow = 0;

                if (peakFlowSewageSource === 'drain_based' && totalDrainDischarge > 0) {
                  const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
                  avgSewFlow = referencePopulation > 0
                    ? (popVal / referencePopulation) * totalDrainDischarge
                    : totalDrainDischarge;
                } else if (peakFlowSewageSource === 'water_based' && Number(totalSupplyInput) > 0) {
                  const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
                  avgSewFlow = referencePopulation > 0
                    ? (popVal / referencePopulation) * Number(totalSupplyInput) * 0.80
                    : Number(totalSupplyInput) * 0.80;
                } else if (peakFlowSewageSource === 'floating_sewage') {
                  // Calculate floating sewage flow
                  if (waterDemandResults?.floating?.[year]) {
                    avgSewFlow = waterDemandResults.floating[year] * 0.8;
                  } else if ((window as any).floatingWaterDemand?.[year]) {
                    avgSewFlow = (window as any).floatingWaterDemand[year] * 0.8;
                  }
                } else if (peakFlowSewageSource === 'institutional_sewage') {
                  // Calculate institutional sewage flow
                  if (waterDemandResults?.institutional?.[year]) {
                    avgSewFlow = waterDemandResults.institutional[year] * 0.8;
                  } else if ((window as any).institutionalWaterDemand?.[year]) {
                    avgSewFlow = (window as any).institutionalWaterDemand[year] * 0.8;
                  }
                } else if (peakFlowSewageSource === 'firefighting_sewage') {
                  // Calculate firefighting sewage flow
                  const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
                  if (waterDemandResults?.firefighting?.[method]?.[year]) {
                    avgSewFlow = waterDemandResults.firefighting[method][year] * 0.8;
                  } else if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
                    avgSewFlow = (window as any).firefightingWaterDemand[method][year] * 0.8;
                  } else if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
                    avgSewFlow = (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
                  }
                } else {
                  // Default to population-based sewage
                  if (typeof sewageResult === 'number') {
                    if (domesticLoadMethod === 'manual' && domesticSupplyInput) {
                      const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
                      const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
                      avgSewFlow = referencePopulation > 0
                        ? ((popVal / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
                        : sewageResult;
                    } else {
                      avgSewFlow = sewageResult;
                    }
                  } else {
                    avgSewFlow = sewageResult[year] || 0;
                  }
                }

                // Create the row with basic data
                const row = [
                  year,
                  popVal.toLocaleString(),
                  avgSewFlow.toFixed(2)
                ];

                // Add peak flow calculations based on selected methods
                if (selectedMethods.includes('CPHEEO')) {
                  row.push((avgSewFlow * getCPHEEOFactor(popVal)).toFixed(2));
                }
                if (selectedMethods.includes('HARMON')) {
                  row.push((avgSewFlow * getHarmonFactor(popVal)).toFixed(2));
                }
                if (selectedMethods.includes('BABBITT')) {
                  row.push((avgSewFlow * getBabbittFactor(popVal)).toFixed(2));
                }

                return row;
              });

              // Generate the table
              autoTable(doc, {
                head: [headers],
                body: peakRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 11 },
                headStyles: { fillColor: [128, 0, 128], textColor: [255, 255, 255] },
                columnStyles: headers.length === 3 ? {
                  0: { cellWidth: 30 },
                  1: { cellWidth: 60 },
                  2: { cellWidth: 90 }
                } : headers.length === 4 ? {
                  0: { cellWidth: 25 },
                  1: { cellWidth: 45 },
                  2: { cellWidth: 55 },
                  3: { cellWidth: 55 }
                } : headers.length === 5 ? {
                  0: { cellWidth: 20 },
                  1: { cellWidth: 35 },
                  2: { cellWidth: 35 },
                  3: { cellWidth: 35 },
                  4: { cellWidth: 35 }
                } : {
                  0: { cellWidth: 18 },
                  1: { cellWidth: 30 },
                  2: { cellWidth: 28 },
                  3: { cellWidth: 28 },
                  4: { cellWidth: 28 },
                  5: { cellWidth: 28 }
                },
                margin: { left: 14 }
              });

              yPos = (doc as any).lastAutoTable?.finalY + 10;

              // Add explanatory text
              addParagraph(`Peak flow calculations have been performed using ${selectedMethods.join(', ')} method(s) based on ${peakFlowSewageSource.replace('_', ' ')} sewage generation values.`);

              if (yPos > doc.internal.pageSize.height - 20) {
                doc.addPage();
                yPos = 20;
              }
            } else {
              addParagraph("Peak flow calculation data not available. Please ensure sewage calculation is completed first.");
            }
          }


          // 6.5 Raw Sewage Characteristics
          if (showRawSewage && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (showRawSewage) {
            addSectionHeading("4.4.5 Raw Sewage Characteristics", 2);
            const basePop = computedPopulation["2011"] || 0;
            const baseCoefficient = basePop >= 1000000 ? 150 : 135;
            const unmetered = Number(unmeteredSupplyInput) || 0;
            const totalCoefficient = (baseCoefficient + unmetered) * 0.80;

            doc.setFontSize(12);
            doc.setFont('times', 'normal');
            doc.text(`Base Population (2011): ${basePop.toLocaleString()}`, 14, yPos);
            yPos += 5;
            doc.text(`Base Coefficient: ${baseCoefficient} LPCD`, 14, yPos);
            yPos += 5;
            doc.text(`Unmetered Supply: ${unmetered} LPCD`, 14, yPos);
            yPos += 5;
            doc.text(`Total Coefficient: ${totalCoefficient.toFixed(2)} LPCD`, 14, yPos);
            yPos += 8;

            const rawRows = pollutionItemsState.map((item) => {
              const concentration = (item.perCapita / totalCoefficient) * 1000;
              return [
                item.name,
                item.perCapita.toFixed(1),
                concentration.toFixed(1),
                (item.designCharacteristic || concentration).toFixed(1)
              ];
            });

            autoTable(doc, {
              head: [["Parameter", "Per Capita (g/c/d)", "Raw Sewage (mg/l)", "Design Value (mg/l)"]],
              body: rawRows,
              startY: yPos,
              styles: { font: 'times', fontSize: 12 },
              headStyles: { fillColor: [66, 139, 202], textColor: [255, 255, 255] },
              columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 45 },
                2: { cellWidth: 45 },
                3: { cellWidth: 45 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 15;
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // Add after the existing domestic sewage section

          // 6.6 Floating Seasonal Sewage Generation
          if (floatingSeasonalDemands && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (floatingSeasonalDemands) {
            addSectionHeading("4.4.6 Floating Seasonal Sewage Generation", 2);

            const floatingSeasonalRows = Object.keys(computedPopulation).map((year) => {
              const domesticPop = computedPopulation[year];
              const summerFloating = floatingSeasonalDemands?.summer?.[year] ? (floatingSeasonalDemands.summer[year] * 0.8) : 0;
              const monsoonFloating = floatingSeasonalDemands?.monsoon?.[year] ? (floatingSeasonalDemands.monsoon[year] * 0.8) : 0;
              const postMonsoonFloating = floatingSeasonalDemands?.postMonsoon?.[year] ? (floatingSeasonalDemands.postMonsoon[year] * 0.8) : 0;
              const winterFloating = floatingSeasonalDemands?.winter?.[year] ? (floatingSeasonalDemands.winter[year] * 0.8) : 0;

              return [
                year,
                domesticPop.toLocaleString(),
                summerFloating.toFixed(2),
                monsoonFloating.toFixed(2),
                postMonsoonFloating.toFixed(2),
                winterFloating.toFixed(2)
              ];
            });

            autoTable(doc, {
              head: [["Year", "Population", "Summer (MLD)", "Monsoon (MLD)", "Post-Monsoon (MLD)", "Winter (MLD)"]],
              body: floatingSeasonalRows,
              startY: yPos,
              styles: { font: 'times', fontSize: 11 },
              headStyles: { fillColor: [255, 165, 0], textColor: [255, 255, 255] },
              columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 35 },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 30 },
                5: { cellWidth: 25 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 10;

            addParagraph("Floating seasonal sewage values are calculated by applying seasonal multipliers to base floating water demand and converting to sewage (×0.8).");

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.7 Domestic Seasonal Sewage Generation
          if (seasonalMultipliers && domesticSewageResult && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (seasonalMultipliers && domesticSewageResult) {
            addSectionHeading("4.4.7 Domestic Seasonal Sewage Generation", 2);

            const domesticSeasonalRows = typeof domesticSewageResult === 'number'
              ? Object.keys(computedPopulation).map((year) => {
                const domesticPop = computedPopulation[year];
                const k = Number(domesticSupplyInput);
                const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
                const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
                const baseDomesticSewage = referencePopulation > 0
                  ? ((domesticPop / referencePopulation) * k) * multiplier * 0.80
                  : domesticSewageResult;

                return [
                  year,
                  domesticPop.toLocaleString(),
                  (baseDomesticSewage * seasonalMultipliers.summer).toFixed(2),
                  (baseDomesticSewage * seasonalMultipliers.monsoon).toFixed(2),
                  (baseDomesticSewage * seasonalMultipliers.postMonsoon).toFixed(2),
                  (baseDomesticSewage * seasonalMultipliers.winter).toFixed(2)
                ];
              })
              : Object.entries(domesticSewageResult).map(([year, value]) => {
                const domesticPop = computedPopulation[year];
                const baseDomesticSewage = Number(value);

                return [
                  year,
                  domesticPop?.toLocaleString() || '0',
                  (baseDomesticSewage * seasonalMultipliers.summer).toFixed(2),
                  (baseDomesticSewage * seasonalMultipliers.monsoon).toFixed(2),
                  (baseDomesticSewage * seasonalMultipliers.postMonsoon).toFixed(2),
                  (baseDomesticSewage * seasonalMultipliers.winter).toFixed(2)
                ];
              });

            autoTable(doc, {
              head: [["Year", "Population", "Summer (MLD)", "Monsoon (MLD)", "Post-Monsoon (MLD)", "Winter (MLD)"]],
              body: domesticSeasonalRows,
              startY: yPos,
              styles: { font: 'times', fontSize: 11 },
              headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255] },
              columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 35 },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 30 },
                5: { cellWidth: 25 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 10;

            addParagraph(`Domestic seasonal sewage values use multipliers - Summer: ${seasonalMultipliers.summer}, Monsoon: ${seasonalMultipliers.monsoon}, Post-Monsoon: ${seasonalMultipliers.postMonsoon}, Winter: ${seasonalMultipliers.winter}`);

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.8 Sewage Treatment Capacity Analysis
          if (treatmentCapacityTable && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (treatmentCapacityTable) {
            addSectionHeading("4.4.8 Sewage Treatment Capacity Analysis", 2);

            addParagraph(`A comprehensive analysis of sewage treatment capacity versus generation has been conducted. The existing treatment capacity is ${Number(sewageTreatmentCapacity).toFixed(2)} MLD, analyzed against ${selectedTreatmentMethod?.toUpperCase()} peak flow calculations.`);

            // Treatment capacity details
            doc.setFontSize(12);
            doc.setFont('times', 'normal');
            doc.text("Treatment Capacity:", 14, yPos);
            doc.text(`${Number(sewageTreatmentCapacity).toFixed(2)} MLD`, 80, yPos);
            yPos += 5;
            doc.text("Peak Flow Method:", 14, yPos);
            doc.text(`${selectedTreatmentMethod?.toUpperCase() || 'Not Selected'}`, 80, yPos);
            yPos += 10;

            // Gap analysis table
            const sewageResult = domesticLoadMethod === 'modeled' ? domesticSewageResult : (waterSupplyResult || domesticSewageResult);
            if (sewageResult) {
              const treatmentRows = Object.keys(computedPopulation).map((year) => {
                const popVal = computedPopulation[year] || 0;
                let avgSewFlow = 0;

                if (typeof sewageResult === 'number') {
                  if (domesticLoadMethod === 'manual' && domesticSupplyInput) {
                    const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
                    const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
                    avgSewFlow = referencePopulation > 0
                      ? ((popVal / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
                      : sewageResult;
                  } else {
                    avgSewFlow = sewageResult;
                  }
                } else {
                  avgSewFlow = sewageResult[year] || 0;
                }

                // Calculate peak flow based on selected treatment method
                let peakSewageGeneration;
                if (selectedTreatmentMethod === 'cpheeo') {
                  peakSewageGeneration = avgSewFlow * getCPHEEOFactor(popVal);
                } else if (selectedTreatmentMethod === 'harmon') {
                  peakSewageGeneration = avgSewFlow * getHarmonFactor(popVal);
                } else if (selectedTreatmentMethod === 'babbitt') {
                  peakSewageGeneration = avgSewFlow * getBabbittFactor(popVal);
                } else {
                  peakSewageGeneration = avgSewFlow;
                }

                const gap = Number(sewageTreatmentCapacity) - peakSewageGeneration;
                const status = gap >= 0 ? 'Sufficient' : 'Deficit';

                return [
                  year,
                  popVal.toLocaleString(),
                  Number(sewageTreatmentCapacity).toFixed(2),
                  peakSewageGeneration.toFixed(2),
                  (gap >= 0 ? '+' : '') + gap.toFixed(2),
                  status
                ];
              });

              autoTable(doc, {
                head: [["Year", "Population", "Treatment Capacity (MLD)", "Sewage Generation (MLD)", "Gap (MLD)", "Status"]],
                body: treatmentRows,
                startY: yPos,
                styles: { font: 'times', fontSize: 11 },
                headStyles: { fillColor: [128, 0, 128], textColor: [255, 255, 255] },
                columnStyles: {
                  0: { cellWidth: 25 },
                  1: { cellWidth: 30 },
                  2: { cellWidth: 35 },
                  3: { cellWidth: 35 },
                  4: { cellWidth: 25 },
                  5: { cellWidth: 30 }
                },
                margin: { left: 14 }
              });
              yPos = (doc as any).lastAutoTable?.finalY + 10;
            }

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }

          // 6.9 Storm Water Runoff Analysis
          if (stormWaterResult && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (stormWaterResult) {
            addSectionHeading("4.4.9 Storm Water Runoff Analysis", 2);

            addParagraph("Storm water runoff analysis has been conducted based on shape detection, land use characteristics, and rainfall intensity parameters.");

            // Storm water parameters
            doc.setFontSize(12);
            doc.setFont('times', 'normal');
            if (stormWaterData) {
              doc.text("Detected Shape Type:", 14, yPos);
              doc.text(`${stormWaterData.overall_shape_type || 'N/A'}`, 80, yPos);
              yPos += 5;
              doc.text("Total Area:", 14, yPos);
              doc.text(`${stormWaterData.total_area_hectares?.toLocaleString() || 'N/A'} hectares`, 80, yPos);
              yPos += 5;
            }
            doc.text("Selected Land Use Type:", 14, yPos);
            doc.text(`${selectedLandUseType.replace(/^(rectangle_|sector_)/, '').replace(/_/g, ' ') || 'N/A'}`, 80, yPos);
            yPos += 5;
            doc.text("Duration Time:", 14, yPos);
            doc.text(`${selectedTime || 'N/A'} minutes`, 80, yPos);
            yPos += 5;
            doc.text("Rainfall Intensity:", 14, yPos);
            doc.text(`${rainfallIntensity || 'N/A'} mm/hr`, 80, yPos);
            yPos += 10;

            // Storm water result
            addSectionHeading("Storm Water Runoff Result:", 2);
            doc.setFontSize(16);
            doc.setFont('times', 'bold');
            doc.text(`${stormWaterResult.storm_water_runoff || 'N/A'} ${stormWaterResult.unit || 'MLD'}`, 14, yPos);
            yPos += 10;

            addParagraph("This storm water runoff value represents the expected surface water flow during the specified rainfall event and should be considered for drainage infrastructure planning.");

            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          }


          // 7. Results and Discussion
          addSectionHeading("5. Results and Discussion");
          addParagraph("The results of the sewage generation estimation will be discussed in this section, including spatial patterns, high-demand areas, and infrastructure recommendations. [To be expanded based on specific results and analysis.]");

          // 8. Summary and Conclusions
          // 8. Summary and Conclusions
          if (yPos > 230) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("6. Summary and Conclusions");

          // Get data for the summary table
          const selectedMethod = window.selectedPopulationMethod || window.selectedMethod || 'Not specified';
          const forecatingYears = Object.keys(computedPopulation).length > 0
            ? `${Math.min(...Object.keys(computedPopulation).map(Number))} - ${Math.max(...Object.keys(computedPopulation).map(Number))}`
            : 'Not available';

          const waterDemandData = (window as any).totalWaterDemand || {};
          const domesticWaterDemand = (window as any).domesticWaterDemand || {};
          const floatingWaterDemand = (window as any).floatingWaterDemand || {};
          const firefightingDemand = (window as any).firefightingWaterDemand || {};

          // Calculate water gap status
          const waterSupply = Number(totalSupplyInput) || 0;
          let waterGapStatus = 'Not calculated';
          if (waterSupply > 0 && Object.keys(waterDemandData).length > 0) {
            const lastYear = Object.keys(waterDemandData).sort().pop();
            const lastDemand = lastYear ? waterDemandData[lastYear] : 0;
            const gap = waterSupply - lastDemand;
            waterGapStatus = gap >= 0 ? `Sufficient (Gap: +${gap.toFixed(2)} MLD)` : `Deficit (Gap: ${gap.toFixed(2)} MLD)`;
          }

          // Get peak flow methods
          const selectedPeakMethods = Object.entries(peakFlowMethods)
            .filter(([_, selected]) => selected)
            .map(([method]) => method.toUpperCase())
            .join(', ') || 'Not selected';

          // Create summary table data
          const summaryTableData = [
            ['1', 'Forecasting Years', forecatingYears],
            ['2', 'Forecasting Method', selectedMethod],
            ['3', 'Methods for Water Demand & Sewage', `Water Demand: Population-based, Sewage: ${domesticLoadMethod || 'Not selected'}`],
            ['4', 'Demand Rate', `Domestic: 135 LPCD, Total: ${Object.keys(waterDemandData).length > 0 ? 'Calculated' : 'Not calculated'}`],
            ['5', 'Floating Demand Rate', Object.keys(floatingWaterDemand).length > 0 ? 'As per CPHEEO guidelines' : 'Not calculated'],
            ['6', 'Fire Fighting Method', Object.keys(firefightingDemand).length > 0 ? 'Kuchling Method' : 'Not calculated'],
            ['7', 'Water Sufficiency', waterGapStatus],
            ['8', 'Drain Tapping Information', `${drainItems.length} drains, Total discharge: ${totalDrainDischarge.toFixed(2)} MLD`],
            ['9', 'NRW/UFW', `${unmeteredSupplyInput || 15}% (Unaccounted for Water)`],
            ['10', 'Peak Flow Method', selectedPeakMethods]
          ];

          addParagraph("This comprehensive report presents the sewage generation analysis with the following key parameters and findings:");

          // Add the summary table
          autoTable(doc, {
            head: [['S.No.', 'Parameter', 'Details']],
            body: summaryTableData,
            startY: yPos,
            styles: {
              font: 'times',
              fontSize: 11,
              cellPadding: 3
            },
            headStyles: {
              fillColor: [66, 139, 202],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            columnStyles: {
              0: { cellWidth: 20, halign: 'center' },
              1: { cellWidth: 60 },
              2: { cellWidth: 100 }
            },
            margin: { left: 14 },
            theme: 'striped',
            alternateRowStyles: { fillColor: [245, 245, 245] }
          });

          yPos = (doc as any).lastAutoTable?.finalY + 15;

          if (yPos > pageHeight - bottomMargin) {
            doc.addPage();
            yPos = 20;
          }

          // Add concluding paragraph
          addParagraph(`The analysis indicates a total sewage generation of ${totalSewageVolume} MLD for the study area. The methodology follows CPHEEO guidelines and incorporates multiple forecasting approaches to ensure robust planning estimates. This comprehensive assessment provides the foundation for sewage treatment infrastructure planning and environmental management decisions.`);


          // 9. References
          // doc.addPage();
          addSectionHeading("7. References");
          const references = [
            "1. CPHEEO Manual on Water Supply and Treatment, Ministry of Urban Development, Government of India",
            "2. CPHEEO Manual on Sewerage and Sewage Treatment Systems, Ministry of Urban Development, Government of India",
            "3. Census of India, 2011",
            "4. Guidelines for Decentralized Wastewater Management, Ministry of Environment, Forest and Climate Change",
            "5. IS 1172:1993 - Code of Basic Requirements for Water Supply, Drainage and Sanitation",
            "6. Metcalf & Eddy, Wastewater Engineering: Treatment and Reuse, 4th Edition",
            "7. Central Pollution Control Board Guidelines for Sewage Treatment",
            "8. Manual on Storm Water Drainage Systems, CPHEEO",
            "9. Uniform Drinking Water Quality Monitoring Protocol, Ministry of Jal Shakti",
            "10. National Water Policy 2012, Government of India"
          ];
          doc.setFontSize(12);
          doc.setFont('times', 'normal');
          references.forEach(ref => {
            const lines = doc.splitTextToSize(ref, 180);
            doc.text(lines, 14, yPos);
            yPos += (lines.length * 5) + 3;
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          });

          // Add page numbers and footer
          const pageCount = doc.internal.pages.length - 1;
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('times', 'normal');
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
            doc.text("Comprehensive Sewage Generation Report", 14, doc.internal.pageSize.height - 10);
            // d            oc.text(today, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
          }

          try {
            //console.log('Starting PDF upload process...');

            // Generate PDF as blob for upload
            const pdfBlob = doc.output('blob');
            const fileName = `Comprehensive_Sewage_Generation_Report_${Date.now()}.pdf`;

            //console.log('PDF blob created:', pdfBlob.size, 'bytes');

            // Create FormData for upload
            const formData = new FormData();
            formData.append('pdf_file', pdfBlob, fileName);

            //console.log('FormData created, uploading to API...');

            // Upload to your API
            const uploadResponse = await fetch('/django/pdf', {
              method: 'POST',
              body: formData,
            });

            //console.log('Upload response status:', uploadResponse.status);

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              //console.log('PDF uploaded successfully:', uploadResult);

              // Show success message
              setTimeout(() => {
                //alert(`PDF uploaded successfully!\nUnique filename: ${uploadResult.unique_filename || 'Generated'}`);
              }, 100);
            } else {
              const errorText = await uploadResponse.text();
              //console.log('Upload failed:', uploadResponse.status, errorText);
              setTimeout(() => {
                // alert('PDF generated successfully, but upload to server failed. Check console for details.');
              }, 100);
            }
          } catch (uploadError) {
            // console.log('Upload error:', uploadError);
            setTimeout(() => {
              //alert('PDF generated successfully, but upload to server failed. Check console for details.');
            }, 100);
          }

          // Keep the original download functionality
          // console.log('Starting PDF download...');
          doc.save("Comprehensive_Sewage_Generation_Report.pdf");
          // console.log('PDF download initiated');


          doc.save("Comprehensive_Sewage_Generation_Report.pdf");
        } // End of try block
      } catch (error) {
        //console.log("Error generating report:", error);
      }
      finally {
        setIsDownloading(false);
      }
    }; // End of continueWithReport

    await addLogos();
    await continueWithReport();
  };

  const handleCheckboxChange = (key: keyof typeof checkboxes) => {
    setCheckboxes(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="p-6 border rounded-lg bg-gradient-to-br from-white to-gray-50 shadow-lg">
      <div className="flex items-center mb-4 ">
        <h3 className="text-2xl font-bold text-gray-800">Sewage Calculation</h3>
        {sourceMode === 'drain' && (
          <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
            Drain Mode
          </span>
        )}
        <div className="relative ml-2 group">
          <span className="flex items-center justify-center h-5 w-5 text-sm bg-blue-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
          <div className="absolute z-10 hidden group-hover:block w-72 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl -mt-8 left-6 border border-gray-200">
            Sewage calculation determines wastewater generation based on water supply, population, and drainage infrastructure to support effective sewage treatment planning.
          </div>
        </div>
      </div>

      {/* Water Supply Method Container */}
      <div className="mb-6 p-4 border rounded-lg bg-blue-50/50 shadow-sm">
        <h4 className="font-semibold text-lg text-blue-700">Water Supply Method</h4>
        <div className="mt-3">
          <label htmlFor="total_supply_input" className="block text-sm font-medium text-gray-700">
            Total Water Supply (MLD):
          </label>
          <input
            type="number"
            id="total_supply_input"
            value={totalSupplyInput}
            onChange={(e) =>
              setTotalSupplyInput(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="mt-2 block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Enter total supply"
            min="0"
          />
        </div>
        {waterSupplyResult && (
          <div className="mt-4 p-4 border rounded-lg bg-green-50/50 shadow-sm">
            <h4 className="font-semibold text-lg text-green-700">Sewage Generation (Water Supply):</h4>
            {typeof waterSupplyResult === 'number' ? (
              <p className="text-xl font-medium text-gray-800">{waterSupplyResult.toFixed(2)} MLD</p>
            ) : (
              <div className="mt-4">
                <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-100">
                  <table className="table-auto w-full min-w-[600px] bg-white border border-gray-300 rounded-lg shadow-md">
                    <thead className="bg-gradient-to-r from-blue-100 to-blue-200 sticky top-0 z-10">
                      <tr>
                        <th className="border-b border-gray-300 px-6 py-3 text-left text-sm font-semibold text-gray-800">Year</th>
                        <th className="border-b border-gray-300 px-6 py-3 text-left text-sm font-semibold text-gray-800">Forecasted Population</th>
                        <th className="border-b border-gray-300 px-6 py-3 text-left text-sm font-semibold text-gray-800">Sewage Generation (MLD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(waterSupplyResult).map(([year, value], index) => (
                        <tr
                          key={year}
                          className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <td className="border-b border-gray-200 px-6 py-3 text-gray-700">{year}</td>
                          <td className="border-b border-gray-200 px-6 py-3 text-gray-700">{computedPopulation[year]?.toLocaleString() || '0'}</td>
                          <td className="border-b border-gray-200 px-6 py-3 text-gray-700">{Number(value).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drain Tapping Input */}
      <div className="mb-6 p-4 border rounded-lg bg-blue-50/50 shadow-sm">
        <h4 className="font-semibold text-lg text-blue-700 mb-3">Drain Tapping Information</h4>
        {sourceMode !== 'drain' && (
          <>
            <label className="block text-sm font-medium text-gray-700 flex items-center">
              Number Of Drains to be Tapped
              <div className="relative ml-1 group">
                <span className="flex items-center justify-center h-5 w-5 text-sm bg-blue-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl -mt-12 ml-6 border border-gray-200">
                  Enter the number of drains that will be connected to the sewage system for wastewater collection.
                </div>
              </div>
            </label>
            <input
              type="number"
              id="drain_count"
              value={drainCount}
              onChange={handleDrainCountChange}
              className="mt-2 block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter number of drains"
              min="0"
            />
          </>
        )}

        {sourceMode === 'drain' && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-blue-800">Drain Mode Active</span>
            </div>
            <p className="text-sm text-blue-700">
              Drain information is automatically populated from your drain selection.
              Number of drains: <strong>{drainItems.length}</strong>
            </p>
          </div>
        )}

        {drainCount && drainCount > 0 && drainItemsTableJSX}
      </div>


      {/* Domestic Sewage Load Estimation Container */}
      <div className="mb-6 p-4 border rounded-lg bg-blue-50/50 shadow-sm">
        <h4 className="font-semibold text-lg text-blue-700 mb-3">Domestic Sewage Load Estimation</h4>
        <div className="mb-4">
          <label htmlFor="domestic_load_method" className="block text-sm font-medium text-gray-700">
            Select Sector:
          </label>
          <select
            id="domestic_load_method"
            value={domesticLoadMethod}
            onChange={handleDomesticLoadMethodChange}
            className="mt-2 block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">-- Choose Option --</option>
            <option value="manual">Manual</option>
            <option value="modeled">Modeled</option>

          </select>
          {domesticLoadMethod === 'manual' && (
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="domestic_supply_input" className="block text-sm font-medium text-gray-700">
                    Enter Population:
                  </label>
                  <div className="relative group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-blue-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl mt-2 left-full ml-2 border border-gray-200">
                      Population forecasted by user
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  id="domestic_supply_input"
                  value={domesticSupplyInput}
                  onChange={(e) =>
                    setDomesticSupplyInput(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="mt-2 block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter population"
                  min="0"
                />
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="unmetered_supply_input_manual" className="text-sm font-medium text-gray-700">
                    Unaccounted for Water (UFW) in Percent (optional):
                  </label>
                  <div className="relative group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-blue-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl mt-2 left-full ml-2 border border-gray-200">
                      Unaccounted For Water (UFW) Should Be Limited To 15% As Per CPHEEO Manual On Water Supply and Treatment, May-1999.
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  id="unmetered_supply_input_manual"
                  value={unmeteredSupplyInput}
                  onChange={(e) =>
                    setUnmeteredSupplyInput(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="mt-2 block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter unmetered supply"
                  min="0"
                />
              </div>
            </div>
          )}
          {domesticLoadMethod === 'modeled' && (
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center space-x-2">

                  <div className="relative group">

                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl mt-2 left-full ml-2 border border-gray-200">
                      Population forecasted by algorithm
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="unmetered_supply_input" className="text-sm font-medium text-gray-700">
                    Unaccounted for Water (UFW) in Percent (optional):
                  </label>
                  <div className="relative group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-blue-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl mt-2 left-full ml-2 border border-gray-200">
                      Unaccounted For Water (UFW) Should Be Limited To 15% As Per CPHEEO Manual On Water Supply and Treatment, May-1999.
                    </div>
                  </div>
                </div>

                <div>
                  <input
                    type="number"
                    id="unmetered_supply_input"
                    value={unmeteredSupplyInput}
                    onChange={(e) =>
                      setUnmeteredSupplyInput(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="mt-2 block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter unmetered supply"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && <div className="mb-6 text-red-600 font-medium">{error}</div>}

      <div className="flex space-x-4 mb-6">
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          onClick={handleCalculateSewage}
        >
          Calculate Sewage
        </button>
      </div>

      {domesticSewageResult && (
        <div className="mt-6 p-4 border rounded-lg bg-green-50/50 shadow-sm">
          <h4 className="font-semibold text-lg text-green-700 mb-4">Sewage Generation:</h4>
          {typeof domesticSewageResult === 'number' ? (
            // FOR MANUAL CASE - Create table like modeled
            domesticLoadMethod === 'manual' ? (
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-100">
                <table className="table-auto w-full min-w-[800px] bg-white border border-gray-300 rounded-lg shadow-md">
                  <thead className="bg-gradient-to-r from-blue-100 to-blue-200 sticky top-0 z-10">
                    <tr>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Year</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Forecasted Population</th>
                      {((window as any).totalWaterSupply > 0 || Number(totalSupplyInput) > 0) && (
                        <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Water Based Sewage Generation (MLD)</th>
                      )}
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Population Based Sewage Generation (MLD)</th>
                      {totalDrainDischarge > 0 && (
                        <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Drains Based Sewage Generation (MLD)</th>
                      )}
                      {/* KEEP THESE SEPARATE COLUMNS FOR DISPLAY */}
                      {/* {(waterDemandResults?.floating || (window as any).floatingWaterDemand) && (
                        <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Floating Sewage Generation (MLD)</th>
                      )}
                      {(waterDemandResults?.institutional || (window as any).institutionalWaterDemand) && (
                        <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Institutional Sewage Generation (MLD)</th>
                      )}
                      {(waterDemandResults?.firefighting || (window as any).firefightingWaterDemand) && (
                        <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Firefighting Sewage Generation (MLD)</th>
                      )} */}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(computedPopulation).map((year, index) => {
                      const domesticPop = computedPopulation[year];
                      const k = Number(domesticSupplyInput); // User input population
                      const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
                      const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;

                      // Manual calculations with ratio
                      const populationBasedSewage = referencePopulation > 0
                        ? ((domesticPop / referencePopulation) * k) * multiplier * 0.80
                        : domesticSewageResult;

                      const waterBasedSewage = referencePopulation > 0
                        ? ((domesticPop / referencePopulation) * Number(totalSupplyInput)) * 0.80
                        : 0;

                      const drainBasedSewage = referencePopulation > 0
                        ? ((domesticPop / referencePopulation) * totalDrainDischarge)
                        : 0;

                      // Calculate floating sewage
                      const floatingSewage = (() => {
                        if (waterDemandResults?.floating?.[year]) {
                          return waterDemandResults.floating[year] * 0.8;
                        }
                        if (waterDemandResults?.floating?.base_demand?.[year]) {
                          return waterDemandResults.floating.base_demand[year] * 0.8;
                        }
                        if ((window as any).floatingWaterDemand?.[year]) {
                          return (window as any).floatingWaterDemand[year] * 0.8;
                        }
                        if ((window as any).floatingWaterDemand?.base_demand?.[year]) {
                          return (window as any).floatingWaterDemand.base_demand[year] * 0.8;
                        }
                        return 0;
                      })();

                      // Calculate institutional sewage
                      const institutionalSewage = (() => {
                        if (waterDemandResults?.institutional?.[year]) {
                          return waterDemandResults.institutional[year] * 0.8;
                        }
                        if ((window as any).institutionalWaterDemand?.[year]) {
                          return (window as any).institutionalWaterDemand[year] * 0.8;
                        }
                        return 0;
                      })();

                      // Calculate firefighting sewage
                      const firefightingSewage = (() => {
                        const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
                        if (waterDemandResults?.firefighting?.[method]?.[year]) {
                          return waterDemandResults.firefighting[method][year] * 0.8;
                        }
                        if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
                          return (window as any).firefightingWaterDemand[method][year] * 0.8;
                        }
                        if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
                          return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
                        }
                        return 0;
                      })();

                      // Combine all sewage types for domestic column
                      const combinedDomesticSewage = populationBasedSewage + floatingSewage + institutionalSewage;

                      return (
                        <tr
                          key={year}
                          className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{year}</td>
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{domesticPop.toLocaleString()}</td>
                          {((window as any).totalWaterSupply > 0 || Number(totalSupplyInput) > 0) && (
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">
                              {waterBasedSewage.toFixed(2)}
                            </td>
                          )}
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">
                            {combinedDomesticSewage.toFixed(2)}
                          </td>
                          {totalDrainDischarge > 0 && (
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">
                              {drainBasedSewage.toFixed(2)}
                            </td>
                          )}
                          {/* KEEP THESE SEPARATE CELLS FOR DISPLAY */}
                          {/* {(waterDemandResults?.floating || (window as any).floatingWaterDemand) && (
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{floatingSewage.toFixed(2)}</td>
                          )}
                          {(waterDemandResults?.institutional || (window as any).institutionalWaterDemand) && (
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{institutionalSewage.toFixed(2)}</td>
                          )}
                          {(waterDemandResults?.firefighting || (window as any).firefightingWaterDemand) && (
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{firefightingSewage.toFixed(2)}</td>
                          )} */}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              // Original single value display for non-manual
              <p className="text-xl font-medium text-gray-800">{domesticSewageResult.toFixed(2)} MLD</p>
            )
          ) : (
            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-100">
              <table className="table-auto w-full min-w-[800px] bg-white border border-gray-300 rounded-lg shadow-md">
                <thead className="bg-gradient-to-r from-blue-100 to-blue-200 sticky top-0 z-10">
                  <tr>
                    <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Year</th>
                    <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Forecasted Population</th>
                    {((window as any).totalWaterSupply > 0 || Number(totalSupplyInput) > 0) && (
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Water Based Sewage Generation (MLD)</th>
                    )}
                    <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Population Based Sewage Generation (MLD)</th>
                    {domesticLoadMethod === 'modeled' && totalDrainDischarge > 0 && (
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Drains Based Sewage Generation (MLD)</th>
                    )}
                    {/* KEEP THESE SEPARATE COLUMNS FOR DISPLAY */}
                    {/* {(waterDemandResults?.floating || (window as any).floatingWaterDemand) && (
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Floating Sewage Generation (MLD)</th>
                    )}
                    {(waterDemandResults?.institutional || (window as any).institutionalWaterDemand) && (
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Institutional Sewage Generation (MLD)</th>
                    )}
                    {(waterDemandResults?.firefighting || (window as any).firefightingWaterDemand) && (
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Firefighting Sewage Generation (MLD)</th>
                    )} */}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(domesticSewageResult).map(([year, value], index) => {
                    const forecastData = (window as any).selectedPopulationForecast;
                    const domesticPop = forecastData[year] ?? "";
                    const drainsSewage = calculateDrainBasedSewFlow(domesticPop);
                    const waterSewage = calculatewaterBasedSewFlow(domesticPop);

                    // Calculate floating sewage
                    const floatingSewage = (() => {
                      if (waterDemandResults?.floating?.[year]) {
                        return waterDemandResults.floating[year] * 0.8;
                      }
                      if (waterDemandResults?.floating?.base_demand?.[year]) {
                        return waterDemandResults.floating.base_demand[year] * 0.8;
                      }
                      if ((window as any).floatingWaterDemand?.[year]) {
                        return (window as any).floatingWaterDemand[year] * 0.8;
                      }
                      if ((window as any).floatingWaterDemand?.base_demand?.[year]) {
                        return (window as any).floatingWaterDemand.base_demand[year] * 0.8;
                      }
                      return 0;
                    })();

                    // Calculate institutional sewage
                    const institutionalSewage = (() => {
                      if (waterDemandResults?.institutional?.[year]) {
                        return waterDemandResults.institutional[year] * 0.8;
                      }
                      if ((window as any).institutionalWaterDemand?.[year]) {
                        return (window as any).institutionalWaterDemand[year] * 0.8;
                      }
                      return 0;
                    })();

                    // Calculate firefighting sewage
                    const firefightingSewage = (() => {
                      const method = waterDemandResults?.selectedFirefightingMethod || 'kuchling';
                      if (waterDemandResults?.firefighting?.[method]?.[year]) {
                        return waterDemandResults.firefighting[method][year] * 0.8;
                      }
                      if ((window as any).firefightingWaterDemand?.[method]?.[year]) {
                        return (window as any).firefightingWaterDemand[method][year] * 0.8;
                      }
                      if ((window as any).firefightingWaterDemand?.kuchling?.[year]) {
                        return (window as any).firefightingWaterDemand.kuchling[year] * 0.8;
                      }
                      return 0;
                    })();

                    // Combine domestic sewage with floating, institutional, and firefighting
                    const combinedDomesticSewage = Number(value) + floatingSewage + institutionalSewage;

                    return (
                      <tr
                        key={year}
                        className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{year}</td>
                        <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{domesticPop.toLocaleString()}</td>
                        {((window as any).totalWaterSupply > 0 || Number(totalSupplyInput) > 0) && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">
                            {Number(waterSewage) > 0 ? Number(waterSewage).toFixed(2) : "0.00"}
                          </td>
                        )}
                        <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{combinedDomesticSewage.toFixed(2)}</td>
                        {domesticLoadMethod === 'modeled' && totalDrainDischarge > 0 && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{drainsSewage > 0 ? drainsSewage.toFixed(2) : "0.00"}</td>
                        )}
                        {/* KEEP THESE SEPARATE CELLS FOR DISPLAY */}
                        {/* {(waterDemandResults?.floating || (window as any).floatingWaterDemand) && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{floatingSewage.toFixed(2)}</td>
                        )}
                        {(waterDemandResults?.institutional || (window as any).institutionalWaterDemand) && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{institutionalSewage.toFixed(2)}</td>
                        )}
                        {(waterDemandResults?.firefighting || (window as any).firefightingWaterDemand) && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{firefightingSewage.toFixed(2)}</td>
                        )} */}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* ADD THIS NEW SECTION RIGHT AFTER THE SEWAGE GENERATION TABLE */}
          {floatingSeasonalDemands && (
            <div className="mt-8 p-4 border rounded-lg bg-orange-50/50 shadow-sm">
              <h4 className="font-semibold text-lg text-orange-700 mb-4">Floating Seasonal Sewage Generation:</h4>
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-orange-500 scrollbar-track-gray-100">
                <table className="table-auto w-full min-w-[800px] bg-white border border-gray-300 rounded-lg shadow-md">
                  <thead className="bg-gradient-to-r from-orange-100 to-orange-200 sticky top-0 z-10">
                    <tr>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Year</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Forecasted Population</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Summer Floating Sewage (MLD)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Monsoon Floating Sewage (MLD)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Post-Monsoon Floating Sewage (MLD)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Winter Floating Sewage (MLD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(computedPopulation).map((year, index) => {
                      const domesticPop = computedPopulation[year];

                      // Calculate seasonal floating sewage values (multiply by 0.8)
                      const summerFloatingSewage = floatingSeasonalDemands?.summer?.[year] ? (floatingSeasonalDemands.summer[year] * 0.8) : 0;
                      const monsoonFloatingSewage = floatingSeasonalDemands?.monsoon?.[year] ? (floatingSeasonalDemands.monsoon[year] * 0.8) : 0;
                      const postMonsoonFloatingSewage = floatingSeasonalDemands?.postMonsoon?.[year] ? (floatingSeasonalDemands.postMonsoon[year] * 0.8) : 0;
                      const winterFloatingSewage = floatingSeasonalDemands?.winter?.[year] ? (floatingSeasonalDemands.winter[year] * 0.8) : 0;

                      return (
                        <tr
                          key={year}
                          className={`hover:bg-orange-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{year}</td>
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{domesticPop.toLocaleString()}</td>
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{summerFloatingSewage.toFixed(2)}</td>
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{monsoonFloatingSewage.toFixed(2)}</td>
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{postMonsoonFloatingSewage.toFixed(2)}</td>
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{winterFloatingSewage.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-sm text-orange-600">
                <p><strong>Note:</strong> All floating seasonal demand values have been multiplied by 0.8 to convert from water demand to sewage generation as per standard practice.</p>
              </div>
            </div>
          )}
          {/* ADD THIS RIGHT AFTER THE FLOATING SEASONAL SEWAGE TABLE */}
          {/* Domestic Seasonal Sewage Generation Table */}
          {/* Domestic Seasonal Sewage Generation Table */}
          {seasonalMultipliers && domesticSewageResult && (
            <div className="mt-8 p-4 border rounded-lg bg-green-50/50 shadow-sm">
              <h4 className="font-semibold text-lg text-green-700 mb-4">Domestic Seasonal Sewage Generation:</h4>
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-green-500 scrollbar-track-gray-100">
                <table className="table-auto w-full min-w-[800px] bg-white border border-gray-300 rounded-lg shadow-md">
                  <thead className="bg-gradient-to-r from-green-100 to-green-200 sticky top-0 z-10">
                    <tr>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Year</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Forecasted Population</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Summer Domestic Sewage (MLD)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Monsoon Domestic Sewage (MLD)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Post-Monsoon Domestic Sewage (MLD)</th>
                      <th className="border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800">Winter Domestic Sewage (MLD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeof domesticSewageResult === 'number' ? (
                      // Manual case - calculate for each year
                      Object.keys(computedPopulation).map((year, index) => {
                        const domesticPop = computedPopulation[year];
                        const k = Number(domesticSupplyInput);
                        const referencePopulation = (window as any).population2025 || computedPopulation["2025"];
                        const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;

                        const baseDomesticSewage = referencePopulation > 0
                          ? ((domesticPop / referencePopulation) * k) * multiplier * 0.80
                          : domesticSewageResult;

                        // Calculate seasonal domestic sewage values using seasonal multipliers
                        const summerDomesticSewage = baseDomesticSewage * seasonalMultipliers.summer;
                        const monsoonDomesticSewage = baseDomesticSewage * seasonalMultipliers.monsoon;
                        const postMonsoonDomesticSewage = baseDomesticSewage * seasonalMultipliers.postMonsoon;
                        const winterDomesticSewage = baseDomesticSewage * seasonalMultipliers.winter;

                        return (
                          <tr
                            key={year}
                            className={`hover:bg-green-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                          >
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{year}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{domesticPop?.toLocaleString() || '0'}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{summerDomesticSewage.toFixed(2)}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{monsoonDomesticSewage.toFixed(2)}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{postMonsoonDomesticSewage.toFixed(2)}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{winterDomesticSewage.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      // Modeled case - use the object values
                      Object.entries(domesticSewageResult).map(([year, value], index) => {
                        const domesticPop = computedPopulation[year];
                        const baseDomesticSewage = Number(value);

                        // Calculate seasonal domestic sewage values using seasonal multipliers
                        const summerDomesticSewage = baseDomesticSewage * seasonalMultipliers.summer;
                        const monsoonDomesticSewage = baseDomesticSewage * seasonalMultipliers.monsoon;
                        const postMonsoonDomesticSewage = baseDomesticSewage * seasonalMultipliers.postMonsoon;
                        const winterDomesticSewage = baseDomesticSewage * seasonalMultipliers.winter;

                        return (
                          <tr
                            key={year}
                            className={`hover:bg-green-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                          >
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{year}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{domesticPop?.toLocaleString() || '0'}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{summerDomesticSewage.toFixed(2)}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{monsoonDomesticSewage.toFixed(2)}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{postMonsoonDomesticSewage.toFixed(2)}</td>
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{winterDomesticSewage.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-sm text-green-600">
                <p><strong>Note:</strong> Domestic sewage values have been multiplied by seasonal multipliers - Summer: {seasonalMultipliers.summer}, Monsoon: {seasonalMultipliers.monsoon}, Post-Monsoon: {seasonalMultipliers.postMonsoon}, Winter: {seasonalMultipliers.winter}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showPeakFlow && (
        <div className="mt-6 p-4 border rounded-lg bg-blue-50/50 shadow-sm">
          <h5 className="font-semibold text-lg text-blue-700 mb-3">Peak Sewage Flow Calculation</h5>
          {(domesticLoadMethod === 'modeled' && totalDrainDischarge > 0) ||
            (domesticLoadMethod === 'manual') ? (  // Always show for manual
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Sewage Generation Source for Peak Flow Calculation:
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="peakFlowSewageSource"
                    checked={peakFlowSewageSource === 'population_based'}
                    onChange={() => handlePeakFlowSewageSourceChange('population_based')}
                    className="mr-2"
                  />
                  Population Based Sewage Generation
                </label>
                {((domesticLoadMethod === 'modeled' && totalDrainDischarge > 0) ||
                  (domesticLoadMethod === 'manual' && totalDrainDischarge > 0)) && (
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="peakFlowSewageSource"
                        checked={peakFlowSewageSource === 'drain_based'}
                        onChange={() => handlePeakFlowSewageSourceChange('drain_based')}
                        className="mr-2"
                      />
                      Drain Based Sewage Generation
                    </label>
                  )}
                {((window as any).totalWaterSupply > 0 || Number(totalSupplyInput) > 0) && (
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="peakFlowSewageSource"
                      checked={peakFlowSewageSource === 'water_based'}
                      onChange={() => handlePeakFlowSewageSourceChange('water_based')}
                      className="mr-2"
                    />
                    Water Based Sewage Generation
                  </label>
                )}
                {/* {(waterDemandResults?.floating || (window as any).floatingWaterDemand) && (
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="peakFlowSewageSource"
                      checked={peakFlowSewageSource === 'floating_sewage'}
                      onChange={() => handlePeakFlowSewageSourceChange('floating_sewage')}
                      className="mr-2"
                    />
                    Floating Sewage Generation (MLD)
                  </label>
                )} */}
                {/* {(waterDemandResults?.institutional || (window as any).institutionalWaterDemand) && (
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="peakFlowSewageSource"
                      checked={peakFlowSewageSource === 'institutional_sewage'}
                      onChange={() => handlePeakFlowSewageSourceChange('institutional_sewage')}
                      className="mr-2"
                    />
                    Institutional Sewage Generation (MLD)
                  </label>
                )} */}
                {/* {(waterDemandResults?.firefighting || (window as any).firefightingWaterDemand) && (
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="peakFlowSewageSource"
                      checked={peakFlowSewageSource === 'firefighting_sewage'}
                      onChange={() => handlePeakFlowSewageSourceChange('firefighting_sewage')}
                      className="mr-2"
                    />
                    Firefighting Sewage Generation (MLD)
                  </label>
                )} */}
              </div>
            </div>
          ) : null}

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Select Peak Sewage Flow Methods:
            </label>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={peakFlowMethods.cpheeo}
                  onChange={() => handlePeakFlowMethodToggle('cpheeo')}
                  className="mr-2"
                />
                CPHEEO Method
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={peakFlowMethods.harmon}
                  onChange={() => handlePeakFlowMethodToggle('harmon')}
                  className="mr-2"
                />
                Harmon's Method
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={peakFlowMethods.babbitt}
                  onChange={() => handlePeakFlowMethodToggle('babbitt')}
                  className="mr-2"
                />
                Babbit's Method
              </label>
            </div>
          </div>
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            onClick={handleCalculatePeakFlow}
          >
            Calculate Peak Sewage Flow
          </button>
          {peakFlowTable && (
            <div className="mt-6 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-100">
              {peakFlowTable}
            </div>
          )}
        </div>
      )}

      {/* Sewage Treatment Capacity Section */}
      {showPeakFlow && (
        <div className="mt-6 p-4 border rounded-lg bg-purple-50/50 shadow-sm">
          <h5 className="font-semibold text-lg text-purple-700 mb-3">Sewage Treatment Capacity Analysis</h5>

          <div className="mb-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Sewage Treatment Capacity (MLD):
              </label>
              <input
                type="number"
                value={sewageTreatmentCapacity}
                onChange={(e) => setSewageTreatmentCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                className="block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                placeholder="Enter treatment capacity"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Peak Flow Method for Comparison:
              </label>
              <select
                value={selectedTreatmentMethod}
                onChange={(e) => setSelectedTreatmentMethod(e.target.value as 'cpheeo' | 'harmon' | 'babbitt' | '')}
                className="block w-1/3 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
              >
                <option value="">-- Select Method --</option>
                <option value="cpheeo">CPHEEO Method</option>
                <option value="harmon">Harmon's Method</option>
                <option value="babbitt">Babbit's Method</option>
              </select>
            </div>
          </div>

          <button
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            onClick={handleCalculateTreatmentCapacity}
          >
            Calculate Treatment Capacity Gap
          </button>

          {treatmentCapacityTable && (
            <div className="mt-6">
              <h6 className="font-medium text-gray-800 mb-3">Treatment Capacity vs Sewage Generation Gap Analysis</h6>
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-100">
                {treatmentCapacityTable}
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p><span className="text-green-600 font-medium">Green</span> = Sufficient capacity, <span className="text-red-600 font-medium">Red</span> = Deficit in capacity</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Storm Water Runoff Section */}
      <div className="mt-6 p-4 border rounded-lg bg-cyan-50/50 shadow-sm">
        <h5 className="font-semibold text-lg text-cyan-700 mb-3">Storm Water Runoff Analysis</h5>

        {/* Always show initialize/re-initialize button */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Generate storm water runoff analysis based on shape detection and land use characteristics.
          </p>
          <button
            className="bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-400"
            onClick={initializeStormWater}
            disabled={stormWaterLoading}
          >
            {isInitialized ? 'Re-initialize Storm Water Analysis' : 'Initialize Storm Water Analysis'}
          </button>
        </div>

        {/* Show content only if initialized */}
        {isInitialized && (
          <div className="space-y-4">
            {/* Loading State */}
            {stormWaterLoading && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading storm water data...
                </div>
              </div>
            )}

            {/* Error Display */}
            {stormWaterError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <strong>Error:</strong> {stormWaterError}
                <button
                  onClick={() => {
                    setStormWaterError(null);
                    if (selectedLandUseType && selectedTime && rainfallIntensity) {
                      initializeStormWater();
                    }
                  }}
                  className="ml-3 text-red-600 underline hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Shape Information Box */}
            {stormWaterData && (
              <div className="p-4 bg-gray-100 border rounded-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <p className="text-sm text-gray-500">Detected Shape Type</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {stormWaterData.overall_shape_type || 'Loading...'}
                  </p>
                </div>
                <div className="text-center md:text">
                  <p className="text-sm text-gray-500">Total Area (Hectares)</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {stormWaterData.total_area_hectares?.toLocaleString() || 'N/A'}
                  </p>
                </div>
              </div>
            )}


            {/* Selection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Land Use Type Dropdown - Dynamically populated from API */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Land Use Type
                  <div className="relative ml-1 inline-block group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-cyan-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl -mt-12 ml-6 border border-gray-200">
                      Select the land use type based on the detected shape characteristics for runoff calculation.
                    </div>
                  </div>
                </label>
                <select
                  value={selectedLandUseType}
                  onChange={(e) => setSelectedLandUseType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                  disabled={stormWaterLoading || !stormWaterData}
                >
                  <option value="">-- Select Land Use Type --</option>
                  {Array.isArray(stormWaterData?.shape_attributes)
                    ? stormWaterData.shape_attributes.map((attribute: string, index: number) => (
                      <option key={index} value={attribute}>
                        {attribute
                          .replace(/^(rectangle_|sector_)/, '')
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())
                        }
                      </option>
                    ))
                    : (
                      <option disabled>Loading options...</option>
                    )}

                </select>
              </div>

              {/* Time Dropdown - Populated from API */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration Time (minutes)
                  <div className="relative ml-1 inline-block group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-cyan-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl -mt-12 ml-6 border border-gray-200">
                      Select the time duration for storm water runoff calculation from available options.
                    </div>
                  </div>
                </label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                  disabled={stormWaterLoading || !stormWaterData}
                >
                  <option value="">-- Select Time Duration --</option>
                  {Array.isArray(stormWaterData?.all_duration_values)
                    ? stormWaterData.all_duration_values.map((duration: number, index: number) => (
                      <option key={index} value={duration.toString()}>
                        {duration} minutes
                      </option>
                    ))
                    : (
                      <option disabled>Loading options...</option>
                    )}

                </select>
              </div>

              {/* Rainfall Intensity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rainfall Intensity (mm/hr)
                  <div className="relative ml-1 inline-block group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-cyan-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
                    <div className="absolute z-10 hidden group-hover:block w-64 text-gray-700 text-xs rounded-lg p-3 bg-white shadow-xl -mt-12 ml-6 border border-gray-200">
                      Enter the rainfall intensity in millimeters per hour for the storm water runoff calculation.
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={rainfallIntensity}
                  onChange={(e) => setRainfallIntensity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                  placeholder="Enter intensity"
                  min="0"
                  step="0.1"
                  disabled={stormWaterLoading}
                />
              </div>
            </div>

            {/* Calculate Button */}
            <div className="flex justify-center">
              <button
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${selectedLandUseType && selectedTime && rainfallIntensity && stormWaterData && !stormWaterLoading
                  ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  }`}
                onClick={calculateStormWaterRunoff}
                disabled={!selectedLandUseType || !selectedTime || !rainfallIntensity || !stormWaterData || stormWaterLoading}
              >
                {stormWaterLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calculating...
                  </>
                ) : (
                  'Calculate Storm Water Runoff'
                )}
              </button>
            </div>

            {/* Results Display */}
            {stormWaterResult && (
              <div className="mt-6 p-4 border rounded-lg bg-green-50/50 shadow-sm">
                <h6 className="font-semibold text-lg text-green-700 mb-3">Storm Water Runoff Result</h6>
                <div className="text-sm text-gray-600 mb-1">
                  <div className="text-3xl font-bold text-green-600">
                    {stormWaterResult.storm_water_runoff || 'N/A'}{" "}
                    <span className="text-lg text-green-800 font-italic">
                      {stormWaterResult.unit || 'MLD'}
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 border rounded-lg bg-blue-50/50 shadow-sm">
        <h5 className="font-semibold text-lg text-blue-700 mb-3">Raw Sewage Characteristics</h5>
        <button
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          onClick={handleCalculateRawSewage}
        >
          Calculate Raw Sewage Characteristics
        </button>
        {showRawSewage && (
          <div className="mt-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-100">
            {rawSewageJSX}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 border rounded-lg bg-gray-50/50 shadow-sm">
        <h5 className="font-semibold text-lg text-gray-700 mb-3">Report Checklist</h5>
        <p className="text-sm text-gray-600 mb-4">
          Please confirm completion of the following sections to enable the comprehensive report download.
        </p>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={checkboxes.populationForecasting}
              onChange={() => handleCheckboxChange('populationForecasting')}
              className="mr-2"
            />
            Population Forecasting<span className="text-red-500">*</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={checkboxes.waterDemand}
              onChange={() => handleCheckboxChange('waterDemand')}
              className="mr-2"
            />
            Water Demand<span className="text-red-500">*</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={checkboxes.waterSupply}
              onChange={() => handleCheckboxChange('waterSupply')}
              className="mr-2"
            />
            Water Supply
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={checkboxes.sewageCalculation}
              onChange={() => handleCheckboxChange('sewageCalculation')}
              className="mr-2"
            />
            Sewage Calculation<span className="text-red-500">*</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={checkboxes.rawSewageCharacteristics}
              onChange={() => handleCheckboxChange('rawSewageCharacteristics')}
              className="mr-2"
            />
            Raw Sewage Characteristics<span className="text-red-500">*</span>
          </label>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          className={`text-white font-medium py-3 px-6 rounded-lg transition duration-300 ease-in-out shadow-md w-full sm:w-auto flex items-center justify-center ${areAllCheckboxesChecked && !isDownloading
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'bg-gray-400 cursor-not-allowed'
            }`}
          onClick={handle1pdfDownload}
          disabled={!areAllCheckboxesChecked || isDownloading}
        >
          {isDownloading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Generating Report...
            </>
          ) : (
            'Download Comprehensive Report'
          )}
        </button>
      </div>
    </div>
  );
};

export default SewageCalculationForm;


