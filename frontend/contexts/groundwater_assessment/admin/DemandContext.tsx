"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from './LocationContext';
import { useWell } from './WellContext';

interface TableData {
  [key: string]: string | number;
}

interface CropData {
  [season: string]: string[];
}

export interface IndustrialSubtype {
  industry: string;
  subtype: string;
  unit: 'MW' | 'm³/tonne of product';
  consumptionValue: number;
  production: number;
}

const initialIndustrialData: IndustrialSubtype[] = [
  { industry: 'Thermal Power Plants', subtype: 'Small (<1000 MW)', unit: 'm³/tonne of product', consumptionValue: 3.1, production: 0 },
  { industry: 'Thermal Power Plants', subtype: 'Medium (1000–2500 MW)', unit: 'm³/tonne of product', consumptionValue: 4.2, production: 0 },
  { industry: 'Thermal Power Plants', subtype: 'Large (>2500 MW)', unit: 'm³/tonne of product', consumptionValue: 3.1, production: 0 },
  { industry: 'Pulp & Paper', subtype: 'Integrated Mills', unit: 'm³/tonne of product', consumptionValue: 31.8, production: 0 },
  { industry: 'Pulp & Paper', subtype: 'RCF-based Mills', unit: 'm³/tonne of product', consumptionValue: 11.5, production: 0 },
  { industry: 'Textiles', subtype: 'Integrated (Cotton)', unit: 'm³/tonne of product', consumptionValue: 224, production: 0 },
  { industry: 'Textiles', subtype: 'Fabric Processing', unit: 'm³/tonne of product', consumptionValue: 75, production: 0 },
  { industry: 'Iron & Steel', subtype: 'Integrated (Woollen)', unit: 'm³/tonne of product', consumptionValue: 237, production: 0 },
  { industry: 'Iron & Steel', subtype: 'General', unit: 'm³/tonne of product', consumptionValue: 6.5, production: 0 },
];

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
  domesticChecked: boolean;
  agriculturalChecked: boolean;
  industrialChecked: boolean;
  perCapitaConsumption: number;
  kharifChecked: boolean;
  rabiChecked: boolean;
  zaidChecked: boolean;
  availableCrops: CropData;
  selectedCrops: { [season: string]: string[] };
  cropsLoading: { [season: string]: boolean };
  cropsError: { [season: string]: string | null };
  groundwaterFactor: number;
  industrialData: IndustrialSubtype[];
  industrialGWShare: number;
  chartData: ChartData | null;
  chartsError: string | null;
  domesticTableData: TableData[];
  agriculturalTableData: TableData[];
  industrialTableData: TableData[];
  combinedDemandData: TableData[];
  domesticLoading: boolean;
  agriculturalLoading: boolean;
  industrialLoading: boolean;
  domesticError: string | null;
  agriculturalError: string | null;
  industrialError: string | null;
  setDomesticChecked: (checked: boolean) => void;
  setAgriculturalChecked: (checked: boolean) => void;
  setIndustrialChecked: (checked: boolean) => void;
  setPerCapitaConsumption: (value: number) => void;
  setGroundwaterFactor: (value: number) => void;
  setIndustrialData: (data: IndustrialSubtype[]) => void;
  setIndustrialGWShare: (value: number) => void;
  updateIndustrialProduction: (industry: string, subtype: string, production: number) => void;
  updateIndustrialConsumption: (industry: string, subtype: string, consumption: number) => void;

  setKharifChecked: (checked: boolean) => void;
  setRabiChecked: (checked: boolean) => void;
  setZaidChecked: (checked: boolean) => void;
  fetchCropsForSeason: (season: string) => Promise<void>;
  toggleCropSelection: (season: string, crop: string) => void;
  clearChartData: () => void;
  computeDomesticDemand: () => Promise<void>;
  computeAgriculturalDemand: () => Promise<void>;
  computeIndustrialDemand: () => Promise<void>;
  canComputeDomesticDemand: () => boolean;
  canComputeAgriculturalDemand: () => boolean;
  canComputeIndustrialDemand: () => boolean;
}

