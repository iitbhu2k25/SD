"use client";

import React, { createContext, useContext, useState } from 'react';
import { useLocation } from './LocationContext';
import { useWell } from './WellContext';

interface TableData {
  [key: string]: string | number;
}

interface CropData {
  [season: string]: string[]; // season -> array of crop names
}

// Updated interface for chart data - structured JSON data instead of images
interface ChartData {
  individual_crops: {
    type: "scatter";
    title: string;
    x_label: string;
    y_label: string;
    months: string[];
    crops_data: { [crop: string]: number[] };
  };
  cumulative_demand: {
    type: "line_area";
    title: string;
    x_label: string;
    y_label: string;
    months: string[];
    values: number[];
  };
  summary_stats: {
    total_villages: number;
    total_demand_cubic_meters: number;
    average_demand_per_village: number;
  };
}

interface DemandContextType {
  // Form State
  domesticChecked: boolean;
  agriculturalChecked: boolean;
  industrialChecked: boolean;
  perCapitaConsumption: number;

  // Agricultural Season & Crop State
  kharifChecked: boolean;
  rabiChecked: boolean;
  zaidChecked: boolean;
  availableCrops: CropData;
  selectedCrops: { [season: string]: string[] };
  cropsLoading: { [season: string]: boolean };
  cropsError: { [season: string]: string | null };
  
  // Groundwater Factor
  groundwaterFactor: number;
  
  // Charts State - now includes structured chart data
  chartData: ChartData | null;
  chartsError: string | null;

  // Data State - separate for each demand type
  domesticTableData: TableData[];
  agriculturalTableData: TableData[];
  industrialTableData: TableData[];

  // Loading and Error State - separate for each demand type
  domesticLoading: boolean;
  agriculturalLoading: boolean;
  industrialLoading: boolean;
  domesticError: string | null;
  agriculturalError: string | null;
  industrialError: string | null;

  // Actions
  setDomesticChecked: (checked: boolean) => void;
  setAgriculturalChecked: (checked: boolean) => void;
  setIndustrialChecked: (checked: boolean) => void;
  setPerCapitaConsumption: (value: number) => void;
  setGroundwaterFactor: (value: number) => void;
  
  // Season Actions
  setKharifChecked: (checked: boolean) => void;
  setRabiChecked: (checked: boolean) => void;
  setZaidChecked: (checked: boolean) => void;
  
  // Crop Actions
  fetchCropsForSeason: (season: string) => Promise<void>;
  toggleCropSelection: (season: string, crop: string) => void;
  
  // Charts Actions
  clearChartData: () => void;
  
  computeDomesticDemand: () => Promise<void>;
  computeAgriculturalDemand: () => Promise<void>;
  computeIndustrialDemand: () => Promise<void>;

  // Helper functions
  canComputeDomesticDemand: () => boolean;
  canComputeAgriculturalDemand: () => boolean;
  canComputeIndustrialDemand: () => boolean;
}

export const DemandContext = createContext<DemandContextType | undefined>(undefined);

interface DemandProviderProps {
  children: React.ReactNode;
}

