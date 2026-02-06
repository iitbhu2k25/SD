"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

import { useRiverSystem } from "@/contexts/water_quality_assesment/users/DrainContext";
import { DRAIN_LAYER_NAMES, ClipRasters } from "@/interface/raster_context";
import { useWebSocket } from "@/services/websocket";
import { api } from '@/services/api';
import { useYear } from '@/contexts/water_quality_assesment/users/yearContext';


interface LayerFilter {
  filterField: string | null;
  filterValue: number[] | string[] | null;
}


interface MapContextType {
  primaryLayer: string;
  riverLayer: string | null;
  stretchLayer: string | null;
  drainLayer: string | null;
  catchmentLayer: string | null;
  boundarylayer: string | null;

  riverFilter: LayerFilter;
  stretchFilter: LayerFilter;
  drainFilter: LayerFilter;
  catchmentFilter: LayerFilter;

  shouldLoadAllLayers: boolean;
  hasSelections: boolean;

  stpOperation: boolean;
  setstpOperation: (operation: boolean) => void;
  setPrimaryLayer: (layer: string) => void;
  setRiverLayer: (layer: string | null) => void;
  setStretchLayer: (layer: string | null) => void;
  setDrainLayer: (layer: string | null) => void;
  setCatchmentLayer: (layer: string | null) => void;
  syncLayersWithRiverSystem: () => void;
  isMapLoading: boolean;
  zoomToFeature: (featureId: string, layerName: string) => void;
  resetMapView: () => void;
  geoServerUrl: string;
  defaultWorkspace: string;
  DRAIN_LAYER_NAMES: typeof DRAIN_LAYER_NAMES;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  showLayer: boolean;
  setShowLayer: (layer: boolean) => void;
  rasterLayerInfo: ClipRasters | null;
  setRasterLayerInfo: (layer: null) => void;
  setShowLegend: (layer: boolean) => void;
  showLegend: boolean;
  handleLayerSelection: (layer: string) => void;
  setSelectedradioLayer: (layer: string | null) => void;
  selectedradioLayer: string | null;
  error: string | null;
  setError: (error: string | null) => void;
  wmsDebugInfo: string | null;
  setWmsDebugInfo: (info: string | null) => void;
  setRasterLoading: (loading: boolean) => void;
  rasterLoading: boolean;
}

// Props for the MapProvider
interface MapProviderProps {
  children: ReactNode;
  geoServerUrl?: string;
  defaultWorkspace?: string;
}

// Create the map context with default values
const MapContext = createContext<MapContextType>({
  primaryLayer: DRAIN_LAYER_NAMES.INDIA,
  riverLayer: null,
  stretchLayer: null,
  drainLayer: null,
  catchmentLayer: null,
  boundarylayer: null,
  riverFilter: { filterField: null, filterValue: null },
  stretchFilter: { filterField: null, filterValue: null },
  drainFilter: { filterField: null, filterValue: null },
  catchmentFilter: { filterField: null, filterValue: null },
  shouldLoadAllLayers: true,
  hasSelections: false,
  showLayer: true,
  stpOperation: false,
  setstpOperation: () => { },
  setPrimaryLayer: () => { },
  setRiverLayer: () => { },
  setStretchLayer: () => { },
  setDrainLayer: () => { },
  setCatchmentLayer: () => { },
  syncLayersWithRiverSystem: () => { },
  isMapLoading: false,
  zoomToFeature: () => { },
  resetMapView: () => { },
  geoServerUrl: "/geoserver/api",
  defaultWorkspace: "vector_work",
  DRAIN_LAYER_NAMES,
  loading: false,
  setLoading: () => { },
  setShowLayer: () => { },
  rasterLayerInfo: null,
  setRasterLayerInfo: () => { },
  setShowLegend: () => { },
  showLegend: false,
  handleLayerSelection: () => { },
  setSelectedradioLayer: () => { },
  selectedradioLayer: null,
  error: null,
  setError: () => { },
  wmsDebugInfo: null,
  setWmsDebugInfo: () => { },
  setRasterLoading: () => { },
  rasterLoading: false,
});

