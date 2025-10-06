"use client";

import React, { createContext, useContext, useState } from 'react';
import { useLocation } from './LocationContext';
import { useDemand } from './DemandContext';
import { useRecharge } from './RechargeContext';
import { GroundwaterTrendContext } from './TrendContext';
import { useMap } from '@/contexts/groundwater_assessment/drain/MapContext';

interface GSRData {
  village_code: string;
  village_name: string;
  subdistrict_code: string;
  recharge: number;
  domestic_demand: number;
  agricultural_demand: number;
  total_demand: number;
  gsr: number | null;
  gsr_status: string;
  trend_status: string;
  gsr_classification: string;
  classification_color: string;
  has_recharge_data: boolean;
  has_domestic_data: boolean;
  has_agricultural_data: boolean;
  has_trend_data: boolean;
}

interface StressData {
  [key: string]: string | number;
}

interface MergeStatistics {
  total_shapefile_villages: number;
  total_gsr_villages: number;
  villages_with_geospatial_data: number;
  villages_without_geospatial_data: number;
  match_success_rate: number;
  error?: string;
}

interface GSRSummary {
  total_villages: number;
  total_recharge: number;
  total_domestic_demand: number;
  total_agricultural_demand: number;
  total_demand: number;
  overall_gsr: number | null;
  average_gsr: number;
  sustainable_villages: number;
  stressed_villages: number;
  no_demand_villages: number;
  sustainability_percentage: number;
  villages_with_trend_data: number;
  trend_distribution: Record<string, number>;
  classification_distribution: Record<string, number>;
}

interface GSRContextType {
  // GSR State
  gsrTableData: GSRData[];
  gsrLoading: boolean;
  gsrError: string | null;
  gsrSummary: GSRSummary | null;

  // Stress Identification State
  stressTableData: StressData[];
  stressLoading: boolean;
  stressError: string | null;

  // GeoJSON State
  gsrGeojsonData: any | null;
  mergeStatistics: MergeStatistics | null;

  // Map Image State
  mapImageFilename: string | null;
  mapImageBase64: string | null;

  // Actions
  computeGSR: () => Promise<void>;
  canComputeGSR: () => boolean;

  // Stress Identification Actions
  computeStressIdentification: (yearsCount: number) => Promise<StressData[]>;
  canComputeStressIdentification: () => boolean;

  // Helper methods
  clearGSRData: () => void;
  clearStressData: () => void;
  getMapImageUrl: () => string | null;
}

export const GSRContext = createContext<GSRContextType | undefined>(undefined);

interface GSRProviderProps {
  children: React.ReactNode;
}

