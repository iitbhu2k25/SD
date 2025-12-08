'use client';

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { GroundwaterTrendContext } from './TrendContext';

interface GroundwaterForecastContextType {
  forecastData: any;
  method: string;
  forecastType: string;
  forecastYear: string;
  forecastYears: string[];
  isLoading: boolean;
  error: string | null;
  setMethod: (value: string) => void;
  setForecastType: (value: string) => void;
  setForecastYear: (value: string) => void;
  setForecastYears: (value: string[]) => void;
  handleGenerate: () => Promise<void>;
  clearForecastData: () => void;
  resetForm: () => void;
  getTimeseriesFilename: () => string | null;
  debugTrendAccess: () => void;
}

interface GroundwaterForecastProviderProps {
  children: ReactNode;
  activeTab: string;
  onForecastData?: (data: any) => void;
}

export const GroundwaterForecastContext = createContext<GroundwaterForecastContextType>({
  forecastData: null,
  method: '',
  forecastType: '',
  forecastYear: '',
  forecastYears: ['', ''],
  isLoading: false,
  error: null,
  setMethod: () => { },
  setForecastType: () => { },
  setForecastYear: () => { },
  setForecastYears: () => { },
  handleGenerate: async () => { },
  clearForecastData: () => { },
  resetForm: () => { },
  getTimeseriesFilename: () => null,
  debugTrendAccess: () => { },
});

export const GroundwaterForecastProvider = ({
  children,
  activeTab,
  onForecastData = () => { },
}: GroundwaterForecastProviderProps) => {
  const [forecastData, setForecastData] = useState<any>(null);
  const [method, setMethod] = useState<string>('');
  const [forecastType, setForecastType] = useState<string>('');
  const [forecastYear, setForecastYear] = useState<string>('');
  const [forecastYears, setForecastYears] = useState<string[]>(['', '']);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  //  Access TrendContext 
  const trendContextValue = useContext(GroundwaterTrendContext);

  //  Extract trendData separately 
  const { trendData, trendMethod, yearStart, yearEnd } = trendContextValue;

  //  Use useCallback to get the latest trendData reference
  const getLatestTrendData = useCallback(() => {
    return trendContextValue.trendData;
  }, [trendContextValue.trendData]);

  // Debug function to check context access
  const debugTrendAccess = useCallback(() => {
    const latestTrendData = getLatestTrendData();
    console.log('===  DEBUGGING TREND CONTEXT ACCESS ===');
    console.log(' trendContextValue:', trendContextValue);
    console.log(' trendContextValue available?:', !!trendContextValue);
    console.log(' trendData from destructuring:', trendData);
    console.log('latestTrendData from callback:', latestTrendData);
    console.log(' trendData available?:', !!latestTrendData);

    if (latestTrendData) {
      console.log('TrendData found!');
      console.log(' success:', latestTrendData.success);
      console.log(' summary_stats:', !!latestTrendData.summary_stats);
      console.log(' file_info:', !!latestTrendData.summary_stats?.file_info);
      console.log(' timeseries_yearly_csv_filename:', latestTrendData.summary_stats?.file_info?.timeseries_yearly_csv_filename);
      console.log(' Full analysis info:', {
        success: latestTrendData.success,
        total_villages: latestTrendData.total_villages,
        analysis_timestamp: latestTrendData.analysis_timestamp,
        timeseries_file: latestTrendData.summary_stats?.file_info?.timeseries_yearly_csv_filename
      });
    } else {
      console.log(' No trendData found');
      console.log(' Context debug info:', {
        'trendContextValue exists': !!trendContextValue,
        'trendData from destructuring': !!trendData,
        'direct access trendContextValue.trendData': !!trendContextValue?.trendData,
      });
    }
    console.log('=============================================');
  }, [trendContextValue, trendData, getLatestTrendData]);

  // Helper to get timeseries filename 
  const getTimeseriesFilename = useCallback((): string | null => {
    const latestTrendData = getLatestTrendData();
    const filename = latestTrendData?.summary_stats?.file_info?.timeseries_yearly_csv_filename || null;
    console.log('🔍 getTimeseriesFilename - latest:', filename);
    return filename;
  }, [getLatestTrendData]);

  //  Monitor ALL trend context changes
  useEffect(() => {
    console.log('🔄 ForecastContext: TrendContext changed');
    console.log('🔄 TrendData exists:', !!trendData);
    console.log('🔄 TrendData timestamp:', trendData?.analysis_timestamp);
    debugTrendAccess();
  }, [trendContextValue, trendData, debugTrendAccess]);

  // Clear data when tab changes
  useEffect(() => {
    if (activeTab !== 'groundwater-forecast') {
      clearForecastData();
    }
  }, [activeTab]);

  const clearForecastData = () => {
    setForecastData(null);
    setError(null);
  };

  const resetForm = () => {
    setMethod('');
    setForecastType('');
    setForecastYear('');
    setForecastYears(['', '']);
    clearForecastData();
  };

  const handleGenerate = async () => {
    console.log('🚀 === FORECAST GENERATION STARTED ===');

    // First debug trend access 
    debugTrendAccess();

    // Validate all required fields
    if (!method || !forecastType) {
      alert('Please fill all required fields: Method and Forecast Type.');
      return;
    }

    // Get latest trend data using callback
    const latestTrendData = getLatestTrendData();

    // Check if trend context is available
    if (!trendContextValue) {
      console.log('❌ No TrendContext available!');
      alert('Context Error: ForecastProvider must be wrapped inside TrendProvider');
      return;
    }

    // Check if trend data exists using latest reference
    if (!latestTrendData) {
      console.log('❌ No trendData available!');
      console.log('Context state:', {
        trendContextValue: !!trendContextValue,
        destructuredTrendData: !!trendData,
        directAccess: !!trendContextValue.trendData,
        latestFromCallback: !!latestTrendData
      });
      alert('No trend analysis data found. Please complete trend analysis first.');
      return;
    }

    // Check if trend analysis was successful
    if (!latestTrendData.success) {
      console.log('❌ Trend analysis not successful');
      alert('Trend analysis was not successful. Please run a successful trend analysis first.');
      return;
    }

    // Get timeseries filename from latest data
    const timeseriesCsvFilename = latestTrendData.summary_stats?.file_info?.timeseries_yearly_csv_filename;

    if (!timeseriesCsvFilename) {
      console.log('❌ No timeseries CSV filename found!');
      console.log('Available data structure:', latestTrendData);
      alert('Timeseries CSV filename not found. Please run trend analysis first.');
      return;
    }

    console.log(' All validations passed!');
    console.log(' Using timeseries file:', timeseriesCsvFilename);

    // Validate year selection based on forecast type
    if (forecastType === 'single') {
      if (!forecastYear) {
        alert('Please enter a forecast year.');
        return;
      }
      const year = parseInt(forecastYear);
      if (isNaN(year) || year < 2020 || year > 2099) {
        alert('Please enter a valid year between 2020 and 2099.');
        return;
      }
    } else if (forecastType === 'range') {
      if (!forecastYears[0] || !forecastYears[1]) {
        alert('Please enter both start and end years for the forecast range.');
        return;
      }

      const startYear = parseInt(forecastYears[0]);
      const endYear = parseInt(forecastYears[1]);

      if (isNaN(startYear) || isNaN(endYear)) {
        alert('Please enter valid years.');
        return;
      }

      if (startYear < 2020 || startYear > 2099 || endYear < 2020 || endYear > 2099) {
        alert('Both years must be between 2020 and 2099.');
        return;
      }

      if (startYear >= endYear) {
        alert('Start year must be less than end year.');
        return;
      }
    }

    // Prepare target years array
    let targetYears: number[] = [];
    if (forecastType === 'single') {
      targetYears = [parseInt(forecastYear)];
    } else {
      const startYear = parseInt(forecastYears[0]);
      const endYear = parseInt(forecastYears[1]);
      for (let year = startYear; year <= endYear; year++) {
        targetYears.push(year);
      }
    }

    // Prepare payload for forecast analysis
    const payload = {
      method,
      forecast_type: forecastType,
      target_years: targetYears,
      timeseries_yearly_csv_filename: timeseriesCsvFilename,
    };

    try {
      setIsLoading(true);
      setError(null);
      setForecastData(null);

      console.log(' === Posting Forecast Analysis Payload ===');
      console.log(' Trend Analysis Info:');
      console.log(`    Analysis Date: ${latestTrendData.summary_stats?.file_info?.analysis_date}`);
      console.log(`    Total Villages: ${latestTrendData.total_villages}`);
      console.log(`    Analysis Timestamp: ${latestTrendData.analysis_timestamp}`);
      console.log(' Forecast Payload Details:');
      console.log(`    Method: ${payload.method}`);
      console.log(`   Forecast Type: ${payload.forecast_type}`);
      console.log(`  Target Years: ${payload.target_years.join(', ')}`);
      console.log(`   Timeseries CSV: ${payload.timeseries_yearly_csv_filename}`);
      console.log(' Full Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch('/fastm/gwa/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(' Forecast API response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to generate forecast analysis: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.log('❌ Forecast API error response:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse error response as JSON:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(' Forecast analysis completed successfully!');
      console.log(' Data received:', data);

      // Validate response data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response data received from server');
      }

      setForecastData(data);
      onForecastData(data);

      console.log(' Forecast generation completed!');
      console.log(` Based on: ${timeseriesCsvFilename}`);

    } catch (error) {
      console.log('❌ Error generating forecast analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during forecast analysis';
      setError(errorMessage);
      setForecastData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GroundwaterForecastContext.Provider
      value={{
        forecastData,
        method,
        forecastType,
        forecastYear,
        forecastYears,
        isLoading,
        error,
        setMethod,
        setForecastType,
        setForecastYear,
        setForecastYears,
        handleGenerate,
        clearForecastData,
        resetForm,
        getTimeseriesFilename,
        debugTrendAccess,
      }}
    >
      {children}
    </GroundwaterForecastContext.Provider>
  );
};