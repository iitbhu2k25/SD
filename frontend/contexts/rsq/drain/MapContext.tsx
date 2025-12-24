"use client";
import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import Overlay from 'ol/Overlay';
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Stroke, Style, Text } from "ol/style";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import { Feature } from 'ol';
import { Geometry, SimpleGeometry } from 'ol/geom';
import { useLocation } from "@/contexts/rsq/drain/LocationContext";
import { useRSQ } from "./RsqContext";
import CircleStyle from "ol/style/Circle";

// GeoServer configuration
const GEOSERVER_BASE_URL = "/geoserver/api/myworkspace/wfs";

// Base maps configuration
interface BaseMapDefinition {
  name: string;
  source: () => OSM | XYZ;
  icon: string;
}

const baseMaps: Record<string, BaseMapDefinition> = {
  osm: {
    name: "OpenStreetMap",
    source: () => new OSM({ crossOrigin: "anonymous" }),
    icon: "M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146",
  },
  terrain: {
    name: "Stamen Terrain",
    source: () =>
      new XYZ({
        url: "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
        maxZoom: 19,
        attributions:
          'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
        crossOrigin: "anonymous",
      }),
    icon: "M14 11l4-8H6l4 8H6l6 10 6-10h-4z",
  },
  cartoLight: {
    name: "Carto Light",
    source: () =>
      new XYZ({
        url: "https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
        crossOrigin: "anonymous",
      }),
    icon:
      "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  },
  satellite: {
    name: "Satellite",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions:
          'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">ArcGIS</a>',
        crossOrigin: "anonymous",
      }),
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  topo: {
    name: "Topographic",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions:
          'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer">ArcGIS</a>',
        crossOrigin: "anonymous",
      }),
    icon: "M7 14l5-5 5 5",
  },
};

interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  setMapContainer: (container: HTMLDivElement | null) => void;
  changeBaseMap: (baseMapKey: string) => void;
  zoomToCurrentExtent: () => void;
  getAllLayers: () => any[];
  showLabels: boolean;
  toggleLabels: () => void;
}

interface MapProviderProps {
  children: ReactNode;
}

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  selectedBaseMap: "osm",
  setMapContainer: () => { },
  changeBaseMap: () => { },
  zoomToCurrentExtent: () => { },
  getAllLayers: () => [],
  showLabels: false,
  toggleLabels: () => { },
});

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);

  // Layer refs for drainage system
  const basinBoundaryLayerRef = useRef<VectorLayer<any> | null>(null);
  const riversLayerRef = useRef<VectorLayer<any> | null>(null);
  const stretchesLayerRef = useRef<VectorLayer<any> | null>(null);
  const drainsLayerRef = useRef<VectorLayer<any> | null>(null);
  const catchmentsLayerRef = useRef<VectorLayer<any> | null>(null);
  const villagesLayerRef = useRef<VectorLayer<any> | null>(null);
  const groundwaterLayerRef = useRef<VectorLayer<any> | null>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const highlightLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const [showLabels, setShowLabels] = useState(false);

  const { groundWaterData } = useRSQ();

  // Get location context data
  const {
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedVillages,
  } = useLocation();

  // Styles for drainage system layers
  const basinBoundaryStyle = new Style({
    stroke: new Stroke({
      color: "#6f11119d",
      width: 3,
    }),
    fill: new Fill({
      color: "rgba(0, 0, 0, 0)",
    }),
  });

  const riverStyle = new Style({
    stroke: new Stroke({
      color: "#1E40AF",
      width: 3,
    }),
  });

  const stretchStyle = new Style({
    stroke: new Stroke({
      color: "#7C3AED",
      width: 2,
    }),
  });

  const selectedStretchStyle = new Style({
    stroke: new Stroke({
      color: "#EF4444",
      width: 4,
    }),
  });

  // Update your drain styles in RSQ MapContext (around line 90-120)

const drainStyle = new Style({
  stroke: new Stroke({
    color: "#059669", // Green
    width: 2,
  }),
});

const selectedDrainStyle = new Style({
  stroke: new Stroke({
    color: '#FF6B35', // Orange for selected drain
    width: 4,
  }),
});

// ADD THIS: Point-based drain style (in case drains are points)
const drainPointStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({
      color: '#059669',
    }),
    stroke: new Stroke({
      color: '#FFFFFF',
      width: 2,
    }),
  }),
});

const selectedDrainPointStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({
      color: '#FF6B35',
    }),
    stroke: new Stroke({
      color: '#FFFFFF',
      width: 2,
    }),
  }),
});

  const catchmentStyle = new Style({
    stroke: new Stroke({
      color: "#DC2626",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(220, 38, 38, 0.1)",
    }),
  });

  const villageStyle = new Style({
    stroke: new Stroke({
      color: "#F59E0B",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(245, 158, 11, 0.1)",
    }),
  });

  const selectedVillageStyle = new Style({
    stroke: new Stroke({
      color: "#F59E0B",
      width: 2,
    }),
    fill: new Fill({
      color: "rgba(245, 158, 11, 0.4)",
    }),
  });

  const removeGroundwaterLayer = () => {
    if (groundwaterLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(groundwaterLayerRef.current);
      groundwaterLayerRef.current = null;
    }
  };

  // Hide layer without removing from map
  const hideLayer = (ref: React.MutableRefObject<VectorLayer<any> | null>) => {
    if (ref.current) {
      ref.current.setVisible(false);
    }
  };

  // Helper function to create text style for labels
  const createLabelStyle = (text: string, offsetY: number = 0) => {
    return new Style({
      text: new Text({
        text: text,
        font: '12px Calibri,sans-serif',
        fill: new Fill({
          color: '#000000'
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 3
        }),
        offsetY: offsetY,
        textAlign: 'center',
        textBaseline: 'middle'
      })
    });
  };

  // Helper function to create combined geometry + label style
  const createCombinedStyle = (baseStyle: Style, labelText: string, offsetY: number = 0) => {
    return [
      baseStyle,
      createLabelStyle(labelText, offsetY)
    ];
  };

  // Configuration object for label visibility rules
  const STRETCH_LABEL_CONFIG = {
    zoomLevels: [
      {
        minZoom: 0,
        maxZoom: 9,
        strategy: 'all',
        description: 'Overview level - show all stretches'
      },
      {
        minZoom: 9,
        maxZoom: 11,
        strategy: 'selective',
        interval: 3,
        description: 'Regional level - show major stretches'
      },
      {
        minZoom: 11,
        maxZoom: 13,
        strategy: 'selective',
        interval: 2,
        description: 'Local level - show more stretches'
      },
      {
        minZoom: 13,
        maxZoom: 20,
        strategy: 'all',
        description: 'Detail level - show all stretches'
      }
    ],
    enableProgressiveLabeling: true,
    fallbackShowAll: true
  };

  // Helper function to determine if a stretch label should be shown
  const shouldShowStretchLabel = (stretchId: number, currentZoom: number, showLabelsToggle: boolean) => {
    if (!showLabelsToggle) return false;

    if (!STRETCH_LABEL_CONFIG.enableProgressiveLabeling) {
      return STRETCH_LABEL_CONFIG.fallbackShowAll;
    }

    const zoomConfig = STRETCH_LABEL_CONFIG.zoomLevels.find(
      level => currentZoom >= level.minZoom && currentZoom < level.maxZoom
    );

    if (!zoomConfig) return false;

    switch (zoomConfig.strategy) {
      case 'all':
        return true;
      case 'selective':
        return stretchId % (zoomConfig?.interval ?? 1) === 1;
      case 'none':
        return false;
      default:
        return false;
    }
  };

  // Helper function to create stretch label style with line placement
  const createStretchLabelStyle = (text: string) => {
    return new Style({
      text: new Text({
        text: text,
        font: '11px Arial, sans-serif',
        fill: new Fill({
          color: '#1F2937'
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 3
        }),
        placement: 'line',
        textAlign: 'center',
        textBaseline: 'middle',
        maxAngle: Math.PI / 4,
        overflow: false
      })
    });
  };

  // Helper function to remove layer by ref with protection for permanent layers
  const removeLayerByRef = (layerRef: React.MutableRefObject<VectorLayer<any> | null>, layerName: string) => {
    if (layerRef.current && mapInstanceRef.current) {
      if (layerRef.current.get('permanent')) {
        console.log(`Cannot remove permanent layer: ${layerName}`);
        return;
      }

      console.log(`Removing ${layerName} layer`);
      mapInstanceRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  };

  // Initialize map when container is set
  useEffect(() => {
    if (!mapContainer || mapInstanceRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.osm.source(),
      zIndex: 0,
    });

    initialBaseLayer.set('name', 'basemap');
    baseLayerRef.current = initialBaseLayer;

    const map = new Map({
      target: mapContainer,
      layers: [initialBaseLayer],
      view: new View({
        center: fromLonLat([82.378970, 25.539697]),
        zoom: 9.7
      }),
    });

    mapInstanceRef.current = map;
    console.log("Map initialized");

    // ============ ADD ALL PERMANENT LAYERS HERE ============

    // 1. BASIN BOUNDARY LAYER
    console.log("Adding permanent basin boundary layer from GeoServer");
    const basinBoundaryLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:basin_boundary&outputFormat=application/json&CQL_FILTER=1=1`,
      }),
      style: basinBoundaryStyle,
      zIndex: 1,
      visible: true,
    });

    basinBoundaryLayer.set('name', 'basin-boundary');
    basinBoundaryLayer.set('type', 'drainage');
    basinBoundaryLayer.set('permanent', true);

    const basinSource = basinBoundaryLayer.getSource();
    basinSource?.on("featuresloaderror", (event) => {
      console.log("Error loading basin boundary layer:", event);
    });
    basinSource?.on("featuresloadstart", () => {
      console.log("Started loading basin boundary layer");
    });
    basinSource?.on("featuresloadend", () => {
      console.log("Successfully loaded basin boundary layer");
      const features = basinSource.getFeatures();
      console.log(`Loaded ${features.length} basin boundary features`);
    });

    basinBoundaryLayerRef.current = basinBoundaryLayer;
    map.addLayer(basinBoundaryLayer);

    // 2. RIVERS LAYER
    console.log("Adding permanent rivers layer from GeoServer");
    const riversLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Rivers&outputFormat=application/json&CQL_FILTER=1=1`,
      }),
      style: riverStyle,
      zIndex: 10,
      visible: true,
    });

    riversLayer.set('name', 'rivers');
    riversLayer.set('type', 'drainage');
    riversLayer.set('permanent', true);

    const riversSource = riversLayer.getSource();
    riversSource?.on("featuresloaderror", (event) => {
      console.log("Error loading rivers layer:", event);
    });
    riversSource?.on("featuresloadstart", () => {
      console.log("Started loading rivers layer");
    });
    riversSource?.on("featuresloadend", () => {
      console.log("Successfully loaded rivers layer");
      const features = riversSource.getFeatures();
      console.log(`Loaded ${features.length} river features`);
    });

    riversLayerRef.current = riversLayer;
    map.addLayer(riversLayer);

    // 3. STRETCHES LAYER
    console.log("Adding permanent stretches layer from GeoServer");
    const stretchesLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Stretches&outputFormat=application/json&CQL_FILTER=1=1`,
      }),
      style: (feature) => {
        const stretchId = feature.get('Stretch_ID');
        const baseStyle = stretchId === selectedStretch ? selectedStretchStyle : stretchStyle;

        const currentZoom = map.getView().getZoom() || 0;
        const shouldShow = shouldShowStretchLabel(stretchId, currentZoom, showLabels);

        if (shouldShow) {
          return [
            baseStyle,
            createStretchLabelStyle(`S-${stretchId}`)
          ];
        }

        return baseStyle;
      },
      zIndex: 11,
      visible: true,
    });

    stretchesLayer.set('name', 'stretches');
    stretchesLayer.set('type', 'drainage');
    stretchesLayer.set('permanent', true);

    const stretchesSource = stretchesLayer.getSource();
    stretchesSource?.on("featuresloaderror", (event) => {
      console.log("Error loading stretches layer:", event);
    });
    stretchesSource?.on("featuresloadstart", () => {
      console.log("Started loading stretches layer");
    });
    stretchesSource?.on("featuresloadend", () => {
      console.log("Successfully loaded stretches layer");
      const features = stretchesSource.getFeatures();
      console.log(`Loaded ${features.length} stretch features`);
    });

    const view = map.getView();
    const stretchZoomChangeHandler = () => {
      const currentZoom = view.getZoom() || 0;
      console.log(`Zoom changed to: ${currentZoom.toFixed(1)} - Refreshing stretch labels`);
      stretchesLayer.changed();
    };
    view.on('change:resolution', stretchZoomChangeHandler);
    stretchesLayer.set('zoomChangeHandler', stretchZoomChangeHandler);

    stretchesLayerRef.current = stretchesLayer;
    map.addLayer(stretchesLayer);

    // 4. DRAINS LAYER
    // 4. DRAINS LAYER (Show ALL drains)
console.log("Adding permanent drains layer from GeoServer");
const drainsLayer = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Drain&outputFormat=application/json&CQL_FILTER=1=1`,
  }),
  style: (feature) => {
    const drainNo = feature.get('Drain_No');
    const geometry = feature.getGeometry();
    const geometryType = geometry?.getType();
    
    // Check if geometry is a point or line
    const isPoint = geometryType === 'Point' || geometryType === 'MultiPoint';
    
    if (drainNo === selectedDrain) {
      return isPoint ? selectedDrainPointStyle : selectedDrainStyle;
    } else {
      return isPoint ? drainPointStyle : drainStyle;
    }
  },
  zIndex: 12,
  visible: true,
});
    drainsLayer.set('name', 'drains');
    drainsLayer.set('type', 'drainage');
    drainsLayer.set('permanent', true);

    const drainsSource = drainsLayer.getSource();
    drainsSource?.on("featuresloaderror", (event) => {
      console.log("Error loading drains layer:", event);
    });
    drainsSource?.on("featuresloadstart", () => {
      console.log("Started loading drains layer");
    });
    drainsSource?.on("featuresloadend", () => {
      console.log("Successfully loaded drains layer");
      const features = drainsSource.getFeatures();
      console.log(`Loaded ${features.length} drain features`);
    });

    drainsLayerRef.current = drainsLayer;
    map.addLayer(drainsLayer);

    // ============ END OF PERMANENT LAYERS ============

    // Create fixed info panel for RSQ/groundwater layer
    const infoPanel = document.createElement("div");
    infoPanel.className = "ol-info-panel";
    infoPanel.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #333;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 12px;
      max-width: 320px;
      min-width: 250px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      display: none;
      z-index: 1000;
    `;
    mapContainer.appendChild(infoPanel);

    // Auto-zoom to basin boundary extent after all layers are loaded
    basinSource?.on("featuresloadend", () => {
      setTimeout(() => {
        const extent = basinBoundaryLayer.getSource()?.getExtent();
        if (extent && map) {
          map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }, 500);
    });

    return () => {
      if (stretchZoomChangeHandler) {
        view.un('change:resolution', stretchZoomChangeHandler);
      }
      if (infoPanel.parentNode) {
        infoPanel.parentNode.removeChild(infoPanel);
      }
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, [mapContainer]);

  // Add hover functionality
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const hoverElement = document.createElement('div');
    hoverElement.className = 'ol-hover-popup';
    hoverElement.style.cssText = `
      background: rgba(255, 255, 255, 1);
      border: 2px solid #3B82F6;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 600;
      color: #1F2937;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      pointer-events: none;
      white-space: nowrap;
      max-width: 300px;
      z-index: 1000;
    `;

    const hoverOverlay = new Overlay({
      element: hoverElement,
      positioning: 'bottom-center',
      stopEvent: false,
      offset: [0, -10],
    });

    mapInstanceRef.current.addOverlay(hoverOverlay);
    hoverOverlayRef.current = hoverOverlay;

    const highlightStyle = new Style({
      fill: new Fill({
        color: 'rgba(59, 130, 246, 0.2)',
      }),
      stroke: new Stroke({
        color: '#fffb00ff',
        width: 3,
      }),
    });

    const highlightLayer = new VectorLayer({
      source: new VectorSource(),
      style: highlightStyle,
      zIndex: 999,
    });

    highlightLayer.set('name', 'highlight-layer');
    mapInstanceRef.current.addLayer(highlightLayer);
    highlightLayerRef.current = highlightLayer;

    const infoPanel = mapInstanceRef.current.getTargetElement()?.querySelector('.ol-info-panel') as HTMLElement;

    const handlePointerMove = (event: any) => {
      if (!mapInstanceRef.current || !highlightLayerRef.current) return;

      const pixel = event.pixel;
      let foundFeature = false;
      const highlightSource = highlightLayerRef.current.getSource();

      if (highlightSource) {
        highlightSource.clear();
      }

      mapInstanceRef.current.forEachFeatureAtPixel(
        pixel,
        (feature, layer) => {
          const layerName = layer?.get('name');

          if (layerName === 'highlight-layer') {
            return false;
          }

          const properties = feature.getProperties();
          let label = '';

          switch (layerName) {
            case 'groundwater-layer':
              const excludedProps = ['geometry', 'vlcode', 'blockcode', 'color', 'SUBDIS_COD', 'srno'];
              let displayText = "<div style='border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px;'><strong style='font-size: 14px;'>Groundwater Data</strong></div>";
              
              Object.keys(properties).forEach(key => {
                if (!excludedProps.includes(key)) {
                  const value = properties[key];
                  const formattedKey = key.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ');
                  
                  displayText += `
                    <div style='margin-bottom: 6px; display: flex; justify-content: space-between; gap: 10px;'>
                      <span style='color: #555; font-weight: 600;'>${formattedKey}:</span>
                      <span style='color: #000; font-weight: 500; text-align: right;'>${value !== null && value !== undefined ? value : '-'}</span>
                    </div>
                  `;
                }
              });

              if (highlightSource && feature instanceof Feature) {
                const clonedFeature = feature.clone() as Feature<Geometry>;
                highlightSource.addFeature(clonedFeature);
              }
              
              if (infoPanel) {
                infoPanel.innerHTML = displayText;
                infoPanel.style.display = 'block';
              }
              if (hoverOverlay) hoverOverlay.setPosition(undefined);
              foundFeature = true;
              
              const target = mapInstanceRef.current?.getTargetElement();
              if (target) {
                target.style.cursor = "pointer";
              }
              return true;

            case 'rivers':
              label = properties.River_Name || properties.river_name || 'River';
              break;

            case 'stretches':
              const stretchId = properties.Stretch_ID || properties.stretch_id;
              label = stretchId ? `Stretch S-${stretchId}` : 'Stretch';
              break;

            case 'drains':
              const drainNo = properties.Drain_No || properties.drain_no;
              label = drainNo ? `Drain ${drainNo}` : 'Drain';
              break;

            case 'catchments':
              const catchmentDrain = properties.Drain_No || properties.drain_no;
              label = catchmentDrain ? `Catchment (Drain ${catchmentDrain})` : 'Catchment';
              break;

            case 'villages':
              label = properties.shapeName || properties.village || properties.Village || properties.VILLAGE || 'Village';
              break;

            default:
              label = properties.name || properties.NAME || properties.River_Name || properties.shapeName;
          }

          if (label && hoverOverlay) {
            if (highlightSource && feature instanceof Feature) {
              const clonedFeature = feature.clone() as Feature<Geometry>;
              clonedFeature.setId(feature.getId());
              highlightSource.addFeature(clonedFeature);
            }

            hoverElement.textContent = label;
            hoverOverlay.setPosition(event.coordinate);
            if (infoPanel) infoPanel.style.display = 'none';
            foundFeature = true;

            const target = mapInstanceRef.current?.getTargetElement();
            if (target) {
              target.style.cursor = "pointer";
            }

            return true;
          }
          return false;
        },
        {
          layerFilter: (layer) => {
            const layerName = layer.get('name');
            return layerName !== 'highlight-layer';
          },
          hitTolerance: 5
        }
      );

      if (!foundFeature) {
        if (hoverOverlay) {
          hoverOverlay.setPosition(undefined);
        }
        if (infoPanel) {
          infoPanel.style.display = 'none';
        }
        if (highlightSource) {
          highlightSource.clear();
        }

        const target = mapInstanceRef.current?.getTargetElement();
        if (target) {
          target.style.cursor = '';
        }
      }
    };

    mapInstanceRef.current.on('pointermove', handlePointerMove);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.un('pointermove', handlePointerMove);

        if (highlightLayerRef.current) {
          mapInstanceRef.current.removeLayer(highlightLayerRef.current);
          highlightLayerRef.current = null;
        }
      }
    };
  }, [mapInstanceRef.current]);

  // Effect to UPDATE stretches styling when river/stretch is selected
  useEffect(() => {
    if (!mapInstanceRef.current || !stretchesLayerRef.current) return;

    console.log(`Updating stretches layer styling for river: ${selectedRiver}, stretch: ${selectedStretch}`);

    stretchesLayerRef.current.setStyle((feature) => {
      const stretchId = feature.get('Stretch_ID');
      const riverCode = feature.get('River_Code');

      let baseStyle;
      if (selectedStretch && stretchId === selectedStretch) {
        baseStyle = selectedStretchStyle;
      } else if (selectedRiver && riverCode === selectedRiver && !selectedStretch) {
        baseStyle = new Style({
          stroke: new Stroke({
            color: "rgba(202, 12, 12, 1)",
            width: 3,
          }),
        });
      } else {
        baseStyle = stretchStyle;
      }

      const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
      const shouldShow = shouldShowStretchLabel(stretchId, currentZoom, showLabels);

      if (shouldShow) {
        return [
          baseStyle,
          createStretchLabelStyle(`S-${stretchId}`)
        ];
      }

      return baseStyle;
    });

    stretchesLayerRef.current.changed();

    // ZOOM TO SELECTION
    setTimeout(() => {
      const source = stretchesLayerRef.current?.getSource();
      if (!source || !mapInstanceRef.current) return;

      const features = source.getFeatures();

      if (selectedStretch) {
        const selectedFeature = features.find((f: { get: (arg0: string) => number; }) => f.get('Stretch_ID') === selectedStretch);
        if (selectedFeature) {
          const geometry = selectedFeature.getGeometry();
          if (geometry) {
            const extent = geometry.getExtent();
            mapInstanceRef.current.getView().fit(extent, {
              padding: [100, 100, 100, 100],
              duration: 1000,
              maxZoom: 12,
            });
            console.log(`Zoomed to stretch ${selectedStretch}`);
          }
        }
      } else if (selectedRiver) {
        const riverFeatures = features.filter((f: { get: (arg0: string) => number; }) => f.get('River_Code') === selectedRiver);
        if (riverFeatures.length > 0) {
          let combinedExtent: any = null;
          riverFeatures.forEach((feature: { getGeometry: () => any; }) => {
            const geometry = feature.getGeometry();
            if (geometry) {
              const featureExtent = geometry.getExtent();
              if (!combinedExtent) {
                combinedExtent = [...featureExtent];
              } else {
                combinedExtent[0] = Math.min(combinedExtent[0], featureExtent[0]);
                combinedExtent[1] = Math.min(combinedExtent[1], featureExtent[1]);
                combinedExtent[2] = Math.max(combinedExtent[2], featureExtent[2]);
                combinedExtent[3] = Math.max(combinedExtent[3], featureExtent[3]);
              }
            }
          });

          if (combinedExtent) {
            mapInstanceRef.current.getView().fit(combinedExtent, {
              padding: [80, 80, 80, 80],
              duration: 1000,
              maxZoom: 11,
            });
            console.log(`Zoomed to river ${selectedRiver} with ${riverFeatures.length} stretches`);
          }
        }
      }
    }, 300);

    console.log(`Stretches layer styling updated`);
  }, [selectedRiver, selectedStretch, showLabels]);

  // Effect to UPDATE drains styling when stretch/drain is selected
// Effect to UPDATE drains styling when stretch/drain is selected
useEffect(() => {
  if (!mapInstanceRef.current || !drainsLayerRef.current) return;

  console.log(`Updating drains layer styling for stretch: ${selectedStretch}, drain: ${selectedDrain}`);

  drainsLayerRef.current.setStyle((feature) => {
    const drainNo = feature.get('Drain_No');
    const stretchId = feature.get('Stretch_ID');
    const riverCode = feature.get('River_Code');
    const geometry = feature.getGeometry();
    const geometryType = geometry?.getType();
    const isPoint = geometryType === 'Point' || geometryType === 'MultiPoint';

    if (selectedDrain && drainNo === selectedDrain) {
      return isPoint ? selectedDrainPointStyle : selectedDrainStyle;
    } else if (selectedStretch && stretchId === selectedStretch && !selectedDrain) {
      return isPoint ? new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({
            color: '#1d05f3ff',
          }),
          stroke: new Stroke({
            color: '#FFFFFF',
            width: 2,
          }),
        }),
      }) : new Style({
        stroke: new Stroke({
          color: '#1d05f3ff',
          width: 3,
        }),
      });
    } else if (selectedRiver && riverCode === selectedRiver && !selectedStretch && !selectedDrain) {
      return isPoint ? new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: '#10B981',
          }),
          stroke: new Stroke({
            color: '#FFFFFF',
            width: 2,
          }),
        }),
      }) : new Style({
        stroke: new Stroke({
          color: "#10B981",
          width: 2.5,
        }),
      });
    } else {
      return isPoint ? drainPointStyle : drainStyle;
    }
  });

  drainsLayerRef.current.changed();

  // ZOOM TO SELECTION
  setTimeout(() => {
    const source = drainsLayerRef.current?.getSource();
    if (!source || !mapInstanceRef.current) return;

    const features = source.getFeatures();
    
    console.log(`Total drain features: ${features.length}`);

    if (selectedDrain) {
      const selectedFeature = features.find((f: { get: (arg0: string) => number; }) => f.get('Drain_No') === selectedDrain);
      
      if (selectedFeature) {
        console.log(`Found drain ${selectedDrain}, zooming to it`);
        const geometry = selectedFeature.getGeometry();
        if (geometry) {
          const extent = geometry.getExtent();
          mapInstanceRef.current.getView().fit(extent, {
            padding: [150, 150, 150, 150],
            duration: 1000,
            maxZoom: 13,
          });
          console.log(`Zoomed to drain ${selectedDrain}`);
        }
      } else {
        console.warn(`Drain ${selectedDrain} not found in features`);
      }
    } else if (selectedStretch) {
      const stretchFeatures = features.filter((f: { get: (arg0: string) => number; }) => f.get('Stretch_ID') === selectedStretch);
      console.log(`Found ${stretchFeatures.length} drains for stretch ${selectedStretch}`);
      
      if (stretchFeatures.length > 0) {
        let combinedExtent: number[] | null = null;
        stretchFeatures.forEach((feature: { getGeometry: () => any; }) => {
          const geometry = feature.getGeometry();
          if (geometry) {
            const featureExtent = geometry.getExtent();
            if (!combinedExtent) {
              combinedExtent = [...featureExtent];
            } else {
              combinedExtent[0] = Math.min(combinedExtent[0], featureExtent[0]);
              combinedExtent[1] = Math.min(combinedExtent[1], featureExtent[1]);
              combinedExtent[2] = Math.max(combinedExtent[2], featureExtent[2]);
              combinedExtent[3] = Math.max(combinedExtent[3], featureExtent[3]);
            }
          }
        });

        if (combinedExtent) {
          mapInstanceRef.current.getView().fit(combinedExtent, {
            padding: [100, 100, 100, 100],
            duration: 1000,
            maxZoom: 12,
          });
          console.log(`Zoomed to stretch ${selectedStretch} drains`);
        }
      }
    }
  }, 300);

  console.log(`Drains layer styling updated`);
}, [selectedStretch, selectedRiver, selectedDrain]);

  // Effect to handle catchments
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    removeLayerByRef(catchmentsLayerRef, "catchments");

    if (selectedDrain) {
      console.log(`Adding catchments layer for drain number: ${selectedDrain}`);

      const catchmentsCqlFilter = `Drain_No=${selectedDrain}`;

      const catchmentsLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Catchment&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(catchmentsCqlFilter)}`,
        }),
        style: catchmentStyle,
        zIndex: 13,
        visible: true,
      });

      catchmentsLayer.set('name', 'catchments');
      catchmentsLayer.set('type', 'drainage');

      const source = catchmentsLayer.getSource();
      source?.on("featuresloaderror", (event: any) => {
        console.log(`Error loading Catchment layer for drain ${selectedDrain}:`, event);
      });

      source?.on("featuresloadstart", () => {
        console.log(`Started loading Catchment layer for drain: ${selectedDrain}`);
      });

      source?.on("featuresloadend", () => {
        console.log(`Successfully loaded Catchment layer for drain: ${selectedDrain}`);
        const features = source.getFeatures();
        console.log(`Loaded ${features.length} catchment features for drain ${selectedDrain}`);
      });

      catchmentsLayerRef.current = catchmentsLayer;
      mapInstanceRef.current.addLayer(catchmentsLayer);

      catchmentsLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          const extent = catchmentsLayer.getSource()?.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });
    }
  }, [selectedDrain]);

  // Effect to handle villages
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    removeLayerByRef(villagesLayerRef, "villages");

    if (selectedVillages.length > 0) {
      console.log(`Adding villages layer for selected villages: ${selectedVillages}`);

      const villageCodeFilter = selectedVillages.map(code => `'${code}'`).join(',');
      const villagesCqlFilter = `village_co IN (${villageCodeFilter})`;

      const villagesLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Village&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(villagesCqlFilter)}`,
        }),
        style: (feature) => {
          const villageCode = feature.get('village_co');
          const baseStyle = selectedVillages.includes(Number(villageCode)) ? selectedVillageStyle : villageStyle;

          if (showLabels) {
            const villageName = feature.get('shapeName') || `Village ${villageCode}`;
            return createCombinedStyle(baseStyle, villageName, 0);
          }
          return baseStyle;
        },
        zIndex: 14,
        visible: true,
      });

      villagesLayer.set('name', 'villages');
      villagesLayer.set('type', 'drainage');

      villagesLayerRef.current = villagesLayer;
      mapInstanceRef.current.addLayer(villagesLayer);

      villagesLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          const extent = villagesLayer.getSource()?.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });
    }
  }, [selectedVillages, showLabels]);

  // Groundwater RSQ layer effect
  useEffect(() => {
    if (groundWaterData) {
      console.log("🧪 MapContext: RSQ data available in context:", groundWaterData);

      if (mapInstanceRef.current && groundWaterData.type === 'FeatureCollection') {
        removeGroundwaterLayer();

        // Hide all other layers
        hideLayer(riversLayerRef);
        hideLayer(stretchesLayerRef);
        hideLayer(drainsLayerRef);
        hideLayer(catchmentsLayerRef);
        hideLayer(villagesLayerRef);

        const vectorSource = new VectorSource({
          features: new GeoJSON().readFeatures(groundWaterData, {
            featureProjection: 'EPSG:3857',
          }),
        });

        const groundwaterStyleFunction = (feature: any) => {
          const props = feature.getProperties();
          const color = props.color || props.Color || props.fill || props.Fill || '#00BCD4';

          return new Style({
            stroke: new Stroke({ color: '#333333', width: 1.5 }),
            fill: new Fill({ color: color }),
          });
        };

        const groundwaterLayer = new VectorLayer({
          source: vectorSource,
          style: groundwaterStyleFunction,
          zIndex: 30,
          visible: true,
        });

        groundwaterLayer.set("name", "groundwater-layer");
        groundwaterLayerRef.current = groundwaterLayer;
        mapInstanceRef.current.addLayer(groundwaterLayer);

        const extent = vectorSource.getExtent();
        if (extent[0] < extent[2]) {
          mapInstanceRef.current.getView().fit(extent, {
            duration: 1000,
            padding: [60, 60, 60, 60],
            maxZoom: 17,
          });
        }

        console.log("✅ Groundwater layer plotted successfully");
      }
    } else {
      console.log("🧪 MapContext: RSQ data is null (no data or cleared)");
      removeGroundwaterLayer();
    }
  }, [groundWaterData]);

  // Function to zoom to current extent
  const zoomToCurrentExtent = () => {
    if (!mapInstanceRef.current) return;

    let targetLayer = null;

    if (villagesLayerRef.current) {
      targetLayer = villagesLayerRef.current;
    } else if (catchmentsLayerRef.current) {
      targetLayer = catchmentsLayerRef.current;
    } else if (drainsLayerRef.current) {
      targetLayer = drainsLayerRef.current;
    } else if (stretchesLayerRef.current) {
      targetLayer = stretchesLayerRef.current;
    } else if (riversLayerRef.current) {
      targetLayer = riversLayerRef.current;
    }

    if (targetLayer) {
      const source = targetLayer.getSource?.();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.some((coord: number) => isFinite(coord))) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 10,
            duration: 1000,
          });
          console.log('Zoomed to current extent');
        }
      }
    }
  };

  // Function to get all layers
  const getAllLayers = () => {
    if (!mapInstanceRef.current) return [];
    return mapInstanceRef.current.getAllLayers();
  };

  const toggleLabels = () => {
    setShowLabels(!showLabels);
    console.log(`Labels toggled to: ${!showLabels}`);
  };

  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) {
      console.warn("Cannot change basemap: map or base layer not initialized");
      return;
    }

    try {
      mapInstanceRef.current.removeLayer(baseLayerRef.current);

      const newBaseLayer = new TileLayer({
        source: baseMaps[baseMapKey].source(),
        zIndex: 0,
      });

      newBaseLayer.set('name', 'basemap');

      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      setSelectedBaseMap(baseMapKey);

      console.log(`Changed basemap to: ${baseMapKey}`);
    } catch (error) {
      console.log("Error changing basemap:", error);
    }
  };

  const contextValue: MapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedBaseMap,
    setMapContainer,
    changeBaseMap,
    zoomToCurrentExtent,
    getAllLayers,
    showLabels,
    toggleLabels,
  };

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      baseLayerRef.current = null;
      basinBoundaryLayerRef.current = null;
      riversLayerRef.current = null;
      stretchesLayerRef.current = null;
      drainsLayerRef.current = null;
      catchmentsLayerRef.current = null;
      villagesLayerRef.current = null;
      groundwaterLayerRef.current = null;
    };
  }, []);

  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};