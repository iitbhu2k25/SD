'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useLocation } from '@/contexts/water/admin/LocationContext';
import { api } from '@/services/api';
import { ClipRasters, stp_priority_Output } from '@/interface/raster_context';

const ADMIN_LAYER_NAMES = {
  INDIA: "STP_State",
  STATE: "STP_State",
  DISTRICT: "STP_district",
  SUB_DISTRICT: "STP_subdistrict",
};

// Type definitions for the context
interface MapContextType {
  primaryLayer: string;
  secondaryLayer: string | null;
  LayerFilter: string | null;
  LayerFilterValue: number[] | null;
  stpOperation: boolean;
  setstpOperation: (operation: boolean) => void;
  setPrimaryLayer: (layer: string) => void;
  syncLayersWithLocation: () => void;
  isMapLoading: boolean;
  zoomToFeature: (featureId: string, layerName: string) => void;
  resetMapView: () => void;
  geoServerUrl: string;
  defaultWorkspace: string;
  ADMIN_LAYER_NAMES: typeof ADMIN_LAYER_NAMES;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setSecondaryLayer: (layer: string | null) => void;
  rasterLoading: boolean;
  setRasterLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  wmsDebugInfo: string | null;
  setWmsDebugInfo: (info: string | null) => void;
  selectedradioLayer: string | null;
  setSelectedradioLayer: (layer: string | null) => void; 
  showLayer: boolean;
  setShowLayer: (layer: boolean) => void;
  rasterLayerInfo: ClipRasters | null;
  setRasterLayerInfo: (layer: ClipRasters | null) => void;
  handleLayerSelection: (layer: string) => void;
  
  // NEW REFS FOR RASTER LAYERS
  mapInstanceRef: React.MutableRefObject<any | null>;
  layersRef: React.MutableRefObject<Record<string, any>>;
  
  // ✅ RESET FUNCTIONALITY
  resetMapLayers: () => void;
  shouldResetMap: boolean;
  setShouldResetMap: (reset: boolean) => void;
}

// Props for the MapProvider
interface MapProviderProps {
  children: ReactNode;
  geoServerUrl?: string;
  defaultWorkspace?: string;
}

// Create the map context with default values
const MapContext = createContext<MapContextType>({
  primaryLayer: ADMIN_LAYER_NAMES.STATE,
  secondaryLayer: null,
  LayerFilter: null,
  LayerFilterValue: null,
  stpOperation: false,
  setstpOperation: () => {},
  setSecondaryLayer: () => {},
  setPrimaryLayer: () => {},
  syncLayersWithLocation: () => {},
  isMapLoading: false,
  zoomToFeature: () => {},
  resetMapView: () => {},
  geoServerUrl: "/geoserver/api",
  defaultWorkspace: "dss_vector",
  ADMIN_LAYER_NAMES,
  loading: false,
  setLoading: () => {},
  rasterLoading: false,
  setRasterLoading: () => {},
  error: null,
  setError: () => {},
  wmsDebugInfo: null,
  setWmsDebugInfo: () => {},
  selectedradioLayer: null,
  setSelectedradioLayer: () => {},
  showLayer: true,
  setShowLayer: () => {},
  rasterLayerInfo: null,
  setRasterLayerInfo: () => {},
  handleLayerSelection: () => {},
  mapInstanceRef: { current: null } as React.MutableRefObject<any | null>,
  layersRef: { current: {} } as React.MutableRefObject<Record<string, any>>,
  // ✅ RESET DEFAULTS
  resetMapLayers: () => {},
  shouldResetMap: false,
  setShouldResetMap: () => {},
});

// Create the provider component
export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  geoServerUrl = "/geoserver/api",
  defaultWorkspace = "dss_vector"
}) => {
  // State for layer management
  const [primaryLayer, setPrimaryLayer] = useState<string>(ADMIN_LAYER_NAMES.STATE);
  const [secondaryLayer, setSecondaryLayer] = useState<string | null>(null);
  const [LayerFilter, setLayerFilter] = useState<string | null>(null);
  const [LayerFilterValue, setLayerFilterValue] = useState<number[] | null>(null);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [stpOperation, setstpOperation] = useState<boolean>(false);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wmsDebugInfo, setWmsDebugInfo] = useState<string | null>(null);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<ClipRasters | null>(null);
  const [selectedradioLayer, setSelectedradioLayer] = useState<string | null>(null);

  // ✅ RESET STATE
  const [shouldResetMap, setShouldResetMap] = useState<boolean>(false);

  // NEW REFS FOR MAP AND LAYERS
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});

  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    displayRaster,
  } = useLocation();

  const resetMapView = (): void => {
    // Implementation for resetting map view
  };

  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
  };

  const zoomToFeature = (featureId: string, layerName: string): void => {
    // Implementation for zooming to feature
  };

  // ✅ RESET MAP LAYERS FUNCTION
  const resetMapLayers = (): void => {
    setShouldResetMap(true);
    setRasterLayerInfo(null);
    setSelectedradioLayer(null);
    setError(null);
    setWmsDebugInfo(null);
    console.log('✓ MapContext: Reset signal sent to map');
  };

  // Synchronize layers based on location selections
  const syncLayersWithLocation = (): void => {
    setIsMapLoading(true);
    
    // Default to showing states
    let primary: string = ADMIN_LAYER_NAMES.INDIA;
    let secondary: string | null = null;
    let filters_type: string | null = null;
    let filters_value: number[] | null = null;
    
    // Logic for determining which layers to show based on selection state
    if (selectedSubDistricts.length > 0) {
      secondary = ADMIN_LAYER_NAMES.SUB_DISTRICT;
      filters_type = 'subdis_cod';
      filters_value = selectedSubDistricts;
    }
    else if (selectedDistricts.length > 0) {
      secondary = ADMIN_LAYER_NAMES.DISTRICT;
      filters_type = 'district_c';
      filters_value = selectedDistricts;
    }
    else if (selectedState) {
      secondary = ADMIN_LAYER_NAMES.STATE;
      filters_type = 'State_Code';
      filters_value = [selectedState];
    }

    // Update state with new layer configuration
    setPrimaryLayer(primary);
    setSecondaryLayer(secondary);
    setLayerFilter(filters_type);
    setLayerFilterValue(filters_value);
    setIsMapLoading(false);
  };

  // Listen for changes in location selection and update layers accordingly
  useEffect(() => {
    syncLayersWithLocation();
  }, [
    selectedState,
    selectedDistricts.length,
    selectedSubDistricts.length,
  ]);

  // Context value with all proper functions and NEW refs
  const contextValue: MapContextType = {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    stpOperation,
    setstpOperation,
    setPrimaryLayer,
    setSecondaryLayer,
    syncLayersWithLocation,
    isMapLoading,
    zoomToFeature,
    resetMapView,
    geoServerUrl,
    defaultWorkspace,
    ADMIN_LAYER_NAMES,
    loading: false,
    setLoading: () => {},
    rasterLayerInfo,
    setRasterLayerInfo,
    rasterLoading,
    setRasterLoading,
    error,
    setError,
    wmsDebugInfo,
    setWmsDebugInfo,
    selectedradioLayer,
    setSelectedradioLayer,
    setShowLayer: () => {},
    showLayer: false,
    handleLayerSelection,
    
    // NEW: Map and layers refs
    mapInstanceRef,
    layersRef,
    
    // ✅ RESET FUNCTIONALITY
    resetMapLayers,
    shouldResetMap,
    setShouldResetMap,
  };

  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
};

// Custom hook to use the map context
export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
};

export default MapContext;