export const DemandContext = createContext<DemandContextType | undefined>(undefined);

interface DemandProviderProps {
  children: React.ReactNode;
}

export const DemandProvider: React.FC<DemandProviderProps> = ({ children }) => {
  const [domesticChecked, setDomesticCheckedState] = useState<boolean>(false);
  const [agriculturalChecked, setAgriculturalCheckedState] = useState<boolean>(false);
  const [industrialChecked, setIndustrialCheckedState] = useState<boolean>(false);
  const [perCapitaConsumption, setPerCapitaConsumption] = useState<number>(60);
  const [kharifChecked, setKharifChecked] = useState<boolean>(false);
  const [rabiChecked, setRabiChecked] = useState<boolean>(false);
  const [zaidChecked, setZaidChecked] = useState<boolean>(false);
  const [availableCrops, setAvailableCrops] = useState<CropData>({});
  const [selectedCrops, setSelectedCrops] = useState<{ [season: string]: string[] }>({});
  const [cropsLoading, setCropsLoading] = useState<{ [season: string]: boolean }>({});
  const [cropsError, setCropsError] = useState<{ [season: string]: string | null }>({});
  const [groundwaterFactor, setGroundwaterFactor] = useState<number>(0.8);
  const [industrialData, setIndustrialData] = useState<IndustrialSubtype[]>(initialIndustrialData);
  const [industrialGWShare, setIndustrialGWShare] = useState<number>(0.5);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartsError, setChartsError] = useState<string | null>(null);
  const [domesticTableData, setDomesticTableData] = useState<TableData[]>([]);
  const [agriculturalTableData, setAgriculturalTableData] = useState<TableData[]>([]);
  const [industrialTableData, setIndustrialTableData] = useState<TableData[]>([]);
  const [combinedDemandData, setCombinedDemandData] = useState<TableData[]>([]);
  const [domesticLoading, setDomesticLoading] = useState<boolean>(false);
  const [agriculturalLoading, setAgriculturalLoading] = useState<boolean>(false);
  const [industrialLoading, setIndustrialLoading] = useState<boolean>(false);
  const [domesticError, setDomesticError] = useState<string | null>(null);
  const [agriculturalError, setAgriculturalError] = useState<string | null>(null);
  const [industrialError, setIndustrialError] = useState<string | null>(null);

  const { selectedSubDistricts } = useLocation();
  const { csvFilename } = useWell();


  const setDomesticChecked = (checked: boolean) => {
    setDomesticCheckedState(checked);
    if (!checked) {
      setDomesticTableData([]);
      setDomesticError(null);
      console.log('🗑️ Domestic demand data cleared (unchecked)');
    }
  };

  const setAgriculturalChecked = (checked: boolean) => {
    setAgriculturalCheckedState(checked);
    if (!checked) {
      setAgriculturalTableData([]);
      setAgriculturalError(null);
      clearChartData();
      console.log('🗑️ Agricultural demand data cleared (unchecked)');
    }
  };

  const setIndustrialChecked = (checked: boolean) => {
    setIndustrialCheckedState(checked);
    if (!checked) {
      setIndustrialTableData([]);
      setIndustrialError(null);
      console.log('🗑️ Industrial demand data cleared (unchecked)');
    }
  };
  // Update production for a specific sub-type
  const updateIndustrialProduction = (industry: string, subtype: string, production: number) => {
    setIndustrialData(prevData =>
      prevData.map(item =>
        item.industry === industry && item.subtype === subtype
          ? { ...item, production: isNaN(production) || production < 0 ? 0 : production }
          : item
      )
    );
  };
