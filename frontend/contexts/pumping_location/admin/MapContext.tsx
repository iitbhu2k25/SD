'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from '@/contexts/pumping_location/admin/LocationContext';
import { useCategory } from '@/contexts/pumping_location/admin/CategoryContext';
import { ADMIN_LAYER_NAMES, ClipRasters, stp_priority_Output } from '@/interface/raster_context';
import { api } from '@/services/api';



interface MapContextType {
  primaryLayer: string;
  secondaryLayer: string | null;
  resultLayer: string | null;
  setResultLayer: (layer: string | null) => void;
  LayerFilter: string | null;
  setLayerFilter: (layer: string | null) => void;
  LayerFilterValue: number[] | null;
  setSecondaryLayer: (layer: string | null) => void;
  stpOperation: boolean;
  setstpOperation: (operation: boolean) => void;
  setPrimaryLayer: (layer: string) => void;
  syncLayersWithLocation: () => void;
  isMapLoading: boolean;
  setIsMapLoading: (loading: boolean) => void;
  zoomToFeature: (featureId: string, layerName: string) => void;
  resetMapView: () => void;
  geoServerUrl: string;
  defaultWorkspace: string;
  ADMIN_LAYER_NAMES: typeof ADMIN_LAYER_NAMES;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  selectedradioLayer: string | null;
  setSelectedradioLayer: (layer: string | null) => void;
  handleLayerSelection: (layer: string) => void;

}

// Props for the MapProvider component
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
  setLayerFilter: () => { },
  LayerFilterValue: null,
  stpOperation: false,
  setstpOperation: () => { },
  setSecondaryLayer: () => { },
  setPrimaryLayer: () => { },
  syncLayersWithLocation: () => { },
  isMapLoading: false,
  setIsMapLoading: () => { },
  zoomToFeature: () => { },
  resetMapView: () => { },
  geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
  defaultWorkspace: "vector_work",
  ADMIN_LAYER_NAMES,
  loading: false,
  setLoading: () => { },
  resultLayer: null,
  setResultLayer: () => { },
  selectedradioLayer: "",
  setSelectedradioLayer: () => { },
 handleLayerSelection: () => {},
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
  const [resultLayer, setResultLayer] = useState<string | null>(null);
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
  // Get location context data
  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedvillages,
    displayRaster,
    setDisplayRaster

  } = useLocation();
  const { selectedCategory, setStpProcess, setShowTable, setTableData } =
    useCategory();
  // Function to reset map view (zoom to default)
  const resetMapView = (): void => {
    // This is a placeholder - the actual implementation
    // will happen in the Map component that consumes this context
    console.log("Map view reset requested");
  };
  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
  };

  // Function to zoom to a specific feature
  const zoomToFeature = (featureId: string, layerName: string): void => {
    console.log(`Zoom to feature ${featureId} in layer ${layerName} requested`);
  };

  // Synchronize layers based on location selections
  const syncLayersWithLocation = (): void => {
    setIsMapLoading(true);

    // Default to showing states
    let primary: string = ADMIN_LAYER_NAMES.INDIA;
    let secondary: string | null = null;
    let filters_type: string | null = null;
    let filters_value: number[] = [];
    if (selectedvillages.length) {
      secondary = ADMIN_LAYER_NAMES.SUB_DISTRICT;
      filters_type = '"ID"';
      filters_value = selectedvillages;
    }
    // Logic for determining which layers to show based on selection state
    else if (selectedSubDistricts) {
      secondary = ADMIN_LAYER_NAMES.SUB_DISTRICT;
      filters_type = 'subdis_cod';
      filters_value = [selectedSubDistricts];
    }
    else if (selectedDistricts) {
      secondary = ADMIN_LAYER_NAMES.DISTRICT;
      filters_type = 'district_c';
      filters_value = [selectedDistricts];
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
    selectedDistricts,
    selectedSubDistricts,
    selectedvillages.length
  ]);


  useEffect(() => {
    if (stpOperation) {
      const performGWPL = async () => {
        setRasterLoading(true);
        setError(null);
        setWmsDebugInfo(null);
        setStpProcess(true);
        try {
          const resp = await api.post("/gwz_operation/gwpl_operation", {
            body: {
              data: selectedCategory,
              clip: selectedvillages
            },
          });

          if (resp.status > 201) {
            throw new Error(`STP operation failed with status: ${resp.status}`);
          }
          const result = await resp.message as stp_priority_Output;

          if (result) {
            const append_data = {
              file_name: "Pumping_location",
              workspace: result.workspace,
              layer_name: result.layer_name,
            };
            setTableData(result.csv_details);
            const index = displayRaster.findIndex(
              (item) => item.file_name === "Pumping_location"
            );

            let newData;
            if (index !== -1) {

              newData = [...displayRaster];
              newData[index] = append_data;
            } else {
              // Append new entry
              newData = displayRaster.concat(append_data);
            }
            setDisplayRaster(newData);
            setRasterLayerInfo(append_data);
            setShowTable(true);
            handleLayerSelection(append_data.file_name);
            setShowLegend(true);
          } else {
            console.log("GWPL operation did not return success:", result);
            setRasterLoading(false);
          }
        } catch (error: any) {
          setError(`GWPL operation failed: ${error.message}`);
        } finally {
          setstpOperation(false);
        }
      };

      performGWPL();
      return;
    }
  }, [stpOperation, selectedCategory, selectedSubDistricts]);


  // Context value
  const contextValue: MapContextType = {
    primaryLayer,
    setLayerFilter,
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
    setIsMapLoading,
    resetMapView,
    geoServerUrl,
    defaultWorkspace,
    ADMIN_LAYER_NAMES,
    loading: false,
    setLoading: () => { },
    resultLayer,
    setResultLayer,
    selectedradioLayer,
    setSelectedradioLayer: () => { },
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