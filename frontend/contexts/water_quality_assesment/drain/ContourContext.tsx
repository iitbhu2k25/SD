'use client';

import React, { createContext, useState, useEffect, ReactNode, useContext, useRef } from 'react';
import { useLocation } from '@/contexts/water_quality_assesment/drain/LocationContext';
import { useMap } from '@/contexts/water_quality_assesment/drain/MapContext';
import { useWell } from '@/contexts/water_quality_assesment/drain/WellContext';

interface GroundwaterContourContextType {
  // Unified state
  gwqiData: any;
  // Common state
  selectedCategories: {[key: string]: boolean};
  // Loading states
  isGenerating: boolean;
  error: string | null;
  // Progress tracking
  generationProgress: {
    currentStep: number;
    totalSteps: number;
    stepName: string;
    stepDescription: string;
  } | null;
  // Full-screen loading state
  isFullScreenLoading: boolean;
  setIsFullScreenLoading: (loading: boolean) => void;
  // GWQI generated state
  isGwqiGenerated: boolean;
  setIsGwqiGenerated: (generated: boolean) => void;
  // Actions
  setSelectedCategories: (categories: {[key: string]: boolean}) => void;
  clearResults: () => void;
  getSelectedCategoriesArray: () => string[];
  selectAllParameters: () => void;
  deselectAllParameters: () => void;
  handleGenerateGWQI: () => Promise<void>;
  // Report and Village Analysis functionality
  handleGenerateReport: () => Promise<void>;
  handleLoadVillageAnalysis: () => Promise<void>;
  isLoadingVillageAnalysis: boolean;
  isGeneratingReport: boolean;
  villageAnalysisSectionRef: React.RefObject<HTMLDivElement> | null;
  setVillageAnalysisSectionRef: (ref: React.RefObject<HTMLDivElement>) => void;
  // Session management
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
  setSelectedCategories: () => {},
  clearResults: () => {},
  getSelectedCategoriesArray: () => [],
  selectAllParameters: () => {},
  deselectAllParameters: () => {},
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
  // Water quality parameters (same as admin system)
  const waterQualityParameters = [
    'ph_level', 'electrical_conductivity', 'carbonate', 'bicarbonate',
    'chloride', 'fluoride', 'sulfate', 'nitrate',
    'Hardness', 'calcium', 'magnesium', 'sodium', 'potassium',
    'iron'
  ];

  // State
  const [gwqiData, setGwqiData] = useState<any>(null);
  const [selectedCategories, setSelectedCategories] = useState<{[key: string]: boolean}>(() => {
    const initial: {[key: string]: boolean} = {};
    waterQualityParameters.forEach((param, index) => {
      initial[param] = false;
    });
    return initial;
  });

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Full-screen loading state
  const [isFullScreenLoading, setIsFullScreenLoading] = useState(false);

  // GWQI generated state
  const [isGwqiGenerated, setIsGwqiGenerated] = useState(false);

  // Progress tracking
  const [generationProgress, setGenerationProgress] = useState<{
    currentStep: number;
    totalSteps: number;
    stepName: string;
    stepDescription: string;
  } | null>(null);

  // Report and Village Analysis states
  const [isLoadingVillageAnalysis, setIsLoadingVillageAnalysis] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [villageAnalysisSectionRef, setVillageAnalysisSectionRef] = useState<React.RefObject<HTMLDivElement> | null>(null);

  // Session management state
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Get contexts
  const { addMultipleRasterLayers, removeAllRasterLayers } = useMap();
  
  // Use drain-specific location context
  const { selectedVillages } = useLocation();
  
  // Get year and wells data from WellContext - INCLUDING existingWellsModified
  const { selectedYear, wellsData, wellSelectionMode, existingWellsModified } = useWell();

