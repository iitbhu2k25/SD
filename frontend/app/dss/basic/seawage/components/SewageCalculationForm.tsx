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
type PeakFlowSewageSource = 'population_based' | 'drain_based' | 'water_based' | '';

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
  selectedRiverData = null
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
    console.log('SewageCalculationForm useEffect triggered:', {
      sourceMode,
      selectedRiverData: selectedRiverData ? 'present' : 'null',
      windowSelectedRiverData: window.selectedRiverData ? 'present' : 'null',
      windowAllDrains: window.selectedRiverData?.allDrains?.length || 0
    });

    // FIXED: Only proceed if sourceMode is actually 'drain'
    if (sourceMode === 'drain') {
      console.log('Processing drain mode initialization...');

      // FIXED: Since window.selectedRiverData has the data, use it primarily
      let drainData = null;

      // Priority 1: window.selectedRiverData.allDrains (this has your data)
      if (window.selectedRiverData?.allDrains && window.selectedRiverData.allDrains.length > 0) {
        drainData = window.selectedRiverData.allDrains;
        console.log('Using window.selectedRiverData.allDrains:', drainData);
      }
      // Priority 2: selectedRiverData prop
      else if (selectedRiverData?.allDrains && selectedRiverData.allDrains.length > 0) {
        drainData = selectedRiverData.allDrains;
        console.log('Using selectedRiverData prop:', drainData);
      }
      // Priority 3: window.selectedRiverData.drains as fallback
      else if (window.selectedRiverData?.drains && window.selectedRiverData.drains.length > 0) {
        drainData = window.selectedRiverData.drains.map((d: { id: { toString: () => any; }; name: any; }) => ({
          id: d.id.toString(),
          name: d.name,
          stretch: 'Unknown Stretch',
          drainNo: d.id.toString()
        }));
        console.log('Using window.selectedRiverData.drains as fallback:', drainData);
      }

      if (drainData && drainData.length > 0) {
        console.log('Creating drain items from data:', drainData);

        const newDrainItems: DrainItem[] = drainData.map((drain: any) => ({
          id: drain.id.toString(), // This should be "33" from your debug
          name: drain.name || `Drain ${drain.id}`, // This should be "Drain 33"
          discharge: '', // Start with empty discharge
        }));

        console.log('New drain items created:', newDrainItems);

        // Always update in drain mode to ensure correct data
        setDrainCount(drainData.length);
        setDrainItems(newDrainItems);

        console.log('Updated drainCount and drainItems');
      } else {
        console.log('No drain data found for initialization');
      }
    } else {
      console.log('Not in drain mode, sourceMode is:', sourceMode);
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
            console.log('Updating drain structure while preserving discharge values');

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

      // Calculate population-based sewage value
      if (domesticLoadMethod === 'modeled' && domesticSewageResult && domesticSewageResult[sampleYear]) {
        popBasedValue = domesticSewageResult[sampleYear];
      } else if (domesticLoadMethod === 'manual' && domesticSupplyInput) {
        const referencePopulation = computedPopulation["2025"] || computedPopulation[Object.keys(computedPopulation)[0]];
        const multiplier = (135 + Number(unmeteredSupplyInput)) / 1000000;
        popBasedValue = referencePopulation > 0
          ? ((samplePop / referencePopulation) * Number(domesticSupplyInput)) * multiplier * 0.80
          : 0;
      } else if (waterSupplyResult && waterSupplyResult[sampleYear]) {
        popBasedValue = waterSupplyResult[sampleYear];
      }

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

      console.log('Auto-selecting peak flow source:', {
        popBasedValue,
        drainBasedValue,
        waterBasedValue,
        domesticLoadMethod,
        totalDrainDischarge,
        totalSupplyInput
      });

      // Select the method with highest value
      if (drainBasedValue >= popBasedValue && drainBasedValue >= waterBasedValue && totalDrainDischarge > 0) {
        setPeakFlowSewageSource('drain_based');
        console.log('Auto-selected: drain_based');
      } else if (waterBasedValue >= popBasedValue && Number(totalSupplyInput) > 0) {
        setPeakFlowSewageSource('water_based');
        console.log('Auto-selected: water_based');
      } else {
        setPeakFlowSewageSource('population_based');
        console.log('Auto-selected: population_based');
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
    console.log(`🔧 Drain item change - Index: ${index}, Field: ${field}, Value: ${value}, Type: ${typeof value}`);

    const newDrainItems = [...drainItems];

    if (field === 'discharge') {
      // Handle discharge field specifically
      if (value === '' || value === null || value === 'helvetica') {
        newDrainItems[index].discharge = '';
        console.log(`✅ Set discharge to empty for drain ${index}`);
      } else {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          newDrainItems[index].discharge = numValue;
          console.log(`✅ Set discharge to ${numValue} for drain ${index}`);
        } else {
          console.warn(`⚠️ Invalid discharge value: ${value}`);
          newDrainItems[index].discharge = '';
        }
      }
    } else {
      // Handle other fields (id, name)
      newDrainItems[index][field] = value as string;
      console.log(`✅ Set ${field} to ${value} for drain ${index}`);
    }

    console.log('Updated drain items:', newDrainItems);
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

    // --- Water Supply Payload ---
    if (totalSupplyInput === '' || Number(totalSupplyInput) <= 0) {
      setError(prev => prev ? `${prev} Invalid total water supply. ` : 'Invalid total water supply. ');
      hasError = true;
    } else {
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

    // --- Domestic Sewage Payload ---
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

    if (hasError) return;

    try {
      const responses = await Promise.all(payloads.map(payload =>
        fetch('/basics/sewage_calculation/', {
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

      if (waterSupplyResult || domesticSewageResult) {
        setShowPeakFlow(true);
      }
    } catch (error) {
      console.log(error);
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

      // Determine average sewage flow based on selected source
      let avgSewFlow;
      if (peakFlowSewageSource === 'drain_based' && totalDrainDischarge > 0) {
        avgSewFlow = drainBasedSewFlow;
      } else if (peakFlowSewageSource === 'water_based' && Number(totalSupplyInput) > 0) {
        avgSewFlow = waterBasedSewFlow;
      } else {
        avgSewFlow = popBasedSewFlow;
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
                  readOnly={sourceMode === 'drain'}
                  title={sourceMode === 'drain' ? 'Drain name is automatically set from drain selection' : ''}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="number"
                  value={item.discharge === '' ? '' : item.discharge}
                  onChange={(e) => {
                    console.log(`🎯 Discharge input change for drain ${index}:`, e.target.value);
                    handleDrainItemChange(index, 'discharge', e.target.value);
                  }}
                  className="w-20 border rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  onFocus={(e) => {
                    console.log(`🎯 Discharge input focused for drain ${index}`);
                    e.target.select(); // Select all text when focused
                  }}
                  onBlur={(e) => {
                    console.log(`🎯 Discharge input blurred for drain ${index}:`, e.target.value);
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
            console.log(`Converted ${prop} from ${value} to ${rgb} on element`, el);
          } catch (err) {
            console.warn(`Failed to convert color ${value} for property ${prop}:`, err);
            // Fallback to a safe color
            el.style.setProperty(prop, 'rgb(0, 0, 0)');
          }
        }
      });
    });

    // Clean up temporary element
    document.body.removeChild(tempDiv);
  };



  const captureMap = async () => {
    // let rgbStylesheet: HTMLStyleElement | null = null;

    try {
      console.log('Starting map capture process...');

      // Try multiple selectors to find the map container
      const mapSelectors = [
        '.map-container .leaflet-container',
        '.admin-map .leaflet-container',
        '.drain-map .leaflet-container',
        '.leaflet-container',
        '[class*="leaflet-container"]'
      ];

      let mapContainer: Element | null = null;

      // Try each selector until we find the map
      for (const selector of mapSelectors) {
        mapContainer = document.querySelector(selector);
        if (mapContainer) {
          console.log(`Found map container with selector: ${selector}`);
          break;
        }
      }

      if (!mapContainer) {
        console.warn('Map container not found with any selector');
        return null;
      }

      // Get the map instance for real coordinates if possible
      let mapInstance: L.Map | null = null;
      const mapElement = mapContainer as any;

      if (mapElement._leaflet_map) {
        mapInstance = mapElement._leaflet_map;
      } else if (mapContainer.parentElement && (mapContainer.parentElement as any)._leaflet_map) {
        mapInstance = (mapContainer.parentElement as any)._leaflet_map;
      }

      const mapRect = mapContainer.getBoundingClientRect();
      const mapWidth = Math.max(mapRect.width, 400);
      const mapHeight = Math.max(mapRect.height, 300);

      // Define margins for the enhanced map
      const topMargin = 55;
      const bottomMargin = 55;
      const leftMargin = 75;
      const rightMargin = 75;

      const totalWidth = mapWidth + leftMargin + rightMargin;
      const totalHeight = mapHeight + topMargin + bottomMargin;

      console.log(`Capturing map - Original: ${mapWidth}x${mapHeight}, Final: ${totalWidth}x${totalHeight}`);

      // COMPREHENSIVE OKLCH HANDLING
      console.log('Applying comprehensive OKLCH to RGB conversion...');

      // Prepare map for capture with force RGB conversion
      // rgbStylesheet = await prepareMapForCapture(mapContainer as HTMLElement);

      // Additional safety: Verify no OKLCH remains in critical elements
      const criticalElements = mapContainer.querySelectorAll('.leaflet-control, .leaflet-popup, .leaflet-tooltip, svg, path');
      criticalElements.forEach(element => {
        const el = element as HTMLElement;
        el.style.setProperty('color', 'rgb(238, 10, 78)', 'important');
        el.style.setProperty('fill', 'rgb(123, 235, 18)', 'important');
        el.style.setProperty('stroke', 'rgb(243, 9, 9)', 'important');
      });


      convertOklchToRgb(mapContainer as HTMLElement);

      // Capture the map with maximum compatibility settings
      // Get a blob using domToImage.toBlob instead
      const blob = await domToImage.toBlob(mapContainer, {
        bgcolor: "#ffffff",
        // scale: 3,
        width: mapWidth,
        height: mapHeight,
        quality: 1,
        cacheBust: true,
        filter: (node: { tagName: string; className: string; }) => {
          if (!(node instanceof Element)) return false;
          // Skip elements that might cause issues
          const tagName = node.tagName?.toLowerCase();
          const className = node.className || '';

          // Skip script and style elements
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return false;
          }

          // Skip elements with problematic classes
          if (className.includes && className.includes('leaflet-control-attribution')) {
            return false;
          }

          return true;
        },




        onclone: (clonedDoc: { head: { appendChild: (arg0: HTMLStyleElement) => void; }; }, element: { querySelectorAll: (arg0: string) => any; }) => {
          try {
            console.log('Processing cloned document...');

            // Apply RGB stylesheet to cloned document
            // const clonedRgbStylesheet = createRgbStylesheet();
            // clonedDoc.head.appendChild(clonedRgbStylesheet);

            // Force RGB colors on all elements in the clone
            const allElements = element.querySelectorAll('*');
            allElements.forEach((el: any) => {
              const htmlEl = el;

              // Critical overrides
              const colorProps = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
              colorProps.forEach(prop => {
                const currentValue = htmlEl.style.getPropertyValue(prop);
                if (!currentValue || currentValue.includes('oklch') || currentValue === 'transparent') {
                  let safeColor = 'rgb(128, 128, 128)';

                  if (prop === 'backgroundColor') safeColor = 'rgb(255, 255, 255)';
                  else if (prop === 'color') safeColor = 'rgb(134, 245, 8)';
                  else if (prop.includes('border')) safeColor = 'rgb(200, 200, 200)';

                  htmlEl.style.setProperty(prop, safeColor, 'important');
                }
              });

              // Handle SVG elements specifically
              if (htmlEl.tagName.toLowerCase() === 'svg' || htmlEl.tagName.toLowerCase() === 'path') {
                htmlEl.style.setProperty('fill', 'rgb(243, 25, 18)', 'important');
                htmlEl.style.setProperty('fill', 'rgb(0, 0, 0)', 'important');
                htmlEl.style.setProperty('stroke', 'rgb(188, 206, 24)', 'important');
              }
            });

            console.log('Cloned document processing complete');
          } catch (err) {
            console.warn('Error in onclone processing:', err);
          }
        }
      } as any);

      // Create a canvas from the blob
      // Create a canvas from the blob
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      const mapCanvas = document.createElement('canvas');
      const mapCtx = mapCanvas.getContext('2d');  // Changed variable name from ctx to mapCtx
      if (!mapCtx) {
        throw new Error("Failed to get 2D context from canvas.");
      }
      // Return a promise that resolves when the image is loaded
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          mapCanvas.width = img.width;
          mapCanvas.height = img.height;
          mapCtx.drawImage(img, 0, 0);  // Use mapCtx instead of ctx
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        img.onerror = reject;
        img.src = blobUrl;
      });

      // // Clean up the RGB stylesheet
      // if (rgbStylesheet) {
      //   cleanupAfterCapture(rgbStylesheet);
      //   rgbStylesheet = null;
      // }

      // Create final canvas with grid and labels
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = totalWidth;
      finalCanvas.height = totalHeight;
      const ctx = finalCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Draw border around the entire image
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(5, 5, totalWidth - 7, totalHeight - 7);

      // Draw the map in the center
      ctx.drawImage(mapCanvas, leftMargin, topMargin, mapWidth, mapHeight);

      // Draw border around the map
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftMargin, topMargin, mapWidth, mapHeight);

      // Add grid lines
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);

      const gridSpacing = Math.min(mapWidth, mapHeight) / 8;

      // Draw vertical grid lines
      for (let x = leftMargin + gridSpacing; x < leftMargin + mapWidth; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, topMargin);
        ctx.lineTo(x, topMargin + mapHeight);
        ctx.stroke();
      }

      // Draw horizontal grid lines
      for (let y = topMargin + gridSpacing; y < topMargin + mapHeight; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(leftMargin + mapWidth, y);
        ctx.stroke();
      }

      // Reset line dash for coordinates
      ctx.setLineDash([]);

      // Add coordinate labels
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px Arial, sans-serif';

      // Get real coordinates if available
      let coordinates = {
        north: 25.0,
        south: 22.0,
        east: 82.0,
        west: 79.0
      };

      if (mapInstance) {
        try {
          const bounds = mapInstance.getBounds();
          coordinates = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          };
          console.log('Using real map coordinates:', coordinates);
        } catch (error) {
          console.warn('Could not get real coordinates, using defaults');
        }
      }

      // East coordinates at bottom
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (let i = 0; i <= 4; i++) {
        const relX = i / 4;
        const x = leftMargin + mapWidth * relX;
        const y = totalHeight - bottomMargin + 10;

        const lng = coordinates.west + (coordinates.east - coordinates.west) * relX;
        const coordText = `${lng.toFixed(2)}°E`;

        // Background for label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        const textMetrics = ctx.measureText(coordText);
        const textWidth = textMetrics.width;
        ctx.fillRect(x - textWidth / 2 - 4, y - 2, textWidth + 8, 18);

        // Border for label
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - textWidth / 2 - 4, y - 2, textWidth + 8, 18);

        // Text
        ctx.fillStyle = '#000000';
        ctx.fillText(coordText, x, y + 2);

        // Draw tick mark
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, topMargin + mapHeight);
        ctx.lineTo(x, topMargin + mapHeight + 8);
        ctx.stroke();
      }

      // North coordinates on left side
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= 4; i++) {
        const relY = i / 4;
        const x = leftMargin - 10;
        const y = topMargin + mapHeight * relY;

        const lat = coordinates.north - (coordinates.north - coordinates.south) * relY;
        const coordText = `${lat.toFixed(2)}°N`;

        // Background for label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        const textMetrics = ctx.measureText(coordText);
        const textWidth = textMetrics.width;
        ctx.fillRect(x - textWidth - 4, y - 9, textWidth + 8, 18);

        // Border for label
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - textWidth - 4, y - 9, textWidth + 8, 18);

        // Text
        ctx.fillStyle = '#000000';
        ctx.fillText(coordText, x, y);

        // Draw tick mark
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(leftMargin - 8, y);
        ctx.stroke();
      }

      // Add title
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const titleText = sourceMode === 'admin'
        ? 'Administrative Area Map'
        : sourceMode === 'drain'
          ? 'Drainage Network Map'
          : 'Study Area Map';

      ctx.fillText(titleText, totalWidth / 2, 15);

      // Add north arrow
      const arrowX = totalWidth - 50;
      const arrowY = 50;

      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY - 15);
      ctx.lineTo(arrowX - 8, arrowY + 5);
      ctx.lineTo(arrowX + 8, arrowY + 5);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', arrowX, arrowY + 25);

      // Add scale information if available
      if (mapInstance) {
        try {
          const zoom = mapInstance.getZoom();
          ctx.font = '10px Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = '#666666';
          ctx.fillText(`Zoom Level: ${zoom}`, leftMargin + 10, topMargin + mapHeight - 10);
        } catch (error) {
          console.warn('Could not get zoom level');
        }
      }

      // Convert to data URL
      return new Promise<string | null>((resolve) => {
        finalCanvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          } else {
            resolve(null);
          }
        }, 'image/png', 1.0);
      });

    } catch (error) {
      console.log('Failed to capture map:', error);
      return null;
    } finally {
      // Ensure cleanup happens even if there's an error
      // if (rgbStylesheet) {
      //   cleanupAfterCapture(rgbStylesheet);
      // }
    }
  };

  const captureMapWithRetry = async (maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Map capture attempt ${i + 1}/${maxRetries}`);
        const result = await captureMap();
        if (result) {
          console.log('Map captured successfully');
          return result;
        }

        // Wait a bit before retrying
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.log(`Map capture attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) {
          console.log('All map capture attempts failed');
          return null;
        }
      }
    }
    return null;
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
        console.log("Failed to load logos:", err);
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

          // Map Capture
          const waitForMapReady = async (timeout = 3000): Promise<boolean> => {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
              const mapContainer = document.querySelector('.admin-map .leaflet-container, .drain-map .leaflet-container');
              if (mapContainer) {
                const leafletMap = (mapContainer as any)._leaflet_map;
                const mapReady = leafletMap && leafletMap._loaded;
                const customReady = (window as any).mapReady;
                const noLoadingOverlay = !document.querySelector('.animate-pulse');
                const tilesLoaded = !document.querySelector('.leaflet-tile-loaded[src=""]');
                if (mapReady && customReady && noLoadingOverlay && tilesLoaded) {
                  console.log('Map is fully ready for capture');
                  await new Promise(resolve => setTimeout(resolve, 500));
                  return true;
                }
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.warn('Map ready timeout exceeded');
            return false;
          };

          console.log('Waiting for map to be ready...');
          const mapReady = await waitForMapReady();
          if (!mapReady) {
            console.warn('Map may not be fully loaded');
          }

          const mapImage = await captureMapWithRetry();
          if (mapImage) {
            const maxMapWidth = pageWidth - 28;
            const mapAspectRatio = 1.2;
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
            addParagraph('Map not available - Please ensure the map is loaded before generating the report');
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
              console.log("Error adding village table:", error);
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
            console.log('Population results for PDF:', populationResults);

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

              console.log('Years found:', populationYears);
              console.log('Methods found:', availableMethods);

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
            console.log("Error adding population forecasting data:", error);
            addParagraph("Error occurred while processing population forecasting data.");
            yPos += 10;
          }

          //----------------------------------------------------------

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
                const waterDemandRows = waterDemandYears.map(year => [
                  year,
                  Math.round(computedPopulation[year] || 0).toLocaleString(),
                  (domesticWaterDemand[year] || 0).toFixed(2),
                  (floatingWaterDemand[year] || 0).toFixed(2),
                  (institutionalWaterDemand[year] || 0).toFixed(2),
                  (firefightingDemand.kuchling?.[year] || 0).toFixed(2),
                  (waterDemandData[year] || 0).toFixed(2)
                ]);
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
            console.log("Error adding water demand data:", error);
            yPos += 5;
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
            console.log("Error adding water supply data:", error);
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
          if (peakFlowTable && yPos > 200) {
            doc.addPage();
            yPos = 20;
          }
          if (peakFlowTable) {
            addSectionHeading("4.4.4 Peak Flow Calculation Results", 2);
            doc.setFontSize(10);
            doc.setFont('times', 'normal');
            doc.text(`Peak Flow Source: ${peakFlowSewageSource.replace('_', ' ').toUpperCase()}`, 14, yPos);
            yPos += 5;
            const selectedMethods = Object.entries(peakFlowMethods)
              .filter(([_, selected]) => selected)
              .map(([method]) => method.toUpperCase());
            doc.text(`Selected Methods: ${selectedMethods.join(', ')}`, 14, yPos);
            yPos += 8;

            const headers = ["Year", "Population", "Avg Sewage Flow (MLD)"];
            if (selectedMethods.includes('CPHEEO')) headers.push("CPHEEO Peak (MLD)");
            if (selectedMethods.includes('HARMON')) headers.push("Harmon's Peak (MLD)");
            if (selectedMethods.includes('BABBITT')) headers.push("Babbit's Peak (MLD)");

            const sewageResult = domesticLoadMethod === 'modeled' ? domesticSewageResult : (waterSupplyResult || domesticSewageResult);
            const peakRows = Object.keys(sewageResult || {}).map((year) => {
              const popVal = computedPopulation[year] || 0;
              const popBasedSewFlow = sewageResult[year] || 0;
              const drainBasedSewFlow = calculateDrainBasedSewFlow(popVal);
              const waterBasedSewFlow = calculatewaterBasedSewFlow(popVal);
              const avgSewFlow = peakFlowSewageSource === 'drain_based' && domesticLoadMethod === 'modeled' && totalDrainDischarge > 0
                ? drainBasedSewFlow
                : peakFlowSewageSource === 'water_based' && (window as any).totalWaterSupply > 0
                  ? waterBasedSewFlow
                  : popBasedSewFlow;
              const row = [
                year,
                popVal.toLocaleString(),
                avgSewFlow.toFixed(2)
              ];
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

            const lastRow = peakRows[peakRows.length - 1];
            const totalSewageVolume = lastRow ? lastRow[2] : '0.00'; // Fixed incomplete assignment

            autoTable(doc, {
              head: [headers],
              body: peakRows,
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
              } : headers.length === 5 ? {
                0: { cellWidth: 20 },
                1: { cellWidth: 35 },
                2: { cellWidth: 35 },
                3: { cellWidth: 35 },
                4: { cellWidth: 35 }
              } : {
                0: { cellWidth: 20 },
                1: { cellWidth: 30 },
                2: { cellWidth: 30 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30 },
                5: { cellWidth: 30 }
              },
              margin: { left: 14 }
            });
            yPos = (doc as any).lastAutoTable?.finalY + 10;
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
            // Store totalSewageVolume for use in Executive Summary
            (window as any).totalSewageVolume = totalSewageVolume;
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

          // 7. Results and Discussion
          addSectionHeading("5. Results and Discussion");
          addParagraph("The results of the sewage generation estimation will be discussed in this section, including spatial patterns, high-demand areas, and infrastructure recommendations. [To be expanded based on specific results and analysis.]");

          // 8. Summary and Conclusions
          if (yPos > 230) {
            doc.addPage();
            yPos = 20;
          }
          addSectionHeading("6. Summary and Conclusions");
          addParagraph("This comprehensive report presents the sewage generation analysis based on:");
          const summaryPoints = [
            `• Population-based analysis using ${Object.keys(computedPopulation).length} forecast years`,
            `• Water supply method with ${totalSupplyInput || 0} MLD total supply`,
            `• Domestic load estimation using ${domesticLoadMethod || 'selected'} method`,
            `• Drain-based analysis with ${drainItems.length} drains (${totalDrainDischarge.toFixed(2)} MLD total discharge)`,
            `• Analysis mode: ${sourceMode === 'drain' ? 'Drain-based system analysis' : 'Administrative area analysis'}`
          ];
          doc.setFontSize(12);
          doc.setFont('times', 'normal');
          summaryPoints.forEach(point => {
            const lines = doc.splitTextToSize(point, 180);
            doc.text(lines, 14, yPos);
            yPos += (lines.length * 5) + 3;
            if (yPos > doc.internal.pageSize.height - 20) {
              doc.addPage();
              yPos = 20;
            }
          });

          yPos += 10;

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

          doc.save("Comprehensive_Sewage_Generation_Report.pdf");
        } // End of try block
      } catch (error) {
        console.log("Error generating report:", error);
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
                  <label className="block text-sm font-medium text-gray-700">
                    Population:
                  </label>
                  <div className="relative group">
                    <span className="flex items-center justify-center h-5 w-5 text-sm bg-blue-600 text-white rounded-full cursor-help transition-transform hover:scale-110">i</span>
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
                            {populationBasedSewage.toFixed(2)}
                          </td>
                          {totalDrainDischarge > 0 && (
                            <td className="border-b border-gray-200 px-4 py-3 text-gray-700">
                              {drainBasedSewage.toFixed(2)}
                            </td>
                          )}
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
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(domesticSewageResult).map(([year, value], index) => {
                    const forecastData = (window as any).selectedPopulationForecast;
                    const domesticPop = forecastData[year] ?? "";
                    const drainsSewage = calculateDrainBasedSewFlow(domesticPop);
                    const waterSewage = calculatewaterBasedSewFlow(domesticPop);
                    return (
                      <tr
                        key={year}
                        className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                      >
                        <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{year}</td>
                        <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{domesticPop.toLocaleString()}</td>
                        {((window as any).totalWaterSupply > 0 || Number(totalSupplyInput) > 0) && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">
                            {Number(waterSewage) > 0 ? Number(waterSewage).toFixed(2) : "0.000000"}
                          </td>
                        )}

                        <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{Number(value).toFixed(2)}</td>
                        {domesticLoadMethod === 'modeled' && totalDrainDischarge > 0 && (
                          <td className="border-b border-gray-200 px-4 py-3 text-gray-700">{drainsSewage > 0 ? drainsSewage.toFixed(2) : "0.000000"}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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