export const GSRProvider: React.FC<GSRProviderProps> = ({ children }) => {
  // GSR State
  const [gsrTableData, setGSRTableData] = useState<GSRData[]>([]);
  const [gsrLoading, setGSRLoading] = useState<boolean>(false);
  const [gsrError, setGSRError] = useState<string | null>(null);
  const [gsrSummary, setGSRSummary] = useState<GSRSummary | null>(null);

  // Stress Identification State
  const [stressTableData, setStressTableData] = useState<StressData[]>([]);
  const [stressLoading, setStressLoading] = useState<boolean>(false);
  const [stressError, setStressError] = useState<string | null>(null);

  // GeoJSON State
  const [gsrGeojsonData, setGSRGeojsonData] = useState<any | null>(null);
  const [mergeStatistics, setMergeStatistics] = useState<MergeStatistics | null>(null);

  // Map Image State
  const [mapImageFilename, setMapImageFilename] = useState<string | null>(null);
  const [mapImageBase64, setMapImageBase64] = useState<string | null>(null);

  // Context dependencies
  const { selectedVillages } = useLocation();
  const {
    domesticTableData,
    agriculturalTableData,
    domesticChecked,
    agriculturalChecked
  } = useDemand();
  const { tableData: rechargeTableData } = useRecharge();
  const { trendData } = useContext(GroundwaterTrendContext);
  const { addGsrLayer, removeGsrLayer } = useMap();

  // Get map image URL helper
  const getMapImageUrl = (): string | null => {
    if (!mapImageFilename) return null;
    return `/django/media/temp/${mapImageFilename}`;
  };

  // Clear all GSR data
  const clearGSRData = () => {
    setGSRTableData([]);
    setGSRGeojsonData(null);
    setMergeStatistics(null);
    setMapImageFilename(null);
    setMapImageBase64(null);
    setGSRSummary(null);
    setGSRError(null);
    removeGsrLayer();
  };

  // Clear stress data
  const clearStressData = () => {
    setStressTableData([]);
    setStressError(null);
  };

  // Check if GSR computation can be performed
  const canComputeGSR = (): boolean => {
    return !!(
      selectedVillages.length > 0 &&
      rechargeTableData.length > 0 &&
      ((domesticChecked && domesticTableData.length > 0) ||
        (agriculturalChecked && agriculturalTableData.length > 0))
    );
  };

  // Check if Stress Identification can be performed
  const canComputeStressIdentification = (): boolean => {
    return gsrTableData.length > 0;
  };

  // Compute GSR function - CORRECTED to match API structure
  const computeGSR = async () => {
    try {
      setGSRLoading(true);
      setGSRError(null);

      // Validation
      if (selectedVillages.length === 0) {
        throw new Error('Village selection is required. Please select villages first.');
      }

      if (rechargeTableData.length === 0) {
        throw new Error('Recharge data is required. Please compute recharge first.');
      }

      if (domesticTableData.length === 0 && agriculturalTableData.length === 0) {
        throw new Error('No demand data available. Please compute domestic or agricultural demand first.');
      }

      // Get trend CSV filename from trend context
      const trendCsvFilename = trendData?.summary_stats?.file_info?.trend_csv_filename || null;

      if (trendCsvFilename) {
        console.log('🎯 Using Trend CSV in GSR computation:', trendCsvFilename);
      } else {
        console.log('⚠️ No trend CSV available for GSR computation');
      }

      // CORRECTED: Prepare request payload to match API expectations
      const requestPayload = {
        rechargeData: rechargeTableData,        // API expects 'rechargeData'
        domesticData: domesticTableData,        // API expects 'domesticData'
        agriculturalData: agriculturalTableData, // API expects 'agriculturalData'
        selectedSubDistricts: selectedVillages, // API expects 'selectedSubDistricts' (even for villages)
        trendCsvFilename: trendCsvFilename,     // API expects 'trendCsvFilename'
        hasDomesticDemand: domesticChecked && domesticTableData.length > 0,
        hasAgriculturalDemand: agriculturalChecked && agriculturalTableData.length > 0,
        hasRechargeData: rechargeTableData.length > 0
      };

      console.log('Computing GSR with payload:', requestPayload);

      // API call to compute GSR
      const response = await fetch('/django/gwa/gsr', {
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
      console.log('GSR computation result:', result);

      // CORRECTED: Extract table data from API response
      if (result.success && result.data && Array.isArray(result.data)) {
        setGSRTableData(result.data);
        console.log(`✅ GSR Table Data set: ${result.data.length} villages`);
      } else {
        throw new Error('Invalid response format from server - missing data array');
      }

      // CORRECTED: Extract summary data
      if (result.summary) {
        setGSRSummary(result.summary);
        console.log('✅ GSR Summary set:', result.summary);
      }

      // CORRECTED: Extract and set GeoJSON data
      if (result.geospatial_data) {
        try {
          addGsrLayer(result.geospatial_data);
          setGSRGeojsonData(result.geospatial_data);
          console.log('✅ GSR GeoJSON data set and layer added to map');
        } catch (e) {
          console.log('Failed to add GSR layer to map:', e);
        }
      } else {
        removeGsrLayer();
        setGSRGeojsonData(null);
        console.log('⚠️ No GeoJSON data received');
      }

      // CORRECTED: Set merge statistics
      if (result.merge_statistics) {
        setMergeStatistics(result.merge_statistics);
        console.log('📊 Merge statistics:', result.merge_statistics);
      }

      // CORRECTED: Handle map image data
      if (result.map_image_filename) {
        setMapImageFilename(result.map_image_filename);
        console.log('📍 GSR map image filename:', result.map_image_filename);
      }

      if (result.map_image_base64) {
        setMapImageBase64(result.map_image_base64);
        console.log('🖼️ GSR map image base64 data received');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.log('Error computing GSR:', errorMessage);
      setGSRError(errorMessage);

      // Clear data on error
      setGSRTableData([]);
      setGSRGeojsonData(null);
      setMergeStatistics(null);
      setMapImageFilename(null);
      setMapImageBase64(null);
      setGSRSummary(null);
      removeGsrLayer();

    } finally {
      setGSRLoading(false);
    }
  };

  // Compute Stress Identification function
  const computeStressIdentification = async (yearsCount: number): Promise<StressData[]> => {
    try {
      setStressLoading(true);
      setStressError(null);

      // Validation
      if (gsrTableData.length === 0) {
        throw new Error('GSR analysis must be completed first. Please compute GSR before stress identification.');
      }

      if (!yearsCount || yearsCount < 1 || yearsCount > 50) {
        throw new Error('Please provide a valid number of years between 1 and 50.');
      }

      // Prepare request payload for stress identification
      const requestPayload = {
        gsrData: gsrTableData,
        years_count: yearsCount,
        selectedVillages: selectedVillages,
        timestamp: new Date().toISOString(),
      };

      console.log('Computing Stress Identification with payload:', requestPayload);

      // API call to compute stress identification
      const response = await fetch('/django/gwa/stress', {
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
      console.log('Stress Identification computation result:', result);

      // Extract and set stress data
      let stressData: StressData[] = [];
      if (result.success && result.data && Array.isArray(result.data)) {
        stressData = result.data;
      } else if (result.stress_data && Array.isArray(result.stress_data)) {
        stressData = result.stress_data;
      } else if (result.results && Array.isArray(result.results)) {
        stressData = result.results;
      } else {
        throw new Error('Invalid response format from server');
      }

      setStressTableData(stressData);
      return stressData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during stress identification';
      console.log('Error computing Stress Identification:', errorMessage);
      setStressError(errorMessage);

      // Clear data on error
      setStressTableData([]);
      throw err;
    } finally {
      setStressLoading(false);
    }
  };

  const value: GSRContextType = {
    // GSR State
    gsrTableData,
    gsrLoading,
    gsrError,
    gsrSummary,

    // Stress Identification State
    stressTableData,
    stressLoading,
    stressError,

    // GeoJSON State
    gsrGeojsonData,
    mergeStatistics,

    // Map Image State
    mapImageFilename,
    mapImageBase64,

    // Actions
    computeGSR,
    canComputeGSR,

    // Stress Identification Actions
    computeStressIdentification,
    canComputeStressIdentification,

    // Helper methods
    clearGSRData,
    clearStressData,
    getMapImageUrl,
  };

  return (
    <GSRContext.Provider value={value}>
      {children}
    </GSRContext.Provider>
  );
};

export const useGSR = (): GSRContextType => {
  const context = useContext(GSRContext);
  if (context === undefined) {
    throw new Error('useGSR must be used within a GSRProvider');
  }
  return context;
};