  // Clear results when tab changes
  useEffect(() => {
    if (activeTab !== 'groundwater-contour') {
      setGwqiData(null);
      setError(null);
      setGenerationProgress(null);
      setIsFullScreenLoading(false);
    }
  }, [activeTab]);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        fetch('/django/wqa/cleanup-session/', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({session_id: sessionId})
        }).catch(err => console.log('[DRAIN] Cleanup error on unmount:', err));
      }
    };
  }, [sessionId]);

  // GWQI Generation Handler
  const handleGenerateGWQI = async () => {
    console.log('=== Starting Enhanced GWQI Generation for Drain System ===');
    
    // Enhanced Validation including year check
    if (selectedVillages.length === 0) {
      const errorMsg = 'Please select villages first in the Area Selection step.';
     console.log('[DRAIN] Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    const selectedCats = getSelectedCategoriesArray();
    if (selectedCats.length === 0) {
      const errorMsg = 'Please select at least one water quality parameter.';
     console.log('[DRAIN] Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    // Check if year is selected from well context
    if (!selectedYear) {
      const errorMsg = 'Please select a year in the Well Selection step first. The GWQI analysis will use the same year as your well data.';
     console.log('[DRAIN] Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    // Year validation
    const currentYear = new Date().getFullYear();
    const yearInt = parseInt(selectedYear);
    if (yearInt < 2019 || yearInt > currentYear) {
      const errorMsg = `Invalid year. Please select a year between 2019 and ${currentYear}.`;
     console.log('[DRAIN] Validation failed:', errorMsg);
      setError(errorMsg);
      return;
    }

    console.log(`[DRAIN] Using year from Well Selection: ${selectedYear}`);
    console.log(`[DRAIN] Wells data count: ${wellsData?.length || 0}`);
    console.log(`[DRAIN] Well selection mode: ${wellSelectionMode}`);
    console.log(`[DRAIN] Existing wells modified: ${existingWellsModified}`);

    // Enable full-screen loading - this will disable all interactions
    setIsFullScreenLoading(true);
    setIsGenerating(true);
    setError(null);
    setGwqiData(null);
    setGenerationProgress({
      currentStep: 1,
      totalSteps: 4,
      stepName: 'Initializing',
      stepDescription: `Preparing enhanced GWQI generation for year ${selectedYear} with individual raster clipping and coloring for drain system...`
    });

    try {
      // UPDATED: Determine CSV mode - check for upload OR modifications
      const isCSVMode = wellSelectionMode === 'upload_csv' || 
        (wellSelectionMode === 'existing_and_new' && existingWellsModified);

      // Debug logging
      console.log('[DRAIN GWQI] Interpolation mode check:', {
        wellSelectionMode,
        existingWellsModified,
        isCSVMode,
        wellsDataCount: wellsData?.length || 0
      });

      if (isCSVMode) {
        if (wellSelectionMode === 'upload_csv') {
          console.log('[DRAIN CSV MODE] Using uploaded CSV data');
        } else {
          console.log('[DRAIN MODIFIED MODE] Using modified existing wells - IDW interpolation required');
        }
        console.log(`[DRAIN CSV MODE] Wells count: ${wellsData?.length || 0}`);
        setGenerationProgress({
          currentStep: 1,
          totalSteps: 4,
          stepName: 'Processing CSV Data',
          stepDescription: `Processing well data and performing IDW interpolation for year ${selectedYear}...`
        });
      } else {
        console.log('[DRAIN] Using pre-existing rasters');
        setGenerationProgress({
          currentStep: 1,
          totalSteps: 4,
          stepName: 'Loading Rasters',
          stepDescription: `Loading pre-existing interpolated rasters for year ${selectedYear}...`
        });
      }

      const payload = {
        selected_parameters: selectedCats,
        selected_year: selectedYear,
        village_ids: selectedVillages, // Use village codes for drain system
        place: 'village', // Changed from 'subdistrict' to 'village' for drain system
        unified_mode: true,
        wells_data: wellsData || [],
        use_csv_interpolation: isCSVMode // UPDATED: Now includes modified existing wells
      };

      console.log('[DRAIN GWQI] Enhanced unified GWQI generation payload:', JSON.stringify(payload, null, 2));
      console.log(`[DRAIN GWQI] Year automatically selected from Well Selection: ${selectedYear}`);
      console.log(`[DRAIN GWQI] CSV Interpolation Mode: ${isCSVMode}`);

      // Enhanced progress tracking
      setGenerationProgress({
        currentStep: 1,
        totalSteps: 4,
        stepName: 'Loading & Processing Individual Rasters',
        stepDescription: `Loading interpolated rasters for year ${selectedYear}, clipping to village boundaries, and applying parameter-specific coloring...`
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      setGenerationProgress({
        currentStep: 2,
        totalSteps: 4,
        stepName: 'Publishing Individual Parameter Layers',
        stepDescription: `Publishing clipped and colored individual parameter rasters for year ${selectedYear} to GeoServer...`
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      setGenerationProgress({
        currentStep: 3,
        totalSteps: 4,
        stepName: 'Analyzing Parameters & Creating GWQI',
        stepDescription: `Calculating CI, Rankings, Weights for year ${selectedYear} data, and generating GWQI composite overlay...`
      });

      setGenerationProgress({
        currentStep: 4,
        totalSteps: 4,
        stepName: 'Setting Up Enhanced Layer Switching',
        stepDescription: 'Configuring enhanced raster layer switching with parameter-specific legends...'
      });

      const response = await fetch('/django/wqa/gwqi-overlay/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[DRAIN GWQI] Enhanced unified GWQI response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Enhanced GWQI generation failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
         console.log('[DRAIN GWQI] Enhanced GWQI API error response:', errorData);
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
         console.log('[DRAIN GWQI] Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[DRAIN GWQI] Enhanced unified GWQI response for drain system:', data);

      // Store session ID from response
      if (data.session_id) {
        setSessionId(data.session_id);
        console.log(`[DRAIN SESSION] Session stored: ${data.session_id}`);
      }

      // Enhanced: Process and ensure proper data structure with individual raster support
      const processedData = {
        ...data,
        // Ensure results structure is properly set
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
          valid_pixels: data.results?.valid_pixels || 0,
          area_distribution_km2: data.results?.area_distribution_km2 || {}
        },
        parameter_statistics: data.parameter_statistics || {},
        processing_info: data.processing_info || {},
        methodology: data.methodology || {},
        layer_metadata: data.layer_metadata || [],
        individual_raster_layers: data.individual_raster_layers || [],
        gwqi_layers: data.gwqi_layers || [],
        raster_switching_info: data.raster_switching_info || {},
        preview_images: data.preview_images || {},
        wells_overlaid: data.wells_overlaid || 0,
        village_analysis: [], // Initialize empty for on-demand loading
        enhanced_processing: {
          individual_rasters_clipped: data.raster_switching_info?.clipping_status || 'Unknown',
          individual_rasters_colored: data.raster_switching_info?.coloring_status || 'Unknown',
          parameter_specific_legends: data.layer_metadata?.length > 0,
          total_switchable_layers: data.raster_switching_info?.total_switchable_layers || 0,
          data_year: selectedYear,
          village_count: selectedVillages.length,
          system_type: 'drain',
          data_source: isCSVMode ? 'CSV_INTERPOLATION' : 'EXISTING_RASTERS',
          interpolation_mode: isCSVMode ? 'IDW' : 'PRE_EXISTING'
        }
      };

      console.log('[DRAIN GWQI] Enhanced processed GWQI data for drain system:', processedData);

      // Enhanced: Add multiple layers to map using the enhanced method with proper color schemes
      if (data.layer_metadata && Array.isArray(data.layer_metadata) && data.layer_metadata.length > 0) {
        console.log('[DRAIN GWQI] Adding enhanced multiple raster layers to map for drain system:', data.layer_metadata);
        
        try {
          const colorScheme = data.color_scheme || {
            colors: ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd'],
            labels: ['Very Poor (0-0.2)', 'Poor (0.2-0.4)', 'Fair (0.4-0.6)', 'Good (0.6-0.8)', 'Excellent (0.8-1.0)'],
            parameter: 'GWQI_Drain',
            classes: 5,
            type: 'gwqi'
          };
          
          addMultipleRasterLayers(data.layer_metadata, data.geoserver_url, colorScheme);
          
          console.log(`[DRAIN GWQI] Successfully added ${data.layer_metadata.length} enhanced switchable raster layers for drain system year ${selectedYear}`);
          
        } catch (layerError) {
          console.warn(`[DRAIN GWQI] Failed to add enhanced multiple raster layers for drain system:`, layerError);
        }
      } else if (data.published_layers && Array.isArray(data.published_layers) && data.published_layers.length > 0) {
        console.log('[DRAIN GWQI] Fallback: Adding layers using old method for drain system:', data.published_layers);
        console.warn('[DRAIN GWQI] Enhanced layer metadata not available, using fallback method');
      } else {
        console.warn('[DRAIN GWQI] No layer data available for map display in drain system');
      }

      // Set the enhanced processed data
      setGwqiData(processedData);
      setIsGwqiGenerated(true);
      onGeoJsonData({ type: 'unified', payload: processedData });

      // Enhanced final progress update
      const totalSwitchableLayers = data.raster_switching_info?.total_switchable_layers || 0;
      const individualRasters = data.raster_switching_info?.individual_rasters || 0;
      const gwqiRasters = data.raster_switching_info?.gwqi_rasters || 0;
      const clippingStatus = data.raster_switching_info?.clipping_status || 'Applied';
      const coloringStatus = data.raster_switching_info?.coloring_status || 'Applied';
      const dataSource = isCSVMode ? 'CSV Interpolation' : 'Pre-existing Rasters';
      
      setGenerationProgress({
        currentStep: 4,
        totalSteps: 4,
        stepName: 'Enhanced Generation Completed',
        stepDescription: `GWQI generated successfully for drain system year ${selectedYear}! Score: ${processedData.results?.gwqi_score || 'N/A'} (${processedData.results?.classification || 'Unknown'}). ${totalSwitchableLayers} enhanced layers available (${individualRasters} clipped & colored individual + ${gwqiRasters} GWQI). Villages: ${selectedVillages.length}. ${clippingStatus}. ${coloringStatus}. Mode: ${dataSource}.`
      });

      console.log('=== Enhanced GWQI Generation Completed Successfully for Drain System ===');
      
    } catch (error) {
     console.log('=== Enhanced GWQI Generation Failed for Drain System ===');
     console.log('[DRAIN GWQI] Error details:', error);
      let userFriendlyError = error instanceof Error ? error.message : 'An unknown error occurred';
      if (userFriendlyError.includes('raster files exist')) {
        userFriendlyError += `\n\nSuggestions:\n• Check if raster files exist for year ${selectedYear}\n• Ensure raster files follow the naming pattern: parameterName_${selectedYear}.tif\n• Verify the rasters directory exists: backend/media/gwa_iprasters\n• Ensure village boundaries are available for clipping`;
      }
      setError(userFriendlyError);
      setGwqiData(null);
      setGenerationProgress(null);
      removeAllRasterLayers();
    } finally {
      setIsGenerating(false);
      setIsFullScreenLoading(false);
      // Clear progress after a delay to show final state
      setTimeout(() => {
        if (!error) {
          setGenerationProgress(null);
        }
      }, 6000);
    }
  };

  // Village Analysis Loading Function
  const handleLoadVillageAnalysis = async () => {
    console.log('=== Loading Village Analysis On-Demand (Drain System) ===');
    
    if (!gwqiData || !selectedYear) {
      setError('Please generate GWQI first before loading village analysis.');
      return;
    }

    // Check if sessionId exists for village analysis
    if (!sessionId) {
      setError('Session not found. Please regenerate GWQI first.');
      return;
    }

    setIsLoadingVillageAnalysis(true);
    setError(null);

    try {
      const payload = {
        selected_year: selectedYear,
        village_ids: selectedVillages, // Use village codes for drain system
        place: 'village', // Changed from 'subdistrict' to 'village'
        session_id: sessionId
      };

      const response = await fetch('/django/wqa/village-analysis/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Village analysis failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[DRAIN] Village analysis loaded for drain system:', data);

      setGwqiData({
        ...gwqiData,
        village_analysis: data.village_analysis || []
      });

      console.log('=== Village Analysis Loaded Successfully (Drain System) ===');

      // Auto-scroll to village analysis section
      setTimeout(() => {
        if (villageAnalysisSectionRef?.current) {
          villageAnalysisSectionRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);

    } catch (error) {
     console.log('[DRAIN] Village analysis error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load village analysis');
    } finally {
      setIsLoadingVillageAnalysis(false);
    }
  };

  // Report Generation Function
  const handleGenerateReport = async () => {
    console.log('=== Starting PDF Report Generation (Drain System) ===');
    
    if (!gwqiData || !selectedYear) {
      setError('Please generate GWQI analysis first before creating a report.');
      return;
    }

    // Check if sessionId exists for report generation
    if (!sessionId) {
      setError('Session not found. Please regenerate GWQI first.');
     console.log('[DRAIN] SessionId is missing:', sessionId);
      return;
    }
    
    setIsGeneratingReport(true);
    setError(null);
    
    try {
      const payload = {
        gwqi_data: gwqiData,
        selected_year: selectedYear,
        session_id: sessionId // Include session ID for PDF
      };
      
      console.log('[DRAIN] Requesting PDF report for drain system with session:', sessionId);
      
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
      a.download = `GWQI_Report_Drain_${selectedYear}${sessionId ? `_${sessionId.substring(0, 8)}` : ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('[DRAIN] PDF report downloaded successfully (Drain System)');
      
    } catch (error) {
     console.log('[DRAIN] Report generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Helper functions
  const getSelectedCategoriesArray = () => {
    return Object.keys(selectedCategories).filter(key => selectedCategories[key]);
  };

  const selectAllParameters = () => {
    const allSelected: {[key: string]: boolean} = {};
    waterQualityParameters.forEach(param => {
      allSelected[param] = true;
    });
    setSelectedCategories(allSelected);
  };

  const deselectAllParameters = () => {
    const allDeselected: {[key: string]: boolean} = {};
    waterQualityParameters.forEach(param => {
      allDeselected[param] = false;
    });
    setSelectedCategories(allDeselected);
  };

  const clearResults = () => {
    setGwqiData(null);
    setError(null);
    setGenerationProgress(null);
    setIsGwqiGenerated(false);
    setIsFullScreenLoading(false);
    removeAllRasterLayers();

    // Cleanup session when clearing results
    if (sessionId) {
      fetch('/django/wqa/cleanup-session/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({session_id: sessionId})
      }).catch(err => console.log('[DRAIN] Cleanup error:', err));
      
      setSessionId(null);
    }

    console.log('[DRAIN] All enhanced results and raster layers cleared for drain system');
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
    setSelectedCategories,
    clearResults,
    getSelectedCategoriesArray,
    selectAllParameters,
    deselectAllParameters,
    handleGenerateGWQI,
    // Report and Village Analysis functionality
    handleGenerateReport,
    handleLoadVillageAnalysis,
    isLoadingVillageAnalysis,
    isGeneratingReport,
    villageAnalysisSectionRef,
    setVillageAnalysisSectionRef,
    // Session management
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