import React, { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMapEvents,
  Marker,
  Popup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L, { LatLng, Icon, Map as LeafletMap, FeatureGroup } from 'leaflet';
import 'leaflet-draw';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

import {
  GeoJSONResponse,
  AnalysisMode,
  MapSettings,
  LayerData,
} from './type';
import { getImageUrl, fetchData } from './utils';

// Set up default Leaflet marker icon
const defaultIcon = new Icon({
  iconUrl: getImageUrl(iconUrl),
  iconRetinaUrl: getImageUrl(iconRetinaUrl),
  shadowUrl: getImageUrl(shadowUrl),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component for map click events with drawing mode detection
function MapClickHandler({ 
  onClick, 
  isDrawing 
}: { 
  onClick: (latlng: LatLng) => void;
  isDrawing: boolean;
}) {
  useMapEvents({
    click: (e) => {
      // Only trigger onClick if not in drawing mode
      if (!isDrawing) {
        onClick(e.latlng);
      }
    },
  });
  return null;
}

// Drawing controls component with drawing state tracking
function DrawingControls({ 
  onDrawnItemsChange,
  onDrawingStateChange
}: { 
  onDrawnItemsChange: (items: any[]) => void;
  onDrawingStateChange: (isDrawing: boolean) => void;
}) {
  const map = useMapEvents({});
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());

  useEffect(() => {
    if (!map) return;

    const drawnItems = drawnItemsRef.current;
    map.addLayer(drawnItems);

    // Initialize drawing controls
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: {
          shapeOptions: {
            color: '#f59e0b',
            weight: 3,
          },
        },
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: '#8b5cf6',
            fillOpacity: 0.2,
          },
        },
        rectangle: {
          shapeOptions: {
            color: '#ec4899',
            fillOpacity: 0.2,
          },
        },
        circle: {
          shapeOptions: {
            color: '#10b981',
            fillOpacity: 0.2,
          },
        },
        marker: {
          icon: defaultIcon,
        },
        circlemarker: {
          color: '#06b6d4',
          fillOpacity: 0.5,
        },
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });

    map.addControl(drawControl);

    // Track drawing state
    map.on(L.Draw.Event.DRAWSTART, () => {
      onDrawingStateChange(true);
    });

    map.on(L.Draw.Event.DRAWSTOP, () => {
      onDrawingStateChange(false);
    });

    // Handle drawing events
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      
      // Convert to array and update parent
      const items: any[] = [];
      drawnItems.eachLayer((layer: any) => {
        items.push(layer.toGeoJSON());
      });
      onDrawnItemsChange(items);
    });

    map.on(L.Draw.Event.EDITED, (e: any) => {
      const items: any[] = [];
      drawnItems.eachLayer((layer: any) => {
        items.push(layer.toGeoJSON());
      });
      onDrawnItemsChange(items);
    });

    map.on(L.Draw.Event.DELETED, (e: any) => {
      const items: any[] = [];
      drawnItems.eachLayer((layer: any) => {
        items.push(layer.toGeoJSON());
      });
      onDrawnItemsChange(items);
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      map.off(L.Draw.Event.DRAWSTART);
      map.off(L.Draw.Event.DRAWSTOP);
    };
  }, [map, onDrawnItemsChange, onDrawingStateChange]);

  return null;
}

// Loading overlay component
const LoadingOverlay = ({
  show,
  isBaseMapLoading = false,
}: {
  show: boolean;
  isBaseMapLoading?: boolean;
}) => {
  if (!show) return null;

  return (
    <div
      className={`absolute inset-0 z-[1000] flex items-center justify-center ${
        isBaseMapLoading
          ? ' bg-opacity-80 '
          : ' bg-opacity-40'
      }`}
    >
      {isBaseMapLoading && (
        <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center border border-slate-200">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mb-4"
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
          <div className="text-lg font-semibold text-slate-800">
            Loading Base Map
          </div>
          <div className="text-sm text-slate-500 mt-2">
            Fetching geographical boundaries...
          </div>
        </div>
      )}
    </div>
  );
};

