'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from '@/contexts/stp/stp_suitability/admin/LocationContext';
import { useCategory } from '@/contexts/stp/stp_suitability/admin/CategoryContext';
import { api } from '@/services/api';
import {stp_sutability_Output,ADMIN_TOWN_LAYER_NAMES, ClipRasters} from "@/interface/raster_context"

interface MapContextType {
  primaryLayer: string;
  secondaryLayer: string | null;
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
  ADMIN_TOWN_LAYER_NAMES: typeof ADMIN_TOWN_LAYER_NAMES;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  selectedradioLayer: string | null;
  setSelectedradioLayer: (layer: string | null) => void; 
  handleLayerSelection: (layer: string) => void;
  rasterLayerInfo: ClipRasters | null;
  setRasterLayerInfo: (layer: null) => void;
  showResultLayer: boolean
  setShowResultLayer: (layer: boolean) => void 

}

// Props for the MapProvider component
interface MapProviderProps {
  children: ReactNode;
  geoServerUrl?: string;
  defaultWorkspace?: string;
}

// Create the map context with default values
const MapContext = createContext<MapContextType>({
  primaryLayer: ADMIN_TOWN_LAYER_NAMES.STATE,
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
  ADMIN_TOWN_LAYER_NAMES,
  loading: false,
  setLoading: () => { },
  selectedradioLayer: "",
  setSelectedradioLayer: () => {},
  handleLayerSelection: () => {},
  rasterLayerInfo: null,
  setRasterLayerInfo: () => { },
  showResultLayer: true,
  setShowResultLayer: () => { }
});

// Create the provider component
export const MapProvider: React.FC<MapProviderProps> = ({
  children,
  geoServerUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
  defaultWorkspace = "vector_work"
}) => {
  // State for layer m
  const [primaryLayer, setPrimaryLayer] = useState<string>(ADMIN_TOWN_LAYER_NAMES.STATE);
  const [secondaryLayer, setSecondaryLayer] = useState<string | null>(null);
  const [LayerFilter, setLayerFilter] = useState<string | null>(null);
  const [LayerFilterValue, setLayerFilterValue] = useState<number[]>([]);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);
  const [stpOperation, setstpOperation] = useState<boolean>(false);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<ClipRasters | null>(null);
  const [selectedradioLayer, setSelectedradioLayer] = useState("");
    const [showResultLayer, setShowResultLayer] = useState(true);
    
  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedTowns,
    setSelectedVillages,
    setDisplayRaster,
    displayRaster,
    resultLayer,
    setResultLayer,
  } = useLocation();
  const { selectedCategory, setShowTable, setTableData} =
    useCategory();

  const resetMapView = (): void => {
    setRasterLayerInfo(null);
    setShowTable(false);
    setTableData([]);
    setResultLayer(null)
    setSelectedVillages([]); 
    resultLayer
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
    let primary: string = ADMIN_TOWN_LAYER_NAMES.INDIA;
    let secondary: string | null = null;
    let filters_type: string | null = null;
    let filters_value: number[] = [];
    if (selectedTowns.length) {
      secondary = ADMIN_TOWN_LAYER_NAMES.SUB_DISTRICT;
      filters_type = '"ID"';
      filters_value = selectedTowns;
    }
    // Logic for determining which layers to show based on selection state
    else if (selectedSubDistricts.length) {
      secondary = ADMIN_TOWN_LAYER_NAMES.SUB_DISTRICT;
      filters_type = 'subdis_cod';
      filters_value = selectedSubDistricts;
    }
    else if (selectedDistricts.length) {
      secondary = ADMIN_TOWN_LAYER_NAMES.DISTRICT;
      filters_type = 'district_c';
      filters_value = selectedDistricts;
    }
    else if (selectedState) {
      secondary = ADMIN_TOWN_LAYER_NAMES.STATE;
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
    selectedTowns.length
  ]);

  useEffect(() => {
    if (!stpOperation) return;

    const performSTP = async () => {
      try {
        const resp = await api.post("/stp_operation/stp_suitability", {
          body: { 
            data: selectedCategory, 
            clip: selectedTowns,
            village_layer:resultLayer},
        });

        if (resp.status != 201) {
          throw new Error(`STP operation failed with status: ${resp.status}`);
        }

        const result = await resp.message as stp_sutability_Output;
        if (result) {
          const append_data = {
            file_name: "STP_Suitability",
            workspace: result.workspace,
            layer_name: result.layer_name,
          };
          setTableData(result.csv_details);
          const index = displayRaster.findIndex(
            (item) => item.file_name === "STP_Suitability"
          );
          let newData;
          if (index !== -1) {
          
            newData = [...displayRaster];
            newData[index] = append_data;
          } else {
            newData = displayRaster.concat(append_data);
          }

          setDisplayRaster(newData);
          handleLayerSelection(append_data.file_name);
          setRasterLayerInfo(append_data);
        }
      } catch (error: any) {
        console.log(`STP operation failed: ${error.message}`);
      } finally {
        setstpOperation(false);
      }
    };

    performSTP();
  }, [rasterLayerInfo, stpOperation]);


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
  ADMIN_TOWN_LAYER_NAMES,
  loading: false,
  setLoading: () => { },
  selectedradioLayer,
  setSelectedradioLayer: () => {},
  handleLayerSelection,
  rasterLayerInfo,
  setRasterLayerInfo,
  showResultLayer,
  setShowResultLayer
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