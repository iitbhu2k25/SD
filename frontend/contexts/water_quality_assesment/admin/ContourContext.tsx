'use client';

import React, { createContext, useState, useEffect, ReactNode, useContext, useRef } from 'react';
import { useLocation } from '@/contexts/water_quality_assesment/admin/LocationContext';
import { useMap } from '@/contexts/water_quality_assesment/admin/MapContext';
import { useWell } from '@/contexts/water_quality_assesment/admin/WellContext';

interface GroundwaterContourContextType {
  gwqiData: any;
  selectedCategories: {[key: string]: boolean};
  isGenerating: boolean;
  error: string | null;
  generationProgress: string | null;
  isFullScreenLoading: boolean;
  setIsFullScreenLoading: (loading: boolean) => void;
  isGwqiGenerated: boolean;
  setIsGwqiGenerated: (generated: boolean) => void;
  parametersChanged: boolean;
  setSelectedCategories: (categories: {[key: string]: boolean}) => void;
  clearResults: () => void;
  getSelectedCategoriesArray: () => string[];
  toggleAllParameters: () => void;
  handleGenerateGWQI: () => Promise<void>;
  handleGenerateReport: () => Promise<void>;
  handleLoadVillageAnalysis: () => Promise<void>;
  isLoadingVillageAnalysis: boolean;
  isGeneratingReport: boolean;
  villageAnalysisSectionRef: React.RefObject<HTMLDivElement> | null;
  setVillageAnalysisSectionRef: (ref: React.RefObject<HTMLDivElement>) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

const GroundwaterContourContext = createContext<GroundwaterContourContextType>({
  gwqiData: null,
  selectedCategories: {},
  isGenerating: false,
  error: null,
  generationProgress: null,
  isFullScreenLoading: false,
  setIsFullScreenLoading: () => {},
  isGwqiGenerated: false,
  setIsGwqiGenerated: () => {},
  parametersChanged: false,
  setSelectedCategories: () => {},
  clearResults: () => {},
  getSelectedCategoriesArray: () => [],
  toggleAllParameters: () => {},
  handleGenerateGWQI: async () => {},
  handleGenerateReport: async () => {},
  handleLoadVillageAnalysis: async () => {},
  isLoadingVillageAnalysis: false,
  isGeneratingReport: false,
  villageAnalysisSectionRef: null,
  setVillageAnalysisSectionRef: () => {},
  sessionId: null,
  setSessionId: () => {},
});

export const useGroundwaterContour = () => {
  const context = useContext(GroundwaterContourContext);
  if (!context) {
    throw new Error('useGroundwaterContour must be used within a GroundwaterContourProvider');
  }
  return context;
};

interface GroundwaterContourProviderProps {
  children: ReactNode;
  activeTab: string;
  onGeoJsonData?: (data: { type: 'unified'; payload: any }) => void;
}

export const GroundwaterContourProvider: React.FC<GroundwaterContourProviderProps> = ({
  children,
  activeTab,
  onGeoJsonData = () => {},
}) => {
  const waterQualityParameters = [
    'ph_level', 'electrical_conductivity', 'carbonate', 'bicarbonate',
    'chloride', 'fluoride', 'sulfate', 'nitrate',
    'Hardness', 'calcium', 'magnesium', 'sodium', 'potassium',
    'iron'
  ];

  const [gwqiData, setGwqiData] = useState<any>(null);
  const [selectedCategories, setSelectedCategoriesState] = useState<{[key: string]: boolean}>(() => {
    const initial: {[key: string]: boolean} = {};
    waterQualityParameters.forEach((param) => {
      initial[param] = false;
    });
    return initial;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreenLoading, setIsFullScreenLoading] = useState(false);
  const [isGwqiGenerated, setIsGwqiGenerated] = useState(false);
  const [parametersChanged, setParametersChanged] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [isLoadingVillageAnalysis, setIsLoadingVillageAnalysis] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [villageAnalysisSectionRef, setVillageAnalysisSectionRef] = useState<React.RefObject<HTMLDivElement> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { addMultipleRasterLayers, removeAllRasterLayers } = useMap();
  const { selectedSubDistricts } = useLocation();
  const { selectedYear, wellsData, wellSelectionMode, existingWellsModified } = useWell();

  const setSelectedCategories = (categories: {[key: string]: boolean}) => {
    setSelectedCategoriesState(categories);
    setParametersChanged(true);
  };

  useEffect(() => {
    if (activeTab !== 'groundwater-contour') {
      setGwqiData(null);
      setError(null);
      setGenerationProgress(null);
      setIsFullScreenLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (sessionId) {
        fetch('/django/wqa/cleanup-session/', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({session_id: sessionId})
        }).catch(err => console.log('Cleanup error on unmount:', err));
      }
    };
  }, [sessionId]);

  const handleGenerateGWQI = async () => {
    console.log('=== Starting GWQI Generation ===');
    
    if (selectedSubDistricts.length === 0) {
      const errorMsg = 'Please select villages/subdistricts first in the Area Selection step.';
     console.log('Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    const selectedCats = getSelectedCategoriesArray();
    if (selectedCats.length === 0) {
      const errorMsg = 'Please select at least one water quality parameter.';
     console.log('Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    if (!selectedYear) {
      const errorMsg = 'Please select a year in the Well Selection step first.';
     console.log('Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    const currentYear = new Date().getFullYear();
    const yearInt = parseInt(selectedYear);
    if (yearInt < 2019 || yearInt > currentYear) {
      const errorMsg = `Invalid year. Please select a year between 2019 and ${currentYear}.`;
     console.log('Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    console.log(`Using year: ${selectedYear}`);
    console.log(`Wells data count: ${wellsData?.length || 0}`);
    console.log(`Well selection mode: ${wellSelectionMode}`);
    console.log(`Existing wells modified: ${existingWellsModified}`);

    setIsFullScreenLoading(true);
    setIsGenerating(true);
    setError(null);
    setGwqiData(null);
    setGenerationProgress('Initializing GWQI generation...');

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(currentSessionId);
      console.log(`[SESSION] Generated new session ID: ${currentSessionId}`);
    } else {
      console.log(`[SESSION] Reusing existing session ID: ${currentSessionId}`);
    }

    try {
      // UPDATED: Determine CSV mode based on upload OR modification
      const isCSVMode = wellSelectionMode === 'upload_csv' || 
                        (wellSelectionMode === 'existing_and_new' && existingWellsModified);

      if (isCSVMode) {
        if (wellSelectionMode === 'upload_csv') {
          console.log('[CSV MODE] Using uploaded CSV data');
        } else {
          console.log('[CSV MODE] Using modified existing wells data (treated as CSV)');
        }
        console.log(`[CSV MODE] Wells count: ${wellsData?.length || 0}`);
        setGenerationProgress('Processing well data and performing IDW interpolation...');
      } else {
        console.log('[EXISTING RASTERS MODE] Using unmodified pre-existing rasters');
        setGenerationProgress('Loading pre-existing raster data...');
      }

      const payload = {
        selected_parameters: selectedCats,
        selected_year: selectedYear,
        village_ids: selectedSubDistricts,
        place: 'subdistrict',
        unified_mode: true,
        wells_data: wellsData || [],
        use_csv_interpolation: isCSVMode,
        session_id: currentSessionId
      };

      console.log('[GWQI] Payload:', {
        parameters_count: selectedCats.length,
        wells_count: wellsData?.length || 0,
        mode: isCSVMode ? 'CSV_INTERPOLATION' : 'EXISTING_RASTERS',
        wells_modified: existingWellsModified,
        session_id: currentSessionId
      });

      const response = await fetch('/django/wqa/gwqi-overlay/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[GWQI] Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `GWQI generation failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
         console.log('[GWQI] API error:', errorData);
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
         console.log('[GWQI] Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[GWQI] Response data received');
      console.log(`[GWQI] Session ID in response: ${data.session_id}`);

      if (data.session_id && data.session_id !== currentSessionId) {
        console.warn(`[SESSION WARNING] Session ID mismatch! Expected: ${currentSessionId}, Got: ${data.session_id}`);
        setSessionId(data.session_id);
        currentSessionId = data.session_id;
      }

      const processedData = {
        ...data,
        results: {
          gwqi_score: data.results?.gwqi_score || 'N/A',
          classification: data.results?.classification || 'Unknown',
          statistics: {
            mean: data.results?.statistics?.mean || data.results?.gwqi_score || 'N/A',
            min: data.results?.statistics?.min || 'N/A',
            max: data.results?.statistics?.max || 'N/A',
            std: data.results?.statistics?.std || 'N/A'
          },
          distribution: data.results?.distribution || {},
          percentages: data.results?.percentages || {},
          area_distribution_km2: data.results?.area_distribution_km2 || {},
          valid_pixels: data.results?.valid_pixels || 0
        },
        parameter_statistics: data.parameter_statistics || {},
        processing_info: data.processing_info || {},
        layer_metadata: data.layer_metadata || [],
        preview_images: data.preview_images || {},
        wells_overlaid: data.wells_overlaid || 0,
        village_analysis: [],
        data_source: isCSVMode ? 'CSV_INTERPOLATION' : 'EXISTING_RASTERS',
        interpolation_mode: isCSVMode ? 'IDW' : 'PRE_EXISTING',
        session_id: currentSessionId
      };

      console.log('[GWQI] Data processed successfully');

      if (data.layer_metadata && Array.isArray(data.layer_metadata) && data.layer_metadata.length > 0) {
        console.log('[GWQI] Adding raster layers to map:', data.layer_metadata.length);
        
        try {
          const colorScheme = data.color_scheme || {
            colors: ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd'],
            labels: ['Very Poor (0-0.2)', 'Poor (0.2-0.4)', 'Fair (0.4-0.6)', 'Good (0.6-0.8)', 'Excellent (0.8-1.0)'],
            parameter: 'GWQI',
            classes: 5,
            type: 'gwqi'
          };
          
          addMultipleRasterLayers(data.layer_metadata, data.geoserver_url, colorScheme);
          console.log(`[GWQI] Successfully added ${data.layer_metadata.length} layers`);
          
        } catch (layerError) {
          console.warn('[GWQI] Failed to add layers:', layerError);
        }
      }

      setGwqiData(processedData);
      setIsGwqiGenerated(true);
      setParametersChanged(false);
      onGeoJsonData({ type: 'unified', payload: processedData });

      const modeText = isCSVMode ? 
        (wellSelectionMode === 'upload_csv' ? 'CSV Upload' : 'Modified Existing Wells (IDW)') : 
        'Pre-existing Rasters';
      setGenerationProgress(`GWQI generated successfully using ${modeText}! Score: ${processedData.results?.gwqi_score || 'N/A'}`);

      console.log('=== GWQI Generation Completed Successfully ===');
      console.log(`[SESSION] Final session ID: ${currentSessionId}`);
      console.log(`[MODE] Data source: ${modeText}`);
      
    } catch (error) {
     console.log('=== GWQI Generation Failed ===');
     console.log('Error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setGwqiData(null);
      setGenerationProgress(null);
      removeAllRasterLayers();
    } finally {
      setIsGenerating(false);
      setIsFullScreenLoading(false);
      setTimeout(() => {
        if (!error) {
          setGenerationProgress(null);
        }
      }, 4000);
    }
  };

  const handleLoadVillageAnalysis = async () => {
    console.log('=== Loading Village Analysis On-Demand ===');
    
    if (!gwqiData || !selectedYear) {
      setError('Please generate GWQI first before loading village analysis.');
      return;
    }

    if (!sessionId) {
      setError('Session not found. Please regenerate GWQI first.');
      return;
    }

    console.log(`[VILLAGE ANALYSIS] Using session ID: ${sessionId}`);

    setIsLoadingVillageAnalysis(true);
    setError(null);

    try {
      const payload = {
        selected_year: selectedYear,
        village_ids: selectedSubDistricts,
        place: 'subdistrict',
        session_id: sessionId
      };

      console.log('[VILLAGE ANALYSIS] Payload:', payload);

      const response = await fetch('/django/wqa/village-analysis/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Village analysis failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[VILLAGE ANALYSIS] Data received:', data);

      setGwqiData({
        ...gwqiData,
        village_analysis: data.village_analysis || []
      });

      console.log('=== Village Analysis Loaded Successfully ===');

      setTimeout(() => {
        if (villageAnalysisSectionRef?.current) {
          villageAnalysisSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);

    } catch (error) {
     console.log('[VILLAGE ANALYSIS] Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load village analysis');
    } finally {
      setIsLoadingVillageAnalysis(false);
    }
  };

  const handleGenerateReport = async () => {
    console.log('=== Starting PDF Report Generation ===');
    
    if (!gwqiData || !selectedYear) {
      setError('Please generate GWQI analysis first before creating a report.');
      return;
    }

    if (!sessionId) {
      setError('Session not found. Please regenerate GWQI first.');
     console.log('SessionId is missing:', sessionId);
      return;
    }

    console.log(`[PDF REPORT] Using session ID: ${sessionId}`);
    
    setIsGeneratingReport(true);
    setError(null);
    
    try {
      const payload = {
        gwqi_data: gwqiData,
        selected_year: selectedYear,
        session_id: sessionId
      };
      
      console.log('[PDF REPORT] Requesting report with session:', sessionId);
      
      const response = await fetch('/django/wqa/generate-gwqi-report/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Report generation failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GWQI_Report_${selectedYear}${sessionId ? `_${sessionId.substring(0, 8)}` : ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('[PDF REPORT] Downloaded successfully');
      
    } catch (error) {
     console.log('[PDF REPORT] Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getSelectedCategoriesArray = () => {
    return Object.keys(selectedCategories).filter(key => selectedCategories[key]);
  };

  const toggleAllParameters = () => {
    const currentlySelected = getSelectedCategoriesArray().length;
    const newState: {[key: string]: boolean} = {};
    
    if (currentlySelected === waterQualityParameters.length) {
      waterQualityParameters.forEach(param => {
        newState[param] = false;
      });
    } else {
      waterQualityParameters.forEach(param => {
        newState[param] = true;
      });
    }
    
    setSelectedCategories(newState);
  };

  const clearResults = () => {
    console.log('[CLEAR] Clearing all results and session');
    
    setGwqiData(null);
    setError(null);
    setGenerationProgress(null);
    setIsGwqiGenerated(false);
    setParametersChanged(false);
    setIsFullScreenLoading(false);
    removeAllRasterLayers();

    if (sessionId) {
      console.log(`[CLEAR] Cleaning up session: ${sessionId}`);
      fetch('/django/wqa/cleanup-session/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({session_id: sessionId})
      }).catch(err => console.log('[CLEAR] Cleanup error:', err));
      
      setSessionId(null);
    }

    console.log('[CLEAR] All results cleared');
  };

  const contextValue: GroundwaterContourContextType = {
    gwqiData,
    selectedCategories,
    isGenerating,
    error,
    generationProgress,
    isFullScreenLoading,
    setIsFullScreenLoading,
    isGwqiGenerated,
    setIsGwqiGenerated,
    parametersChanged,
    setSelectedCategories,
    clearResults,
    getSelectedCategoriesArray,
    toggleAllParameters,
    handleGenerateGWQI,
    handleGenerateReport,
    handleLoadVillageAnalysis,
    isLoadingVillageAnalysis,
    isGeneratingReport,
    villageAnalysisSectionRef,
    setVillageAnalysisSectionRef,
    sessionId,
    setSessionId,
  };

  return (
    <GroundwaterContourContext.Provider value={contextValue}>
      {children}
    </GroundwaterContourContext.Provider>
  );
};

export { GroundwaterContourContext };