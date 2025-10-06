"use client";

import React, { useState } from 'react';
import { useDemand } from '@/contexts/groundwater_assessment/drain/DemandContext';
import { useLocation } from '@/contexts/groundwater_assessment/drain/LocationContext';
import { useWell } from '@/contexts/groundwater_assessment/drain/WellContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const Demand = () => {
  const {
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
    // Chart states - Updated for new structure
    chartData,
    chartsError,
    domesticTableData,
    agriculturalTableData,
    industrialTableData,
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
    // Chart actions
    clearChartData,
    setKharifChecked,
    setRabiChecked,
    setZaidChecked,
    toggleCropSelection,
    computeDomesticDemand,
    computeAgriculturalDemand,
    computeIndustrialDemand,
    canComputeDomesticDemand,
    canComputeAgriculturalDemand,
    canComputeIndustrialDemand
  } = useDemand();

  const { selectedVillages } = useLocation();
  const { csvFilename } = useWell();
  const [showDomesticTable, setShowDomesticTable] = useState(false);
  const toggleDomesticTable = () => setShowDomesticTable((prev) => !prev);

  const [showAgriculturalTable, setShowAgriculturalTable] = useState(false);
  const toggleAgriculturalTable = () => setShowAgriculturalTable((prev) => !prev);
  const [showIndustrialTable, setShowIndustrialTable] = useState(false);
  const toggleIndustrialTable = () => setShowIndustrialTable((prev) => !prev);


  // State for chart selection between individual and cumulative charts
  const [selectedChart, setSelectedChart] = useState<'individual' | 'cumulative'>('individual');

  // *** CONFIGURABLE COLUMNS FOR DOMESTIC TABLE ***
  const domesticVisibleColumns = [
    'village_name',
    'demand_mld',
    'forecast_population',
    'target_year',
    'lpcd',
    // 'village_code',           // Uncomment to show village code
    // 'current_population',     // Uncomment to show current population
    // 'growth_rate',           // Uncomment to show growth rate
  ];

  // *** CONFIGURABLE COLUMNS FOR AGRICULTURAL TABLE ***
  const agriculturalVisibleColumns = [
    'village',
    // 'village_code',
    // 'subdistrict_code',
    'cropland',
    // 'index_sum_across_seasons_crops',
    // 'groundwater_factor',
    'village_demand',
    // 'total_irrigated_area',   // Uncomment to show total irrigated area
    // 'irrigation_method',      // Uncomment to show irrigation method
    // 'crop_intensity',         // Uncomment to show crop intensity
  ];

  // *** CONFIGURABLE COLUMNS FOR INDUSTRIAL TABLE ***
  const industrialVisibleColumns: string | string[] = [
    // Add the columns you want to show for industrial data
    // This will be populated based on your actual industrial API response
  ];

  // Custom table component for domestic demand with configurable columns
  const DomesticTableDisplay = ({ tableData, title }: { tableData: any[]; title: string }) => {
    if (tableData.length === 0) return null;

    // Get all available columns from the data
    const allColumns = Object.keys(tableData[0] || {});

    // Filter columns to only show those specified in domesticVisibleColumns
    const columnsToShow = allColumns.filter(column => domesticVisibleColumns.includes(column));

    // Function to format column headers for domestic table
    const formatDomesticHeader = (header: string): string => {
      const headerMap: { [key: string]: string } = {
        'village_name': 'Village Name',
        'village_code': 'Village Code',
        'demand_mld': 'Demand (M³/Year)',
        'forecast_population': 'Forecasted Population',
        'current_population': 'Current Population',
        'target_year': 'Target Year',
        'lpcd': 'LPCD',
        'growth_rate': 'Growth Rate (%)',
      };

      return headerMap[header] || header.replace(/_/g, ' ').toUpperCase();
    };

    // Function to format cell values for domestic table
    const formatDomesticCellValue = (value: any, column: string): string => {
      if (value === null || value === undefined) return 'N/A';

      if (column === 'demand_mld' && typeof value === 'number') {
        return value.toFixed(2);
      }

      return String(value);
    };

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="text-md font-semibold text-gray-800">{title}</h4>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  S.No.
                </th>
                {columnsToShow.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider"
                  >
                    {formatDomesticHeader(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {index + 1}
                  </td>
                  {columnsToShow.map((column) => (
                    <td
                      key={column}
                      className={`px-4 py-3 text-sm whitespace-nowrap ${column === 'demand_mld' ? 'font-semibold text-blue-700' : 'text-gray-900'
                        }`}
                    >
                      {formatDomesticCellValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing {tableData.length} record{tableData.length !== 1 ? 's' : ''} with {columnsToShow.length} column{columnsToShow.length !== 1 ? 's' : ''}
        </div>
      </div>
    );
  };

  // Agricultural table component with configurable columns
  const AgriculturalTableDisplay = ({ tableData, title }: { tableData: any[]; title: string }) => {
    if (tableData.length === 0) return null;

    // Get all available columns from the data
    const allColumns = Object.keys(tableData[0] || {});

    // Filter columns to only show those specified in agriculturalVisibleColumns
    const columnsToShow = allColumns.filter(column => agriculturalVisibleColumns.includes(column));

    // Function to format column headers for agricultural table
    const formatAgriculturalHeader = (header: string): string => {
      const headerMap: { [key: string]: string } = {
        'village': 'Village Name',
        'cropland': 'Cropland (M²)',
        'village_demand': 'Village Demand (M³/Year)',
      };

      return headerMap[header] || header.replace(/_/g, ' ').toUpperCase();
    };

    // Function to format cell values for agricultural table
    const formatAgriculturalCellValue = (value: any, column: string): string => {
      if (value === null || value === undefined) return 'N/A';

      if (typeof value === 'number') {
        if (column === 'cropland') {
          return value.toFixed(2);
        } else if (column === 'village_demand') {
          return value.toFixed(3);
        }
      }

      return String(value);
    };

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="text-md font-semibold text-gray-800">{title}</h4>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  S.No.
                </th>
                {columnsToShow.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider"
                  >
                    {formatAgriculturalHeader(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {index + 1}
                  </td>
                  {columnsToShow.map((column) => (
                    <td
                      key={column}
                      className={`px-4 py-3 text-sm whitespace-nowrap ${column === 'village_demand' ? 'font-semibold text-green-700' : 'text-gray-900'
                        }`}
                    >
                      {formatAgriculturalCellValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing {tableData.length} village{tableData.length !== 1 ? 's' : ''} with {columnsToShow.length} column{columnsToShow.length !== 1 ? 's' : ''} displayed
        </div>
      </div>
    );
  };

  // NEW: Interactive Chart Display Component using Recharts
  const ChartDisplay = () => {
    if (!chartData) return null;

    // Prepare data for individual crops chart
    const individualCropsData = chartData.individual_crops.months.map((month, index) => {
      const dataPoint: any = { month };
      Object.keys(chartData.individual_crops.crops_data).forEach(crop => {
        dataPoint[crop] = chartData.individual_crops.crops_data[crop][index];
      });
      return dataPoint;
    });

    // Prepare data for cumulative demand chart
    const cumulativeData = chartData.cumulative_demand.months.map((month, index) => ({
      month,
      demand: chartData.cumulative_demand.values[index]
    }));

    // Generate colors for crops
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', '#00ffff', '#ff0000'];
    const cropNames = Object.keys(chartData.individual_crops.crops_data);

    return (
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Agricultural Water Demand Analysis
        </h4>

        {/* Chart Selection Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setSelectedChart('individual')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${selectedChart === 'individual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Individual Crops
              </button>
              <button
                onClick={() => setSelectedChart('cumulative')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${selectedChart === 'cumulative'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Total Demand
              </button>
            </nav>
          </div>
        </div>

        {/* Interactive Chart Display Based on Selection */}
        <div className="chart-display bg-white p-4 rounded-lg border border-gray-200">
          {selectedChart === 'individual' ? (
            <div>
              <h5 className="text-md font-semibold text-gray-700 mb-4">
                {chartData.individual_crops.title}
              </h5>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={individualCropsData}
                  margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"

                  />
                  <YAxis
                    label={{ value: chartData.individual_crops.y_label, angle: -90, position: 'insideLeft', offset: 20, dy: 80 }}
                  />
                  <Tooltip
                    labelFormatter={(label) => `Month: ${label}`}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        // Filter out crops with value 0
                        const filteredPayload = payload.filter((entry) => entry.value !== 0);

                        if (!filteredPayload.length) return null;

                        return (
                          <div className="bg-white p-2 shadow-md rounded border text-xs">
                            <p className="font-semibold">{`Month: ${label}`}</p>
                            {filteredPayload.map((entry, index) => (
                              <p key={`item-${index}`} style={{ color: entry.color }}>
                                {`${entry.name}: ${Number(entry.value).toFixed(2)} mm`}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Legend />
                  {cropNames.map((crop, index) => (
                    <Line
                      key={crop}
                      type="monotone"
                      dataKey={crop}
                      stroke={colors[index % colors.length]}
                      strokeWidth={0}
                      strokeOpacity={0}
                      name={crop}
                      dot={{
                        fill: colors[index % colors.length],
                        stroke: colors[index % colors.length],
                        r: 4
                      }}
                      activeDot={{
                        fill: colors[index % colors.length],
                        stroke: colors[index % colors.length],
                        r: 6
                      }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div>
              <h5 className="text-md font-semibold text-gray-700 mb-4">
                {chartData.cumulative_demand.title}
              </h5>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"

                  />
                  <YAxis
                    label={{ value: chartData.cumulative_demand.y_label, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(2)} mm`, 'Total Demand']}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="demand"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Generic table component for Industrial demand with configurable columns
  const TableDisplay = ({ tableData, title }: { tableData: any[]; title: string }) => {
    if (tableData.length === 0) return null;

    // Get all available columns from the data
    const allColumns = Object.keys(tableData[0] || {});

    // Filter columns - if industrialVisibleColumns is empty, show all columns
    const columnsToShow = industrialVisibleColumns.length > 0
      ? allColumns.filter(column => industrialVisibleColumns.includes(column))
      : allColumns;

    // Function to format column headers for industrial table
    const formatIndustrialHeader = (header: string): string => {
      return header.replace(/_/g, ' ').toUpperCase();
    };

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="text-md font-semibold text-gray-800">{title}</h4>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  S.No.
                </th>
                {columnsToShow.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider"
                  >
                    {formatIndustrialHeader(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {index + 1}
                  </td>
                  {columnsToShow.map((column) => (
                    <td
                      key={column}
                      className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                    >
                      {String(row[column] || 'N/A')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing {tableData.length} record{tableData.length !== 1 ? 's' : ''} with {columnsToShow.length} column{columnsToShow.length !== 1 ? 's' : ''} displayed
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
      <h3 className="text-lg font-semibold text-green-800 mb-3">Groundwater Demand Assessment</h3>

      {/* Demand Type Checkboxes */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Demand Types:</label>
        <div className="flex flex-row space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={domesticChecked}
              onChange={(e) => setDomesticChecked(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Domestic</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={agriculturalChecked}
              onChange={(e) => setAgriculturalChecked(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Agricultural</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={industrialChecked}
              onChange={(e) => setIndustrialChecked(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Industrial</span>
          </label>
        </div>
      </div>

      {/* DOMESTIC DEMAND SECTION */}
      {domesticChecked && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          {/* Domestic Loading Overlay */}
          {domesticLoading && (
            <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="text-center bg-white rounded-xl shadow-2xl p-8">
                <div className="inline-block relative">
                  <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <defs>
                      <linearGradient id="spinner-gradient-domestic" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#EC4899" />
                      </linearGradient>
                      <linearGradient id="spinner-gradient-2-domestic" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="50%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-domestic)" strokeWidth="3" />
                    <path className="opacity-90" fill="url(#spinner-gradient-2-domestic)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Computing Domestic Demand...
                </p>
                <p className="text-sm text-gray-500 mt-2">Please wait while we calculate domestic water requirements</p>
              </div>
            </div>
          )}
          <h4 className="text-md font-semibold text-blue-800 mb-3">Domestic Demand Parameters</h4>

          {/* Per Capita Consumption Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Per Capita Consumption (LPCD)
            </label>
            <input
              type="number"
              value={perCapitaConsumption}
              onChange={(e) => setPerCapitaConsumption(Number(e.target.value))}
              className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter LPCD value"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: 60 LPCD (Litres Per Capita Per Day)
            </p>
          </div>

          {/* Requirements Check */}
          {!canComputeDomesticDemand() && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-400 text-amber-700 rounded-md">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="font-medium">Requirements Not Met</p>
                  <div className="text-sm mt-1">
                    <p>Missing requirements:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {selectedVillages.length === 0 && <li>Village selection required</li>}
                      {perCapitaConsumption <= 0 && <li>LPCD must be greater than 0</li>}
                      {!csvFilename && <li>CSV file with well data required</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {domesticError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium">Computation Failed</p>
                  <p className="text-sm mt-1">{domesticError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Buttons Row */}
          <div className="mb-4 flex items-center gap-4">
            {/* Compute Button */}
            <button
              onClick={computeDomesticDemand}
              disabled={domesticLoading || !canComputeDomesticDemand()}
              className={`inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5
      ${domesticLoading || !canComputeDomesticDemand()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"}`}
            >
              {domesticLoading ? "Computing Domestic Demand..." : "Compute Domestic Demand"}
            </button>

            {/* Show/Hide Table Button */}
            {domesticTableData.length > 0 && (
              <button
                onClick={toggleDomesticTable}
                className={`inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5 shadow-md
        ${showDomesticTable
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"}`}
              >
                <svg
                  className={[
                    "w-4 h-4 transition-transform",
                    showAgriculturalTable ? "rotate-180" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {showDomesticTable ? "Hide Table" : "Show Domestic Demand Table"}
              </button>
            )}
          </div>

          {/* Domestic Table */}
          {showDomesticTable && domesticTableData.length > 0 && (
            <DomesticTableDisplay
              tableData={domesticTableData}
              title="Groundwater Consumption for Domestic Need"
            />
          )}

        </div>
      )}

      {/* AGRICULTURAL DEMAND SECTION */}
      {agriculturalChecked && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          {/* Agricultural Loading Overlay */}
          {agriculturalLoading && (
            <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="text-center bg-white rounded-xl shadow-2xl p-8">
                <div className="inline-block relative">
                  <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <defs>
                      <linearGradient id="spinner-gradient-agricultural" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#EC4899" />
                      </linearGradient>
                      <linearGradient id="spinner-gradient-2-agricultural" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="50%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-agricultural)" strokeWidth="3" />
                    <path className="opacity-90" fill="url(#spinner-gradient-2-agricultural)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Computing Agricultural Demand...
                </p>
                <p className="text-sm text-gray-500 mt-2">Please wait while we calculate agricultural water requirements</p>
              </div>
            </div>
          )}
          <h4 className="text-md font-semibold text-yellow-800 mb-3">
            Agricultural Demand Parameters
          </h4>

          {/* Season Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Seasons:
            </label>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={kharifChecked}
                  onChange={(e) => setKharifChecked(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">Kharif</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rabiChecked}
                  onChange={(e) => setRabiChecked(e.target.checked)}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">Rabi</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={zaidChecked}
                  onChange={(e) => setZaidChecked(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">Zaid</span>
              </label>
            </div>
          </div>

          {/* 3-Column Grid for Season Crops */}
          {(kharifChecked || rabiChecked || zaidChecked) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Kharif Column */}
              {kharifChecked && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-green-800">
                      Kharif Season Crops
                    </h5>
                    {availableCrops.Kharif?.length > 0 && (
                      <label className="flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            selectedCrops.Kharif?.length === availableCrops.Kharif.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              availableCrops.Kharif.forEach((crop) => {
                                if (!selectedCrops.Kharif?.includes(crop)) {
                                  toggleCropSelection("Kharif", crop);
                                }
                              });
                            } else {
                              availableCrops.Kharif.forEach((crop) => {
                                if (selectedCrops.Kharif?.includes(crop)) {
                                  toggleCropSelection("Kharif", crop);
                                }
                              });
                            }
                          }}
                          className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-1"
                        />
                        Select All
                      </label>
                    )}
                  </div>

                  {cropsLoading.Kharif ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      Loading crops...
                    </div>
                  ) : cropsError.Kharif ? (
                    <p className="text-sm text-red-600">Error: {cropsError.Kharif}</p>
                  ) : availableCrops.Kharif && availableCrops.Kharif.length > 0 ? (
                    <div className="space-y-2">
                      {availableCrops.Kharif.map((crop) => (
                        <label key={crop} className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={selectedCrops.Kharif?.includes(crop) || false}
                            onChange={() => toggleCropSelection("Kharif", crop)}
                            className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-2"
                          />
                          <span className="text-gray-700">{crop}</span>
                        </label>
                      ))}

                      {selectedCrops.Kharif && selectedCrops.Kharif.length > 0 && (
                        <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-700">
                          ✓ Selected: {selectedCrops.Kharif.length} crop
                          {selectedCrops.Kharif.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No crops available for Kharif season.
                    </p>
                  )}
                </div>
              )}

              {/* Rabi Column */}
              {rabiChecked && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-orange-800">
                      Rabi Season Crops
                    </h5>
                    {availableCrops.Rabi?.length > 0 && (
                      <label className="flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            selectedCrops.Rabi?.length === availableCrops.Rabi.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              availableCrops.Rabi.forEach((crop) => {
                                if (!selectedCrops.Rabi?.includes(crop)) {
                                  toggleCropSelection("Rabi", crop);
                                }
                              });
                            } else {
                              availableCrops.Rabi.forEach((crop) => {
                                if (selectedCrops.Rabi?.includes(crop)) {
                                  toggleCropSelection("Rabi", crop);
                                }
                              });
                            }
                          }}
                          className="h-3 w-3 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mr-1"
                        />
                        Select All
                      </label>
                    )}
                  </div>

                  {cropsLoading.Rabi ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      Loading crops...
                    </div>
                  ) : cropsError.Rabi ? (
                    <p className="text-sm text-red-600">Error: {cropsError.Rabi}</p>
                  ) : availableCrops.Rabi && availableCrops.Rabi.length > 0 ? (
                    <div className="space-y-2">
                      {availableCrops.Rabi.map((crop) => (
                        <label key={crop} className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={selectedCrops.Rabi?.includes(crop) || false}
                            onChange={() => toggleCropSelection("Rabi", crop)}
                            className="h-3 w-3 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mr-2"
                          />
                          <span className="text-gray-700">{crop}</span>
                        </label>
                      ))}

                      {selectedCrops.Rabi && selectedCrops.Rabi.length > 0 && (
                        <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-700">
                          ✓ Selected: {selectedCrops.Rabi.length} crop
                          {selectedCrops.Rabi.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No crops available for Rabi season.
                    </p>
                  )}
                </div>
              )}

              {/* Zaid Column */}
              {zaidChecked && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-purple-800">
                      Zaid Season Crops
                    </h5>
                    {availableCrops.Zaid?.length > 0 && (
                      <label className="flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            selectedCrops.Zaid?.length === availableCrops.Zaid.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              availableCrops.Zaid.forEach((crop) => {
                                if (!selectedCrops.Zaid?.includes(crop)) {
                                  toggleCropSelection("Zaid", crop);
                                }
                              });
                            } else {
                              availableCrops.Zaid.forEach((crop) => {
                                if (selectedCrops.Zaid?.includes(crop)) {
                                  toggleCropSelection("Zaid", crop);
                                }
                              });
                            }
                          }}
                          className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mr-1"
                        />
                        Select All
                      </label>
                    )}
                  </div>

                  {cropsLoading.Zaid ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      Loading crops...
                    </div>
                  ) : cropsError.Zaid ? (
                    <p className="text-sm text-red-600">Error: {cropsError.Zaid}</p>
                  ) : availableCrops.Zaid && availableCrops.Zaid.length > 0 ? (
                    <div className="space-y-2">
                      {availableCrops.Zaid.map((crop) => (
                        <label key={crop} className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={selectedCrops.Zaid?.includes(crop) || false}
                            onChange={() => toggleCropSelection("Zaid", crop)}
                            className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mr-2"
                          />
                          <span className="text-gray-700">{crop}</span>
                        </label>
                      ))}

                      {selectedCrops.Zaid && selectedCrops.Zaid.length > 0 && (
                        <div className="mt-3 p-2 bg-purple-100 rounded text-xs text-purple-700">
                          ✓ Selected: {selectedCrops.Zaid.length} crop
                          {selectedCrops.Zaid.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No crops available for Zaid season.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Groundwater Factor Input */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Groundwater Irrigation Factor
            </label>
            <input
              type="number"
              value={groundwaterFactor}
              onChange={(e) => setGroundwaterFactor(Number(e.target.value))}
              className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter groundwater factor"
              min="0"
              max="1"
              step="0.1"
            />
          </div>

          {/* Error Display */}
          {agriculturalError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <p className="font-medium">Computation Failed</p>
              <p className="text-sm mt-1">{agriculturalError}</p>
            </div>
          )}

          {/* Charts Error Display */}
          {chartsError && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
              <p className="font-medium">Chart Generation Warning</p>
              <p className="text-sm mt-1">{chartsError}</p>
            </div>
          )}

          {/* Compute Button */}
          {/* Buttons Row */}
          <div className="mb-4 flex items-center gap-4 mt-4">
            <button
              onClick={computeAgriculturalDemand}
              disabled={agriculturalLoading || !canComputeAgriculturalDemand()}
              className={`inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5
      ${agriculturalLoading || !canComputeAgriculturalDemand()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"}`}
            >
              {agriculturalLoading ? "Computing Agricultural Demand..." : "Compute Agricultural Demand"}
            </button>

            {agriculturalTableData.length > 0 && (
              <button
                onClick={toggleAgriculturalTable}
                className={`inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5 shadow-md
        ${showAgriculturalTable
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"}`}
              >
                <svg
                  className={[
                    "w-4 h-4 transition-transform",
                    showAgriculturalTable ? "rotate-180" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {showAgriculturalTable ? "Hide Table" : "Show Agricultural Demand Table"}
              </button>
            )}
          </div>

          {/* Agricultural Table */}
          {showAgriculturalTable && agriculturalTableData.length > 0 && (
            <AgriculturalTableDisplay
              tableData={agriculturalTableData}
              title="Groundwater Consumption for Agricultural Need"
            />
          )}
          {/* Chart Display */}
          <ChartDisplay />
        </div>
      )}


      {/* INDUSTRIAL DEMAND SECTION */}
      {industrialChecked && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
          {/* Industrial Loading Overlay */}
          {industrialLoading && (
            <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="text-center bg-white rounded-xl shadow-2xl p-8">
                <div className="inline-block relative">
                  <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <defs>
                      <linearGradient id="spinner-gradient-industrial" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#EC4899" />
                      </linearGradient>
                      <linearGradient id="spinner-gradient-2-industrial" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="50%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-industrial)" strokeWidth="3" />
                    <path className="opacity-90" fill="url(#spinner-gradient-2-industrial)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Computing Industrial Demand...
                </p>
                <p className="text-sm text-gray-500 mt-2">Please wait while we calculate industrial water requirements</p>
              </div>
            </div>
          )}
          <h4 className="text-md font-semibold text-purple-800 mb-3">Industrial Demand Parameters</h4>

          {/* Error Display */}
          {industrialError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium">Computation Failed</p>
                  <p className="text-sm mt-1">{industrialError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Compute Button */}
          {/* Buttons Row */}
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={computeIndustrialDemand}
              disabled={industrialLoading || !canComputeIndustrialDemand()}
              className={`inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5
      ${industrialLoading || !canComputeIndustrialDemand()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 shadow-md focus:outline-none focus:ring-4 focus:ring-purple-400 focus:ring-opacity-50"}`}
            >
              {industrialLoading ? "Computing Industrial Demand..." : "Compute Industrial Demand"}
            </button>

            {industrialTableData.length > 0 && (
              <button
                onClick={toggleIndustrialTable}
                className={`inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5 shadow-md
        ${showIndustrialTable
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
                    : "bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800"}`}
              >
                <svg
                  className={[
                    "w-4 h-4 transition-transform",
                    showAgriculturalTable ? "rotate-180" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {showIndustrialTable ? "Hide Table" : "Show Table"}
              </button>
            )}
          </div>

          {/* Industrial Table */}
          {showIndustrialTable && industrialTableData.length > 0 && (
            <TableDisplay tableData={industrialTableData} title="Industrial Demand Results" />
          )}

        </div>
      )}
    </div>
  );
};

export default Demand;
