"use client";

import React, { createContext, useContext, useState } from 'react';
import { useLocation } from './LocationContext';
import { useDemand } from './DemandContext';
import { useRecharge } from './RechargeContext';
import { GroundwaterTrendContext } from './TrendContext';
import { useMap } from '@/contexts/groundwater_assessment/drain/MapContext'; // Ensure this points to drain MapContext
import pako from 'pako';

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
  gsrTableData: GSRData[];
  gsrLoading: boolean;
  gsrError: string | null;
  stressTableData: StressData[];
  stressLoading: boolean;
  stressError: string | null;
  gsrGeojsonData: any | null;
  mergeStatistics: MergeStatistics | null;
  mapImageFilename: string | null;
  mapImageBase64: string | null;
  computeGSR: () => Promise<void>;
  canComputeGSR: () => boolean;
  computeStressIdentification: (yearsCount: number) => Promise<StressData[]>;
  canComputeStressIdentification: () => boolean;
  clearGSRData: () => void;
  clearStressData: () => void;
  getMapImageUrl: () => string | null;
  getMapImageSrc: () => string | null;
}

export const GSRContext = createContext<GSRContextType | undefined>(undefined);

interface GSRProviderProps {
  children: React.ReactNode;
}

export const GSRProvider: React.FC<GSRProviderProps> = ({ children }) => {
  const [gsrTableData, setGSRTableData] = useState<GSRData[]>([]);
  const [gsrLoading, setGSRLoading] = useState<boolean>(false);
  const [gsrError, setGSRError] = useState<string | null>(null);
  const [stressTableData, setStressTableData] = useState<StressData[]>([]);
  const [stressLoading, setStressLoading] = useState<boolean>(false);
  const [stressError, setStressError] = useState<string | null>(null);
  const [gsrGeojsonData, setGSRGeojsonData] = useState<any | null>(null);
  const [mergeStatistics, setMergeStatistics] = useState<MergeStatistics | null>(null);
  const [mapImageFilename, setMapImageFilename] = useState<string | null>(null);
  const [mapImageBase64, setMapImageBase64] = useState<string | null>(null);

  const { selectedVillages } = useLocation(); // Drain context uses selectedVillages

  // FIX: Destructure combinedDemandData from useDemand (was added in the previous context update)
  const {
    domesticTableData,
    agriculturalTableData,
    industrialTableData,
    combinedDemandData // This is the crucial addition from the DemandContext update
  } = useDemand();

  const { tableData: rechargeTableData } = useRecharge();
  const { trendData } = React.useContext(GroundwaterTrendContext);
  const { addGsrLayer, removeGsrLayer } = useMap();

  const getMapImageUrl = (): string | null => {
    if (!mapImageFilename) return null;
    return `/django/media/temp/${mapImageFilename}`;
  };

  const getMapImageSrc = (): string | null => {
    if (mapImageBase64) return mapImageBase64;
    return getMapImageUrl();
  };

  const clearGSRData = () => {
    setGSRTableData([]);
    setGSRGeojsonData(null);
    setMergeStatistics(null);
    setMapImageFilename(null);
    setMapImageBase64(null);
    setGSRError(null);
    removeGsrLayer();
  };

  const clearStressData = () => {
    setStressTableData([]);
    setStressError(null);
  };

  const canComputeGSR = (): boolean => {
    // Check if any demand data exists, by checking the combined data length
    const hasDemandData = domesticTableData.length > 0 || agriculturalTableData.length > 0 || industrialTableData.length > 0;

    return !!(
      selectedVillages.length > 0 &&
      rechargeTableData.length > 0 &&
      hasDemandData
    );
  };

  const canComputeStressIdentification = (): boolean => {
    return gsrTableData.length > 0;
  };

  // Compute GSR - ALIGNED WITH ADMIN LOGIC (using combinedDemandData)
  const computeGSR = async () => {
    try {
      setGSRLoading(true);
      setGSRError(null);

      // Validation
      if (selectedVillages.length === 0) {
        throw new Error('Village selection is required. Please select areas first.');
      }

      if (rechargeTableData.length === 0) {
        throw new Error('Recharge data is required. Please compute recharge first.');
      }

      // Check against the combined data state
      if (combinedDemandData.length === 0) {
        throw new Error('No demand data available. Please compute domestic, agricultural, or industrial demand first.');
      }

      // Trend CSV from trend context
      const trendCsvFilename = trendData?.summary_stats?.file_info?.trend_csv_filename || null;

      // Create payload object using combinedDemandData
      const payload = {
        selectedVillages: selectedVillages, // Use selectedVillages for drain
        rechargeData: rechargeTableData,
        combinedDemandData: combinedDemandData, // Use the pre-combined data
        hasRechargeData: rechargeTableData.length > 0,
        hasDemandData: combinedDemandData.length > 0, // Flag based on combined data
        trendCsvFilename: trendCsvFilename || '',
        timestamp: new Date().toISOString()
      };

      // 🏭 VERIFICATION LOGGING (Simplified to focus on combined data)
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      console.log('🏭 GSR PAYLOAD VERIFICATION (DRAIN CASE) - USING COMBINED DEMAND');
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      console.log('📊 DATA SUMMARY:');
      console.log(`   ✓ Recharge Records: ${rechargeTableData.length}`);
      console.log(`   ✓ Combined Demand Records: ${combinedDemandData.length}`);
      console.log('');

      if (combinedDemandData.length > 0) {
        console.log('🏭 COMBINED DEMAND DATA SAMPLE (First 3 records):');
        combinedDemandData.slice(0, 3).forEach((record, idx) => {
          console.log(`   ${idx + 1}. Village Code: ${record.village_code}`);
          console.log(`      Village Name: ${record.village_name}`);
          console.log(`      - Domestic: ${record.domestic_demand || 0} MLD`);
          console.log(`      - Agricultural: ${record.agricultural_demand || 0} MLD`);
          console.log(`      - Industrial: ${record.industrial_demand || 0} MLD`);
          console.log(`      - Total: ${record.total_demand || 0} MLD`);
        });

        const totalDemand = combinedDemandData.reduce((sum, v) => sum + (Number(v.total_demand) || 0), 0);
        console.log(`   ✅ Total Demand (All Villages): ${totalDemand.toFixed(3)} MLD`);
      }

      console.log('');
      console.log('📍 Selected Villages:', selectedVillages);
      console.log('📈 Trend CSV:', trendCsvFilename || 'Not provided');
      console.log('═══════════════════════════════════════════════════════════════════════════════');

      // Convert payload to JSON string and compress
      const jsonString = JSON.stringify(payload);
      const compressed = pako.gzip(jsonString);

      let binary = '';
      const len = compressed.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      const base64Compressed = btoa(binary);

      console.log('🔄 Sending compressed payload to GSR API...');
      console.log(`   Payload size: ${jsonString.length} bytes`);
      console.log(`   Compressed size: ${base64Compressed.length} bytes`);

      // Send compressed data
      const response = await fetch('/fastm/gwa/gsr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ zipped_data: base64Compressed }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      console.log('✅ GSR API Response received');
      console.log(`   Success: ${result.success}`);
      console.log(`   Villages processed: ${result.villages_count || 0}`);

      // Log summary if available
      if (result.summary) {
        console.log('');
        console.log('📊 GSR COMPUTATION SUMMARY:');
        console.log(`   Total Recharge: ${result.summary.total_recharge || 0} MCM`);
        console.log(`   Total Demand: ${result.summary.total_demand || 0} MCM`);
        console.log(`   ─────────────────────────────────────────────────────`);
        console.log(`   OVERALL GSR: ${result.summary.overall_gsr || 0}`);
      }

      // Handle GSR data response (using comprehensive checks)
      let tableData: any[] = [];
      if (result.data && Array.isArray(result.data)) {
        tableData = result.data;
      } else if (result.gsr_data && Array.isArray(result.gsr_data)) {
        tableData = result.gsr_data;
      } else if (result.results && Array.isArray(result.results)) {
        tableData = result.results;
      } else if (result.gsr_results && Array.isArray(result.gsr_results)) {
        tableData = result.gsr_results;
      } else if (Array.isArray(result)) {
        tableData = result;
      }

      if (tableData.length === 0) {
        throw new Error('No GSR table data found in API response.');
      }
      setGSRTableData(tableData);
      console.log('✅ setGSRTableData called with:', tableData.length, 'records');

      // GeoJSON handling
      if (result.geospatial_data) {
        try {
          addGsrLayer(result.geospatial_data);
          setGSRGeojsonData(result.geospatial_data);
          console.log('✅ GSR layer added to map');
        } catch (e) {
          console.log('⚠️ Failed to add GSR layer to map:', e);
        }
      } else {
        removeGsrLayer();
        setGSRGeojsonData(null);
      }

      // Merge stats
      if (result.merge_statistics) {
        setMergeStatistics(result.merge_statistics);
        console.log(`📊 Merge Statistics: ${result.merge_statistics.villages_with_geospatial_data}/${result.merge_statistics.total_gsr_villages} villages merged`);
      }

      // Map images
      if (result.map_image_filename) {
        setMapImageFilename(result.map_image_filename);
        console.log('📸 GSR map image generated:', result.map_image_filename);
      } else {
        setMapImageFilename(null);
      }

      if (result.map_image_base64) {
        setMapImageBase64(result.map_image_base64);
        console.log('📸 GSR map image base64 received');
      } else {
        setMapImageBase64(null);
      }

      console.log('═══════════════════════════════════════════════════════════════════════════════');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('❌ GSR Computation Error:', errorMessage);
      setGSRError(errorMessage);
      setGSRTableData([]);
      setGSRGeojsonData(null);
      setMergeStatistics(null);
      setMapImageFilename(null);
      setMapImageBase64(null);
      removeGsrLayer();
    } finally {
      setGSRLoading(false);
    }
  };

  // Compute Stress Identification (same as admin, using gsrTableData)
  const computeStressIdentification = async (yearsCount: number): Promise<StressData[]> => {
    try {
      setStressLoading(true);
      setStressError(null);

      if (gsrTableData.length === 0) {
        throw new Error('GSR analysis must be completed first. Please compute GSR before stress identification.');
      }

      if (!yearsCount || yearsCount < 1 || yearsCount > 50) {
        throw new Error('Please provide a valid number of years between 1 and 50.');
      }

      const requestPayload = {
        gsrData: gsrTableData,
        years_count: yearsCount,
        selectedVillages: selectedVillages, // Use selectedVillages for drain
        timestamp: new Date().toISOString()
      };

      console.log('🔄 Computing Stress Identification...');
      console.log(`   Years: ${yearsCount}`);
      console.log(`   GSR Records: ${gsrTableData.length}`);

      const response = await fetch('/fastm/gwa/stress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

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
      console.log(`✅ Stress identification completed for ${stressData.length} villages`);

      return stressData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during stress identification';
      console.error('❌ Stress Identification Error:', errorMessage);
      setStressError(errorMessage);
      setStressTableData([]);
      throw err;
    } finally {
      setStressLoading(false);
    }
  };

  const value: GSRContextType = {
    gsrTableData,
    gsrLoading,
    gsrError,
    stressTableData,
    stressLoading,
    stressError,
    gsrGeojsonData,
    mergeStatistics,
    mapImageFilename,
    mapImageBase64,
    computeGSR,
    canComputeGSR,
    computeStressIdentification,
    canComputeStressIdentification,
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