// Create the provider component
export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  geoServerUrl = "/geoserver/api",
  defaultWorkspace = "vector_work",
}) => {
  // State for layer management
  const [primaryLayer, setPrimaryLayer] = useState<string>(DRAIN_LAYER_NAMES.INDIA);
  const [boundarylayer, setboundarylayer] = useState<string | null>(DRAIN_LAYER_NAMES.BOUNDARY);
  const [riverLayer, setRiverLayer] = useState<string | null>(DRAIN_LAYER_NAMES.RIVER);
  const [stretchLayer, setStretchLayer] = useState<string | null>(DRAIN_LAYER_NAMES.STRETCH);
  const [drainLayer, setDrainLayer] = useState<string | null>(DRAIN_LAYER_NAMES.DRAIN);
  const [catchmentLayer, setCatchmentLayer] = useState<string | null>(DRAIN_LAYER_NAMES.CATCHMENT);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<ClipRasters | null>(null);
  const [riverFilter, setRiverFilter] = useState<LayerFilter>({
    filterField: null,
    filterValue: null
  });
  const [stretchFilter, setStretchFilter] = useState<LayerFilter>({
    filterField: null,
    filterValue: null
  });
  const [drainFilter, setDrainFilter] = useState<LayerFilter>({
    filterField: null,
    filterValue: null
  });
  const [catchmentFilter, setCatchmentFilter] = useState<LayerFilter>({
    filterField: null,
    filterValue: null
  });

  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [stpOperation, setstpOperation] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [shouldLoadAllLayers, setShouldLoadAllLayers] = useState<boolean>(true);
  const [hasSelections, setHasSelections] = useState<boolean>(false);
  const [selectedradioLayer, setSelectedradioLayer] = useState("");
  const { wqi_data, selectedParam, qualityParam } = useYear();
  // Get river system context data
  const {
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    setDisplayRaster

  } = useRiverSystem();

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
      if (!activeTaskId) return;
      console.log(" websocket stpOperation",stpOperation)
      let dict_message = JSON.parse(lastMessage || "{}");
      if (dict_message["state"] === "completed") {
        const resp:ClipRasters[] = convertToClipRasters(dict_message["result"]);
        setDisplayRaster(resp);
        setstpOperation(false);
        setSelectedradioLayer("GWI_overlay");
        disconnect();
      }
      else {
        console.log("lastMessage", lastMessage);
      }
    }, [lastMessage, isConnected]);
  
  // Function to reset map view (zoom to default)
  const resetMapView = (): void => {

  };

  // Function to zoom to a specific feature
  const zoomToFeature = (featureId: string, layerName: string): void => {

  };

  // Synchronize layers based on river system selections with hierarchical filtering
  const syncLayersWithRiverSystem = useCallback((): void => {


    setIsMapLoading(true);


    const hasAnySelections = !!(
      selectedRiver ||
      (selectedStretches && selectedStretches.length > 0) ||
      (selectedDrains && selectedDrains.length > 0) ||
      (selectedCatchments && selectedCatchments.length > 0)
    );

    setHasSelections(hasAnySelections);

    // Always keep layers loaded
    setRiverLayer(DRAIN_LAYER_NAMES.RIVER);
    setStretchLayer(DRAIN_LAYER_NAMES.STRETCH);
    setDrainLayer(DRAIN_LAYER_NAMES.DRAIN);
    setCatchmentLayer(DRAIN_LAYER_NAMES.CATCHMENT);

    // 1. River Filter - Only filter rivers by selected river
    if (selectedRiver) {
      setRiverFilter({
        filterField: "River_Code",
        filterValue: [selectedRiver]
      });
    } else {
      setRiverFilter({ filterField: null, filterValue: null });

    }

    // 2. Stretch Filter - Hierarchical logic
    if (selectedStretches && selectedStretches.length > 0) {
      // If specific stretches are selected, filter by stretch IDs
      setDrainFilter({
        filterField: "Drain_No",
        filterValue: selectedDrains
      });

    } else if (selectedRiver) {
      // If only river is selected, filter stretches by river
      setStretchFilter({
        filterField: "River_Code", // Assuming stretches have a River_Code field
        filterValue: [selectedRiver]
      });

    } else {
      setStretchFilter({ filterField: null, filterValue: null });
    }

    // 3. Drain Filter - Hierarchical logic
    if (selectedDrains && selectedDrains.length > 0) {
      // If specific drains are selected, filter by drain numbers
      setDrainFilter({
        filterField: "Drain_No",
        filterValue: selectedDrains
      });

    } else if (selectedStretches && selectedStretches.length > 0) {
      // If stretches are selected, filter drains by stretch IDs
      setDrainFilter({
        filterField: "Stretch_ID", // Assuming drains have a Stretch_ID field
        filterValue: selectedStretches
      });
    } else if (selectedRiver) {
      // If only river is selected, filter drains by river
      setDrainFilter({
        filterField: "River_Code", // Assuming drains have a River_Code field
        filterValue: [selectedRiver]
      });

    } else {
      setDrainFilter({ filterField: null, filterValue: null });

    }

    // 4. Catchment Filter - Keep original logic (independent)
    if (selectedCatchments && selectedCatchments.length > 0) {
      setCatchmentFilter({
        filterField: "village_id",
        filterValue: selectedCatchments
      });

    } else {
      setCatchmentFilter({ filterField: null, filterValue: null });

    }

    setIsMapLoading(false);
    setShouldLoadAllLayers(false); // After first sync, we no longer need the initial load flag
  }, [selectedRiver, selectedStretches, selectedDrains, selectedCatchments]);

  // Listen for changes in river system selection and update layers accordingly
  useEffect(() => {
    syncLayersWithRiverSystem();
  }, [syncLayersWithRiverSystem]);
  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
  };
  useEffect(() => {
    if (!stpOperation) return;

    const performSTP = async () => {
      setRasterLoading(true);
      setError(null);
      try {
        const resp = await api.post("/wqi/well_interpolation", {
          body: {
            data: wqi_data,
            params: selectedParam,
            location: selectedCatchments,
            place:"drain"
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
    riverLayer,
    stretchLayer,
    drainLayer,
    catchmentLayer,
    boundarylayer,
    riverFilter,
    stretchFilter,
    drainFilter,
    catchmentFilter,
    shouldLoadAllLayers,
    hasSelections,
    stpOperation,
    setstpOperation,
    setPrimaryLayer,
    setRiverLayer,
    setStretchLayer,
    setDrainLayer,
    setCatchmentLayer,
    syncLayersWithRiverSystem,
    isMapLoading,
    zoomToFeature,
    resetMapView,
    geoServerUrl,
    defaultWorkspace,
    DRAIN_LAYER_NAMES,
    loading,
    setLoading,
    handleLayerSelection,
    setRasterLayerInfo,
    rasterLayerInfo,
    setShowLayer: () => { },
    showLayer: false,
    setShowLegend: () => { },
    showLegend,
    selectedradioLayer,
    setSelectedradioLayer: () => { },
    error,
    setError,
    wmsDebugInfo: null,
    setWmsDebugInfo: () => { },
    setRasterLoading,
    rasterLoading,
  };

  return (
    <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
  );
};

// Custom hook to use the map context
export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};