'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FeatureCollection, Feature } from 'geojson';

// Define props interface
interface MapProps {
  selectedState?: string;
  selectedDistricts?: string[];
  selectedSubDistricts?: string[];
  selectedVillages?: string[];
  subDistrictData?: any[];
  className?: string;
  onLocationSelect?: (locations: {
    state: string;
    districts: string[];
    subDistricts: string[];
    villages: string[];
    allVillages?: any[];
    totalPopulation?: number;
  }) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

// Fullscreen Button Component
function FullscreenControl({ isFullscreen, onToggleFullscreen }: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    const fullscreenControl = L.Control.extend({
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-control-fullscreen');
        const button = L.DomUtil.create('button', 'fullscreen-button', container);
        
        button.innerHTML = isFullscreen ? 
          '⤡' : // Exit fullscreen icon
          '⤢'; // Enter fullscreen icon
          
        button.title = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
        button.style.cssText = `
          background: white;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 4px;
          width: 30px;
          height: 30px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
        `;
        
        button.onmouseover = () => {
          button.style.backgroundColor = '#f4f4f4';
        };
        
        button.onmouseout = () => {
          button.style.backgroundColor = 'white';
        };
        
        L.DomEvent.on(button, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(button, 'click', onToggleFullscreen);
        
        return container;
      }
    });
    
    const control = new fullscreenControl({ position: 'topleft' });
    control.addTo(map);
    
    return () => {
      map.removeControl(control);
    };
  }, [map, isFullscreen, onToggleFullscreen]);
  
  return null;
}

