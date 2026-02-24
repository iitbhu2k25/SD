'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from '@/contexts/water_quality_assesment/admin/LocationContext';
import { api } from '@/services/api';
import { ClipRasters, stp_priority_Output } from '@/interface/raster_context';
import { useYear } from './yearContext';
import { ADMIN_LAYER_NAMES } from '@/interface/raster_context';
import { useWebSocket } from "@/services/websocket";
import { last } from 'lodash';
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
  setRasterLayerInfo: (layer: null) => void;
  setShowLegend: (layer: boolean) => void;
  showLegend: boolean;
  handleLayerSelection: (layer: string) => void;
}

// Props for the MapProvider loading
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
  setstpOperation: () => { },
  setSecondaryLayer: () => { },
  setPrimaryLayer: () => { },
  syncLayersWithLocation: () => { },
  isMapLoading: false,
  zoomToFeature: () => { },
  resetMapView: () => { },
  geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
  defaultWorkspace: "vector_work",
  ADMIN_LAYER_NAMES,
  loading: false,
  setLoading: () => { },
  rasterLoading: false,
  setRasterLoading: () => { },
  error: null,
  setError: () => { },
  wmsDebugInfo: null,
  setWmsDebugInfo: () => { },
  selectedradioLayer: "",
  setSelectedradioLayer: () => { },
  showLayer: true,
  setShowLayer: () => { },
  rasterLayerInfo: null,
  setRasterLayerInfo: () => { },
  setShowLegend: () => { },
  showLegend: true,
  handleLayerSelection: () => { },
});

// Create the provider component
export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  geoServerUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
  defaultWorkspace = "vector_work"
}) => {
  // State for layer management
  const [primaryLayer, setPrimaryLayer] = useState<string>(ADMIN_LAYER_NAMES.STATE);
  const [secondaryLayer, setSecondaryLayer] = useState<string | null>(null);
  const [LayerFilter, setLayerFilter] = useState<string | null>(null);
  const [LayerFilterValue, setLayerFilterValue] = useState<number[]>([]);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [stpOperation, setstpOperation] = useState<boolean>(false);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wmsDebugInfo, setWmsDebugInfo] = useState<string | null>(null);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<ClipRasters | null>(null);
  const [selectedradioLayer, setSelectedradioLayer] = useState("");
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const { wqi_data, selectedParam, qualityParam } = useYear();

  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    displayRaster,
    setDisplayRaster,

  } = useLocation();

  function convertToClipRasters(data: Record<string, string>): ClipRasters[] {
  return Object.entries(data).map(([key, value]) => ({
    file_name: key,
    layer_name: value,
  }));
}


  const [activeTaskId, setActiveTaskId] = useState("");

  const wsUrl = activeTaskId
    ? `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/wqi/ws/${activeTaskId}`
    : "";

  const {lastMessage, isConnected, disconnect } = useWebSocket(wsUrl, { reconnect: false });

  useEffect(() => {
  if (!lastMessage || !activeTaskId) return;
  
  try {
    const dict_message = JSON.parse(lastMessage);
    if (dict_message["state"] === "completed") {
      const resp: ClipRasters[] = convertToClipRasters(dict_message["result"]);
      setDisplayRaster(resp);
      setstpOperation(false);
      setSelectedradioLayer("GWI_overlay");
      disconnect();
      setActiveTaskId(""); 
    } else {
      console.log("lastMessage", lastMessage);
    }
  } catch (e) {
    console.log("Failed to parse message:", e);
  }
}, [lastMessage, activeTaskId, disconnect]);

  const resetMapView = (): void => {

  };

  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);

  };
  const zoomToFeature = (featureId: string, layerName: string): void => {
  };

  // Synchronize layers based on location selections
  const syncLayersWithLocation = (): void => {
    setIsMapLoading(true);

    // Default to showing states
    let primary: string = ADMIN_LAYER_NAMES.INDIA;
    let secondary: string | null = null;
    let filters_type: string | null = null;
    let filters_value: number[] = [];

    // Logic for determining which layers to show based on selection state
    if (selectedSubDistricts.length) {
      secondary = ADMIN_LAYER_NAMES.SUB_DISTRICT;
      filters_type = 'subdis_cod';
      filters_value = selectedSubDistricts;
    }
    else if (selectedDistricts.length) {
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
    setLayerFilterValue(filters_value)
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


  useEffect(() => {
    if (!stpOperation) return;

    const performSTP = async () => {
      setRasterLoading(true);
      setError(null);
      setWmsDebugInfo(null);

      try {
        const resp = await api.post("/wqi/well_interpolation", {
          body: {
            data: wqi_data,
            params: selectedParam,
            location: selectedSubDistricts,
            place:"admin"
          }
        }
        );

        if (resp.status != 201) {
          console.log("get error is ", resp);
          throw new Error(`WQI operation failed with status: ${resp.status}`);
        }
        const result = await resp.message as string;
        setActiveTaskId(result);
      } catch (error: any) {
        setError(`Error communicating with STP service: ${error.message}`);
        setRasterLoading(false);

      }
    };

    performSTP();
  }, [stpOperation]);
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
    ADMIN_LAYER_NAMES,
    loading: false,
    setLoading: () => { },
    rasterLayerInfo,
    setRasterLayerInfo,
    rasterLoading,
    setRasterLoading,
    error,
    setError,
    wmsDebugInfo,
    setWmsDebugInfo: () => { },
    selectedradioLayer,
    setSelectedradioLayer: () => { },
    setShowLayer: () => { },
    showLayer: false,
    setShowLegend: () => { },
    showLegend,
    handleLayerSelection,
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