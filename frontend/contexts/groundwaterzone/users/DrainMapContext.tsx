"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useCategory } from "../admin/CategoryContext";
import { useRiverSystem } from "@/contexts/groundwaterzone/users/DrainContext";
import { DRAIN_LAYER_NAMES, ClipRasters,stp_priority_Output } from "@/interface/raster_context";
import { api } from "@/services/api";
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
  const [primaryLayer, setPrimaryLayer] = useState<string>(DRAIN_LAYER_NAMES.INDIA);
  const [boundarylayer, setboundarylayer] = useState<string | null>(DRAIN_LAYER_NAMES.BOUNDARY);
  const [riverLayer, setRiverLayer] = useState<string | null>(DRAIN_LAYER_NAMES.RIVER);
  const [stretchLayer, setStretchLayer] = useState<string | null>(DRAIN_LAYER_NAMES.STRETCH);
  const [drainLayer, setDrainLayer] = useState<string | null>(DRAIN_LAYER_NAMES.DRAIN);
  const [catchmentLayer, setCatchmentLayer] = useState<string | null>(DRAIN_LAYER_NAMES.CATCHMENT);
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
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    setDisplayRaster,
    setShowTable,
    setTableData,
    displayRaster,

  } = useRiverSystem();

  // Function to reset map view (zoom to default)
  const resetMapView = (): void => {
    console.log("Map view reset requested");
  };

  // Function to zoom to a specific feature
  const zoomToFeature = (featureId: string, layerName: string): void => {
    console.log(`Zoom to feature ${featureId} in layer ${layerName} requested`);
  };
  const { selectedCategories, setStpProcess } = useCategory();
  // Synchronize layers based on river system selections with hierarchical filtering
  const syncLayersWithRiverSystem = useCallback((): void => {
    console.log("Syncing layers with river system (hierarchical filtering)...", {
      selectedRiver,
      selectedStretches,
      selectedDrains,
      selectedCatchments,
    });

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
      console.log("River filter applied for river:", selectedRiver);
    } else {
      setRiverFilter({ filterField: null, filterValue: null });
      console.log("River filter cleared - showing all rivers");
    }

    // 2. Stretch Filter - Hierarchical logic
    if (selectedStretches && selectedStretches.length > 0) {
      // If specific stretches are selected, filter by stretch IDs
      setDrainFilter({
        filterField: "Drain_No",
        filterValue: selectedDrains
      });
      console.log("Stretch filter applied for specific stretches:", selectedStretches);
    } else if (selectedRiver) {
      // If only river is selected, filter stretches by river
      setStretchFilter({
        filterField: "River_Code", // Assuming stretches have a River_Code field
        filterValue: [selectedRiver]
      });
      console.log("Stretch filter applied for river:", selectedRiver);
    } else {
      // No selection - show all stretches
      setStretchFilter({ filterField: null, filterValue: null });
      console.log("Stretch filter cleared - showing all stretches");
    }

    // 3. Drain Filter - Hierarchical logic
    if (selectedDrains && selectedDrains.length > 0) {
      // If specific drains are selected, filter by drain numbers
      setDrainFilter({
        filterField: "Drain_No",
        filterValue: selectedDrains
      });
      console.log("Drain filter applied for specific drains:", selectedDrains);
    } else if (selectedStretches && selectedStretches.length > 0) {
      // If stretches are selected, filter drains by stretch IDs
      setDrainFilter({
        filterField: "Stretch_ID", // Assuming drains have a Stretch_ID field
        filterValue: selectedStretches
      });
      console.log("Drain filter applied for stretches:", selectedStretches);
    } else if (selectedRiver) {
      // If only river is selected, filter drains by river
      setDrainFilter({
        filterField: "River_Code", // Assuming drains have a River_Code field
        filterValue: [selectedRiver]
      });
      console.log("Drain filter applied for river:", selectedRiver);
    } else {
      // No selection - show all drains
      setDrainFilter({ filterField: null, filterValue: null });
      console.log("Drain filter cleared - showing all drains");
    }

    // 4. Catchment Filter - Keep original logic (independent)
    if (selectedCatchments && selectedCatchments.length > 0) {
      setCatchmentFilter({
        filterField: "village_id",
        filterValue: selectedCatchments
      });
      console.log("Catchment filter applied for catchments:", selectedCatchments);
    } else {
      setCatchmentFilter({ filterField: null, filterValue: null });
      console.log("Catchment filter cleared - showing all catchments");
    }
    setIsMapLoading(false);
    setShouldLoadAllLayers(false); 
  }, [selectedRiver, selectedStretches, selectedDrains, selectedCatchments]);


  useEffect(() => {
    syncLayersWithRiverSystem();
  }, [syncLayersWithRiverSystem]);
  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
  
  };
  useEffect(() => {
    if (!stpOperation) return;

    const performSTP = async () => {
      try {
        const resp = await api.post("/gwz_operation/gwz_operation", {
          body: {
            data: selectedCategories,
            clip: selectedCatchments,
            place: "Drain",
          },
        }
        );

        if (resp.status>201) {
          throw new Error(`STP operation failed with status: ${resp.status}`);
        }
        const result = await resp.message as stp_priority_Output;

        if (result) {
          const append_data = {
            file_name: "GroundWaterZone",
            workspace: result.workspace,
            layer_name: result.layer_name,
          };
          setTableData(result.csv_details);

          const index = displayRaster.findIndex(
            (item) => item.file_name === "GroundWaterZone"
          );

          let newData;
          if (index !== -1) {
            newData = [...displayRaster];
            newData[index] = append_data;
          } else {
            newData = displayRaster.concat(append_data);
          }
          setDisplayRaster(newData);
          handleLayerSelection(append_data.file_name)
        } else {
          console.log("STP operation did not return success:", result);
          setRasterLoading(false);
        }
      } catch (error: any) {
        setError(`Error communicating with STP service: ${error.message}`);
        setRasterLoading(false);
        setShowTable(false);
      } finally {
        setstpOperation(false);
        setStpProcess(false);
      }
    };

    performSTP();
  }, [
    stpOperation,
    selectedCategories,
    selectedCatchments,
    selectedDrains,
    selectedStretches,
    selectedRiver,
  ]);



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