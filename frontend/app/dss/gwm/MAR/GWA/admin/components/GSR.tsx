"use client";

import React, { useState, useMemo } from 'react';
import Recharge from './Recharge';
import Demand from './demand';
import { RechargeProvider, useRecharge } from '@/contexts/groundwater_assessment/admin/RechargeContext';
import { DemandProvider, useDemand } from '@/contexts/groundwater_assessment/admin/DemandContext';
import { GSRProvider, useGSR } from '@/contexts/groundwater_assessment/admin/GSRContext';

interface GSRProps {
  step: number;
}

// ======================================================================
// Stress Identification Component (MAR Need Assessment)
// ======================================================================
const StressIdentification: React.FC = () => {
  const [yearsCount, setYearsCount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stressData, setStressData] = useState<any[]>([]);

  const { gsrTableData, computeStressIdentification, canComputeStressIdentification } = useGSR();
  const [showStressTable, setShowStressTable] = useState(true);

  // --- Search & Sort States ---
  const [stressSearchInput, setStressSearchInput] = useState("");
  const [stressAppliedSearch, setStressAppliedSearch] = useState("");
  const [stressSortConfig, setStressSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // --- Field Definitions & Labels ---
  const STRESS_DISPLAY_FIELDS: string[] = [
    'village_name',
    'recharge',
    'total_demand',
    'injection',
    'stress_value'
  ];

  const STRESS_LABEL_MAP: Record<string, string> = {
    'village_name': 'Village Name',
    'recharge': 'Recharge (Million Litres/Year)',
    'total_demand': 'Total Demand (Million Litres/Year)',
    'injection': 'Recoverable Potential',
    'stress_value': 'Injection Need (Million Litres/Year)'
  };

  const formatStressLabel = (key: string) => STRESS_LABEL_MAP[key] || key.replace(/_/g, " ");

  // --- Handlers ---
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
      setError(err instanceof Error ? err.message : 'Failed to compute stress identification');
    } finally {
      setLoading(false);
    }
  };

  const handleStressApplySearch = () => {
    setStressAppliedSearch(stressSearchInput.trim());
  };

  const handleStressSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (stressSortConfig && stressSortConfig.key === key && stressSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setStressSortConfig({ key, direction });
  };

  const getStressSortIcon = (field: string) => {
    if (stressSortConfig?.key !== field) return null;
    return stressSortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-600">▲</span>
    ) : (
      <span className="ml-1 text-blue-600">▼</span>
    );
  };

  // --- Memoized Data Processing ---
  const processedStressData = useMemo(() => {
    let data = [...stressData];

    // Apply Search
    if (stressAppliedSearch) {
      data = data.filter(row =>
        String(row.village_name || "").toLowerCase().includes(stressAppliedSearch.toLowerCase())
      );
    }

    // Apply Sort
    if (stressSortConfig) {
      data.sort((a, b) => {
        const aValue = a[stressSortConfig.key];
        const bValue = b[stressSortConfig.key];

        if (aValue == null) return stressSortConfig.direction === 'asc' ? -1 : 1;
        if (bValue == null) return stressSortConfig.direction === 'asc' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return stressSortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return stressSortConfig.direction === 'asc'
            ? aValue - bValue
            : bValue - aValue;
        }
        return 0;
      });
    }

    return data;
  }, [stressData, stressAppliedSearch, stressSortConfig]);

  // --- Formatting ---
  const formatStressValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (['recharge', 'total_demand', 'injection', 'stress_value'].includes(key)) {
        return value.toFixed(2);
      }
    }
    return String(value);
  };

  const getStressCellClasses = (row: any, column: string): string => {
    const value = row[column];
    let baseClasses = "px-4 py-3 text-sm whitespace-nowrap";

    if (column === 'stress_value') {
      baseClasses += " font-medium";
      if (typeof value === 'number') {
        if (value > 0) baseClasses += " text-red-700";
        else baseClasses += " text-green-700";
      } else {
        baseClasses += " text-gray-900";
      }
    } else {
      baseClasses += " text-gray-900";
    }
    return baseClasses;
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

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {!canComputeStressIdentification() && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md">
          <p className="font-medium">Requirements Not Met</p>
          <p className="text-sm mt-1">Please ensure GSR is computed before assessing injection needs.</p>
        </div>
      )}

      {/* Input Section */}
      <div className="mb-4">
        <label htmlFor="years-input" className="block text-sm font-medium text-gray-700 mb-2">
          Enter Number of Design Years for Water Injection Assessment (1-50)
        </label>
        <div className="flex gap-3 max-w-sm">
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
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start">
        <button
          onClick={handleComputeStress}
          disabled={loading || !canComputeStressIdentification() || !yearsCount.trim()}
          className={[
            "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
            loading || !canComputeStressIdentification() || !yearsCount.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-md focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50",
          ].join(" ")}
        >
          {loading ? "Computing..." : "Compute Injection Need"}
        </button>

        {/* Search & Toggle */}
        {stressData.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 ml-auto">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search village..."
                value={stressSearchInput}
                onChange={(e) => setStressSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleStressApplySearch()}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleStressApplySearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>

            <button
              onClick={() => setShowStressTable(!showStressTable)}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              title={showStressTable ? "Hide Table" : "Show Table"}
            >
              {showStressTable ? (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.94 17.94A10.016 10.016 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.96 9.96 0 012.293-3.95M6.06 6.06A9.991 9.991 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.042 5.142" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 01-3 3m0-6a3 3 0 013 3m0 0a3 3 0 01-3 3m0 0L3 3m0 0l18 18" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Active Filters */}
      {(stressAppliedSearch || stressSortConfig) && (
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {stressAppliedSearch && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              Search: "{stressAppliedSearch}"
              <button onClick={() => { setStressAppliedSearch(""); setStressSearchInput(""); }} className="ml-1 hover:text-blue-900">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          {stressSortConfig && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
              Sort: {formatStressLabel(stressSortConfig.key)} ({stressSortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})
              <button onClick={() => setStressSortConfig(null)} className="ml-1 hover:text-green-900">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}

      {/* Stress Table */}
      {showStressTable && stressData.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Groundwater MAR Need Assessment for {yearsCount} year{parseInt(yearsCount) !== 1 ? 's' : ''}
          </h4>

          <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                    S.No.
                  </th>
                  {STRESS_DISPLAY_FIELDS.map((header) => (
                    <th
                      key={header}
                      onClick={() => handleStressSort(header)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    >
                      <div className="flex items-center">
                        {formatStressLabel(header)}
                        {getStressSortIcon(header)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedStressData.map((row, index) => (
                  <tr
                    key={index}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-red-50 transition-colors`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                      {index + 1}
                    </td>
                    {STRESS_DISPLAY_FIELDS.map((field) => (
                      <td
                        key={field}
                        className={getStressCellClasses(row, field)}
                      >
                        {formatStressValue(field, row[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            <span>
              Showing <strong>{processedStressData.length}</strong> village{processedStressData.length !== 1 ? "s" : ""}
              {(stressAppliedSearch || stressSortConfig) ? ` (filtered)` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ======================================================================
// GSR Analysis Component
// ======================================================================
const GSRAnalysis: React.FC = () => {
  const {
    gsrTableData,
    gsrLoading,
    gsrError,
    computeGSR,
    canComputeGSR,
  } = useGSR();

  const [showGsrTable, setShowGsrTable] = useState(true);

  // --- Search & Sort States ---
  const [gsrSearchInput, setGsrSearchInput] = useState("");
  const [gsrAppliedSearch, setGsrAppliedSearch] = useState("");
  const [gsrSortConfig, setGsrSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // --- Field Definitions & Labels ---
  const GSR_DISPLAY_FIELDS: string[] = [
  'village_code',
  'village_name',
  'recharge',
  'total_demand',
  'gsr',
  'trend_status',
  'gsr_classification',
];
  const GSR_LABEL_MAP: Record<string, string> = {
  'village_code': 'Village Code',
  'village_name': 'Village Name',
  'recharge': 'Recharge (Million Litres/Year)',
  'total_demand': 'Total Demand (Million Litres/Year)',
  'gsr': 'GSR Ratio',
  'trend_status': 'Trend Status',
  'gsr_classification': 'GSR Classification',
};

  const formatGsrLabel = (key: string) => GSR_LABEL_MAP[key] || key.replace(/_/g, " ");
  
  // --- Handlers ---
  const handleGsrApplySearch = () => {
    setGsrAppliedSearch(gsrSearchInput.trim());
  };

  const handleGsrSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (gsrSortConfig && gsrSortConfig.key === key && gsrSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setGsrSortConfig({ key, direction });
  };

  const getGsrSortIcon = (field: string) => {
    if (gsrSortConfig?.key !== field) return null;
    return gsrSortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-600">▲</span>
    ) : (
      <span className="ml-1 text-blue-600">▼</span>
    );
  };

  // --- Memoized Data Processing ---
  const processedGsrData = useMemo(() => {
    let data = [...gsrTableData];

    // Apply Search
    if (gsrAppliedSearch) {
      data = data.filter(row =>
        String(row.village_name || "").toLowerCase().includes(gsrAppliedSearch.toLowerCase())
      );
    }

    // Apply Sort
    if (gsrSortConfig) {
      data.sort((a, b) => {
        const aValue = a[gsrSortConfig.key];
        const bValue = b[gsrSortConfig.key];

        if (aValue == null) return gsrSortConfig.direction === 'asc' ? -1 : 1;
        if (bValue == null) return gsrSortConfig.direction === 'asc' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return gsrSortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return gsrSortConfig.direction === 'asc'
            ? aValue - bValue
            : bValue - aValue;
        }
        return 0;
      });
    }

    return data;
  }, [gsrTableData, gsrAppliedSearch, gsrSortConfig]);

  // --- Formatting ---
  const formatGsrValue = (value: any, column: string): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (['recharge', 'total_demand'].includes(column)) return value.toFixed(2);
      if (column === 'gsr') return value.toFixed(4);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const getGsrCellClasses = (row: any, column: string): string => {
    const value = row[column];
    let baseClasses = "px-4 py-3 text-sm whitespace-nowrap";

    if (column === 'trend_status') {
      if (value === 'Increasing') baseClasses += " text-green-700 font-medium";
      else if (value === 'Decreasing') baseClasses += " text-red-700 font-medium";
      else if (value === 'No Trend') baseClasses += " text-gray-700 font-medium";
      else if (value === 'No Trend Data') baseClasses += " text-yellow-600 font-medium";
      else baseClasses += " text-gray-900";
    }
    else if (column === 'gsr_classification') {
      baseClasses += " font-medium rounded px-2 py-1";
      if (!value) {
        baseClasses += " text-gray-500 bg-gray-100";
      } else {
        const backendColor = row.classification_color;
        if (backendColor) {
          baseClasses += " text-white";
        } else {
          const classificationValue = String(value).toLowerCase();
          if (classificationValue.includes('critical') && !classificationValue.includes('semi')) baseClasses += " text-red-800 bg-red-100";
          else if (classificationValue.includes('safe') && !classificationValue.includes('very')) baseClasses += " text-green-800 bg-green-100";
          else if (classificationValue.includes('very safe')) baseClasses += " text-emerald-800 bg-emerald-100";
          else if (classificationValue.includes('over exploited')) baseClasses += " text-red-900 bg-red-200";
          else if (classificationValue.includes('semi-critical')) baseClasses += " text-orange-800 bg-orange-100";
          else if (classificationValue.includes('no data')) baseClasses += " text-yellow-800 bg-yellow-100";
          else baseClasses += " text-gray-900 bg-gray-50";
        }
      }
    } else {
      baseClasses += " text-gray-900";
    }
    return baseClasses;
  };

  const getGsrInlineStyle = (row: any, column: string): React.CSSProperties => {
    if (column === 'gsr_classification' && row.classification_color) {
      return { backgroundColor: row.classification_color, color: 'white' };
    }
    return {};
  };

  return (
    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-md">
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

      {gsrError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p className="font-medium">{gsrError}</p>
        </div>
      )}

      {!canComputeGSR() && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md">
          <p className="font-medium">Requirements Not Met</p>
          <p className="text-sm mt-1">Please ensure recharge and demand are computed before GSR.</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start">
        <button
          onClick={computeGSR}
          disabled={gsrLoading || !canComputeGSR()}
          className={[
            "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
            gsrLoading || !canComputeGSR()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
          ].join(" ")}
        >
          {gsrLoading ? "Computing GSR..." : "Compute GSR"}
        </button>

        {/* Search & Toggle */}
        {gsrTableData.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 ml-auto">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search village..."
                value={gsrSearchInput}
                onChange={(e) => setGsrSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGsrApplySearch()}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleGsrApplySearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>

            <button
              onClick={() => setShowGsrTable(!showGsrTable)}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              title={showGsrTable ? "Hide Table" : "Show Table"}
            >
              {showGsrTable ? (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.94 17.94A10.016 10.016 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.96 9.96 0 012.293-3.95M6.06 6.06A9.991 9.991 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.042 5.142" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 01-3 3m0-6a3 3 0 013 3m0 0a3 3 0 01-3 3m0 0L3 3m0 0l18 18" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Active Filters */}
      {(gsrAppliedSearch || gsrSortConfig) && (
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {gsrAppliedSearch && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              Search: "{gsrAppliedSearch}"
              <button onClick={() => { setGsrAppliedSearch(""); setGsrSearchInput(""); }} className="ml-1 hover:text-blue-900">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          {gsrSortConfig && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
              Sort: {formatGsrLabel(gsrSortConfig.key)} ({gsrSortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})
              <button onClick={() => setGsrSortConfig(null)} className="ml-1 hover:text-green-900">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}

      {/* GSR Table */}
      {showGsrTable && gsrTableData.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            GSR Analysis Results
          </h4>

          <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                    S.No.
                  </th>
                  {GSR_DISPLAY_FIELDS.map((header) => (
                    <th
                      key={header}
                      onClick={() => handleGsrSort(header)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    >
                      <div className="flex items-center">
                        {formatGsrLabel(header)}
                        {getGsrSortIcon(header)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedGsrData.map((row, index) => (
                  <tr
                    key={index}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-indigo-50 transition-colors`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                      {index + 1}
                    </td>
                    {GSR_DISPLAY_FIELDS.map((field) => (
                      <td
                        key={field}
                        className={getGsrCellClasses(row, field)}
                        style={getGsrInlineStyle(row, field)}
                      >
                        {formatGsrValue(row[field], field)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            <span>
              Showing <strong>{processedGsrData.length}</strong> village{processedGsrData.length !== 1 ? "s" : ""}
              {(gsrAppliedSearch || gsrSortConfig) ? ` (filtered)` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ======================================================================
// Main Component
// ======================================================================
const GSR: React.FC<GSRProps> = ({ step }) => {
  return (
    <div className="h-full overflow-auto flex flex-col">
      <div className="space-y-6">
        <Recharge />
        <Demand />
        <GSRAnalysis />
        <StressIdentification />
      </div>
    </div>
  );
};

export default GSR;