export const DemandProvider: React.FC<DemandProviderProps> = ({ children }) => {
  // Form State
  const [domesticChecked, setDomesticChecked] = useState<boolean>(false);
  const [agriculturalChecked, setAgriculturalChecked] = useState<boolean>(false);
  const [industrialChecked, setIndustrialChecked] = useState<boolean>(false);
  const [perCapitaConsumption, setPerCapitaConsumption] = useState<number>(60);

  // Agricultural Season & Crop State
  const [kharifChecked, setKharifChecked] = useState<boolean>(false);
  const [rabiChecked, setRabiChecked] = useState<boolean>(false);
  const [zaidChecked, setZaidChecked] = useState<boolean>(false);
  const [availableCrops, setAvailableCrops] = useState<CropData>({});
  const [selectedCrops, setSelectedCrops] = useState<{ [season: string]: string[] }>({});
  const [cropsLoading, setCropsLoading] = useState<{ [season: string]: boolean }>({});
  const [cropsError, setCropsError] = useState<{ [season: string]: string | null }>({});
  
  // Groundwater Factor
  const [groundwaterFactor, setGroundwaterFactor] = useState<number>(0.8);
  
  // Charts State - supports structured chart data
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartsError, setChartsError] = useState<string | null>(null);

  // Data State - separate for each demand type
  const [domesticTableData, setDomesticTableData] = useState<TableData[]>([]);
  const [agriculturalTableData, setAgriculturalTableData] = useState<TableData[]>([]);
  const [industrialTableData, setIndustrialTableData] = useState<TableData[]>([]);

  // Loading and Error State - separate for each demand type
  const [domesticLoading, setDomesticLoading] = useState<boolean>(false);
  const [agriculturalLoading, setAgriculturalLoading] = useState<boolean>(false);
  const [industrialLoading, setIndustrialLoading] = useState<boolean>(false);
  const [domesticError, setDomesticError] = useState<string | null>(null);
  const [agriculturalError, setAgriculturalError] = useState<string | null>(null);
  const [industrialError, setIndustrialError] = useState<string | null>(null);

  // Context dependencies
  const { selectedSubDistricts } = useLocation();
  const { csvFilename } = useWell();

  // Clear chart data helper
  const clearChartData = () => {
    setChartData(null);
    setChartsError(null);
  };

  // Season checkbox handlers
  const handleKharifChecked = async (checked: boolean) => {
    setKharifChecked(checked);
    if (checked) {
      await fetchCropsForSeason('Kharif');
    }
  };

  const handleRabiChecked = async (checked: boolean) => {
    setRabiChecked(checked);
    if (checked) {
      await fetchCropsForSeason('Rabi');
    }
  };

  const handleZaidChecked = async (checked: boolean) => {
    setZaidChecked(checked);
    if (checked) {
      await fetchCropsForSeason('Zaid');
    }
  };

  // Fetch crops for a specific season
  const fetchCropsForSeason = async (season: string) => {
    try {
      setCropsLoading(prev => ({ ...prev, [season]: true }));
      setCropsError(prev => ({ ...prev, [season]: null }));

      const response = await fetch('/django/gwa/crops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ season }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`${season} crops fetched:`, result);

      if (result.success && result.data && result.data.crops && Array.isArray(result.data.crops)) {
        setAvailableCrops(prev => ({
          ...prev,
          [season]: result.data.crops
        }));
        
        if (!selectedCrops[season]) {
          setSelectedCrops(prev => ({
            ...prev,
            [season]: []
          }));
        }
      } else {
        throw new Error(`Invalid response format for ${season} crops`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.log(`Error fetching ${season} crops:`, errorMessage);
      setCropsError(prev => ({ ...prev, [season]: errorMessage }));
    } finally {
      setCropsLoading(prev => ({ ...prev, [season]: false }));
    }
  };

  // Toggle crop selection
  const toggleCropSelection = (season: string, crop: string) => {
    setSelectedCrops(prev => {
      const currentSeasonCrops = prev[season] || [];
      const isSelected = currentSeasonCrops.includes(crop);
      
      return {
        ...prev,
        [season]: isSelected 
          ? currentSeasonCrops.filter(c => c !== crop)
          : [...currentSeasonCrops, crop]
      };
    });
  };

  // Check if compute demand can be performed for each type
  const canComputeDomesticDemand = (): boolean => {
    return !!(domesticChecked && selectedSubDistricts.length > 0 && perCapitaConsumption > 0 && csvFilename);
  };

  const canComputeAgriculturalDemand = (): boolean => {
    return !!(agriculturalChecked && selectedSubDistricts.length > 0);
  };

  const canComputeIndustrialDemand = (): boolean => {
    return !!(industrialChecked && selectedSubDistricts.length > 0);
  };

  const computeDomesticDemand = async () => {
    try {
      setDomesticLoading(true);
      setDomesticError(null);

      // Validation
      if (!domesticChecked) {
        throw new Error('Please select domestic demand type.');
      }
      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }
      if (perCapitaConsumption <= 0) {
        throw new Error('Per capita consumption must be greater than 0.');
      }
      if (!csvFilename) {
        throw new Error('Population forecast CSV is required. Please upload/confirm wells CSV first.');
      }

      // Prepare request payload for forecast API
      const requestPayload = {
        subdistrict_code: selectedSubDistricts,
        csv_filename: csvFilename,
        lpcd: perCapitaConsumption,
      };

      console.log('Computing domestic demand via forecast-population with payload:', requestPayload);

      // API call to compute domestic demand via forecast-population
      const response = await fetch('/django/gwa/forecast-population', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Domestic demand computation result:', result);

      // Set the table data from API response
      if (result.forecasts && Array.isArray(result.forecasts)) {
        setDomesticTableData(result.forecasts);
      } else {
        throw new Error('Invalid response format from server: forecasts not found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.log('Error computing domestic demand:', errorMessage);
      setDomesticError(errorMessage);
      setDomesticTableData([]);
    } finally {
      setDomesticLoading(false);
    }
  };

  const computeAgriculturalDemand = async () => {
    try {
      setAgriculturalLoading(true);
      setAgriculturalError(null);
      
      // Clear previous chart data
      clearChartData();

      // Validation
      if (!agriculturalChecked) {
        throw new Error('Please select agricultural demand type.');
      }

      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }

      // Prepare request payload - Always include charts
      const requestPayload = {
        subdistrict_code: selectedSubDistricts,
        selectedCrops: selectedCrops,
        groundwaterFactor: groundwaterFactor,
        irrigationIntensity: 0.8,
        seasons: {
          kharif: kharifChecked,
          rabi: rabiChecked,
          zaid: zaidChecked
        },
        include_charts: true  // Always include charts
      };

      console.log('Computing agricultural demand with payload:', requestPayload);

      // API call to compute agricultural demand
      const response = await fetch('/django/gwa/agricultural', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Agricultural demand computation result:', result);

      // Set the table data from API response
      if (result.data && Array.isArray(result.data)) {
        setAgriculturalTableData(result.data);
      } else {
        throw new Error('Invalid response format from server');
      }

      // Handle chart data - now supports structured JSON data
      if (result.charts) {
        if (result.charts_error) {
          setChartsError(result.charts_error);
          console.warn('Chart generation error:', result.charts_error);
        } else {
          setChartData(result.charts);
          console.log('Charts data received:', {
            hasIndividualChart: !!result.charts.individual_crops,
            hasCumulativeChart: !!result.charts.cumulative_demand,
            summary: result.charts.summary_stats
          });
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.log('Error computing agricultural demand:', errorMessage);
      setAgriculturalError(errorMessage);
      setAgriculturalTableData([]);
      clearChartData(); // Clear charts on error
    } finally {
      setAgriculturalLoading(false);
    }
  };

  const computeIndustrialDemand = async () => {
    try {
      setIndustrialLoading(true);
      setIndustrialError(null);

      // Validation
      if (!industrialChecked) {
        throw new Error('Please select industrial demand type.');
      }

      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }

      // Prepare request payload
      const requestPayload = {
        selectedSubDistricts: selectedSubDistricts,
      };

      console.log('Computing industrial demand with payload:', requestPayload);

      // API call to compute industrial demand
      const response = await fetch('/django/gwa/compute-industrial-demand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Industrial demand computation result:', result);

      // Set the table data from API response
      if (result.data && Array.isArray(result.data)) {
        setIndustrialTableData(result.data);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.log('Error computing industrial demand:', errorMessage);
      setIndustrialError(errorMessage);
      setIndustrialTableData([]);
    } finally {
      setIndustrialLoading(false);
    }
  };

  const value: DemandContextType = {
    // Form State
    domesticChecked,
    agriculturalChecked,
    industrialChecked,
    perCapitaConsumption,

    // Agricultural Season & Crop State
    kharifChecked,
    rabiChecked,
    zaidChecked,
    availableCrops,
    selectedCrops,
    cropsLoading,
    cropsError,
    
    // Groundwater Factor
    groundwaterFactor,
    
    // Charts State
    chartData,
    chartsError,

    // Data State - separate for each demand type
    domesticTableData,
    agriculturalTableData,
    industrialTableData,

    // Loading and Error State - separate for each demand type
    domesticLoading,
    agriculturalLoading,
    industrialLoading,
    domesticError,
    agriculturalError,
    industrialError,

    // Actions
    setDomesticChecked,
    setAgriculturalChecked,
    setIndustrialChecked,
    setPerCapitaConsumption,
    setGroundwaterFactor,
    
    // Season Actions
    setKharifChecked: handleKharifChecked,
    setRabiChecked: handleRabiChecked,
    setZaidChecked: handleZaidChecked,
    
    // Crop Actions
    fetchCropsForSeason,
    toggleCropSelection,

    // Charts Actions
    clearChartData,

    computeDomesticDemand,
    computeAgriculturalDemand,
    computeIndustrialDemand,

    // Helper functions
    canComputeDomesticDemand,
    canComputeAgriculturalDemand,
    canComputeIndustrialDemand,
  };

  return (
    <DemandContext.Provider value={value}>
      {children}
    </DemandContext.Provider>
  );
};

export const useDemand = (): DemandContextType => {
  const context = useContext(DemandContext);
  if (context === undefined) {
    throw new Error('useDemand must be used within a DemandProvider');
  }
  return context;
};