// Create a separate component to handle map updates
function MapLayers({
  selectedState,
  selectedDistricts,
  selectedSubDistricts,
  selectedVillages,
  subDistrictData,
  onLocationSelect,
  onLoadingChange,
  isFullscreen,
  onToggleFullscreen,
}: {
  selectedState?: string;
  selectedDistricts?: string[];
  selectedSubDistricts?: string[];
  selectedVillages?: string[];
  subDistrictData?: any[];
  onLocationSelect?: (locations: {
    state: string;
    districts: string[];
    subDistricts: string[];
    villages: string[];
    allVillages?: any[];
    totalPopulation?: number;
  }) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const map = useMap();

  // Refs for layer objects
  const stateLayerRef = useRef<L.GeoJSON | null>(null);
  const districtLayersRef = useRef<L.GeoJSON | null>(null);
  const subDistrictLayersRef = useRef<L.GeoJSON | null>(null);
  const villageLayersRef = useRef<L.GeoJSON | null>(null);
  const baseMapLayerRef = useRef<L.GeoJSON | null>(null);

  // Loading states
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingSubDistricts, setIsLoadingSubDistricts] = useState(false);
  const [isLoadingVillages, setIsLoadingVillages] = useState(false);

  // Track previous selections
  const prevStateRef = useRef<string | undefined>(undefined);
  const prevDistrictsRef = useRef<string[] | undefined>([]);
  const prevSubDistrictsRef = useRef<string[] | undefined>([]);
  const prevVillagesRef = useRef<string[] | undefined>([]);
  const currentZoomLevelRef = useRef<number | null>(null);

  // Combined loading state
  const isLoading =
    isLoadingBase ||
    isLoadingState ||
    isLoadingDistricts ||
    isLoadingSubDistricts ||
    isLoadingVillages;

  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // Add scale control with both metric and imperial
  useEffect(() => {
    const scale = L.control.scale({
      position: 'bottomleft',
      imperial: true,
      metric: true
    });

    scale.addTo(map);

    return () => {
      map.removeControl(scale);
    };
  }, [map]);

  // Helper function to create WFS URL
  const createWFSUrl = (layerName: string, cqlFilter?: string) => {
    const baseUrl = '/geoserver/api/myworkspace/wfs';
    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: `myworkspace:${layerName}`,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326'
    });

    if (cqlFilter) {
      params.append('CQL_FILTER', cqlFilter);
    }

    return `${baseUrl}?${params.toString()}`;
  };

  // Helper function to zoom to feature bounds
  const zoomToFeatureBounds = async (layerName: string, cqlFilter?: string) => {
    try {
      const url = createWFSUrl(layerName, cqlFilter);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        const geoJsonLayer = L.geoJSON(data);
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      }
    } catch (error) {
      //console.log('Error zooming to feature bounds:', error);
    }
  };

  // GeoJSON styles
  const stateGeoJsonStyle = {
    fillColor: '#3388ff',
    weight: 2,
    opacity: 1,
    color: 'red',
    dashArray: '1',
    fillOpacity: 0,
  };

  const districtGeoJsonStyle = {
    fillColor: '#33ff88',
    weight: 3,
    opacity: 1,
    color: 'green',
    dashArray: '3',
    fillOpacity: 0.3,
  };

  const subDistrictGeoJsonStyle = {
    fillColor: '#ff6b6b',
    weight: 4,
    opacity: 1,
    color: 'blue',
    dashArray: '5',
    fillOpacity: 0.4,
  };

  const villageGeoJsonStyle = {
    fillColor: '#ffff00',
    weight: 1,
    opacity: 1,
    color: 'purple',
    dashArray: '2',
    fillOpacity: 0.5,
  };

  const baseMapGeoJsonStyle = {
    fillColor: '#blue',
    weight: 2,
    opacity: 1,
    color: 'blue',
    fillOpacity: 0,
  };

  // Cleanup functions
  const cleanupDistrictLayers = () => {
    if (districtLayersRef.current) {
      //console.log('FORCE REMOVING district layers');
      try {
        map.removeLayer(districtLayersRef.current);
        districtLayersRef.current = null;
      } catch (error) {
        //console.log('Error removing district layers:', error);
      }
    }
  };

  const cleanupSubDistrictLayers = () => {
    if (subDistrictLayersRef.current) {
     //console.log('FORCE REMOVING sub-district layers');
      try {
        map.removeLayer(subDistrictLayersRef.current);
        subDistrictLayersRef.current = null;
      } catch (error) {
        //console.log('Error removing sub-district layers:', error);
      }
    }
  };

  const cleanupVillageLayers = () => {
    if (villageLayersRef.current) {
     // console.log('FORCE REMOVING village layers');
      try {
        map.removeLayer(villageLayersRef.current);
        villageLayersRef.current = null;
      } catch (error) {
       // console.log('Error removing village layers:', error);
      }
    }
  };

  const cleanupStateLayer = () => {
    if (stateLayerRef.current) {
     // console.log('FORCE REMOVING state layer');
      try {
        map.removeLayer(stateLayerRef.current);
        stateLayerRef.current = null;
      } catch (error) {
        //console.log('Error removing state layer:', error);
      }
    }
  };

  // Update global window object and call onLocationSelect
  const updateLocationData = useCallback(() => {
    const locationData = {
      state: selectedState || '',
      districts: selectedDistricts || [],
      subDistricts: selectedSubDistricts || [],
      villages: selectedVillages || [],
      allVillages: subDistrictData || [],
      totalPopulation: subDistrictData?.reduce(
        (sum, item) => sum + (item.population || 0),
        0
      ),
    };

    if (typeof window !== 'undefined') {
      (window as any).selectedLocations = locationData;
    }

    onLocationSelect?.(locationData);
  }, [
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedVillages,
    subDistrictData,
    onLocationSelect,
  ]);

  // Handle state changes
  useEffect(() => {
    if (selectedState !== prevStateRef.current) {
      // console.log(
      //   '*** STATE CHANGED: Forcing cleanup of district, subdistrict, and village layers ***'
      // );
      cleanupDistrictLayers();
      cleanupSubDistrictLayers();
      cleanupVillageLayers();
      setIsLoadingDistricts(false);
      setIsLoadingSubDistricts(false);
      setIsLoadingVillages(false);
      prevStateRef.current = selectedState;
      updateLocationData();
    }
  }, [selectedState, map, updateLocationData]);

  // Handle district changes
  useEffect(() => {
    const prevDistrictsJSON = JSON.stringify(prevDistrictsRef.current || []);
    const currentDistrictsJSON = JSON.stringify(selectedDistricts || []);
    if (prevDistrictsJSON !== currentDistrictsJSON) {
      // console.log(
      //   '*** DISTRICTS CHANGED: Forcing cleanup of subdistrict and village layers ***'
      // );
      cleanupSubDistrictLayers();
      cleanupVillageLayers();
      setIsLoadingSubDistricts(false);
      setIsLoadingVillages(false);
      prevDistrictsRef.current = selectedDistricts;
      updateLocationData();
    }
  }, [selectedDistricts, map, updateLocationData]);

  // Handle sub-district changes
  useEffect(() => {
    const prevSubDistrictsJSON = JSON.stringify(prevSubDistrictsRef.current || []);
    const currentSubDistrictsJSON = JSON.stringify(selectedSubDistricts || []);
    if (prevSubDistrictsJSON !== currentSubDistrictsJSON) {
      //console.log('*** SUBDISTRICTS CHANGED: Forcing cleanup of village layers ***');
      cleanupVillageLayers();
      setIsLoadingVillages(false);
      prevSubDistrictsRef.current = selectedSubDistricts;
      updateLocationData();
    }
  }, [selectedSubDistricts, map, updateLocationData]);

  // Handle village changes
  useEffect(() => {
    const prevVillagesJSON = JSON.stringify(prevVillagesRef.current || []);
    const currentVillagesJSON = JSON.stringify(selectedVillages || []);
    if (prevVillagesJSON !== currentVillagesJSON) {
      //console.log('*** VILLAGES CHANGED ***');
      cleanupVillageLayers();
      prevVillagesRef.current = selectedVillages;
      updateLocationData();
    }
  }, [selectedVillages, map, updateLocationData]);

  // Fetch base map from GeoServer
  useEffect(() => {
    let isMounted = true;

    const fetchBaseMap = async () => {
      try {
        setIsLoadingBase(true);
        //console.log('Fetching base map for India from GeoServer');

        // GeoServer WFS endpoint for India layer (GeoJSON output)
        const WFS_URL =
          '/geoserver/api/myworkspace/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json';

        const response = await fetch(WFS_URL, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        //console.log('Base map data received from GeoServer');

        if (
          !data ||
          data.type !== 'FeatureCollection' ||
          !Array.isArray(data.features)
        ) {
          throw new Error('Invalid GeoJSON: Expected FeatureCollection');
        }

        const validFeatures = data.features.filter((feature: any) => {
          return (
            feature &&
            feature.type === 'Feature' &&
            feature.geometry &&
            feature.geometry.coordinates &&
            feature.geometry.coordinates.length > 0
          );
        });

        if (validFeatures.length === 0) {
          throw new Error('No valid features found in GeoJSON');
        }

        const newBaseLayer = L.geoJSON(
          { type: 'FeatureCollection', features: validFeatures } as GeoJSON.FeatureCollection,
          {
            style: baseMapGeoJsonStyle,
            onEachFeature: (feature, layer) => {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
              }
            },
          }
        );

        map.whenReady(() => {
          if (isMounted) {
            if (baseMapLayerRef.current) {
              map.removeLayer(baseMapLayerRef.current);
            }
            newBaseLayer.addTo(map);
            baseMapLayerRef.current = newBaseLayer;
            try {
              const bounds = newBaseLayer.getBounds();
              if (bounds.isValid()) {
                map.fitBounds(bounds);
                currentZoomLevelRef.current = map.getZoom(); // Store initial zoom
              } else {
                //console.warn('Invalid bounds for base map layer');
              }
            } catch (error) {
              //console.log('Error fitting map to bounds:', error);
            }
            setIsLoadingBase(false);
          }
        });
      } catch (error) {
        //console.log('Error fetching or rendering base map:', error);
        if (isMounted) {
          setIsLoadingBase(false);
        }
      }
    };

    fetchBaseMap();

    return () => {
      isMounted = false;
      if (baseMapLayerRef.current) {
        map.removeLayer(baseMapLayerRef.current);
        baseMapLayerRef.current = null;
      }
    };
  }, [map]);

  // Fetch state data from GeoServer
  useEffect(() => {
    if (!selectedState) {
      cleanupStateLayer();
      setIsLoadingState(false);
      return;
    }

    if (isLoadingDistricts || isLoadingSubDistricts || isLoadingVillages) {
      return;
    }

    setIsLoadingState(true);
    const fetchStateData = async () => {
      try {
        //console.log('Fetching state data for:', selectedState);
        
        const formattedStateCode = selectedState.toString().padStart(2, "0");
        const cqlFilter = `state_code = '${formattedStateCode}'`;
        const url = createWFSUrl('B_State', cqlFilter);
        
        const response = await fetch(url);

        if (!response.ok) {
          alert(
            'Due to unavailability of the JSON data, the map will not be displayed for the selected state. Please select another state.'
          );
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        //console.log('State data received from GeoServer');

        if (
          !data ||
          !data.type ||
          data.type !== 'FeatureCollection' ||
          !Array.isArray(data.features)
        ) {
          throw new Error('Invalid GeoJSON: Expected a FeatureCollection with features');
        }

        const validFeatures = data.features.filter((feature: any) => {
          return (
            feature &&
            feature.type === 'Feature' &&
            feature.geometry &&
            feature.geometry.coordinates &&
            feature.geometry.coordinates.length > 0
          );
        });

        if (validFeatures.length === 0) {
          throw new Error('No valid features found in state GeoJSON');
        }

        const newStateLayer = L.geoJSON(
          { type: 'FeatureCollection', features: validFeatures } as GeoJSON.FeatureCollection,
          {
            style: stateGeoJsonStyle,
            onEachFeature: (feature, layer) => {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
              }
            },
          }
        );

        map.whenReady(() => {
          if (!selectedDistricts || selectedDistricts.length === 0) {
            cleanupStateLayer();
            newStateLayer.addTo(map);
            stateLayerRef.current = newStateLayer;
            try {
              const bounds = newStateLayer.getBounds();
              if (bounds.isValid()) {
                map.fitBounds(bounds);
                currentZoomLevelRef.current = map.getZoom();
              } else {
                //console.warn('Invalid bounds for state layer');
              }
            } catch (error) {
              //console.log('Error fitting map to state layer bounds:', error);
            }
          }
          setIsLoadingState(false);
        });
      } catch (error) {
        //console.log('Error fetching or rendering state data:', error);
        setIsLoadingState(false);
      }
    };

    fetchStateData();
  }, [selectedState, map, isLoadingDistricts, isLoadingSubDistricts, isLoadingVillages, selectedDistricts]);

  // Fetch district data from GeoServer
  useEffect(() => {
    if (!selectedDistricts || selectedDistricts.length === 0 || !selectedState) {
      cleanupDistrictLayers();
      setIsLoadingDistricts(false);
      return;
    }

    // Remove state layer when districts are selected
    if (stateLayerRef.current) {
      map.removeLayer(stateLayerRef.current);
      stateLayerRef.current = null;
    }

    setIsLoadingDistricts(true);
    const fetchDistrictData = async () => {
      try {
        const districtCodes = selectedDistricts.map((code) => `'${code}'`).join(",");
        const cqlFilter = `DISTRICT_C IN (${districtCodes})`;
        const url = createWFSUrl('B_district', cqlFilter);

        //console.log('Fetching district data with filter:', cqlFilter);
        const response = await fetch(url);

        if (!response.ok) {
          alert('We have data only for Uttar Pradesh.');
          //console.log('Failed to fetch district data:', response.status);
          setIsLoadingDistricts(false);
          return;
        }

        const data = await response.json();
        //console.log('District data received from GeoServer');

        if (
          !data ||
          !data.type ||
          data.type !== 'FeatureCollection' ||
          !Array.isArray(data.features)
        ) {
          throw new Error('Invalid GeoJSON: Expected a FeatureCollection with features');
        }

        const validFeatures = data.features.filter((feature: any) => {
          return (
            feature &&
            feature.type === 'Feature' &&
            feature.geometry &&
            feature.geometry.coordinates &&
            feature.geometry.coordinates.length > 0
          );
        });

        if (validFeatures.length === 0) {
          throw new Error('No valid features found in district GeoJSON');
        }

        const newDistrictLayers = L.geoJSON(
          { type: 'FeatureCollection', features: validFeatures } as GeoJSON.FeatureCollection,
          {
            style: districtGeoJsonStyle,
            onEachFeature: (feature, layer) => {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
              }
            },
          }
        );

        map.whenReady(() => {
          cleanupDistrictLayers();
          newDistrictLayers.addTo(map);
          districtLayersRef.current = newDistrictLayers;
          try {
            const bounds = newDistrictLayers.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [100, 100] });
              currentZoomLevelRef.current = map.getZoom();
            }
          } catch (error) {
            //console.log('Error fitting map to district layer bounds:', error);
          }
          setIsLoadingDistricts(false);
        });
      } catch (error) {
        //console.log('Error fetching or rendering district data:', error);
        setIsLoadingDistricts(false);
      }
    };

    fetchDistrictData();
    return () => {
      cleanupDistrictLayers();
    };
  }, [selectedDistricts, selectedState, map]);

  // Fetch sub-district data from GeoServer
  useEffect(() => {
    if (!selectedSubDistricts || selectedSubDistricts.length === 0) {
      cleanupSubDistrictLayers();
      setIsLoadingSubDistricts(false);
      return;
    }

    // Remove district layer when subdistricts are selected
    if (districtLayersRef.current) {
      map.removeLayer(districtLayersRef.current);
      districtLayersRef.current = null;
    }

    setIsLoadingSubDistricts(true);
    const fetchSubDistrictData = async () => {
      try {
        const subdistrictCodes = selectedSubDistricts.map((code) => `'${code}'`).join(",");
        const cqlFilter = `SUBDIS_COD IN (${subdistrictCodes})`;
        const url = createWFSUrl('B_subdistrict', cqlFilter);

        //console.log('Fetching subdistrict data with filter:', cqlFilter);
        const response = await fetch(url);

        if (!response.ok) {
          //console.log('Failed to fetch subdistrict data:', response.status);
          setIsLoadingSubDistricts(false);
          return;
        }

        const data = await response.json();
        //console.log('SubDistrict data received from GeoServer');

        if (!data || !data.features || data.features.length === 0) {
          //console.warn('No valid subdistrict data received');
          setIsLoadingSubDistricts(false);
          return;
        }

        const newSubDistrictLayers = L.geoJSON(data, {
          style: subDistrictGeoJsonStyle,
          onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(feature.properties.name);
            }
          },
        });

        map.whenReady(() => {
          cleanupSubDistrictLayers();
          newSubDistrictLayers.addTo(map);
          subDistrictLayersRef.current = newSubDistrictLayers;
          try {
            const bounds = newSubDistrictLayers.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [30, 30] });
              currentZoomLevelRef.current = map.getZoom();
            }
          } catch (error) {
            //console.log('Error fitting map to sub-district layer bounds:', error);
          }
          setIsLoadingSubDistricts(false);
        });
      } catch (error) {
        //console.log('Error fetching or rendering sub-district data:', error);
        setIsLoadingSubDistricts(false);
      }
    };

    fetchSubDistrictData();
    return () => {
      cleanupSubDistrictLayers();
    };
  }, [selectedSubDistricts, map]);

  // Fetch village data from GeoServer
  useEffect(() => {
    if (!selectedVillages || selectedVillages.length === 0) {
      cleanupVillageLayers();
      setIsLoadingVillages(false);
      return;
    }

    setIsLoadingVillages(true);
    const fetchVillageData = async () => {
      try {
        const villageCodes = selectedVillages.map((code) => `'${code}'`).join(",");
        const cqlFilter = `vlcode IN (${villageCodes})`;
        const url = createWFSUrl('Village', cqlFilter);

        //console.log('Fetching village data with filter:', cqlFilter);
        const response = await fetch(url);

        if (!response.ok) {
          //console.log('Failed to fetch village data:', response.status);
          setIsLoadingVillages(false);
          return;
        }

        const data = await response.json();
        //console.log('Village data received from GeoServer');

        if (!data || !data.features || data.features.length === 0) {
          //console.warn('No valid village data received');
          setIsLoadingVillages(false);
          return;
        }

        const hasGetBounds = (layer: L.Layer): layer is L.Layer & { getBounds(): L.LatLngBounds } => {
          return 'getBounds' in layer && typeof (layer as any).getBounds === 'function';
        };

        // Village Layers with hover popup and click functionality
        const newVillageLayers = L.geoJSON(data, {
          style: villageGeoJsonStyle,
          onEachFeature: (feature, layer) => {
            if (feature.properties) {
              const {
                shapeName,
                name,
                DISTRICT,
                SUB_DISTRI,
                population,
                Area,
                STATE,
              } = feature.properties;
              const villageName = shapeName || name || 'Unknown Village';
              const popupContent = `
                <div>
                  <strong>State:</strong> ${STATE || 'N/A'}<br/>
                  <strong>District:</strong> ${DISTRICT || 'N/A'}<br/>
                  <strong>Sub-District:</strong> ${SUB_DISTRI || 'N/A'}<br/>
                  <strong>Village:</strong> ${villageName}<br/>
                  <strong>Population:</strong> ${population || 'N/A'}<br/>
                  <strong>Area:</strong> ${Area || 'N/A'} km²
                </div>
              `;
              layer.bindPopup(popupContent);

              // Replace click with hover events for popup
              layer.on('mouseover', () => {
                layer.openPopup();
              });
              layer.on('mouseout', () => {
                layer.closePopup();
              });

              // Keep click event for zooming and data selection
              layer.on('click', () => {
                if (hasGetBounds(layer)) {
                  const bounds = layer.getBounds();
                  if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
                    currentZoomLevelRef.current = map.getZoom();
                  }
                }
                // Update location data with clicked village details
                const updatedLocationData = {
                  state: selectedState || '',
                  districts: selectedDistricts || [],
                  subDistricts: selectedSubDistricts || [],
                  villages: [feature.properties.shape_id || ''],
                  allVillages: subDistrictData || [],
                  totalPopulation: population || 0,
                };
                onLocationSelect?.(updatedLocationData);
                if (typeof window !== 'undefined') {
                  (window as any).selectedLocations = updatedLocationData;
                }
              });
            }
          },
        });

        map.whenReady(() => {
          cleanupVillageLayers();
          newVillageLayers.addTo(map);
          villageLayersRef.current = newVillageLayers;
          try {
            const bounds = newVillageLayers.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
              currentZoomLevelRef.current = map.getZoom();
            }
          } catch (error) {
            //console.log('Error fitting map to village layer bounds:', error);
          }
          setIsLoadingVillages(false);
        });
      } catch (error) {
        //console.log('Error fetching or rendering village data:', error);
        setIsLoadingVillages(false);
      }
    };

    fetchVillageData();
    return () => {
      cleanupVillageLayers();
    };
  }, [selectedVillages, selectedState, selectedDistricts, selectedSubDistricts, subDistrictData, map, onLocationSelect]);

  // Prevent auto-zoom out by maintaining the current zoom level
  useEffect(() => {
    const handleZoomEnd = () => {
      currentZoomLevelRef.current = map.getZoom();
    };

    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  return (
    <>
      <FullscreenControl 
        isFullscreen={isFullscreen} 
        onToggleFullscreen={onToggleFullscreen} 
      />
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000]">
          <div className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
            <svg
              className="animate-spin h-5 w-5 mr-2 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading Map...
          </div>
        </div>
      )}
    </>
  );
}

