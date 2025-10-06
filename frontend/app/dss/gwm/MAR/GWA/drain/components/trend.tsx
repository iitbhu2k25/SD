"use client";

import React, { useContext, useState, useMemo } from 'react';
import { GroundwaterTrendContext } from "@/contexts/groundwater_assessment/drain/TrendContext";
import { useWell } from '@/contexts/groundwater_assessment/drain/WellContext';
import { useLocation } from '@/contexts/groundwater_assessment/drain/LocationContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';

interface GroundwaterTrendProps {
  activeTab: string;
  step: number;
}

const GroundwaterTrend: React.FC<GroundwaterTrendProps> = ({ activeTab, step }) => {
  const {
    trendData,
    trendMethod,
    yearStart,
    yearEnd,
    returnType,
    isLoading,
    error,
    setTrendMethod,
    setYearStart,
    setYearEnd,
    setReturnType,
    handleGenerate,
    availableCharts,
    getChartImage,
  } = useContext(GroundwaterTrendContext);

  const { csvFilename, wellsData, isWellTableSaved } = useWell();
  const { selectedVillages } = useLocation();

  const [activeResultTab, setActiveResultTab] = useState<'overview' | 'table' | 'charts' | 'map'>('overview');
  const [villageFilter, setVillageFilter] = useState<string>('');
  const [trendFilter, setTrendFilter] = useState<string>('All');

  // Extract available years from wells data columns
  const availableYears = useMemo(() => {
    if (!wellsData || wellsData.length === 0 || !isWellTableSaved) {
      return {
        allYears: [],
        minYear: '',
        maxYear: ''
      };
    }

    const columns = Object.keys(wellsData[0] || {});
    const years = columns
      .filter(col => col.match(/^(PRE|POST)_(\d{4})$/i))
      .map(col => col.replace(/^(PRE|POST)_/i, ''))
      .filter(year => !isNaN(parseInt(year)))
      .sort((a, b) => parseInt(a) - parseInt(b));

    const uniqueYears = [...new Set(years)];

    return {
      allYears: uniqueYears,
      minYear: uniqueYears[0] || '',
      maxYear: uniqueYears[uniqueYears.length - 1] || ''
    };
  }, [wellsData, isWellTableSaved]);

  const yearsToShow = availableYears.allYears;

  const isFormValid = () => {
    if (!trendMethod || !yearStart || !yearEnd || !csvFilename || !isWellTableSaved) {
      return false;
    }
    if (!selectedVillages || selectedVillages.length === 0) {
      return false;
    }
    const yearStartNum = parseInt(yearStart);
    const yearEndNum = parseInt(yearEnd);
    return !isNaN(yearStartNum) && !isNaN(yearEndNum) && yearStartNum < yearEndNum;
  };

  // Prepare data for trend distribution pie chart
  const trendDistributionData = useMemo(() => {
    if (!trendData?.summary_stats?.trend_distribution) return [];
    const { trend_distribution } = trendData.summary_stats;
    return [
      { name: 'Increasing', value: trend_distribution.increasing, color: '#FF6B6B' },
      { name: 'Decreasing', value: trend_distribution.decreasing, color: '#4ECDC4' },
      { name: 'No-Trend', value: trend_distribution.no_trend, color: '#95A5A6' },
      { name: 'Insufficient Data', value: trend_distribution.insufficient_data, color: '#F39C12' },
    ].filter(item => item.value > 0);
  }, [trendData]);

  // Filter villages based on search and trend filter
  const filteredVillages = useMemo(() => {
    if (!trendData?.villages) return [];

    return trendData.villages.filter((village: any) => {
      const matchesSearch = !villageFilter ||
        village.Village_Name?.toLowerCase().includes(villageFilter.toLowerCase()) ||
        village.Village_ID?.toString().includes(villageFilter) ||
        village.Block?.toLowerCase().includes(villageFilter.toLowerCase()) ||
        village.District?.toLowerCase().includes(villageFilter.toLowerCase());

      const matchesTrend = trendFilter === 'All' || village.Trend_Status === trendFilter;

      return matchesSearch && matchesTrend;
    });
  }, [trendData?.villages, villageFilter, trendFilter]);

  return (
    <div className="h-full overflow-auto flex flex-col relative">
      {/* Full Screen Loading Overlay */}
      {/* Full Screen Loading Overlay */}
      {/* Full Screen Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-2xl p-8">
            <div className="inline-block relative">
              {/* Outer rotating gradient ring */}
              <svg
                className="animate-spin h-20 w-20"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <defs>
                  <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="spinner-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <circle
                  className="opacity-20"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="url(#spinner-gradient)"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  fill="url(#spinner-gradient-2)"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>

              {/* Pulsing center dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
            </div>

            <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Processing Trend Analysis...
            </p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we analyze your groundwater data</p>
          </div>
        </div>
      )}
      <h3 className="font-medium text-blue-600 mb-4">Groundwater Trend Analysis (Step {step})</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Trend Analysis Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {(!wellsData || wellsData.length === 0 || !isWellTableSaved) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm text-amber-700">
              <p className="font-medium">Wells Data Required</p>
              <p className="mt-1">
                Please complete Step 2 (Well Selection) and save your wells data before performing trend analysis.
                {!isWellTableSaved && wellsData && wellsData.length > 0 && " Your wells data is not saved yet - please click 'Save Wells Table' in Step 2."}
              </p>
            </div>
          </div>
        </div>
      )}

      {(!selectedVillages || selectedVillages.length === 0) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <div className="text-sm text-amber-700">
              <p className="font-medium">Area Selection Required</p>
              <p className="mt-1">Please select villages in Step 1 before performing trend analysis.</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trend Analysis Method <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value="Mann-Kendall Test"
            readOnly
            className="w-full p-2 border rounded-md text-sm bg-gray-100 text-gray-700"
          />
          {/* still send value with form */}
          <input type="hidden" name="trendMethod" value="mann_kendall" />
        </div>


        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Year <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={yearStart}
              onChange={(e) => {
                setYearStart(e.target.value);
                if (yearEnd && parseInt(e.target.value) >= parseInt(yearEnd)) {
                  setYearEnd('');
                }
              }}
              disabled={isLoading || yearsToShow.length === 0}
            >
              <option value="">
                {yearsToShow.length === 0 ? "No years available" : "Select from year"}
              </option>
              {yearsToShow.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Year <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={yearEnd}
              onChange={(e) => setYearEnd(e.target.value)}
              disabled={isLoading || !yearStart || yearsToShow.length === 0}
            >
              <option value="">
                {!yearStart ? "Select from year first" : yearsToShow.length === 0 ? "No years available" : "Select to year"}
              </option>
              {yearsToShow
                .filter(year => !yearStart || parseInt(year) > parseInt(yearStart))
                .map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {yearStart && yearEnd && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-700">
                <p className="font-medium">Analysis Configuration</p>
                <div className="mt-1 space-y-1">
                  <p>
                    Trend analysis will be performed for {parseInt(yearEnd) - parseInt(yearStart) + 1} years
                    ({yearStart} to {yearEnd}).
                  </p>

                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
        <span className="whitespace-nowrap">Generate Trend Analysis</span>
      </button>

      {trendData && !error && !isLoading && (
        <div className="mt-4 space-y-4">
          <div className="mt-6 bg-white border border-gray-200 rounded-lg">
            <div className="border-b border-gray-200">
              <nav className="flex px-6">
                {[
                  { id: 'overview', name: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                  { id: 'table', name: 'Village Data', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveResultTab(tab.id as any)}
                    className={`${activeResultTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } flex-1 py-4 px-1 border-b-2 font-medium text-sm flex items-center justify-center gap-2`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                    </svg>
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>


            <div className="p-6 max-h-[800px] overflow-y-auto">
              {activeResultTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-5 gap-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-blue-600">Total Villages</p>
                          <p className="text-2xl font-semibold text-blue-900">{trendData.summary_stats?.file_info?.total_villages || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-red-600">Increasing Trends</p>
                          <p className="text-2xl font-semibold text-red-900">{trendData.summary_stats?.trend_distribution?.increasing || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-green-600">Decreasing Trends</p>
                          <p className="text-2xl font-semibold text-green-900">{trendData.summary_stats?.trend_distribution?.decreasing || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">No Trend</p>
                          <p className="text-2xl font-semibold text-gray-900">{trendData.summary_stats?.trend_distribution?.no_trend || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-yellow-600">Significant Trends</p>
                          <p className="text-2xl font-semibold text-yellow-900">{trendData.summary_stats?.statistical_summary?.significant_trends_count || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>



                  <div className="w-full">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Trend Distribution</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={trendDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => [`${value} villages`, "Villages"]} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {trendDistributionData.map((entry, index) => (
                              <Cell key={`bar-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        {trendDistributionData.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: entry.color }}
                            ></div>
                            <span>{entry.name}: {entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>


                </div>
              )}

              {activeResultTab === 'table' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-800">Village Trend Analysis Results</h4>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        placeholder="Search villages..."
                        value={villageFilter}
                        onChange={(e) => setVillageFilter(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={trendFilter}
                        onChange={(e) => setTrendFilter(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="All">All Trends</option>
                        <option value="Increasing">Increasing</option>
                        <option value="Decreasing">Decreasing</option>
                        <option value="No-Trend">No Trend</option>
                        <option value="Insufficient Data">Insufficient Data</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    Showing {filteredVillages.length} of {trendData.villages?.length || 0} villages
                  </div>

                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Village Details</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statistics</th>
                          {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Quality</th> */}
                          {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depth Info</th> */}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredVillages.map((village: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{village.Village_Name}</div>
                              <div className="text-sm text-gray-500">ID: {village.Village_ID}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>{village.Block}</div>
                              <div className="text-xs text-gray-500">{village.District}</div>
                              {village.SUBDIS_COD && (
                                <div className="text-xs text-gray-400">SUBDIS: {village.SUBDIS_COD}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${village.Trend_Status === 'Increasing' ? 'bg-red-100 text-red-800' :
                                village.Trend_Status === 'Decreasing' ? 'bg-green-100 text-green-800' :
                                  village.Trend_Status === 'No-Trend' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {village.Trend_Status?.replace('-', ' ') || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {village.P_Value && village.P_Value < 0.05 ?
                                  (village.P_Value < 0.01 ? '99% Significant' : '95% Significant') :
                                  'Not Significant'
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>τ: {village.Mann_Kendall_Tau?.toFixed(4) || 'N/A'}</div>
                              <div>P: {village.P_Value?.toFixed(4) || 'N/A'}</div>
                              <div>Slope : {village.Sen_Slope?.toFixed(4) || 'N/A'}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default GroundwaterTrend;