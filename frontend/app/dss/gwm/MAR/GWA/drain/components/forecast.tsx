'use client';

import React, { useContext, useState, useMemo } from 'react';
import { GroundwaterForecastContext } from '@/contexts/groundwater_assessment/drain/ForecastContext';
import { useWell } from '@/contexts/groundwater_assessment/drain/WellContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart, ScatterChart, Scatter } from 'recharts';

interface GroundwaterForecastProps {
  activeTab: string;
  step: number;
}

const GroundwaterForecast: React.FC<GroundwaterForecastProps> = ({ activeTab, step }) => {
  const {
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
    debugTrendAccess,
  } = useContext(GroundwaterForecastContext);

  const { wellsData, isWellTableSaved, csvFilename } = useWell();

  const [activeResultTab, setActiveResultTab] = useState<'overview' | 'table' | 'charts'>('overview');
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [hoveredData, setHoveredData] = useState<any>(null);

  // Handle chart click to show data
  const handleChartClick = (event: any) => {
    if (event && event.activeLabel !== undefined) {
      const clickedYear = event.activeLabel;
      const dataPoint = chartData.find((d: any) => d.year === clickedYear);
      
      if (dataPoint) {
        const payload = Object.keys(dataPoint)
          .filter(key => key !== 'year' && dataPoint[key] !== undefined && dataPoint[key] !== null)
          .map(key => ({
            dataKey: key,
            value: dataPoint[key],
            name: key
          }));
        
        setHoveredData({
          year: clickedYear,
          data: payload
        });
      }
    }
  };

  // Extract available years from wells data for historical reference
  const availableHistoricalYears = useMemo(() => {
    if (!wellsData || wellsData.length === 0 || !isWellTableSaved) {
      return {
        allYears: [],
        minYear: '',
        maxYear: '',
      };
    }

    const columns = Object.keys(wellsData[0] || {});
    const allYears = columns
      .filter((col) => col.match(/^(PRE|POST)_(\d{4})$/i))
      .map((col) => col.replace(/^(PRE|POST)_/i, ''))
      .filter((year) => !isNaN(parseInt(year)))
      .sort((a, b) => parseInt(a) - parseInt(b));

    return {
      allYears: [...new Set(allYears)],
      minYear: allYears[0] || '',
      maxYear: allYears[allYears.length - 1] || '',
    };
  }, [wellsData, isWellTableSaved]);

  // Prepare simplified table data
  const tableData = useMemo(() => {
    if (!forecastData?.villages) return [];

    return forecastData.villages.map((village: any) => {
      const villageName = village.village_info?.village || 'Unknown Village';

      if (Array.isArray(village.forecast_data?.values)) {
        const forecastValues = village.forecast_data.years?.map((year: number, idx: number) => ({
          year,
          value: village.forecast_data.values[idx]
        })) || [];
        return {
          village: villageName,
          forecasts: forecastValues
        };
      } else {
        return {
          village: villageName,
          forecasts: [{
            year: village.forecast_data?.year,
            value: village.forecast_data?.value
          }]
        };
      }
    });
  }, [forecastData]);

  // Get all unique forecast years for table headers
  const allForecastYears = useMemo(() => {
    if (!tableData.length) return [];

    const years = new Set<number>();
    tableData.forEach((row: { forecasts: any[]; }) => {
      row.forecasts.forEach((forecast: any) => {
        if (forecast.year) years.add(forecast.year);
      });
    });

    return Array.from(years).sort((a, b) => a - b);
  }, [tableData]);

  // Export CSV function
  const exportToCSV = () => {
    if (!tableData.length) return;

    const headers = ['Village', ...allForecastYears.map(year => `Forecasted ${year}`)];
    const csvContent = [
      headers.join(','),
      ...tableData.map((row: { village: any; forecasts: any[]; }) => {
        const values = [row.village];
        allForecastYears.forEach(year => {
          const forecast = row.forecasts.find((f: any) => f.year === year);
          values.push(forecast && typeof forecast.value === 'number' ? forecast.value.toFixed(2) : '');
        });
        return values.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `groundwater_forecast_drain_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle village selection for charts
  const handleVillageSelection = (villageName: string, isChecked: boolean) => {
    setSelectedVillages(prev => {
      if (isChecked) {
        return [...prev, villageName];
      } else {
        return prev.filter(name => name !== villageName);
      }
    });
  };

  // Prepare chart data for selected villages
  const chartData = useMemo(() => {
    if (!forecastData?.villages || selectedVillages.length === 0) return [];

    const selectedVillageData = forecastData.villages.filter((village: any) =>
      selectedVillages.includes(village.village_info?.village || 'Unknown Village')
    );

    const allYears = new Set<number>();
    selectedVillageData.forEach((village: any) => {
      village.historical_data?.years?.forEach((year: number) => allYears.add(year));
      if (Array.isArray(village.forecast_data?.years)) {
        village.forecast_data.years.forEach((year: number) => allYears.add(year));
      } else if (village.forecast_data?.year) {
        allYears.add(village.forecast_data.year);
      }
    });

    const sortedYears = Array.from(allYears).sort((a, b) => a - b);

    return sortedYears.map(year => {
      const dataPoint: any = { year };

      selectedVillageData.forEach((village: any) => {
        const villageName = village.village_info?.village || 'Unknown Village';

        const historicalIndex = village.historical_data?.years?.indexOf(year);
        if (historicalIndex !== -1 && historicalIndex !== undefined) {
          dataPoint[`${villageName}_historical`] = village.historical_data.values[historicalIndex];
        }

        if (Array.isArray(village.forecast_data?.years)) {
          const forecastIndex = village.forecast_data.years.indexOf(year);
          if (forecastIndex !== -1) {
            dataPoint[`${villageName}_forecast`] = village.forecast_data.values[forecastIndex];
          }
        } else if (village.forecast_data?.year === year) {
          dataPoint[`${villageName}_forecast`] = village.forecast_data.value;
        }
      });

      return dataPoint;
    });
  }, [forecastData, selectedVillages]);

  // Check if all required fields are filled
  const isFormValid = () => {
    if (!method || !forecastType) return false;

    if (!wellsData || wellsData.length === 0 || !isWellTableSaved) {
      return false;
    }

    if (!csvFilename) {
      return false;
    }

    const maxHistoricalYear = parseInt(availableHistoricalYears.maxYear) || 0;

    if (forecastType === 'single') {
      if (!forecastYear) return false;
      const year = parseInt(forecastYear);
      return !isNaN(year) && year > maxHistoricalYear && year >= 2021 && year <= 2099;
    } else if (forecastType === 'range') {
      if (!forecastYears[0] || !forecastYears[1]) return false;
      const startYear = parseInt(forecastYears[0]);
      const endYear = parseInt(forecastYears[1]);
      return (
        !isNaN(startYear) &&
        !isNaN(endYear) &&
        startYear > maxHistoricalYear &&
        endYear > startYear &&
        startYear >= 2021 &&
        startYear <= 2099 &&
        endYear >= 2021 &&
        endYear <= 2099
      );
    }

    return false;
  };

  // Validate year input
  const validateYear = (year: string, maxHistoricalYear: number): string | null => {
    if (!year) return 'Year is required';
    const num = parseInt(year);
    if (isNaN(num)) return 'Year must be a valid number';
    if (num <= maxHistoricalYear) return `Year must be after ${maxHistoricalYear}`;
    if (num < 2021 || num > 2099) return 'Year must be between 2021 and 2099';
    return null;
  };

  return (
    <div className="h-full overflow-auto flex flex-col">
      {/* Forecast Generation Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-2xl p-8">
            <div className="inline-block relative">
              <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <defs>
                  <linearGradient id="spinner-gradient-forecast-drain" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="spinner-gradient-2-forecast-drain" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-forecast-drain)" strokeWidth="3" />
                <path className="opacity-90" fill="url(#spinner-gradient-2-forecast-drain)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Generating Forecast...
            </p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we analyze and predict groundwater trends</p>
          </div>
        </div>
      )}
      <h3 className="font-medium text-blue-600 mb-4">Groundwater Forecast Analysis (Step {step})</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Forecast Analysis Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Wells Data Status */}
      {(!wellsData || wellsData.length === 0 || !isWellTableSaved || !csvFilename) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm text-amber-700">
              <p className="font-medium">Wells Data Required</p>
              <p className="mt-1">
                Please complete Step 2 (Well Selection), upload a valid CSV file, and save your wells data before performing forecast analysis.
                {!isWellTableSaved && wellsData && wellsData.length > 0 && " Your wells data is not saved yet - please click 'Save Wells Table' in Step 2."}
                {!csvFilename && " No CSV file uploaded. Please upload a CSV file in Step 2."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4 mb-6">
        {/* Forecast Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Forecast Method <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select Method...</option>
            <option value="linear_regression">Linear Regression</option>
            <option value="arima">ARIMA (AutoRegressive Integrated Moving Average)</option>
          </select>
        </div>

        {/* Forecast Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Forecast Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="forecastType"
                value="single"
                checked={forecastType === 'single'}
                onChange={(e) => {
                  setForecastType(e.target.value);
                  setForecastYear('');
                  setForecastYears(['', '']);
                }}
                disabled={isLoading}
                className="mr-2"
              />
              Single Year
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="forecastType"
                value="range"
                checked={forecastType === 'range'}
                onChange={(e) => {
                  setForecastType(e.target.value);
                  setForecastYear('');
                  setForecastYears(['', '']);
                }}
                disabled={isLoading}
                className="mr-2"
              />
              Year Range
            </label>
          </div>
        </div>

        {/* Year Input */}
        {forecastType === 'single' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forecast Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={forecastYear}
              onChange={(e) => setForecastYear(e.target.value)}
              placeholder={`Enter year (2021-2099, after ${availableHistoricalYears.maxYear || 'historical data'})`}
              disabled={isLoading}
              min="2021"
              max="2099"
            />
            {forecastYear && validateYear(forecastYear, parseInt(availableHistoricalYears.maxYear) || 0) && (
              <span className="text-red-500 text-sm mt-1">
                {validateYear(forecastYear, parseInt(availableHistoricalYears.maxYear) || 0)}
              </span>
            )}
          </div>
        )}

        {forecastType === 'range' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={forecastYears[0]}
                onChange={(e) => setForecastYears([e.target.value, forecastYears[1]])}
                placeholder={`Enter start year (2021-2099, after ${availableHistoricalYears.maxYear || 'historical data'})`}
                disabled={isLoading}
                min="2021"
                max="2099"
              />
              {forecastYears[0] && validateYear(forecastYears[0], parseInt(availableHistoricalYears.maxYear) || 0) && (
                <span className="text-red-500 text-sm mt-1">
                  {validateYear(forecastYears[0], parseInt(availableHistoricalYears.maxYear) || 0)}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={forecastYears[1]}
                onChange={(e) => setForecastYears([forecastYears[0], e.target.value])}
                placeholder={`Enter end year (2021-2099, after start year)`}
                disabled={isLoading || !forecastYears[0]}
                min="2021"
                max="2099"
              />
              {forecastYears[1] && validateYear(forecastYears[1], parseInt(availableHistoricalYears.maxYear) || 0) && (
                <span className="text-red-500 text-sm mt-1">
                  {validateYear(forecastYears[1], parseInt(availableHistoricalYears.maxYear) || 0)}
                </span>
              )}
              {forecastYears[0] && forecastYears[1] && parseInt(forecastYears[0]) >= parseInt(forecastYears[1]) && (
                <span className="text-red-500 text-sm mt-1">End year must be greater than start year</span>
              )}
            </div>
          </div>
        )}

        {/* Forecast Configuration Info */}
        {method && ((forecastType === 'single' && forecastYear) || (forecastType === 'range' && forecastYears[0] && forecastYears[1])) && csvFilename && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-2">Forecast Configuration</p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <strong>Method:</strong>
                    <span>{method === 'linear_regression' ? 'Linear Regression' : 'ARIMA'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <strong>Target:</strong>
                    <span>
                      {forecastType === 'single'
                        ? `Year ${forecastYear}`
                        : `Years ${forecastYears[0]} to ${forecastYears[1]} (${parseInt(forecastYears[1]) - parseInt(forecastYears[0]) + 1} years)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <strong>Historical Data:</strong>
                    <span>{availableHistoricalYears.minYear} - {availableHistoricalYears.maxYear}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !isFormValid()}
        className={[
          "w-full inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
          isLoading || !isFormValid()
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
        ].join(" ")}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
            <span className="whitespace-nowrap">Generating Forecast...</span>
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="whitespace-nowrap">Generate Forecast Analysis</span>
          </>
        )}
      </button>

      {/* Success Results */}
      {forecastData && !error && !isLoading && (
        <div className="mt-4 space-y-4">
          <div className="mt-6 bg-white border border-gray-200 rounded-lg">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  {
                    id: 'overview',
                    name: 'Overview',
                    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                  },
                  {
                    id: 'table',
                    name: 'Data Table',
                    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z M3 7l9 5 9-5',
                  },
                  {
                    id: 'charts',
                    name: 'Charts & Graphs',
                    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveResultTab(tab.id as any)}
                    className={`${activeResultTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                    </svg>
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Scrollable Tab Content */}
            <div className="p-6 max-h-[800px] overflow-y-auto">
              {/* Overview Tab */}
              {activeResultTab === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Forecast Analysis Configuration</h5>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Villages Processed:</span>
                            <span className="font-medium">{forecastData.total_villages_processed || wellsData?.length || 0}</span>
                          </div>

                          {(() => {
                            const allForecastValues =
                              forecastData.villages?.flatMap((village: any) =>
                                Array.isArray(village.forecast_data?.values)
                                  ? village.forecast_data.values
                                  : village.forecast_data?.value
                                    ? [village.forecast_data.value]
                                    : [],
                              ) || [];

                            if (allForecastValues.length === 0) {
                              return (
                                <div className="text-gray-500 italic text-center py-2">
                                  No forecast values available
                                </div>
                              );
                            }

                            const min = Math.min(...allForecastValues);
                            const max = Math.max(...allForecastValues);
                            const avg = allForecastValues.reduce((a: any, b: any) => a + b, 0) / allForecastValues.length;

                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Minimum Depth:</span>
                                  <span className="font-medium">{min.toFixed(2)} m</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Maximum Depth:</span>
                                  <span className="font-medium">{max.toFixed(2)} m</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Average Depth:</span>
                                  <span className="font-medium">{avg.toFixed(2)} m</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Forecast vs Historical Data (Sample Villages)</h4>
                      <div className="max-h-[400px] overflow-y-auto space-y-4">
                        {forecastData.villages?.slice(0, 3).map((village: any, index: number) => {
                          const historicalData =
                            village.historical_data?.years?.map((year: number, idx: number) => ({
                              year,
                              historical: village.historical_data.values[idx],
                              type: 'historical',
                            })) || [];

                          const forecastYearsArray = Array.isArray(village.forecast_data?.years)
                            ? village.forecast_data.years
                            : village.forecast_data?.year
                              ? [village.forecast_data.year]
                              : [];

                          const forecastValuesArray = Array.isArray(village.forecast_data?.values)
                            ? village.forecast_data.values
                            : village.forecast_data?.value
                              ? [village.forecast_data.value]
                              : [];

                          const forecastData = forecastYearsArray.map((year: number, idx: number) => ({
                            year,
                            forecast: forecastValuesArray[idx],
                            type: 'forecast',
                          }));

                          const combinedData = [...historicalData, ...forecastData];

                          return (
                            <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">{village.village_info?.village || `Village ${index + 1}`}</h5>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={combinedData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="year" />
                                  <YAxis />
                                  <Tooltip />
                                  <Line
                                    type="monotone"
                                    dataKey="historical"
                                    stroke="#3B82F6"
                                    strokeWidth={2}
                                    name="Historical"
                                    connectNulls={false}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="forecast"
                                    stroke="#EF4444"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name="Forecast"
                                    connectNulls={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Tab */}
              {activeResultTab === 'table' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold text-gray-800">Forecast Results</h4>
                    <button
                      onClick={exportToCSV}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md flex items-center gap-2 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export as CSV
                    </button>
                  </div>

                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Village</th>
                          {allForecastYears.map(year => (
                            <th key={year} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Forecasted {year}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.map((row: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {row.village}
                            </td>
                            {allForecastYears.map(year => {
                              const forecast = row.forecasts.find((f: any) => f.year === year);
                              return (
                                <td key={year} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {forecast && typeof forecast.value === 'number' ? forecast.value.toFixed(2) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Charts Tab */}
              {activeResultTab === 'charts' && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Select Villages to Display</h4>

                    {/* Village Selection Dropdown */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Choose villages to display on the chart:
                      </label>
                      <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
                        <div className="max-h-48 overflow-y-auto">
                          {forecastData.villages?.map((village: any, index: number) => {
                            const villageName = village.village_info?.village || `Village ${index + 1}`;
                            return (
                              <label key={index} className="flex items-center space-x-3 cursor-pointer py-3 px-4 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150">
                                <input
                                  type="checkbox"
                                  checked={selectedVillages.includes(villageName)}
                                  onChange={(e) => handleVillageSelection(villageName, e.target.checked)}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <span className="text-sm font-medium text-gray-800">{villageName}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => setSelectedVillages([])}
                          className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-1 rounded-md transition-colors duration-150"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Chart Display */}
                    {selectedVillages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p>Select villages from the dropdown above to display their forecast charts</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-md font-medium text-gray-700">
                            Combined Forecast Chart ({selectedVillages.length} village{selectedVillages.length !== 1 ? 's' : ''} selected)
                          </h5>
                          <div className="flex items-center gap-3">
                            {hoveredData && (
                              <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-full px-3 py-1">
                                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-semibold text-blue-700">Selected: {hoveredData.year}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                              </svg>
                              <span>Click on any year to view details</span>
                            </div>
                          </div>
                        </div>

                        {/* Two Column Layout: 80% Chart + 20% Tooltip */}
                        <div className="grid grid-cols-12 gap-4">
                          {/* Left Column - Chart (80%) */}
                          <div className="col-span-10 cursor-pointer">
                            <ResponsiveContainer width="100%" height={400}>
                              <LineChart 
                                data={chartData}
                                onClick={handleChartClick}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="year" />
                                <YAxis />
                                {/* <Tooltip /> */}

                                {selectedVillages.map((villageName, idx) => {
                                  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];
                                  const historicalColor = colors[idx % colors.length];
                                  const forecastColor = colors[(idx + 1) % colors.length];

                                  return (
                                    <React.Fragment key={villageName}>
                                      <Line
                                        type="monotone"
                                        dataKey={`${villageName}_historical`}
                                        stroke={historicalColor}
                                        strokeWidth={2}
                                        name={`${villageName} (Historical)`}
                                        connectNulls={false}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 7 }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey={`${villageName}_forecast`}
                                        stroke={forecastColor}
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        name={`${villageName} (Forecast)`}
                                        connectNulls={false}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 7 }}
                                      />
                                    </React.Fragment>
                                  );
                                })}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Right Column - Tooltip Data Display (20%) */}
                          <div className="col-span-2">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 h-[400px] overflow-y-auto shadow-inner">
                              <div className="flex items-center justify-between mb-3 border-b border-blue-300 pb-2">
                                <h6 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                  Data Details
                                </h6>
                                {hoveredData && (
                                  <button
                                    onClick={() => setHoveredData(null)}
                                    className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                    title="Clear selection"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              
                              {hoveredData ? (
                                <div className="space-y-3">
                                  <div className="bg-white rounded-md p-2 shadow-sm border border-blue-100">
                                    <p className="text-xs text-gray-500 font-medium">Year</p>
                                    <p className="text-lg font-bold text-blue-600">{hoveredData.year}</p>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    {hoveredData.data && hoveredData.data.length > 0 ? (
                                      hoveredData.data.map((item: any, index: number) => {
                                        if (item.value === null || item.value === undefined || item.value === '') return null;
                                        
                                        const dataKey = item.dataKey || item.name || 'Unknown';
                                        
                                        const displayName = String(dataKey)
                                          .replace(/_/g, ' ')
                                          .split(' ')
                                          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                                          .join(' ');
                                        
                                        const isHistorical = String(dataKey).toLowerCase().includes('historical');
                                        const bgColor = isHistorical ? 'bg-blue-50' : 'bg-red-50';
                                        const borderColor = isHistorical ? 'border-blue-200' : 'border-red-200';
                                        const textColor = isHistorical ? 'text-blue-700' : 'text-red-700';
                                        const dotColor = isHistorical ? 'bg-blue-500' : 'bg-red-500';
                                        
                                        return (
                                          <div 
                                            key={index} 
                                            className={`${bgColor} ${borderColor} border rounded-md p-2 shadow-sm transition-all hover:shadow-md`}
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                                              <p className="text-xs text-gray-600 truncate flex-1" title={displayName}>
                                                {displayName}
                                              </p>
                                            </div>
                                            <div className="flex items-baseline gap-1 pl-4">
                                              <p className={`text-base font-bold ${textColor}`}>
                                                {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
                                              </p>
                                              <span className="text-xs text-gray-500">m</span>
                                            </div>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-xs text-gray-500 text-center py-4">No data available for this point</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                                  <svg className="w-12 h-12 text-blue-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                  </svg>
                                  <p className="text-xs text-gray-500 px-2 font-medium mb-1">
                                    Click on the chart
                                  </p>
                                  <p className="text-xs text-gray-400 px-2">
                                    Click any data point to view detailed information
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Selected Villages Legend */}
                        <div className="mt-4 p-3 bg-gray-50 rounded-md">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Selected Villages:</h6>
                          <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto p-2 bg-white rounded border border-gray-200">
                            {selectedVillages.map((village, idx) => {
                              const colors = [
                                "#3B82F6",
                                "#EF4444",
                                "#10B981",
                                "#F59E0B",
                                "#8B5CF6",
                                "#06B6D4",
                                "#EC4899",
                                "#84CC16",
                              ];
                              return (
                                <span
                                  key={village}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: colors[idx % colors.length] }}
                                >
                                  {village}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroundwaterForecast;