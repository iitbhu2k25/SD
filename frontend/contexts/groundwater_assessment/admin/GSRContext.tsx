"use client";

import React, { createContext, useContext, useState } from 'react';
import { useLocation } from './LocationContext';
import { useDemand } from './DemandContext';
import { useRecharge } from './RechargeContext';
import { GroundwaterTrendContext } from './TrendContext';
import { useMap } from '@/contexts/groundwater_assessment/admin/MapContext';
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
  // GSR State
  gsrTableData: GSRData[];
  gsrLoading: boolean;
  gsrError: string | null;

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
  const { combinedDemandData } = useDemand();
  const { tableData: rechargeTableData } = useRecharge();
  const { trendData } = React.useContext(GroundwaterTrendContext);
  const { addGsrLayer, removeGsrLayer } = useMap();

  // Get map image URL helper
  const getMapImageUrl = (): string | null => {
    if (!mapImageFilename) return null;
    return `/django/media/temp/${mapImageFilename}`;
  };

  // Get map image source helper 
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
      combinedDemandData.length > 0
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

      if (combinedDemandData.length === 0) {
        throw new Error('No demand data available. Please compute demand first.');
      }

      // Trend CSV from trend context
      const trendCsvFilename = trendData?.summary_stats?.file_info?.trend_csv_filename || null;

      // Create payload object with combined demand data
      const payload = {
        selectedSubDistricts: selectedSubDistricts,
        rechargeData: rechargeTableData,
        combinedDemandData: combinedDemandData,
        hasRechargeData: rechargeTableData.length > 0,
        hasDemandData: combinedDemandData.length > 0,
        trendCsvFilename: trendCsvFilename || '',
        timestamp: new Date().toISOString()
      };

      // 🏭 VERIFICATION LOGGING
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      console.log('🏭 GSR PAYLOAD VERIFICATION - COMBINED DEMAND');
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      console.log('📊 DATA SUMMARY:');
      console.log(`   ✓ Recharge Records: ${rechargeTableData.length}`);
      console.log(`   ✓ Combined Demand Records: ${combinedDemandData.length}`);
      console.log('');
      console.log('🎯 PAYLOAD FLAGS:');
      console.log(`   • hasRechargeData: ${payload.hasRechargeData}`);
      console.log(`   • hasDemandData: ${payload.hasDemandData}`);
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
      } else {
        console.log('   ⚠️ No combined demand data');
      }
      console.log('');
      console.log('🔍 DEMAND BREAKDOWN BY TYPE:');
      const domesticTotal = combinedDemandData.reduce((sum, v) => sum + (Number(v.domestic_demand) || 0), 0);
      const agriculturalTotal = combinedDemandData.reduce((sum, v) => sum + (Number(v.agricultural_demand) || 0), 0);
      const industrialTotal = combinedDemandData.reduce((sum, v) => sum + (Number(v.industrial_demand) || 0), 0);

      console.log(`   Domestic: ${domesticTotal.toFixed(3)} MLD`);
      console.log(`   Agricultural: ${agriculturalTotal.toFixed(3)} MLD`);
      console.log(`   Industrial: ${industrialTotal.toFixed(3)} MLD`);
      console.log(`   ─────────────────────────────────────────────────────`);
      console.log(`   TOTAL: ${(domesticTotal + agriculturalTotal + industrialTotal).toFixed(3)} MLD`);
      console.log('');
      console.log('📍 Selected Sub-districts:', selectedSubDistricts);
      console.log('📈 Trend CSV:', trendCsvFilename || 'Not provided');
      console.log('═══════════════════════════════════════════════════════════════════════════════');

      // Convert payload to JSON string and compress
      const jsonString = JSON.stringify(payload);
      const compressed = pako.gzip(jsonString);

      // Convert to base64 without spreading (avoids stack overflow)
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

      console.log('═══════════════════════════════════════════════════════════════════════════════');

      // Handle GSR data response
      if (result.success && result.data && Array.isArray(result.data)) {
        setGSRTableData(result.data);
      } else if (result.gsr_data && Array.isArray(result.gsr_data)) {
        setGSRTableData(result.gsr_data);
      } else if (result.results && Array.isArray(result.results)) {
        setGSRTableData(result.results);
      } else {
        throw new Error('Invalid response format from server');
      }

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
        console.log('⚠️ No map image generated');
      }

      if (result.map_image_base64) {
        setMapImageBase64(result.map_image_base64);
        console.log('📸 GSR map image base64 received');
      } else {
        setMapImageBase64(null);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('❌ GSR Computation Error:', errorMessage);
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

  // Compute Stress Identification
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
        years_count: yearsCount,
        selectedSubDistricts: selectedSubDistricts,
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