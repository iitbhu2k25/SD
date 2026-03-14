"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
// import { useCategory } from "../admin/CategoryContext";
import { useRiverSystem } from "@/contexts/water/users/DrainContext";
import { DRAIN_LAYER_NAMES } from "@/interface/raster_context";
import {ClipRasters} from "@/contexts/water/users/DrainContext";
interface LayerFilter {
  filterField: string | null;
  filterValue: number[] |string[] | null;
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
  geoServerUrl: string;
  defaultWorkspace: string;
  DRAIN_LAYER_NAMES: typeof DRAIN_LAYER_NAMES;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  showLayer: boolean;
  setShowLayer: (layer: boolean) => void;
  rasterLayerInfo: ClipRasters | null;
  setRasterLayerInfo: (layer: ClipRasters |null) => void;
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
  setstpOperation: () => {},
  setPrimaryLayer: () => {},
  setRiverLayer: () => {},
  setStretchLayer: () => {},
  setDrainLayer: () => {},
  setCatchmentLayer: () => {},
  syncLayersWithRiverSystem: () => {},
  isMapLoading: false,
  geoServerUrl: "/geoserver/api",
  defaultWorkspace: "dss_vector",
  DRAIN_LAYER_NAMES,
  loading: false,
  setLoading: () => {},
  setShowLayer: () => {},
  rasterLayerInfo: null,
  setRasterLayerInfo: () => {},
  setShowLegend: () => {},
  showLegend:false,
  handleLayerSelection: () => {},
  setSelectedradioLayer: () => {},
  selectedradioLayer: null,
  error: null,
  setError: () => {},
  wmsDebugInfo: null,
  setWmsDebugInfo: () => {},
  setRasterLoading: () => {},
  rasterLoading: false,
});

// Create the provider component
export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  geoServerUrl = "/geoserver/api",
  defaultWorkspace = "dss_vector",
}) => {
  // State for layer management
  const [primaryLayer, setPrimaryLayer] = useState<string>(DRAIN_LAYER_NAMES.INDIA);
  const [boundarylayer, setboundarylayer] = useState<string | null>(DRAIN_LAYER_NAMES.BOUNDARY);
  const [riverLayer, setRiverLayer] = useState<string | null>(DRAIN_LAYER_NAMES.RIVER); 
  const [stretchLayer, setStretchLayer] = useState<string | null>(DRAIN_LAYER_NAMES.STRETCH); 
  const [drainLayer, setDrainLayer] = useState<string | null>(DRAIN_LAYER_NAMES.DRAIN); 
  const [catchmentLayer, setCatchmentLayer] = useState<string | null>(null); 
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(true);
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
  // Get river system context data
  const {
    selectedRiver,
    selectedStretch,
    selectedDrain,
    setDisplayRaster,
    displayRaster,
  
  } = useRiverSystem();

  // Function to reset map view (zoom to default)
  // const { selectedCategories, setStpProcess } = useCategory();
  // Synchronize layers based on river system selections with hierarchical filtering
  const syncLayersWithRiverSystem = useCallback((): void => {
    

    setIsMapLoading(true);


    const hasAnySelections = !!(
      selectedRiver ||
      (selectedStretch !== null) ||
      (selectedDrain !== null)
    );

    setHasSelections(hasAnySelections);

    // Always keep layers loaded
    setRiverLayer(DRAIN_LAYER_NAMES.RIVER);
    setStretchLayer(DRAIN_LAYER_NAMES.STRETCH);
    setDrainLayer(DRAIN_LAYER_NAMES.DRAIN);

    console.log("river code:", selectedRiver);
    console.log("stretch id:", selectedStretch);
    console.log("drain no:", selectedDrain);

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
    if (selectedStretch !== null) {
      // If specific stretches are selected, filter by stretch IDs
      setDrainFilter({
        filterField: "Drain_No",
        filterValue: selectedDrain !== null ? [selectedDrain] : null
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
    if (selectedDrain !== null) {
      // If specific drains are selected, filter by drain numbers
      setDrainFilter({
        filterField: "Drain_No",
        filterValue: selectedDrain !== null ? [selectedDrain] : null
      });
      console.log("Selected Drain no:", selectedDrain);
      setCatchmentLayer(DRAIN_LAYER_NAMES.CATCHMENT);
      setCatchmentFilter({
        filterField: "Drain_No", 
        filterValue: selectedDrain !== null ? [selectedDrain] : null,
      });
    
    } else if (selectedStretch !== null) {
      // If stretches are selected, filter drains by stretch IDs
      console.log("Selected Drain no with stretch:", selectedDrain);

      setDrainFilter({
        filterField: "Stretch_ID", // Assuming drains have a Stretch_ID field
        filterValue: [selectedStretch]
      });
      setCatchmentLayer(null);
      setCatchmentFilter({ filterField: null, filterValue: null });
    } else if (selectedRiver) {
      // If only river is selected, filter drains by river
      console.log("Selected Drain no with river:", selectedDrain);

      setDrainFilter({
        filterField: "River_Code", // Assuming drains have a River_Code field
        filterValue: [selectedRiver]
      });
      setCatchmentLayer(null);
      setCatchmentFilter({ filterField: null, filterValue: null });
    } else {
      console.log("Selected Drain no with no selection:", selectedDrain);

      setDrainFilter({ filterField: null, filterValue: null });
      setCatchmentLayer(null);
      setCatchmentFilter({ filterField: null, filterValue: null });
    }

    setIsMapLoading(false);
    setShouldLoadAllLayers(false); // After first sync, we no longer need the initial load flag
  }, [selectedRiver, selectedStretch, selectedDrain]);

  // Listen for changes in river system selection and update layers accordingly
  useEffect(() => {
    syncLayersWithRiverSystem();
  }, [syncLayersWithRiverSystem]);

  
  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
  };



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
    geoServerUrl,
    defaultWorkspace,
    DRAIN_LAYER_NAMES,
    loading,
    setLoading,
    handleLayerSelection,
    setRasterLayerInfo,
    rasterLayerInfo,
    setShowLayer:()=>{},
    showLayer: false,
    setShowLegend: () => {},
    showLegend,
    selectedradioLayer,
    setSelectedradioLayer: () => {},
    error,
    setError,
    wmsDebugInfo: null,
    setWmsDebugInfo: () => {},
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