// Add this function inside DemandProvider (next to updateIndustrialProduction)
const updateIndustrialConsumption = (industry: string, subtype: string, newConsumption: number) => {
  setIndustrialData(prev =>
    prev.map(item =>
      item.industry === industry && item.subtype === subtype
        ? { ...item, consumptionValue: isNaN(newConsumption) || newConsumption < 0 ? 0 : newConsumption }
        : item
    )
  );
};
  const clearChartData = () => {
    setChartData(null);
    setChartsError(null);
  };

  // Generate combined demand data based on village_code
  const generateCombinedDemandData = () => {
    const villageMap = new Map<string | number, any>();

    // Add domestic data
    domesticTableData.forEach(row => {
      const villageCode = row.village_code || row.Village_code;
      if (!villageCode) return; // Skip if no village code

      const villageName = row.village_name || 'Unknown';
      if (!villageMap.has(villageCode)) {
        villageMap.set(villageCode, {
          village_code: villageCode,
          village_name: villageName,
          domestic_demand: 0,
          agricultural_demand: 0,
          industrial_demand: 0,
        });
      }
      const village = villageMap.get(villageCode);
      if (village) {
        village.domestic_demand = row.demand_mld || 0;
        // Update village name if it was 'Unknown' before
        if (village.village_name === 'Unknown' && villageName !== 'Unknown') {
          village.village_name = villageName;
        }
      }
    });

    // Add agricultural data
    agriculturalTableData.forEach(row => {
      const villageCode = row.village_code || row.Village_code;
      if (!villageCode) return; // Skip if no village code

      const villageName = row.village || row.village_name || 'Unknown';
      if (!villageMap.has(villageCode)) {
        villageMap.set(villageCode, {
          village_code: villageCode,
          village_name: villageName,
          domestic_demand: 0,
          agricultural_demand: 0,
          industrial_demand: 0,
        });
      }
      const village = villageMap.get(villageCode);
      if (village) {
        village.agricultural_demand = row.village_demand || 0;
        // Update village name if it was 'Unknown' before
        if (village.village_name === 'Unknown' && villageName !== 'Unknown') {
          village.village_name = villageName;
        }
      }
    });

    // Add industrial data
    industrialTableData.forEach(row => {
      const villageCode = row.village_code || row.Village_code;
      if (!villageCode) return; // Skip if no village code

      const villageName = row.Village_name || row.village_name || 'Unknown';
      if (!villageMap.has(villageCode)) {
        villageMap.set(villageCode, {
          village_code: villageCode,
          village_name: villageName,
          domestic_demand: 0,
          agricultural_demand: 0,
          industrial_demand: 0,
        });
      }
      const village = villageMap.get(villageCode);
      if (village) {
        village.industrial_demand = row['Industrial_demand_(Million litres/Year)'] || 0;
        // Update village name if it was 'Unknown' before
        if (village.village_name === 'Unknown' && villageName !== 'Unknown') {
          village.village_name = villageName;
        }
      }
    });

    // Calculate totals
    const combined = Array.from(villageMap.values()).map(village => ({
      ...village,
      total_demand: Number(village.domestic_demand) + Number(village.agricultural_demand) + Number(village.industrial_demand),
    }));

    setCombinedDemandData(combined);
    console.log('✅ Combined demand data generated:', combined.length, 'villages');
    console.log('📋 Sample combined data:', combined.slice(0, 3));
  };

  // Regenerate combined data when any demand changes
  useEffect(() => {
    if (domesticTableData.length > 0 || agriculturalTableData.length > 0 || industrialTableData.length > 0) {
      generateCombinedDemandData();
    } else {
      setCombinedDemandData([]);
    }
  }, [domesticTableData, agriculturalTableData, industrialTableData]);

  // Fetch crops when seasons are checked
  useEffect(() => {
    if (kharifChecked && !availableCrops.Kharif) {
      fetchCropsForSeason('Kharif');
    }
  }, [kharifChecked]);

  useEffect(() => {
    if (rabiChecked && !availableCrops.Rabi) {
      fetchCropsForSeason('Rabi');
    }
  }, [rabiChecked]);

  useEffect(() => {
    if (zaidChecked && !availableCrops.Zaid) {
      fetchCropsForSeason('Zaid');
    }
  }, [zaidChecked]);

  const fetchCropsForSeason = async (season: string) => {
    try {
      setCropsLoading(prev => ({ ...prev, [season]: true }));
      setCropsError(prev => ({ ...prev, [season]: null }));

      const response = await fetch('/fastm/gwa/crops', {
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

      const requestPayload = {
        subdistrict_code: selectedSubDistricts,
        csv_filename: csvFilename,
        lpcd: perCapitaConsumption,
      };

      console.log('Computing domestic demand via forecast-population with payload:', requestPayload);

      const response = await fetch('/fastm/gwa/forecast-population', {
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
      clearChartData();

      if (!agriculturalChecked) {
        throw new Error('Please select agricultural demand type.');
      }

      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }

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
        include_charts: true
      };

      console.log('Computing agricultural demand with payload:', requestPayload);

      const response = await fetch('/fastm/gwa/agricultural', {
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

      if (result.data && Array.isArray(result.data)) {
        setAgriculturalTableData(result.data);
      } else {
        throw new Error('Invalid response format from server');
      }

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
      clearChartData();
    } finally {
      setAgriculturalLoading(false);
    }
  };

  const computeIndustrialDemand = async () => {
    try {
      setIndustrialLoading(true);
      setIndustrialError(null);

      if (!industrialChecked) {
        throw new Error('Please select industrial demand type.');
      }

      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }

      if (!csvFilename) {
        throw new Error('CSV filename is required. Please upload/confirm wells CSV first.');
      }

      const totalAnnualDemand = industrialData.reduce((sum, item) => {
        return sum + (item.production * item.consumptionValue);
      }, 0);

      const groundwaterIndustrialDemand = totalAnnualDemand * industrialGWShare;

      if (totalAnnualDemand === 0) {
        throw new Error('Total Annual Industrial Production is zero. Please enter production values.');
      }

      const requestPayload = {
        csv_filename: csvFilename,
        groundwater_industrial_demand: groundwaterIndustrialDemand,
        subdistrict_codes: selectedSubDistricts,
      };

      console.log('Computing industrial demand with payload:', requestPayload);

      const response = await fetch('/fastm/gwa/industrial', {
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

      if (result.data && Array.isArray(result.data)) {
        setIndustrialTableData(result.data);
      } else if (result.forecasts && Array.isArray(result.forecasts)) {
        setIndustrialTableData(result.forecasts);
      } else {
        setIndustrialTableData([{
          Total_Input_Demand: totalAnnualDemand.toFixed(2),
          GW_Share: `${(industrialGWShare * 100).toFixed(0)}%`,
          GW_Demand_Sent: groundwaterIndustrialDemand.toFixed(2),
          Status: result.status || 'success',
          Message: result.message || 'Computation completed'
        }]);
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
    domesticChecked,
    agriculturalChecked,
    industrialChecked,
    perCapitaConsumption,
    kharifChecked,
    rabiChecked,
    zaidChecked,
    availableCrops,
    selectedCrops,
    cropsLoading,
    cropsError,
    groundwaterFactor,
    industrialData,
    industrialGWShare,
    chartData,
    chartsError,
    domesticTableData,
    agriculturalTableData,
    industrialTableData,
    combinedDemandData,
    domesticLoading,
    agriculturalLoading,
    industrialLoading,
    domesticError,
    agriculturalError,
    industrialError,
    setDomesticChecked,
    setAgriculturalChecked,
    setIndustrialChecked,
    setPerCapitaConsumption,
    setGroundwaterFactor,
    setIndustrialData,
    setIndustrialGWShare,
    updateIndustrialProduction,
    updateIndustrialConsumption,
    setKharifChecked,
    setRabiChecked,
    setZaidChecked,
    fetchCropsForSeason,
    toggleCropSelection,
    clearChartData,
    computeDomesticDemand,
    computeAgriculturalDemand,
    computeIndustrialDemand,
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