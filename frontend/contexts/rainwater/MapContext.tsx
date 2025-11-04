'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from '@/contexts/rainwater/LocationContext';

const LAYER_NAMES = {
  INDIA:"STP_State",
  STATE: "STP_district",
  DISTRICT: "STP_subdistrict",
  SUB_DISTRICT: "STP_Village",
};

interface clip_rasters{
  file_name:string;
  layer_name:string;
  workspace:string;
}
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
  LAYER_NAMES: typeof LAYER_NAMES;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setSecondaryLayer: (layer: string | null) => void;
}

// Props for the MapProvider loading
interface MapProviderProps {
  children: ReactNode;
  geoServerUrl?: string;
  defaultWorkspace?: string;
}

// Create the map context with default values
const MapContext = createContext<MapContextType>({
  primaryLayer: LAYER_NAMES.STATE,
  secondaryLayer: null,
  LayerFilter:null,
  LayerFilterValue :null,
  stpOperation: false,
 
  setstpOperation: () => {},
  setSecondaryLayer: () => {},
  setPrimaryLayer: () => {},
  syncLayersWithLocation: () => {},
  isMapLoading: false,
  zoomToFeature: () => {},
  resetMapView: () => {},
  geoServerUrl: "/geoserver/api",
  defaultWorkspace: "vector_work",
  LAYER_NAMES,
  loading: false,
  setLoading: () => {},
});

// Create the provider component
export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  geoServerUrl = "/geoserver/api",
  defaultWorkspace = "vector_work"
}) => {
  // State for layer management
  const [primaryLayer, setPrimaryLayer] = useState<string>(LAYER_NAMES.STATE);
  const [secondaryLayer, setSecondaryLayer] = useState<string | null>(null);
  const [LayerFilter, setLayerFilter] = useState<string|null>(null);
  const [LayerFilterValue, setLayerFilterValue] = useState<number[]|null>(null);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [stpOperation, setstpOperation] = useState<boolean>(false);
 
  // Get location context data
  const {
    selectedState,
    selectedDistrict,
    selectedSubDistricts,

  } = useLocation();

  // Function to reset map view (zoom to default)
  const resetMapView = (): void => {
    // This is a placeholder - the actual implementation
    // will happen in the Map component that consumes this context
    console.log("Map view reset requested");
  };

  // Function to zoom to a specific feature
  const zoomToFeature = (featureId: string, layerName: string): void => {
   
    console.log(`Zoom to feature ${featureId} in layer ${layerName} requested`);
  };

  // Synchronize layers based on location selections
  const syncLayersWithLocation = (): void => {
    setIsMapLoading(true);
    
    // Default to showing states
    let primary: string = LAYER_NAMES.INDIA ;
    let secondary: string | null = null;
    let filters_type:string | null = null;
    let filters_value: number[] | null = null;
    
    // Logic for determining which layers to show based on selection state
    if (selectedSubDistricts.length) {
      secondary = LAYER_NAMES.SUB_DISTRICT;
      filters_type = 'subdis_cod';
      filters_value = selectedSubDistricts;
      }
    else if (selectedDistrict) {
      secondary = LAYER_NAMES.DISTRICT;
      filters_type = 'district_c';
      filters_value = [selectedDistrict];
     }
    else if(selectedState) {
      secondary = LAYER_NAMES.STATE;
      filters_type = 'State_Code';
      filters_value = [selectedState];
    }
    

    // Update state with new layer configuration
    setPrimaryLayer(primary);
    setSecondaryLayer(secondary);
    setLayerFilter(filters_type);
    setLayerFilterValue(filters_value)
    setIsMapLoading(false);
  };

  // Listen for changes in location selection and update layers accordingly
  useEffect(() => {
    syncLayersWithLocation();
  }, [
    selectedState,
    selectedDistrict,
    selectedSubDistricts,
  ]);
  
  // Context value
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
    LAYER_NAMES,
    loading: false,
    
    setLoading: () => {},
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