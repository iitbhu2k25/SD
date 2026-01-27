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
import "ol/ol.css";
import { api } from "@/services/api";
import { toast } from "react-toastify";
import { baseMaps } from "@/components/MapComponents";
import Image from "next/image";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { transformExtent } from 'ol/proj';

interface RasterLayer {
  file_name: string;
  layer_name: string;
  category?: string;
}

const Analytics: React.FC = () => {
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
  const [activePanel, setActivePanel] = useState<string>('modules');
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("satellite");
  const [rasterFileName, setRasterFileName] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [respRaster, setRespRaster] = useState<RasterLayer[]>([]);
  const [showLegend, setShowLegend] = useState(true);

  // Constants
  const GEOSERVER_URL = "/geoserver/api/wms";
  const GEOSERVER_MVT_URL = "/geoserver/api/gwc/service/tms/1.0.0";
  const Vector_workspace = "vector_work";
  const Raster_workspace = "raster_work";
  const FIXED_VECTOR_LAYER = "STP_State";


  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
    });
    baseLayerRef.current = initialBaseLayer;

    const controls = defaultControls({
      zoom: false,
      rotate: false,
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
        coordinateFormat: (coordinate) => {
          if (!coordinate) return "No coordinates";
          const [lon, lat] = coordinate;
          return `${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E`;
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

    // Load MVT vector layer
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

    map.addLayer(vectorTileLayer);
    vectorLayerRef.current = vectorTileLayer;

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
  }, []);
  const getWMSExtent4326 = async (layerName: string) => {
    const url = `${GEOSERVER_URL}?service=WMS&request=GetCapabilities&version=1.3.0`;
    const response = await fetch(url);
    const text = await response.text();

    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const layers = Array.from(xml.getElementsByTagName('Layer'));

    const layer = layers.find(l =>
      l.getElementsByTagName('Name')[0]?.textContent === layerName
    );

    if (!layer) return null;

    // WGS84 extent
    const bbox = layer.getElementsByTagName('EX_GeographicBoundingBox')[0];
    if (!bbox) return null;

    return [
      parseFloat(bbox.getElementsByTagName('westBoundLongitude')[0].textContent!),
      parseFloat(bbox.getElementsByTagName('southBoundLatitude')[0].textContent!),
      parseFloat(bbox.getElementsByTagName('eastBoundLongitude')[0].textContent!),
      parseFloat(bbox.getElementsByTagName('northBoundLatitude')[0].textContent!)
    ];
  };

  // Load raster layer
  const loadRasterLayer = (layerName: string, file_name: string) => {
    if (!mapInstanceRef.current || !layerName.trim()) {
      setError("Please select a valid layer");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const map = mapInstanceRef.current;
      const fullLayerName = `${Raster_workspace}:${layerName}`;

      if (rasterLayerRef.current) {
        map.removeLayer(rasterLayerRef.current);
      }

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

      const rasterLayer = new ImageLayer({
        source: wmsSource,
        visible: true,
        opacity: layerOpacity / 100,
        zIndex: 10,
      });

      const legendUrlString = `${GEOSERVER_URL}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000`;
      setLegendUrl(legendUrlString);
      map.addLayer(rasterLayer);
      rasterLayerRef.current = rasterLayer;
      getWMSExtent4326(fullLayerName).then(extent4326 => {
        if (!extent4326) return;

        const view = map.getView();
        const viewProj = view.getProjection().getCode();

        const extent = viewProj === 'EPSG:4326'
          ? extent4326
          : transformExtent(extent4326, 'EPSG:4326', viewProj);

        view.fit(extent, {
          padding: [20, 20, 20, 20],
          duration: 500,
          maxZoom: 14
        });
      });
      setRasterFileName(file_name);
      setLoading(false);
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
      setRasterFileName("");
      toast.info("Layer removed from map");
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    if (!document.fullscreenElement) {
      mapElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    const view = mapInstanceRef.current?.getView();
    if (view) view.animate({ zoom: (view.getZoom() ?? 0) + delta, duration: 250 });
  };

  const resetView = () => {
    const view = mapInstanceRef.current?.getView();
    if (view) {
      view.animate({
        center: fromLonLat([78.9629, 23.5937]),
        zoom: 5,
        duration: 600,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file: File | undefined = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

    if (file.size > MAX_SIZE) {
      toast.error("File size must be 50 MB or less");
      e.target.value = "";
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post<{ success: boolean; message: [RasterLayer] | string }>(
        "/api/check",
        {
          body: formData,
        }
      );

      if (res.status == 201 && Array.isArray(res.message)) {
        setRespRaster(res.message as RasterLayer[]);
        toast.success("Raster file uploaded successfully");
      }
    } catch (error) {
      toast.error("Something went wrong while uploading");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="relative w-full h-200 bg-slate-900 flex flex-col md:flex-row">
      {/* Processing Overlay - Fixed positioned below navbar */}
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Left side */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 md:w-2/6 bg-slate-800 border-r border-slate-700 flex flex-col shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ISRO RAC</h1>
                <p className="text-blue-100 text-sm">Analysis hyperspectral imager</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-750">
          {[
            { id: 'modules', label: 'Layers', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { id: 'basemap', label: 'Base Map', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${activePanel === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/30'
                }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {activePanel === 'modules' && (
            <div className="space-y-4">
              {/* Upload Section */}
              <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <h3 className="text-base font-semibold text-white">Upload Raster File</h3>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".tif,.tiff,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${uploading
                      ? 'border-slate-500 bg-slate-600/30 cursor-not-allowed'
                      : 'border-blue-500/50 bg-slate-800/50 hover:bg-slate-700/50 hover:border-blue-400'
                      }`}
                  >
                    <div className="text-center">
                      {uploading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                          <span className="text-sm text-slate-300">Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="mx-auto h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <p className="text-sm text-slate-300 font-medium">Click to upload</p>
                          <p className="text-xs text-slate-400 mt-1">TIF, TIFF, PNG, JPG (Max 50MB)</p>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Active Layer Controls */}
              {rasterFileName && (
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-600/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <h4 className="text-sm font-semibold text-white">Active Layer</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Legend toggle */}
                      <button
                        onClick={() => setShowLegend(!showLegend)}
                        className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                        title={showLegend ? "Hide legend" : "Show legend"}
                      >
                        {showLegend ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.958 9.958 0 012.735-4.338m1.65-1.512A9.959 9.959 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.732 2.945M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                          </svg>
                        )}
                      </button>
                      {/* Remove button */}
                      <button
                        onClick={removeRasterLayer}
                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all"
                        title="Remove layer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-sm text-slate-200 font-medium truncate" title={rasterFileName}>
                      {rasterFileName}
                    </p>
                  </div>

                  {/* Opacity Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Opacity</span>
                      </label>
                      <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                        {layerOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={layerOpacity}
                      onChange={handleOpacityChange}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${layerOpacity}%, #334155 ${layerOpacity}%, #334155 100%)`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Available Layers List */}
              {respRaster.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <h4 className="text-sm font-semibold text-slate-300">Available Layers</h4>
                    </div>
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                      {respRaster.length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                    {respRaster.map((layer, index) => (
                      <div
                        key={`${layer.file_name}-${index}`}
                        className={`group relative overflow-hidden rounded-lg border transition-all duration-300 ${rasterFileName === layer.file_name
                          ? "bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20"
                          : "bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500 hover:shadow-md"
                          }`}
                      >
                        {/* Main content - slides left on hover */}
                        <div className={`relative transition-transform duration-300 ease-out ${rasterFileName === layer.file_name
                          ? ''
                          : 'group-hover:-translate-x-20'
                          }`}>
                          <button
                            onClick={() => loadRasterLayer(layer.layer_name, layer.file_name)}
                            className="w-full text-left px-4 py-3 focus:outline-none"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${rasterFileName === layer.file_name
                                ? "bg-blue-500/30"
                                : "bg-slate-600/50 group-hover:bg-slate-600 group-hover:scale-110"
                                }`}>
                                <svg className={`w-5 h-5 transition-colors ${rasterFileName === layer.file_name ? 'text-blue-300' : 'text-slate-300 group-hover:text-white'
                                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate transition-colors ${rasterFileName === layer.file_name ? 'text-white' : 'text-slate-300 group-hover:text-white'
                                  }`}>
                                  {layer.file_name}
                                </p>
                                {layer.category && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{layer.category}</p>
                                )}
                              </div>
                              {rasterFileName === layer.file_name && (
                                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </button>
                        </div>

                        {/* Action buttons - slide in from right */}
                        {rasterFileName !== layer.file_name && (
                          <div className="absolute right-0 top-0 h-full flex items-center translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out">
                            <div className="flex items-center h-full bg-gradient-to-l from-slate-700 to-transparent pl-4 pr-2">
                              <button
                                onClick={() => loadRasterLayer(layer.layer_name, layer.file_name)}
                                className="p-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-all duration-200 hover:scale-110 mr-1"
                                title="Load layer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRespRaster(prev => prev.filter((_, i) => i !== index));
                                  if (rasterFileName === layer.file_name) {
                                    removeRasterLayer();
                                  }
                                  toast.info("Layer removed from list");
                                }}
                                className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-all duration-200 hover:scale-110"
                                title="Delete layer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Active layer indicator bar */}
                        {rasterFileName === layer.file_name && (
                          <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {respRaster.length === 0 && !uploading && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-sm text-center">No layers uploaded yet</p>
                  <p className="text-slate-500 text-xs text-center mt-1">Upload a raster file to get started</p>
                </div>
              )}
            </div>
          )}

          {/* Base Maps Panel */}
          {activePanel === 'basemap' && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 px-1 mb-3">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <h4 className="text-sm font-semibold text-slate-300">Select Base Map</h4>
              </div>

              <div className="grid gap-3">
                {Object.entries(baseMaps).map(([key, baseMap]) => (
                  <button
                    key={key}
                    onClick={() => changeBaseMap(key)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${selectedBaseMap === key
                      ? "bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20"
                      : "bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500"
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${selectedBaseMap === key ? "bg-blue-500/20" : "bg-slate-600/50"
                        }`}>
                        <svg className={`w-6 h-6 ${selectedBaseMap === key ? 'text-blue-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${selectedBaseMap === key ? 'text-white' : 'text-slate-300'}`}>
                          {baseMap.name}
                        </h4>
                        {selectedBaseMap === key && (
                          <div className="flex items-center space-x-1 mt-1">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                            <p className="text-xs text-blue-400">Active</p>
                          </div>
                        )}
                      </div>
                      {selectedBaseMap === key && (
                        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Container - Right side */}
      <div className="flex-1 md:w-4/6 p-1 relative bg-slate-950">
        <div
          ref={mapRef}
          className="w-full h-full rounded-2xl shadow-2xl border border-slate-700 bg-slate-900"
        />

        {/* Fullscreen Button */}
        <div className="absolute top-6 right-6 z-30">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-100 shadow-lg hover:bg-slate-700/70 transition"
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m12-6h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4m12 6h4a2 2 0 002-2v-4" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m14-6h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3m14 6h3a2 2 0 002-2v-3" />
              </svg>
            )}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="absolute top-6 left-6 z-20 flex flex-col rounded-xl bg-slate-900/70 backdrop-blur-md shadow-xl border border-slate-700 overflow-hidden">
          <button
            onClick={() => handleZoom(1)}
            className="p-3 text-slate-100 hover:bg-slate-700 transition"
            title="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div className="h-px bg-slate-700" />

          <button
            onClick={() => handleZoom(-1)}
            className="p-3 text-slate-100 hover:bg-slate-700 transition"
            title="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <div className="h-px bg-slate-700" />

          <button
            onClick={resetView}
            className="p-3 text-slate-100 hover:bg-slate-700 transition"
            title="Reset view"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
            </svg>
          </button>
        </div>

        {/* Coordinates */}
        <div className="absolute right-6 bottom-6 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
          <div className="text-xs font-mono text-slate-100" id="mouse-position"></div>
        </div>

        {/* Legend */}
        {legendUrl && showLegend && (
          <div className="absolute bottom-16 right-16 z-20">
            <div
              className="
      bg-white/95 backdrop-blur-md
      rounded-xl shadow-2xl border border-gray-200
      w-[150px] h-[380px]
      flex flex-col
    "
            >
              {/* Header */}
              <div className="flex justify-between items-center px-2 py-1 border-b">
                <span className="text-xs font-bold text-gray-700">Legend</span>
                <button
                  onClick={() => setShowLegend(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Image Container */}
              <div className="relative flex-1 p-2 overflow-hidden">
                <Image
                  src={legendUrl}
                  alt="Layer Legend"
                  fill
                  className="object-contain"
                  unoptimized
                  onError={() => setError("Failed to load legend")}
                />
              </div>
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

export default Analytics;