"use client";

import React, { createContext, useContext, useState } from 'react';
import { useLocation } from './LocationContext';
import { useDemand } from './DemandContext';
import { useRecharge } from './RechargeContext';
import { GroundwaterTrendContext } from './TrendContext';
import { useMap } from '@/contexts/groundwater_assessment/admin/MapContext';

interface GSRData {
  [key: string]: string | number;
}

interface StressData {
  [key: string]: string | number;
}

interface MergeStatistics {
  total_shapefile_villages: number;
  villages_with_gsr_data: number;
  villages_without_gsr_data: number;
  merge_success_rate: number;
  error?: string;
}

interface GSRContextType {
  // GSR State
  gsrTableData: GSRData[];
  gsrLoading: boolean;
  gsrError: string | null;

  // Stress Identification State
  stressTableData: StressData[];
  stressLoading: boolean;
  stressError: string | null;

  // GeoJSON State
  gsrGeojsonData: any | null; // GeoJSON FeatureCollection
  mergeStatistics: MergeStatistics | null;

  // Map Image State
  mapImageFilename: string | null;
  mapImageBase64: string | null;

  // Actions
  computeGSR: () => Promise<void>;
  canComputeGSR: () => boolean;

  // Stress Identification Actions (uses yearsCount instead of calendar year)
  computeStressIdentification: (yearsCount: number) => Promise<StressData[]>;
  canComputeStressIdentification: () => boolean;

  // Helper methods
  clearGSRData: () => void;
  clearStressData: () => void;

  // Map Image Helpers
  getMapImageUrl: () => string | null;
  getMapImageSrc: () => string | null;
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
  const { selectedSubDistricts } = useLocation();
  const {
    domesticTableData,
    agriculturalTableData,
    domesticChecked,
    agriculturalChecked
  } = useDemand();

  const { tableData: rechargeTableData } = useRecharge();
  const { trendData } = React.useContext(GroundwaterTrendContext);
  const { addGsrLayer, removeGsrLayer } = useMap();

  // Get map image URL helper
  const getMapImageUrl = (): string | null => {
    if (!mapImageFilename) return null;
    // Construct the full URL to the image in media/temp/
    return `/django/media/temp/${mapImageFilename}`;
  };

  // Get map image source helper (prefer base64 if available)
  const getMapImageSrc = (): string | null => {
    if (mapImageBase64) return mapImageBase64;
    return getMapImageUrl();
  };

  // Clear all GSR data
  const clearGSRData = () => {
    setGSRTableData([]);
    setGSRGeojsonData(null);
    setMergeStatistics(null);
    setMapImageFilename(null);
    setMapImageBase64(null);
    setGSRError(null);
    removeGsrLayer();
  };

  // Clear stress data
  const clearStressData = () => {
    setStressTableData([]);
    setStressError(null);
  };

  // Can compute GSR
  const canComputeGSR = (): boolean => {
    return !!(
      selectedSubDistricts.length > 0 &&
      rechargeTableData.length > 0 &&
      ((domesticChecked && domesticTableData.length > 0) ||
        (agriculturalChecked && agriculturalTableData.length > 0))
    );
  };

  // Can compute Stress Identification (depends on GSR)
  const canComputeStressIdentification = (): boolean => {
    return gsrTableData.length > 0;
  };

  // Compute GSR
  const computeGSR = async () => {
    try {
      setGSRLoading(true);
      setGSRError(null);

      // Validation
      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }

      if (rechargeTableData.length === 0) {
        throw new Error('Recharge data is required. Please compute recharge first.');
      }

      if (domesticTableData.length === 0 && agriculturalTableData.length === 0) {
        throw new Error('No demand data available. Please compute domestic or agricultural demand first.');
      }

      // Trend CSV from trend context
      const trendCsvFilename = trendData?.summary_stats?.file_info?.trend_csv_filename || null;

      const requestPayload = {
        selectedSubDistricts: selectedSubDistricts,
        rechargeData: rechargeTableData,
        domesticData: domesticTableData,
        agriculturalData: agriculturalTableData,
        hasDomesticDemand: domesticChecked && domesticTableData.length > 0,
        hasAgriculturalDemand: agriculturalChecked && agriculturalTableData.length > 0,
        hasRechargeData: rechargeTableData.length > 0,
        trendCsvFilename: trendCsvFilename,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/django/gwa/gsr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Table data
      if (result.success && result.data && Array.isArray(result.data)) {
        setGSRTableData(result.data);
      } else if (result.gsr_data && Array.isArray(result.gsr_data)) {
        setGSRTableData(result.gsr_data);
      } else if (result.results && Array.isArray(result.results)) {
        setGSRTableData(result.results);
      } else {
        throw new Error('Invalid response format from server');
      }

      // Map GeoJSON
      if (result.geospatial_data) {
        try {
          addGsrLayer(result.geospatial_data);
          setGSRGeojsonData(result.geospatial_data);
        } catch (e) {
          console.log('Failed to add GSR layer to map:', e);
        }
      } else {
        removeGsrLayer();
        setGSRGeojsonData(null);
      }

      // Merge stats
      if (result.merge_statistics) {
        setMergeStatistics(result.merge_statistics);
      }

      // Handle map image filename
      if (result.map_image_filename) {
        setMapImageFilename(result.map_image_filename);
        console.log('📍 GSR map image generated:', result.map_image_filename);
      } else {
        setMapImageFilename(null);
        console.log('⚠️ No map image generated');
      }

      // Handle map image base64
      if (result.map_image_base64) {
        setMapImageBase64(result.map_image_base64);
        console.log('📍 GSR map image base64 received');
      } else {
        setMapImageBase64(null);
        console.log('⚠️ No map image base64 received');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setGSRError(errorMessage);
      setGSRTableData([]);
      setGSRGeojsonData(null);
      setMergeStatistics(null);
      setMapImageFilename(null);
      setMapImageBase64(null);
    } finally {
      setGSRLoading(false);
    }
  };

  // Compute Stress Identification (UPDATED: uses yearsCount instead of calendar year)
  const computeStressIdentification = async (yearsCount: number): Promise<StressData[]> => {
    try {
      setStressLoading(true);
      setStressError(null);

      // Validation: require GSR first
      if (gsrTableData.length === 0) {
        throw new Error('GSR analysis must be completed first. Please compute GSR before stress identification.');
      }

      // Validate number of years as a count between 1-50
      if (!yearsCount || yearsCount < 1 || yearsCount > 50) {
        throw new Error('Please provide a valid number of years between 1 and 50.');
      }

      // Request payload: use yearsCount instead of year
      const requestPayload = {
        gsrData: gsrTableData,
        years_count: yearsCount, // CHANGED: now accepts count of years (1-50)
        selectedSubDistricts: selectedSubDistricts,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/django/gwa/stress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Extract stress data
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
      setStressError(errorMessage);
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

    // Stress State
    stressTableData,
    stressLoading,
    stressError,

    // GeoJSON
    gsrGeojsonData,
    mergeStatistics,

    // Map Image
    mapImageFilename,
    mapImageBase64,

    // Actions
    computeGSR,
    canComputeGSR,

    // Stress Actions
    computeStressIdentification,
    canComputeStressIdentification,

    // Helpers
    clearGSRData,
    clearStressData,
    getMapImageUrl,
    getMapImageSrc,
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
