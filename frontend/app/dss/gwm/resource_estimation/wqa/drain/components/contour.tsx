import React, { useState, useRef, useEffect } from 'react';
import { useGroundwaterContour } from '@/contexts/water_quality_assesment/drain/ContourContext';
import { useWell } from '@/contexts/water_quality_assesment/drain/WellContext';

// Village Analysis Table Component with Sorting
const VillageAnalysisTable: React.FC<{ villageAnalysis: any[] }> = ({ villageAnalysis }) => {
  if (!villageAnalysis || villageAnalysis.length === 0) {
    return null;
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedVillages = [...villageAnalysis].sort((a, b) => {
    const nameA = a.village_name?.toLowerCase() || '';
    const nameB = b.village_name?.toLowerCase() || '';
    
    if (sortOrder === 'asc') {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });

  const totalPages = Math.ceil(sortedVillages.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentData = sortedVillages.slice(startIndex, endIndex);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl border border-gray-200 shadow-xl">
      <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        Village-wise GWQI Analysis (Drain System)
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                <button 
                  onClick={toggleSortOrder}
                  className="flex items-center gap-2 hover:text-blue-100 transition-colors"
                >
                  Village Name
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {sortOrder === 'asc' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    )}
                  </svg>
                </button>
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold">Excellent<br/>(0.8-1.0)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold">Good<br/>(0.6-0.8)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold">Fair<br/>(0.4-0.6)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold">Poor<br/>(0.2-0.4)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold">Very Poor<br/>(0-0.2)</th>
              <th className="px-6 py-4 text-center text-sm font-semibold">Total Area<br/>(km²)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentData.map((village, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{village.village_name}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-700">
                  {village.percentages?.excellent?.toFixed(2) || '0.00'}%
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-700">
                  {village.percentages?.good?.toFixed(2) || '0.00'}%
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-700">
                  {village.percentages?.fair?.toFixed(2) || '0.00'}%
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-700">
                  {village.percentages?.poor?.toFixed(2) || '0.00'}%
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-700">
                  {village.percentages?.very_poor?.toFixed(2) || '0.00'}%
                </td>
                <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                  {village.total_area_km2?.toFixed(2) || '0.00'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {startIndex + 1}-{Math.min(endIndex, sortedVillages.length)} of {sortedVillages.length}
          </span>
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            «
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            ›
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
};

// Quality Distribution Display Component
const QualityDistributionDisplay: React.FC<{ gwqiData: any }> = ({ gwqiData }) => {
  if (!gwqiData?.results?.distribution) {
    return null;
  }

  const distribution = gwqiData.results.distribution;
  const percentages = gwqiData.results.percentages || {};
  const validPixels = gwqiData.results.valid_pixels || 0;
  const areaDistribution = gwqiData.results.area_distribution_km2 || {};
  
  const pixelAreaKm2 = 0.0009;
  const totalAreaKm2 = areaDistribution.total_area || (validPixels * pixelAreaKm2);

  const categories = [
    { 
      name: 'Excellent', 
      range: '0.8-1.0',
      count: distribution.excellent || 0, 
      percentage: percentages.excellent || 0, 
      gradient: 'from-blue-500 to-blue-600', 
      bgGradient: 'from-blue-50 to-blue-100',
      textColor: 'text-blue-800',
      areaKm2: areaDistribution.excellent || ((distribution.excellent || 0) * pixelAreaKm2)
    },
    { 
      name: 'Good', 
      range: '0.6-0.8',
      count: distribution.good || 0, 
      percentage: percentages.good || 0, 
      gradient: 'from-green-500 to-green-600', 
      bgGradient: 'from-green-50 to-green-100',
      textColor: 'text-green-800',
      areaKm2: areaDistribution.good || ((distribution.good || 0) * pixelAreaKm2)
    },
    { 
      name: 'Fair', 
      range: '0.4-0.6',
      count: distribution.fair || 0, 
      percentage: percentages.fair || 0, 
      gradient: 'from-yellow-500 to-yellow-600', 
      bgGradient: 'from-yellow-50 to-yellow-100',
      textColor: 'text-yellow-800',
      areaKm2: areaDistribution.fair || ((distribution.fair || 0) * pixelAreaKm2)
    },
    { 
      name: 'Poor', 
      range: '0.2-0.4',
      count: distribution.poor || 0, 
      percentage: percentages.poor || 0, 
      gradient: 'from-orange-500 to-orange-600', 
      bgGradient: 'from-orange-50 to-orange-100',
      textColor: 'text-orange-800',
      areaKm2: areaDistribution.poor || ((distribution.poor || 0) * pixelAreaKm2)
    },
    { 
      name: 'Very Poor', 
      range: '0-0.2',
      count: distribution.very_poor || 0, 
      percentage: percentages.very_poor || 0, 
      gradient: 'from-red-500 to-red-600', 
      bgGradient: 'from-red-50 to-red-100',
      textColor: 'text-red-800',
      areaKm2: areaDistribution.very_poor || ((distribution.very_poor || 0) * pixelAreaKm2)
    }
  ];

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl border border-gray-200 shadow-xl">
      <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
        <div className="p-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        Quality Area Analysis (Drain System)
      </h3>
      
      <div className="mb-6 p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl">
        <h4 className="font-bold text-gray-800 mb-2">Total Area Analyzed</h4>
        <div className="text-2xl font-bold text-gray-900">
          {totalAreaKm2.toFixed(2)} km²
        </div>
        <div className="text-sm text-gray-600">
          Based on {validPixels.toLocaleString()} analyzed pixels
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {categories.map((category) => (
          <div 
            key={category.name} 
            className={`bg-gradient-to-br ${category.bgGradient} p-6 rounded-2xl border-2 border-opacity-20 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-xl`}
          >
            <div className="text-center space-y-4">
              <div className={`bg-gradient-to-r ${category.gradient} text-white p-4 rounded-xl shadow-lg`}>
                <div className="text-2xl font-bold">{category.areaKm2.toFixed(2)}</div>
                <div className="text-sm font-medium opacity-90">km²</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${category.textColor}`}>{category.name}</div>
                <div className="text-xs text-gray-500 mt-1">{category.range}</div>
                <div className="text-sm text-gray-600 font-semibold bg-white px-3 py-1 rounded-full mt-2">
                  {category.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Results Summary Component
const ResultsSummaryCard: React.FC<{ title: string; data: any; type: 'unified'; selectedYear: string }> = ({ title, data, type, selectedYear }) => {
  if (!data) return null;

  const getGwqiRange = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    if (score >= 0.2) return 'Poor';
    return 'Very Poor';
  };

  const rawGwqiScore = data.results?.gwqi_score || 0;
  const formattedGwqiScore = typeof rawGwqiScore === 'number' ? rawGwqiScore.toFixed(2) : 'N/A';
  const gwqiRange = typeof rawGwqiScore === 'number' ? getGwqiRange(rawGwqiScore) : 'Unknown';
  
  const minGwqiScore = data.results?.statistics?.min;
  const maxGwqiScore = data.results?.statistics?.max;
  const formattedMinScore = typeof minGwqiScore === 'number' ? minGwqiScore.toFixed(2) : 'N/A';
  const formattedMaxScore = typeof maxGwqiScore === 'number' ? maxGwqiScore.toFixed(2) : 'N/A';

  return (
    <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-2xl border border-green-200 shadow-xl">
      <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        {title}
      </h4>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-6 rounded-xl border-2 border-green-200">
            <div className="text-center">
              <div className="text-sm text-green-700 font-medium mb-2">GWQI Range</div>
              <div className="text-4xl font-bold text-green-800 mb-3">{formattedMinScore} - {formattedMaxScore}</div>
              <div className="inline-block bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-full font-semibold mb-4">
               GWQI score - {formattedGwqiScore}
              </div>
              <div className="mt-2 text-sm text-green-700 font-medium">
                {gwqiRange}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Full-Screen Loading Overlay Component
const FullScreenLoadingOverlay: React.FC<{ 
  isVisible: boolean; 
  progress: { 
    currentStep: number; 
    totalSteps: number; 
    stepName: string; 
    stepDescription: string 
  } | null 
}> = ({ isVisible, progress }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white/10 backdrop-blur-md flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-200">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Generating GWQI Analysis</h3>
          
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
            Please wait, do not refresh the page....
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Contour Component
const ContourPage: React.FC = () => {
  const {
    selectedCategories,
    setSelectedCategories,
    handleGenerateGWQI,
    handleGenerateReport,
    handleLoadVillageAnalysis,
    clearResults,
    selectAllParameters,
    deselectAllParameters,
    getSelectedCategoriesArray,
    isGenerating,
    error,
    gwqiData,
    generationProgress,
    isFullScreenLoading,
    isGwqiGenerated,
    isLoadingVillageAnalysis,
    isGeneratingReport,
    setVillageAnalysisSectionRef,
  } = useGroundwaterContour();

  const { selectedYear, yearSelected } = useWell();

  // Create ref for village analysis section
  const villageAnalysisRef = useRef<HTMLDivElement>(null);

  // NEW: Track last generated parameters
  const [lastGeneratedParams, setLastGeneratedParams] = useState<string[]>([]);

  // Set the ref in context when component mounts
  useEffect(() => {
    setVillageAnalysisSectionRef(villageAnalysisRef);
  }, [setVillageAnalysisSectionRef]);

  // NEW: Reset lastGeneratedParams when results are cleared
  useEffect(() => {
    if (!isGwqiGenerated) {
      setLastGeneratedParams([]);
    }
  }, [isGwqiGenerated]);

  const waterQualityParameters = [
    'ph_level', 'electrical_conductivity', 'carbonate', 'bicarbonate',
    'chloride', 'fluoride', 'sulfate', 'nitrate',
    'Hardness', 'calcium', 'magnesium', 'sodium', 'potassium',
    'iron'
  ];

  const handleParameterToggle = (parameter: string) => {
    setSelectedCategories({
      ...selectedCategories,
      [parameter]: !selectedCategories[parameter]
    });
  };

  // NEW: Check if parameters have changed since last generation
  const hasParametersChanged = () => {
    const currentParams = getSelectedCategoriesArray();
    
    // If no GWQI has been generated yet, return true (show button)
    if (lastGeneratedParams.length === 0) return true;
    
    // If counts differ, parameters changed
    if (currentParams.length !== lastGeneratedParams.length) return true;
    
    // Check if all parameters match
    const allMatch = currentParams.every(param => lastGeneratedParams.includes(param)) &&
                     lastGeneratedParams.every(param => currentParams.includes(param));
    
    return !allMatch;
  };

  // NEW: Wrapper for GWQI generation that saves parameters
  const handleGenerateClick = async () => {
    await handleGenerateGWQI();
    // Save the parameters that were just used for generation
    setLastGeneratedParams(getSelectedCategoriesArray());
  };

  const selectedCount = getSelectedCategoriesArray().length;
  const allSelected = selectedCount === waterQualityParameters.length;

  const hasVillageAnalysis = gwqiData?.village_analysis && gwqiData.village_analysis.length > 0;

  return (
    <div className="space-y-8 bg-gradient-to-br from-gray-50 to-white min-h-screen p-6">
      <FullScreenLoadingOverlay isVisible={isFullScreenLoading} progress={generationProgress} />
      
      <div className={isFullScreenLoading ? "pointer-events-none opacity-50" : ""}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 p-8 rounded-3xl border-0 shadow-2xl text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold">Groundwater Quality Index (GWQI) Generation</h2>
              <p className="text-green-100 text-lg mt-2">Drain System Assessment</p>
              {!selectedYear && (
                <p className="text-yellow-200 text-lg mt-2">
                  Please select a year in the Well Selection step first.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        {generationProgress && !isFullScreenLoading && (
          <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-2xl border border-green-200 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-800 font-bold text-lg flex items-center gap-3">
                <div className="animate-spin">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                {generationProgress.stepName}
              </span>
              <span className="text-green-600 font-semibold bg-white px-3 py-1 rounded-full">
                {generationProgress.currentStep}/{generationProgress.totalSteps}
              </span>
            </div>
            
            <div className="w-full bg-green-200 rounded-full h-3 mb-4">
              <div 
                className="bg-gradient-to-r from-green-600 to-teal-600 h-3 rounded-full transition-all duration-500 shadow-sm" 
                style={{ width: `${(generationProgress.currentStep / generationProgress.totalSteps) * 100}%` }}
              ></div>
            </div>
            
            <p className="text-green-700 font-medium">{generationProgress.stepDescription}</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-200 rounded-xl">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-red-800 font-bold text-lg mb-2">Generation Error</h3>
                <div className="text-red-700 text-sm whitespace-pre-line bg-white p-4 rounded-lg border border-red-200">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Parameter Selection */}
        <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl border border-gray-200 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            Parameter Selection
          </h3>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <button
              onClick={allSelected ? deselectAllParameters : selectAllParameters}
              disabled={!yearSelected}
              className={`px-6 py-3 text-sm rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg ${
                !yearSelected 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : allSelected
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
              }`}
            >
              {allSelected ? 'Deselect All Parameters' : 'Select All Parameters'}
            </button>
            
            <div className="bg-gradient-to-r from-teal-100 to-green-100 px-4 py-2 rounded-xl border border-teal-200">
              <span className="text-sm font-semibold text-teal-800">
                {selectedCount} of {waterQualityParameters.length} parameters selected
              </span>
            </div>
            {selectedYear && (
              <div className="bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-2 rounded-xl border border-green-200">
                <span className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Analysis Year: {selectedYear}
                </span>
              </div>
            )}
          </div>

          {/* Parameter Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {waterQualityParameters.map((parameter) => (
              <label 
                key={parameter} 
                className={`flex items-center space-x-3 cursor-pointer p-4 rounded-xl transition-all duration-200 border-2 ${
                  !yearSelected
                    ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                    : selectedCategories[parameter] 
                      ? 'bg-gradient-to-r from-green-50 to-teal-50 border-green-300 shadow-md transform scale-105' 
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories[parameter] || false}
                  onChange={() => handleParameterToggle(parameter)}
                  disabled={!yearSelected}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-5 h-5 disabled:cursor-not-allowed"
                />
                <span className={`text-sm font-medium capitalize ${
                  !yearSelected
                    ? 'text-gray-400'
                    : selectedCategories[parameter] ? 'text-green-700' : 'text-gray-700'
                }`}>
                  {parameter.replace('_', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Generation Section */}
        <div className="bg-gradient-to-br from-green-50 to-teal-50 p-8 rounded-2xl border-2 border-green-200 shadow-xl">
          {/* Validation Messages */}
          <div className="space-y-4 mb-8">
            {!yearSelected && (
              <div className="bg-red-100 border-l-4 border-red-500 rounded-r-xl p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-800 font-semibold">Please select a year in the Well Selection step first</p>
                </div>
              </div>
            )}
            {yearSelected && selectedCount === 0 && (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 rounded-r-xl p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-yellow-800 font-semibold">Please select at least one water quality parameter</p>
                </div>
              </div>
            )}
            {yearSelected && selectedCount > 0 && (
              <div className="bg-green-100 border-l-4 border-green-500 rounded-r-xl p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-800 font-semibold">Ready to generate GWQI for {selectedCount} selected parameters</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* NEW: Conditionally show Generate button based on parameter changes */}
            {(!isGwqiGenerated || hasParametersChanged()) && (
              <button
                onClick={handleGenerateClick}
                disabled={isGenerating || selectedCount === 0 || !yearSelected}
                className={`px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform ${
                  isGenerating || selectedCount === 0 || !yearSelected
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white shadow-xl hover:shadow-2xl hover:scale-105'
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    Generating GWQI for {selectedYear} (Drain)...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {isGwqiGenerated && hasParametersChanged() ? 'Regenerate GWQI' : 'Generate GWQI'} {selectedYear ? `for ${selectedYear}` : ''}
                  </div>
                )}
              </button>
            )}

            {/* Action Buttons (Report, Village Analysis, Clear) */}
            {isGwqiGenerated && (
              <>
                <button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className={`px-8 py-4 text-lg rounded-2xl font-semibold transition-all duration-300 transform shadow-lg ${
                    isGeneratingReport
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white hover:scale-105'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isGeneratingReport ? (
                      <>
                        <div className="animate-spin">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download GWQI Report
                      </>
                    )}
                  </div>
                </button>

                {!hasVillageAnalysis && (
                  <button
                    onClick={handleLoadVillageAnalysis}
                    disabled={isLoadingVillageAnalysis}
                    className={`px-8 py-4 text-lg rounded-2xl font-semibold transition-all duration-300 transform shadow-lg ${
                      isLoadingVillageAnalysis
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white hover:scale-105'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isLoadingVillageAnalysis ? (
                        <>
                          <div className="animate-spin">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          Loading Village Analysis...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724a1 1 0 010-1.947L9 15.382m0 0l5.447 2.724a1 1 0 001.894-.894V6.618a1 1 0 00-.553-.894L10 3m-1 17V3m0 0L4.553 5.724A1 1 0 003.106 6.618v9.764a1 1 0 001.447.894L9 15.382" />
                          </svg>
                          Load Village Analysis
                        </>
                      )}
                    </div>
                  </button>
                )}

                <button
                  onClick={clearResults}
                  className="px-8 py-4 text-lg bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear Results
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Results Display */}
        {gwqiData && selectedYear && (
          <div className="space-y-8">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-green-500 to-teal-500 p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-4 text-white">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold">GWQI Generation Completed Successfully for Year {selectedYear}!</h3>
                  <p className="text-green-100 mt-1">Drain System Assessment Complete</p>
                </div>
              </div>
            </div>

            {/* Quality Distribution */}
            <QualityDistributionDisplay gwqiData={gwqiData} />

            {/* Village Analysis Table - Only show if data is loaded */}
            {hasVillageAnalysis && (
              <div ref={villageAnalysisRef}>
                <VillageAnalysisTable villageAnalysis={gwqiData.village_analysis} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContourPage;