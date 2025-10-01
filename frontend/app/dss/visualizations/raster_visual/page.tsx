'use client'
import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import ImageWMS from "ol/source/ImageWMS";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import MVT from "ol/format/MVT";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls, ScaleLine, MousePosition, ZoomToExtent, FullScreen } from "ol/control";
import { Style, Fill, Stroke } from "ol/style";
import { Coordinate } from "ol/coordinate";
import "ol/ol.css";
import { api } from "@/services/api";
import { toast } from "react-toastify";
import { baseMaps } from "@/components/MapComponents";

// TypeScript interfaces
interface BaseMap {
  name: string;
  source: () => OSM | XYZ;
  icon: string;
}

interface RasterLayer {
  file_name: string;
  layer_name: string;
  category?: string;
}

interface Module {
  module: string;
  category: boolean;
  raster: RasterLayer[];
}
const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
const INITIAL_ZOOM = 6;

const OpenLayersRasterViewer: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const rasterLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const vectorLayerRef = useRef<VectorTileLayer | null>(null);
  const baseLayerRef = useRef<TileLayer<OSM | XYZ> | null>(null);

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [layerOpacity, setLayerOpacity] = useState<number>(75);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [activePanel, setActivePanel] = useState<string | null>('modules');
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [rasterLayerName, setRasterLayerName] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [Displaydata, setDisplayData] = useState<Module[]>([]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await api.get('/location/get_raster_visual');
        if (response.status != 201) {
          console.log("Failed to fetch modules");
          return
        }
        const data = await response.message as Module[];
        setDisplayData(data);

      } catch (err) {
        console.log("Failed to fetch modules", err);
        toast.error("Failed to connect the server ", {
          position: "top-center",
        })
      }
    };
    fetchModules();
  }, []);

  // Constants
  const GEOSERVER_URL = "/geoserver/api/wms";
  const GEOSERVER_MVT_URL = "/geoserver/api/gwc/service/tms/1.0.0"; // MVT endpoint
  const Vector_workspace = "vector_work";
  const Raster_workspace = "raster_visualization";
  const FIXED_VECTOR_LAYER = "STP_State";
  const INDIA_CENTER_LON = 78.9629;
  const INDIA_CENTER_LAT = 23.5937;
  const INITIAL_ZOOM = 5;

  // Filter rasters
  const filteredRasters: (RasterLayer & { module: string })[] = [];

  if (selectedModule) {
    const selected = Displaydata.find(m => m.module === selectedModule);
    if (selected) {
      selected.raster
        .filter(raster =>
          raster.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          raster.layer_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .forEach(raster => {
          filteredRasters.push({ ...raster, module: selected.module });
        });
    }
  }

  // Initialize map and vector layer together
  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
    });

    baseLayerRef.current = initialBaseLayer;

    const controls = defaultControls({
      attributionOptions: {
        collapsible: false,
      },
    }).extend([
      new ScaleLine({
        units: "metric",
        bar: true,
        steps: 4,
        minWidth: 140,
      }),
      new MousePosition({
        coordinateFormat: (coordinate: Coordinate | undefined): string => {
          if (!coordinate) return "No coordinates";
          const [longitude, latitude] = coordinate;
          return `${latitude.toFixed(6)}°N, ${longitude.toFixed(6)}°E`;
        },
        projection: "EPSG:4326",
        target: document.getElementById("mouse-position") || undefined,
      }),
      new ZoomToExtent({
        tipLabel: "Zoom to extent",
        extent: fromLonLat([68, 6]).concat(fromLonLat([97, 37])),
      }),
      new FullScreen({
        tipLabel: "Toggle fullscreen",
      }),
    ]);
    const map = new Map({
      target: mapRef.current,
      layers: [initialBaseLayer],
      controls: controls,
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: 18,
        enableRotation: true,
        constrainRotation: false,
      }),
    });

    mapInstanceRef.current = map;

    // Load MVT vector layer after map initialization
    const mvtUrl = `${GEOSERVER_MVT_URL}/${Vector_workspace}:${FIXED_VECTOR_LAYER}@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf`;

    const vectorTileSource = new VectorTileSource({
      format: new MVT(),
      url: mvtUrl,
      maxZoom: 22,
    });

    const vectorTileLayer = new VectorTileLayer({
      source: vectorTileSource,
      style: new Style({
        stroke: new Stroke({
          color: "#3b82f6",
          width: 3,
          lineJoin: "round",
        }),
        fill: new Fill({ color: 'transparent' })
      }),
      zIndex: 5,
    });

    // Add vector layer to map
    map.addLayer(vectorTileLayer);
    vectorLayerRef.current = vectorTileLayer;



    // Optional: Add success handler
    vectorTileSource.on('tileloadend', () => {
      console.log('MVT tiles loaded successfully');
    });

    return () => {
      if (mapInstanceRef.current) {
        const layers = mapInstanceRef.current.getLayers().getArray().slice();
        layers.forEach(layer => {
          mapInstanceRef.current?.removeLayer(layer);
        });
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      rasterLayerRef.current = null;
      vectorLayerRef.current = null;
      baseLayerRef.current = null;
    };
  }, []); // Empty dependency array

  // Load raster layer function
  const loadRasterLayer = (layerName: string) => {
    if (!mapInstanceRef.current || !layerName.trim()) {
      setError("Please select a valid layer");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const map = mapInstanceRef.current;
      const fullLayerName = `${Raster_workspace}:${layerName}`;

      // Remove existing raster layer
      if (rasterLayerRef.current) {
        map.removeLayer(rasterLayerRef.current);
      }

      // Create WMS source
      const wmsSource = new ImageWMS({
        url: GEOSERVER_URL,
        params: {
          LAYERS: fullLayerName,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
          VERSION: "1.3.0",
        },
        ratio: 1,
        serverType: "geoserver",
      });

      // Create raster layer
      const rasterLayer = new ImageLayer({
        source: wmsSource,
        visible: true,
        opacity: layerOpacity / 100,
        zIndex: 10,
      });

      // Generate legend URL
      const legendUrlString = `${GEOSERVER_URL}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000`;
      setLegendUrl(legendUrlString);

      // Add layer to map
      map.addLayer(rasterLayer);
      rasterLayerRef.current = rasterLayer;
      setRasterLayerName(layerName);
      setShowLegend(true);
      setLoading(false);

      console.log(`Raster layer loaded: ${fullLayerName}`);
    } catch (error) {
      console.log("Error loading raster layer:", error);
      setError(`Error loading raster layer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  // Change base map
  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;

    mapInstanceRef.current.removeLayer(baseLayerRef.current);

    const baseMapConfig = baseMaps[baseMapKey];
    const newBaseLayer = new TileLayer({
      source: baseMapConfig.source(),
      zIndex: 0,
    });

    baseLayerRef.current = newBaseLayer;
    mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
    setSelectedBaseMap(baseMapKey);
  };

  // Handle opacity change
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseInt(e.target.value);
    setLayerOpacity(newOpacity);
    if (rasterLayerRef.current) {
      rasterLayerRef.current.setOpacity(newOpacity / 100);
    }
  };

  // Remove raster layer
  const removeRasterLayer = () => {
    if (mapInstanceRef.current && rasterLayerRef.current) {
      mapInstanceRef.current.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
      setLegendUrl(null);
      setShowLegend(false);
      setRasterLayerName("");
    }
  };

  // Toggle panel
  const togglePanel = (panelName: string) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  // Toggle sidebar for mobile
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="relative w-full h-200 bg-slate-900 flex flex-col md:flex-row">
      {/* Mobile Sidebar Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 md:w-96 bg-slate-800 border-r border-slate-700 flex flex-col shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">GIS Viewer</h1>
              <p className="text-blue-100 text-sm">Vector Tiles & Raster Layers</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-750">
          {[
            { id: 'modules', label: 'Modules', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { id: 'basemap', label: 'Base', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => togglePanel(tab.id)}
              className={`flex-1 px-2 py-3 text-sm font-medium transition-all duration-200 ${activePanel === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/30'
                }`}
            >
              <div className="flex items-center justify-center space-x-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="text-xs">{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {activePanel === 'modules' && (
            <div className="flex flex-col h-full space-y-4">
              {/* Search and Filter */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Search Layers
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                    placeholder="Search raster layers..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Filter by Module
                  </label>
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                  >
                    <option value="">Select Modules</option>
                    {Displaydata.map((module) => (
                      <option key={module.module} value={module.module}>
                        {module.module}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 👉 Fixed Current Layer Config (always visible) */}
              {rasterLayerRef.current && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <svg
                      className="w-5 h-5 mr-2 text-purple-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2
              l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6
              20h12a2 2 0 002-2V6a2 2 0
              00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Current Layer
                  </h3>

                  <div className="space-y-4">
                    <div className="p-3 bg-slate-600/50 rounded border border-slate-500">
                      <p className="text-sm text-slate-300 font-mono">{rasterLayerName}</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm text-slate-300 mb-2">
                        <span className="font-medium">Opacity</span>
                        <span className="font-semibold text-purple-400">{layerOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={layerOpacity}
                        onChange={handleOpacityChange}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => setShowLegend(!showLegend)}
                      className={`w-full px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium flex items-center justify-center space-x-2 ${showLegend
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-slate-600 hover:bg-slate-500 text-slate-200"
                        }`}
                    >
                      <span>{showLegend ? "Hide Legend" : "Show Legend"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Raster Layers List - scroll only this */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between sticky top-0 bg-slate-800 py-2 z-10">
                  <h3 className="text-sm font-semibold text-white">
                    Raster Layers ({filteredRasters.length})
                  </h3>
                  {rasterLayerRef.current && (
                    <button
                      onClick={removeRasterLayer}
                      className="text-xs bg-red-600/80 hover:bg-red-700 px-2 py-1 rounded-md text-white transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="grid gap-3">
                  {filteredRasters.map((raster, index) => (
                    <div
                      key={`${raster.layer_name}-${index}`}
                      className="p-3 rounded-xl bg-slate-700/40 border border-slate-600 hover:border-blue-500/60 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate flex items-center space-x-2">
                            <svg
                              className="w-4 h-4 text-blue-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                              />
                            </svg>
                            <span>{raster.file_name}</span>
                          </h4>

                          {raster.category && (
                            <p className="mt-1 text-[10px] text-yellow-600 inline-block px-2 py-0.5 rounded-full bg-slate-600 uppercase tracking-wide">
                              {raster.category}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => loadRasterLayer(raster.layer_name)}
                        disabled={loading}
                        className="mt-3 w-full px-3 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-700 transition-all text-white text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            <span>View</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}

                  {filteredRasters.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-sm">No raster layers found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* Base Maps Panel */}
          {activePanel === 'basemap' && (
            <div>
              <div className="grid gap-3">
                {Object.entries(baseMaps).map(([key, baseMap]) => (
                  <button
                    key={key}
                    onClick={() => changeBaseMap(key)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${selectedBaseMap === key
                      ? "bg-blue-600/20 border-blue-500 text-blue-300"
                      : "bg-slate-700/30 border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500"
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedBaseMap === key ? "bg-blue-500/20" : "bg-slate-600/50"
                        }`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium">{baseMap.name}</h4>
                        {selectedBaseMap === key && (
                          <p className="text-xs text-blue-400 mt-1">Currently active</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-1 relative  bg-slate-950">
        <div
          ref={mapRef}
          className="w-full h-full rounded-2xl shadow-2xl border border-slate-700 bg-slate-900"
        />
        {/* Floating Toolbar */}
        {/* Floating Toolbar */}
        <div className="absolute top-6 left-6 z-20 flex flex-col space-y-3">
          {/* Zoom In */}
          <button
            onClick={() => {
              const view = mapInstanceRef.current?.getView();
              if (view) view.setZoom((view.getZoom() ?? 0) + 1);
            }}
            className="p-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-white shadow-lg border border-slate-600 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => {
              const view = mapInstanceRef.current?.getView();
              if (view) view.setZoom((view.getZoom() ?? 0) - 1);
            }}
            className="p-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-white shadow-lg border border-slate-600 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          {/* Reset View */}
          <button
            onClick={() => {
              const view = mapInstanceRef.current?.getView();
              if (view) {
                view.setCenter(fromLonLat([78.9629, 23.5937])); // India center
                view.setZoom(5); // your default zoom
              }
            }}
            className="p-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-white shadow-lg border border-slate-600 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
            </svg>
          </button>


        </div>


        {/* Coordinates */}
        <div className="absolute right-6 bottom-6 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-xs font-mono text-slate-200" id="mouse-position"></div>
          </div>
        </div>

        {/* Legend */}
        {showLegend && legendUrl && (
          <div className="absolute bottom-28 right-6 z-10 bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl w-64">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Legend</h4>
              <button
                onClick={() => setShowLegend(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-600 bg-white">
              <img
                src={legendUrl}
                alt="Layer Legend"
                className="max-w-full h-auto"
                onError={() => setError("Failed to load legend")}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-6 left-6 z-20 bg-red-900/90 backdrop-blur-md border border-red-600 text-red-200 px-4 py-3 rounded-lg shadow-xl flex items-center max-w-md w-full">
            <svg className="w-5 h-5 mr-3 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium pr-8">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute right-2 top-2 text-red-400 hover:text-red-200 transition-colors p-1 hover:bg-red-800/30 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 bg-slate-900/70 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-slate-800/95 backdrop-blur-md rounded-xl p-8 shadow-2xl border border-slate-600">
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <div>
                  <p className="text-white font-medium">Loading raster layer...</p>
                  <p className="text-slate-400 text-sm">Connecting to GeoServer</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default OpenLayersRasterViewer;