"use client";

import React, { useState } from 'react';
import Recharge from './Recharge';
import Demand from './demand';
import { RechargeProvider, useRecharge } from '@/contexts/groundwater_assessment/drain/RechargeContext';
import { DemandProvider, useDemand } from '@/contexts/groundwater_assessment/drain/DemandContext';
import { GSRProvider, useGSR } from '@/contexts/groundwater_assessment/drain/GSRContext';

interface GSRProps {
  step: number;
}

// UPDATED: Stress Identification Component for Drain Case - Now uses new stress structure
const StressIdentification: React.FC = () => {
  const [yearsCount, setYearsCount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stressData, setStressData] = useState<any[]>([]);
  const [showStressTable, setShowStressTable] = useState(true);
  const { gsrTableData, computeStressIdentification, canComputeStressIdentification } = useGSR();


  const handleComputeStress = async () => {
    if (!yearsCount.trim()) {
      setError('Please enter number of years');
      return;
    }

    const yearsNum = parseInt(yearsCount);
    if (isNaN(yearsNum) || yearsNum < 1 || yearsNum > 50) {
      setError('Please enter a valid number of years between 1 and 50');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await computeStressIdentification(yearsNum);
      setStressData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute drain MAR Need Assessment');
    } finally {
      setLoading(false);
    }
  };

  // UPDATED Drain Stress Data Table Display - New structure
  const StressTableDisplay = ({ tableData }: { tableData: any[] }) => {
    if (tableData.length === 0) return null;

    // Updated visible columns to match new backend structure
    const visibleColumns = [
      'village_name',
      'recharge',
      'total_demand',
      'injection',
      'stress_value'  // Only stress value, no classification
    ];

    const formatHeader = (header: string): string => {
      const headerMap: { [key: string]: string } = {
        'village_name': 'Village Name',
        'village_code': 'Village Code',
        'recharge': 'Recharge (M³)',
        'total_demand': 'Total Demand (M³)',
        'injection': 'Recoverable Potential',
        'years_count': 'Years',
        'stress_value': 'Injection Need(M³/year)'
      };
      return headerMap[header] || header.replace(/_/g, ' ').toUpperCase();
    };

    // UPDATED cell formatting for stress values
    const formatCellValue = (value: any, column: string): string => {
      if (value === null || value === undefined) return '-';

      // Format numbers with appropriate precision
      if (typeof value === 'number') {
        if (['recharge', 'total_demand', 'injection', 'stress_value'].includes(column)) {
          return value.toFixed(4);  // 4 decimal places for precision
        } else {
          return value.toString();
        }
      }

      return String(value);
    };

    // UPDATED cell classes for stress values - removed old classification logic
    const getCellClasses = (row: any, column: string): string => {
      const value = row[column];
      let baseClasses = "px-4 py-3 text-sm whitespace-nowrap";

      // Highlight stress_value column with color based on value
      if (column === 'stress_value') {
        baseClasses += " font-medium";

        if (typeof value === 'number') {
          if (value > 100) {
            baseClasses += " text-red-700";  // High stress - red
          } else if (value > 50) {
            baseClasses += " text-orange-600";  // Medium stress - orange  
          } else if (value > 0) {
            baseClasses += " text-yellow-600";  // Low stress - yellow
          } else {
            baseClasses += " text-green-700";  // No stress - green
          }
        } else {
          baseClasses += " text-gray-900";
        }
      } else {
        baseClasses += " text-gray-900";
      }

      return baseClasses;
    };

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">

          <h4 className="text-md font-semibold text-gray-800">
            MAR Need Assessment for {yearsCount} year{parseInt(yearsCount) !== 1 ? 's' : ''}
          </h4>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  S.No.
                </th>
                {visibleColumns.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider"
                  >
                    {formatHeader(header)}
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
                  {visibleColumns.map((column) => (
                    <td
                      key={column}
                      className={getCellClasses(row, column)}
                    >
                      {formatCellValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* UPDATED summary information with color legend */}
        {/* <div className="mt-2 text-sm text-gray-600 flex justify-between">
          <span>
            Showing {tableData.length} drain village{tableData.length !== 1 ? 's' : ''} with stress analysis
          </span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>High (&gt;100)</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span>Medium (50-100)</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Low (0-50)</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Minimal (0)</span>
            </span>
          </span>
        </div> */}
      </div>
    );
  };

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      {loading && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-2xl p-8">
            <div className="inline-block relative">
              <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <defs>
                  <linearGradient id="spinner-gradient-stress" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="spinner-gradient-2-stress" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-stress)" strokeWidth="3" />
                <path className="opacity-90" fill="url(#spinner-gradient-2-stress)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Computing Injection Need...
            </p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we assess MAR requirements</p>
          </div>
        </div>
      )}
      <h3 className="text-lg font-semibold text-red-800 mb-3">MAR Need Assessment</h3>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">MAR Need Assessment Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements Message */}
      {!canComputeStressIdentification() && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md">
          <p className="text-sm">
            <strong>Requirements for MAR Need Assessment:</strong>
          </p>
          <ul className="text-sm mt-1 ml-4 list-disc">
            <li className={gsrTableData.length > 0 ? 'text-green-700' : ''}>
              ✓  GSR analysis must be completed first {gsrTableData.length > 0 ? '(Available)' : '(Missing)'}
            </li>
          </ul>
        </div>
      )}

      {/* Input Section */}
      <div className="mb-4">
        <label htmlFor="years-input" className="block text-sm font-medium text-gray-700 mb-2">
          Enter number of design years for water injection assessment (between 1 and 50 years)
        </label>
        <div className="flex gap-3">
          <input
            id="years-input"
            type="number"
            value={yearsCount}
            onChange={(e) => setYearsCount(e.target.value)}
            placeholder="e.g. 5"
            min="1"
            max="50"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            disabled={loading || !canComputeStressIdentification()}
          />

        </div>

        {/* ADDED: Formula display for drain case */}
        {/* <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          <strong>Formula:</strong> Stress Value = |Recharge - Total Demand| + (Injection / Years Count)
        </div> */}
      </div>
      <div className="mb-4 flex items-center gap-4">
        {/* Compute Stress Button */}
        <button
          onClick={handleComputeStress}
          disabled={loading || !canComputeStressIdentification() || !yearsCount.trim()}
          className={[
            "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
            loading || !canComputeStressIdentification() || !yearsCount.trim()
              ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 focus:ring-yellow-400 focus:ring-opacity-50"
              : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 focus:ring-indigo-400 focus:ring-opacity-50",
          ].join(" ")}
        >
          {loading ? "Computing..." : "Compute Injection Need"}
        </button>

        {/* Toggle Button */}
        {stressData.length > 0 && (
        <button
  onClick={() => setShowStressTable(!showStressTable)}
  className="inline-flex items-center justify-center p-2 rounded-full focus:outline-none"
  aria-label={showStressTable ? "Hide Table" : "Show Table"}
  title={showStressTable ? "Hide Table" : "Show Table"}
>
  {showStressTable ? (
    // Eye icon (visible)
    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {/* Center circle */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      {/* Eye outline */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  ) : (
    // Eye-off icon (hidden)
    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {/* Center circle */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      {/* Eye outline with slash */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.94 17.94A10.016 10.016 0 0112 19
           c-4.477 0-8.268-2.943-9.542-7a9.96 9.96 0 012.293-3.95
           M6.06 6.06A9.991 9.991 0 0112 5c4.477 0 8.268 2.943 9.542 7
           a9.958 9.958 0 01-4.042 5.142"
      />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )}
</button>

        )}
      </div>

      {/* Stress Table */}
      {showStressTable && stressData.length > 0 && (
        <StressTableDisplay tableData={stressData} />
      )}

    </div>
  );
};

// GSR Analysis Component for Drain Case (unchanged)
const GSRAnalysis: React.FC = () => {
  const {
    gsrTableData,
    gsrLoading,
    gsrError,
    computeGSR,
    canComputeGSR,
  } = useGSR();

  // Get data from other contexts for status display
  const { tableData: rechargeTableData } = useRecharge();
  const { domesticTableData, agriculturalTableData } = useDemand();
  const [showGsrTable, setShowGsrTable] = useState(true);

  // *** CONFIGURABLE COLUMNS - Comment/uncomment to show/hide columns ***
  // These are the actual column names returned by your API
  const visibleColumns = [
    // 'village_code',
    'village_name',
    // 'subdistrict_code',
    'recharge',
    // 'domestic_demand',
    // 'agricultural_demand',      // Comment to hide
    'total_demand',
    'gsr',
    // 'gsr_status',
    'trend_status',               // ← NEW: Added trend status column
    'gsr_classification',         // ← NEW: Added GSR classification column
    // 'classification_color',       // ← NEW: Added GSR classification color
    // 'has_recharge_data',       // Uncomment to show this column
    // 'has_domestic_data',       // Uncomment to show this column  
    // 'has_agricultural_data',   // Uncomment to show this column
  ];

  // GSR Table Display Component with configurable columns
  const GSRTableDisplay = ({ tableData, title }: { tableData: any[]; title: string }) => {
    if (tableData.length === 0) return null;

    // 🔍 DEBUG: Log the actual data structure for drain case
    console.log('🔍 DEBUG - Drain GSR First row:', tableData[0]);
    console.log('🔍 DEBUG - Drain Available columns:', Object.keys(tableData[0] || {}));
    console.log('🔍 DEBUG - Drain GSR Classification:', tableData[0]?.gsr_classification);
    console.log('🔍 DEBUG - Drain Classification Color:', tableData[0]?.classification_color);

    // Get all available columns from the data
    const allColumns = Object.keys(tableData[0] || {});

    // Filter columns to only show those specified in visibleColumns
    const columnsToShow = allColumns.filter(column => visibleColumns.includes(column));

    // Function to format column headers
    const formatHeader = (header: string): string => {
      const headerMap: { [key: string]: string } = {
        'village_code': 'Village Code',
        'village_name': 'Village Name',
        'subdistrict_code': 'Sub-District Code',
        'recharge': 'Recharge (M³/Year)',
        'domestic_demand': 'Domestic Demand (M³/Year)',
        'agricultural_demand': 'Agricultural Demand (M³/Year)',
        'total_demand': 'Total Demand (M³/Year)',
        'gsr': 'GSR Ratio',
        'gsr_status': 'GSR Status',
        'trend_status': 'Trend Status',
        'gsr_classification': 'GSR Classification',  // ← NEW: Added classification header
        'classification_color': 'Classification Color',
        'has_recharge_data': 'Has Recharge Data',
        'has_domestic_data': 'Has Domestic Data',
        'has_agricultural_data': 'Has Agricultural Data'
      };

      return headerMap[header] || header.replace(/_/g, ' ').toUpperCase();
    };

    // Function to format cell values
    const formatCellValue = (value: any, column: string): string => {
      if (value === null || value === undefined) return '-';

      // Format numbers with appropriate precision
      if (typeof value === 'number') {
        if (['recharge', 'domestic_demand', 'agricultural_demand', 'total_demand'].includes(column)) {
          return value.toFixed(2);
        } else if (column === 'gsr') {
          return value.toFixed(4);
        } else {
          return value.toString();
        }
      }

      // Format boolean values
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }

      return String(value);
    };

    // Function to get cell CSS classes with dynamic colors from backend
    const getCellClasses = (row: any, column: string): string => {
      const value = row[column];
      let baseClasses = "px-4 py-3 text-sm whitespace-nowrap";

      if (column === 'gsr_status') {
        if (value === 'Sustainable') {
          baseClasses += " text-green-700 font-medium";
        } else if (value === 'Stressed') {
          baseClasses += " text-red-700 font-medium";
        } else if (value === 'No Demand') {
          baseClasses += " text-yellow-700 font-medium";
        } else {
          baseClasses += " text-gray-900";
        }
      }
      else if (column === 'trend_status') {
        if (value === 'Increasing') {
          baseClasses += " text-green-700 font-medium";
        } else if (value === 'Decreasing') {
          baseClasses += " text-red-700 font-medium";
        } else if (value === 'No Trend') {
          baseClasses += " text-gray-700 font-medium";
        } else if (value === 'No Trend Data') {
          baseClasses += " text-yellow-600 font-medium";
        } else {
          baseClasses += " text-gray-900";
        }
      }
      // ← NEW: GSR Classification styling with backend colors
      else if (column === 'gsr_classification') {
        baseClasses += " font-medium rounded px-2 py-1";

        // Check if we have the value first
        if (!value || value === null || value === undefined) {
          baseClasses += " text-gray-500 bg-gray-100";
          return baseClasses;
        }

        // Use backend-provided color if available
        const backendColor = row.classification_color;

        if (backendColor) {
          // Apply dynamic color from backend
          baseClasses += " text-white";
          return baseClasses; // We'll apply the background color via inline style
        } else {
          // Fallback to predefined colors
          const classificationValue = String(value).toLowerCase();
          if (classificationValue.includes('critical') && !classificationValue.includes('semi')) {
            baseClasses += " text-red-800 bg-red-100";
          } else if (classificationValue.includes('safe') && !classificationValue.includes('very')) {
            baseClasses += " text-green-800 bg-green-100";
          } else if (classificationValue.includes('very safe')) {
            baseClasses += " text-emerald-800 bg-emerald-100";
          } else if (classificationValue.includes('over exploited')) {
            baseClasses += " text-red-900 bg-red-200";
          } else if (classificationValue.includes('semi-critical')) {
            baseClasses += " text-orange-800 bg-orange-100";
          } else if (classificationValue.includes('unknown')) {
            baseClasses += " text-gray-700 bg-gray-100";
          } else if (classificationValue.includes('no data')) {
            baseClasses += " text-yellow-800 bg-yellow-100";
          } else {
            baseClasses += " text-gray-900 bg-gray-50";
          }
        }
      }
      else {
        baseClasses += " text-gray-900";
      }

      return baseClasses;
    };

    // Function to get inline style for backend colors
    const getInlineStyle = (row: any, column: string): React.CSSProperties => {
      if (column === 'gsr_classification') {
        const backendColor = row.classification_color;
        if (backendColor && backendColor !== null && backendColor !== undefined) {
          return {
            backgroundColor: backendColor,
            color: 'white'
          };
        }
      }
      return {};
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
                    {formatHeader(header)}
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
                      className={getCellClasses(row, column)}
                      style={getInlineStyle(row, column)} // ← NEW: Apply backend colors
                    >
                      {formatCellValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing {tableData.length} drain village{tableData.length !== 1 ? 's' : ''} with {columnsToShow.length} column{columnsToShow.length !== 1 ? 's' : ''}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-md">
      {/* GSR Loading Overlay */}
      {gsrLoading && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-2xl p-8">
            <div className="inline-block relative">
              <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <defs>
                  <linearGradient id="spinner-gradient-gsr" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="spinner-gradient-2-gsr" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-gsr)" strokeWidth="3" />
                <path className="opacity-90" fill="url(#spinner-gradient-2-gsr)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Computing GSR...
            </p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we calculate Groundwater Sustainability Ratio</p>
          </div>
        </div>
      )}
      <h3 className="text-lg font-semibold text-indigo-800 mb-3">Groundwater Sustainability Ratio</h3>

      {/* Error Display */}
      {gsrError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">GSR Computation Failed</p>
              <p className="text-sm mt-1">{gsrError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements Message */}
      {!canComputeGSR() && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md">
          <p className="text-sm">
            <strong>Requirements for Drain GSR Analysis:</strong>
          </p>
          <ul className="text-sm mt-1 ml-4 list-disc">
            <li>Villages must be selected from drain catchments</li>
            <li className={rechargeTableData.length > 0 ? 'text-green-700' : ''}>
              ✓ Recharge data must be computed first {rechargeTableData.length > 0 ? '(Available)' : '(Missing)'}
            </li>
            <li className={domesticTableData.length > 0 || agriculturalTableData.length > 0 ? 'text-green-700' : ''}>
              ✓ At least one demand type must be computed {domesticTableData.length > 0 || agriculturalTableData.length > 0 ? '(Available)' : '(Missing)'}
            </li>
          </ul>
        </div>
      )}

      {/* Compute GSR Button */}
      <div className="mb-4 flex items-center gap-4">
        {/* Compute GSR Button */}
        <button
          onClick={computeGSR}
          disabled={gsrLoading || !canComputeGSR()}
          className={[
            "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
            gsrLoading || !canComputeGSR()
              ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 focus:ring-yellow-400 focus:ring-opacity-50"
              : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 focus:ring-indigo-400 focus:ring-opacity-50",
          ].join(" ")}
        >
          {gsrLoading ? "Computing GSR..." : "Compute GSR"}
        </button>

        {/* Toggle Button */}
        {gsrTableData.length > 0 && (
          <button
            onClick={() => setShowGsrTable(!showGsrTable)}
            className="inline-flex items-center justify-center p-2 rounded-full focus:outline-none"
            aria-label={showGsrTable ? "Hide Table" : "Show Table"}
            title={showGsrTable ? "Hide Table" : "Show Table"}
          >
            {showGsrTable ? (
              // Eye icon (table visible)
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {/* Center circle */}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                {/* Eye outline */}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            ) : (
              // Eye-off icon (table hidden)
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {/* Center circle */}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                {/* Eye outline with slash */}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.94 17.94A10.016 10.016 0 0112 19
           c-4.477 0-8.268-2.943-9.542-7a9.96 9.96 0 012.293-3.95
           M6.06 6.06A9.991 9.991 0 0112 5c4.477 0 8.268 2.943 9.542 7
           a9.958 9.958 0 01-4.042 5.142"
                />
                <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            )}
          </button>

        )}
      </div>

      {/* GSR Table */}
      {showGsrTable && gsrTableData.length > 0 && (
        <GSRTableDisplay tableData={gsrTableData} title="GSR Analysis Results" />
      )}

    </div>
  );
};

const GSR: React.FC<GSRProps> = ({ step }) => {
  return (
    <div className="h-full overflow-auto flex flex-col">
      <div className="space-y-6">
        {/* Recharge Component */}

        <Recharge />

        {/* Demand Component - Wrapped with RechargeProvider to access recharge data */}

        <Demand />

        {/* GSR Analysis Component - Has access to both Recharge and Demand contexts */}

        <GSRAnalysis />

        {/* UPDATED: Stress Identification Component for Drain - Now uses new stress structure */}
        <StressIdentification />




      </div>
    </div>
  );
};

export default GSR;