// Loading button component
const LoadingButton = ({
  isLoading,
  onClick,
  text,
}: {
  isLoading: boolean;
  onClick: () => void;
  text: string;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`relative overflow-hidden flex items-center justify-center px-4 py-2 rounded-lg text-sm text-white font-medium transition-all duration-300 ${
        isLoading
          ? 'bg-blue-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 active:scale-95 shadow-md hover:shadow-lg'
      }`}
    >
      {isLoading ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-white"
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
          </span>
          <span className="opacity-0">Processing</span>
        </>
      ) : (
        text
      )}
    </button>
  );
};

interface WatershedMapProps {
  mapRef: React.MutableRefObject<LeafletMap | null>;
  clickedPoint: [number, number] | null;
  onMapClick: (latlng: [number, number]) => void;
  mode: AnalysisMode;
  watershedData: GeoJSONResponse | null;
  setWatershedData: (data: GeoJSONResponse | null) => void;
  riversData: GeoJSONResponse | null;
  setRiversData: (data: GeoJSONResponse | null) => void;
  flowpathData: GeoJSONResponse | null;
  setFlowpathData: (data: GeoJSONResponse | null) => void;
  flowpathMessage: string | null;
  setFlowpathMessage: (message: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  indiaBaseMap: GeoJSONResponse | null;
  baseMapLoading: boolean;
  mapSettings: MapSettings;
  customLayers: LayerData[];
  drawnItems: any[];
  onDrawnItemsChange: (items: any[]) => void;
}

const WatershedMap: React.FC<WatershedMapProps> = ({
  mapRef,
  clickedPoint,
  onMapClick,
  mode,
  watershedData,
  setWatershedData,
  riversData,
  setRiversData,
  flowpathData,
  setFlowpathData,
  flowpathMessage,
  setFlowpathMessage,
  loading,
  setLoading,
  error,
  setError,
  indiaBaseMap,
  baseMapLoading,
  mapSettings,
  customLayers,
  drawnItems,
  onDrawnItemsChange,
}) => {
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  const handleMapClick = (latlng: LatLng) => {
    onMapClick([latlng.lat, latlng.lng]);
  };

  const handleDelineate = async () => {
    if (!clickedPoint) return;

    setLoading(true);
    setError(null);
    setFlowpathMessage(null);

    try {
      const [lat, lng] = clickedPoint;

      // Clear previous data
      setWatershedData(null);
      setRiversData(null);
      setFlowpathData(null);

      if (mode === 'upstream') {
        // Fetch watershed data
        const { data: watershedData } = await fetchData('watershed_api', lat, lng);
        setWatershedData(watershedData);

        // Fetch river network data
        const { data: riversData } = await fetchData('upstream_rivers_api', lat, lng);
        setRiversData(riversData);

        // Fit map to watershed bounds
        if (watershedData?.features?.length > 0 && mapRef.current) {
          try {
            const layer = L.geoJSON(watershedData as any);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 13,
              });
            }
          } catch (e) {
            console.log('Error fitting to bounds:', e);
          }
        }
      } else {
        // Fetch flowpath data
        const { data: flowpathData, message } = await fetchData('flowpath_api', lat, lng);
        setFlowpathData(flowpathData);
        setFlowpathMessage(message || null);

        // Fit map to flowpath bounds
        if (flowpathData?.features?.length > 0 && mapRef.current) {
          try {
            const layer = L.geoJSON(flowpathData as any);
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 13,
              });
            }
          } catch (e) {
            console.log('Error fitting to bounds:', e);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set up Leaflet default icon
    const DefaultIcon = L.Icon.Default as any;
    delete DefaultIcon.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: getImageUrl(iconRetinaUrl),
      iconUrl: getImageUrl(iconUrl),
      shadowUrl: getImageUrl(shadowUrl),
    });
  }, []);

  // Get base map URL based on settings
  const getBaseMapUrl = () => {
    switch (mapSettings.baseMap) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'osm':
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const getBaseMapAttribution = () => {
    switch (mapSettings.baseMap) {
      case 'satellite':
        return '© Esri';
      case 'terrain':
        return '© OpenTopoMap';
      case 'dark':
        return '© CartoDB';
      case 'osm':
      default:
        return '© OpenStreetMap contributors';
    }
  };

  // Style functions for GeoJSON layers
  const indiaBaseMapStyle = {
    color: '#2563eb',
    weight: 2,
    opacity: 0.8,
    fillColor: '#f0f9ff',
    fillOpacity: 0.1,
  };

  const watershedStyle = {
    color: mapSettings.watershedColor,
    weight: 4,
    opacity: mapSettings.watershedOpacity,
    fillColor: 'white',
    fillOpacity: mapSettings.watershedFillOpacity,
  };

  const riverStyle = (feature?: any) => {
    const order = feature?.properties?.sorder || 1;
    const width = Math.max(1, order * mapSettings.riverThickness);
    return {
      color: mapSettings.riverColor,
      weight: width,
      opacity: mapSettings.riverOpacity,
    };
  };

  const flowpathStyle = (feature?: any) => {
    const order = feature?.properties?.sorder || 1;
    const width = Math.max(1, order * mapSettings.riverThickness);
    return {
      color: mapSettings.riverColor,
      weight: width,
      opacity: mapSettings.riverOpacity,
    };
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  return (
    <div className="flex-1 relative m-4 rounded-xl shadow-xl overflow-hidden border border-slate-200">
      {/* Loading overlays */}
      <LoadingOverlay show={baseMapLoading} isBaseMapLoading={true} />
      <LoadingOverlay show={loading && !baseMapLoading} isBaseMapLoading={false} />

      <div
        className={`w-full h-full ${
          baseMapLoading ? 'filter blur-sm' : ''
        } transition-all duration-500`}
      >
        <MapContainer
          center={[22.9734, 78.6569]}
          zoom={6}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          ref={(map) => {
            mapRef.current = map;
          }}
          zoomControl={false}
        >
          {/* Custom Zoom Controls */}
          <div
            className="leaflet-control-zoom leaflet-bar leaflet-control"
            style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000 }}
          >
            <a
              className="leaflet-control-zoom-in"
              href="#"
              title="Zoom in"
              role="button"
              aria-label="Zoom in"
              onClick={handleZoomIn}
            >
              +
            </a>
            <a
              className="leaflet-control-zoom-out"
              href="#"
              title="Zoom out"
              role="button"
              aria-label="Zoom out"
              onClick={handleZoomOut}
            >
              −
            </a>
          </div>

          {/* Base Map Tile Layer */}
          <TileLayer
            attribution={getBaseMapAttribution()}
            url={getBaseMapUrl()}
          />

          {/* India Base Map Layer */}
          {indiaBaseMap && (
            <GeoJSON data={indiaBaseMap as any} style={indiaBaseMapStyle} />
          )}

          {/* Map Click Handler */}
          <MapClickHandler onClick={handleMapClick} isDrawing={isDrawing} />

          {/* Drawing Controls */}
          <DrawingControls 
            onDrawnItemsChange={onDrawnItemsChange}
            onDrawingStateChange={setIsDrawing}
          />

          {/* Clicked Point Marker */}
          {clickedPoint && (
            <Marker position={[clickedPoint[0], clickedPoint[1]]} icon={defaultIcon}>
              <Popup autoPan={true} closeOnClick={false} autoClose={false}>
                <div className="flex flex-col gap-2 text-sm p-1">
                  <div className="font-semibold text-slate-700">Selected Point</div>
                  <div className="text-slate-600 text-xs">
                    Lat: {clickedPoint[0].toFixed(5)}
                    <br />
                    Lng: {clickedPoint[1].toFixed(5)}
                  </div>
                  <LoadingButton
                    isLoading={loading}
                    onClick={handleDelineate}
                    text="Delineate"
                  />
                </div>
              </Popup>
            </Marker>
          )}

          {/* Watershed Data */}
          {mode === 'upstream' && watershedData && (
            <GeoJSON data={watershedData as any} style={watershedStyle} />
          )}

          {/* Rivers Data */}
          {mode === 'upstream' && riversData && (
            <GeoJSON data={riversData as any} style={riverStyle} />
          )}

          {/* Flowpath Data */}
          {mode === 'downstream' && flowpathData && (
            <GeoJSON data={flowpathData as any} style={flowpathStyle} />
          )}

          {/* Custom Layers */}
          {customLayers
            .filter((layer) => layer.visible)
            .map((layer) => (
              <GeoJSON
                key={layer.id}
                data={layer.data as any}
                style={{
                  color: layer.color,
                  weight: 2,
                  opacity: 0.7,
                  fillOpacity: 0.2,
                }}
              />
            ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default WatershedMap;