"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useRiverSystem } from "@/contexts/mar_suitability/users/DrainContext";
import { DRAIN_LAYER_NAMES } from "@/interface/raster_context";

// Updated interface with separate filters for each layer
interface LayerFilter {
  filterField: string | null;
  filterValue: number[] |string[] | null;
}

// Type definitions for the context
interface MapContextType {
  primaryLayer: string;
  riverLayer: string | null;
  stretchLayer: string | null;
  drainLayer: string | null;
  catchmentLayer: string | null;
  boundarylayer: string | null;
  
  // Separate filters for each layer
  riverFilter: LayerFilter;
  stretchFilter: LayerFilter;
  drainFilter: LayerFilter;
  catchmentFilter: LayerFilter;
  
  // Add initial load flags
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
  
  stpOperation: false,
  setstpOperation: () => {},
  setPrimaryLayer: () => {},
  setRiverLayer: () => {},
  setStretchLayer: () => {},
  setDrainLayer: () => {},
  setCatchmentLayer: () => {},
  syncLayersWithRiverSystem: () => {},
  isMapLoading: false,
  zoomToFeature: () => {},
  resetMapView: () => {},
  geoServerUrl: "/geoserver/api",
  defaultWorkspace: "vector_work",
  DRAIN_LAYER_NAMES,
  loading: false,
  setLoading: () => {},
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
  const [riverLayer, setRiverLayer] = useState<string | null>(DRAIN_LAYER_NAMES.RIVER); // Always load river layer
  const [stretchLayer, setStretchLayer] = useState<string | null>(DRAIN_LAYER_NAMES.STRETCH); // Always load stretch layer
  const [drainLayer, setDrainLayer] = useState<string | null>(DRAIN_LAYER_NAMES.DRAIN); // Always load drain layer
  const [catchmentLayer, setCatchmentLayer] = useState<string | null>(DRAIN_LAYER_NAMES.CATCHMENT); // Always load catchment layer
  
  // Separate filter states for each layer
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

  // Get river system context data
  const {
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
  } = useRiverSystem();

  // Function to reset map view (zoom to default)
  const resetMapView = (): void => {
   
  };

  // Function to zoom to a specific feature
  const zoomToFeature = (featureId: string, layerName: string): void => {
   
  };

  // Synchronize layers based on river system selections with hierarchical filtering
  const syncLayersWithRiverSystem = useCallback((): void => {
    

    setIsMapLoading(true);

    // Check if we have any selections
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
      // No selection - show all stretches
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