export default function Map({
  selectedState,
  selectedDistricts,
  selectedSubDistricts,
  selectedVillages,
  subDistrictData,
  className,
  onLocationSelect,
  onLoadingChange,
}: MapProps) {
  // console.log('Map component rendering with selectedState:', selectedState);
  // console.log('Map component rendering with selectedDistricts:', selectedDistricts);
  // console.log('Map component rendering with selectedSubDistricts:', selectedSubDistricts);
  // console.log('Map component rendering with selectedVillages:', selectedVillages);

  // State to track if component is mounted (client-side)
  const [isMounted, setIsMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fix Leaflet icon issues
  useEffect(() => {
    setIsMounted(true);

    if (typeof window !== 'undefined' && L && L.Icon) {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
    }
  }, []);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      const mapElement = document.querySelector('.map-container');
      if (mapElement?.requestFullscreen) {
        mapElement.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch((err) => {
          console.log('Error entering fullscreen:', err);
        });
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        }).catch((err) => {
          console.log('Error exiting fullscreen:', err);
        });
      }
    }
  }, []);

  // Listen for fullscreen changes (e.g., when user presses ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Don't render map until component is mounted (client-side)
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center h-[48vh] border-4 border-blue-500 rounded-xl shadow-lg p-4">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  function setMapError(arg0: string | null) {
    console.log('Map error:', arg0);
  }

  return (
    <div 
      className={`map-container ${className || ''} ${isFullscreen ? 'fixed inset-0 z-[9999] bg-white' : 'h-full'}`} 
      style={{ background: 'rgb(255, 255, 255)' }}
    >
      <MapContainer
        center={[22.9734, 78.6569]}
        zoom={5}
        className={`admin-map z-[100] border-4 border-blue-500 rounded-xl shadow-lg hover:border-green-500 hover:shadow-2xl transition-all duration-300 w-full ${isFullscreen ? 'h-screen rounded-none border-0' : 'h-full'}`}
        worldCopyJump={true}
        maxBoundsViscosity={1.0}
        minZoom={2}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        style={{ background: 'rgb(255, 255, 255)' }}
        whenReady={() => {
          //console.log('Map container is ready');
        }}
      >
        {/* Legend moved inside map as overlay */}
        <div className={`absolute ${isFullscreen ? 'top-4 left-16' : 'top-2 left-12'} z-[1000] bg-white bg-opacity-90 p-2 rounded-lg shadow-lg border border-gray-300`}>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 inline-block" style={{ backgroundColor: 'rgb(0, 0, 255)' }}></span>
              <span>India</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 inline-block" style={{ backgroundColor: 'rgb(255, 0, 0)' }}></span>
              <span>State</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 inline-block" style={{ backgroundColor: 'rgb(0, 128, 0)' }}></span>
              <span>District</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 inline-block" style={{ backgroundColor: 'rgb(0, 0, 255)' }}></span>
              <span>Sub-District</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 inline-block" style={{ backgroundColor: 'rgb(255, 255, 0)' }}></span>
              <span>Village</span>
            </div>
          </div>
        </div>

        <LayersControl position="topright">
          {/* Base Layers */}
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="CartoDB Light">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="CartoDB Dark">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapLayers
          selectedState={selectedState}
          selectedDistricts={selectedDistricts}
          selectedSubDistricts={selectedSubDistricts}
          selectedVillages={selectedVillages}
          subDistrictData={subDistrictData}
          onLocationSelect={onLocationSelect}
          onLoadingChange={onLoadingChange}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </MapContainer>

      {/* Fullscreen exit hint */}
      {isFullscreen && (
        <div className="absolute top-4 right-18 z-[1001] bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm">
          Press <kbd className="bg-white text-black px-1 rounded">ESC</kbd> or click the fullscreen button to exit
        </div>
      )}
    </div>
  );
}