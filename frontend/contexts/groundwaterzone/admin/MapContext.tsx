'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from '@/contexts/groundwaterzone/admin/LocationContext';
import { useCategory } from '@/contexts/groundwaterzone/admin/CategoryContext';
import { api } from '@/services/api';
import { DataRow } from '@/interface/table';
// Define layer name constants to ensure consistency
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

interface rasterOutput{
  workspace:string,                  
  layer_name:string,
  csv_path:string,
  csv_details:DataRow[]
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
  rasterLayerInfo: clip_rasters | null;
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
  rasterLoading: false,
  setRasterLoading: () => {},
  error: null,
  setError: () => {},
  wmsDebugInfo: null,
  setWmsDebugInfo: () => {},
  selectedradioLayer: "",
  setSelectedradioLayer: () => {},
  showLayer: true,
  setShowLayer: () => {},
  rasterLayerInfo: null,
  setRasterLayerInfo: () => {},
  setShowLegend: () => {},
  showLegend: true,
  handleLayerSelection: () => {},
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
  const [LayerFilterValue, setLayerFilterValue] = useState<number[]>([]);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [stpOperation, setstpOperation] = useState<boolean>(false);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wmsDebugInfo, setWmsDebugInfo] = useState<string | null>(null);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<clip_rasters | null>(null);
  const [selectedradioLayer, setSelectedradioLayer] = useState("");
  const [showLegend, setShowLegend] = useState<boolean>(true);

  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    displayRaster,
    setdisplay_raster,

  } = useLocation();

  const { selectedCategories, setStpProcess, setShowTable, setTableData } =
      useCategory();
  
  const resetMapView = (): void => {
    console.log("Map view reset requested");
  };

  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
    console.log("Selected layer:", layerName);
  };
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
    let filters_value: number[] = [];
    
    // Logic for determining which layers to show based on selection state
    if (selectedSubDistricts.length) {
      secondary = LAYER_NAMES.SUB_DISTRICT;
      filters_type = 'subdis_cod';
      filters_value = selectedSubDistricts;
      }
    else if (selectedDistricts.length ) {
      secondary = LAYER_NAMES.DISTRICT;
      filters_type = 'district_c';
      filters_value = selectedDistricts;
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
    selectedDistricts.length,
    selectedSubDistricts.length,
  ]);
  

   useEffect(() => {
    if (!stpOperation) return;

    const performSTP = async () => {
      setRasterLoading(true);
      setError(null);
      setWmsDebugInfo(null);
      setStpProcess(true);



      try {
        const resp = await api.post("/gwz_operation/gwz_operation", {
          body:{
            data: selectedCategories,
            clip: selectedSubDistricts,
            place: "sub_district",
          }
        }
      );

        if (resp.status != 201) {
          throw new Error(`STP operation failed with status: ${resp.status}`);
        }

        const result = await resp.message as rasterOutput;

        if (result) {
          const append_data = {
            file_name: "GroundWaterZone",
            workspace: result.workspace,
            layer_name: result.layer_name,
          };
          setTableData(result.csv_details);

          // Check if file_name already exists
          const index = displayRaster.findIndex(
            (item) => item.file_name === "GroundWaterZone"
          );

          let newData;
          if (index !== -1) {
            // Update existing entry
            newData = [...displayRaster];
            newData[index] = append_data;
          } else {
            // Append new entry
            newData = displayRaster.concat(append_data);
          }
          setdisplay_raster(newData);
          setRasterLayerInfo(append_data);
          setShowTable(true);
          handleLayerSelection(append_data.file_name);
          setShowLegend(true);
        } else {
          console.log("STP operation did not return success:", result);
          setRasterLoading(false);
        }
      } catch (error: any) {
        console.log("Error performing STP operation:", error);
        setError(`Error communicating with STP service: ${error.message}`);
        setRasterLoading(false);
        setShowTable(false);
      } finally {
        setstpOperation(false);
        setStpProcess(false);
      }
    };

    performSTP();
  }, [stpOperation, selectedCategories, selectedSubDistricts]);
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
    rasterLayerInfo,
    setRasterLayerInfo,
    rasterLoading,
    setRasterLoading,
    error,
    setError,
    wmsDebugInfo,
    setWmsDebugInfo: () => {},
    selectedradioLayer,
    setSelectedradioLayer: () => {},
    setShowLayer:()=>{},
    showLayer: false,
    setShowLegend: () => {},
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