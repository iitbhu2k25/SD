"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";

import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import TileWMS from "ol/source/TileWMS";
import VectorSource from "ol/source/Vector";
import { toLonLat, fromLonLat, transformExtent } from "ol/proj";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape } from "ol/style";
import Overlay from "ol/Overlay";
// India center in EPSG:3857
const INDIA_CENTER = fromLonLat([82.8, 22.5]); // Center of India
const INDIA_ZOOM = 5;

// GeoServer URL
const GEOSERVER_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://geoserver:8080/geoserver";

/* ---------------- PROPS ---------------- */

interface LayerInfo {
  layerName: string;
  wmsUrl: string;
  wfsUrl: string;
  geometryType: string;
  bufferCreated: boolean;
  featureCount: number;
  bbox: [number, number, number, number] | null;
}

interface WqiRasterInfo {
  layerName: string;
  workspace: string; // [NEW] Added workspace
  styleName?: string;
  statistics: {
    min: number;
    max: number;
    mean: number;
    points_used: number;
  };
  parameterLayers?: Record<string, string>;
  parameterStatistics?: Record<string, {
    min: number;
    max: number;
    mean: number;
    points_used: number;
  }>;
}

interface MapProps {
  layerInfo: LayerInfo | null;
  onReset?: () => void;  // Callback when map is reset
  wqiPoints?: any;  // GeoJSON with WQI points
  wqiRasterLayer?: WqiRasterInfo | null;  // WQI interpolated raster
  activeParameter?: string; // Currently selected physical parameter ID
}

/* ---------------- COMPONENT ---------------- */

const Map: React.FC<MapProps> = ({ layerInfo, onReset, wqiPoints, wqiRasterLayer, activeParameter = "WQI" }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const wmsLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const indiaLayerRef = useRef<any>(null);
  const wqiLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wqiRasterLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(INDIA_ZOOM);

  const activeLegendStats =
    wqiRasterLayer &&
    activeParameter !== "WQI" &&
    wqiRasterLayer.parameterStatistics &&
    wqiRasterLayer.parameterStatistics[activeParameter]
      ? wqiRasterLayer.parameterStatistics[activeParameter]
      : wqiRasterLayer?.statistics;

  /* ---------------- MAP INIT ---------------- */

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Create India WMS layer from GeoServer (hollow - just boundary line)
    // Create India Vector layer (for thicker lines)
    const indiaLayer = new VectorLayer({
      source: new VectorSource({
        url: `${GEOSERVER_URL}/myworkspace/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:India&outputFormat=application/json`,
        format: new GeoJSON(),
      }),
      style: new Style({
        stroke: new Stroke({
          color: '#2563eb', // Blue-600 lines
          width: 2,         // Thicker lines
        }),
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.05)', // Almost transparent fill (just to catch clicks if needed)
        }),
      }),
      zIndex: 1,
    });
    indiaLayerRef.current = indiaLayer;

    mapInstance.current = new OlMap({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maxZoom: 19,
          }),
        }),
        indiaLayer,  // Add India layer from GeoServer
      ],
      view: new View({
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
      }),
    });

    /* Mouse move → coordinates + pointer cursor for features */
    const handlePointerMove = (event: any) => {
      const coordinate =
        mapInstance.current?.getEventCoordinate(event.originalEvent);
      if (!coordinate) return;

      const lonLat = toLonLat(coordinate);
      setCoordinates({
        lon: parseFloat(lonLat[0].toFixed(6)),
        lat: parseFloat(lonLat[1].toFixed(6)),
      });

      // Change cursor to pointer when hovering over a feature
      const hit = mapInstance.current?.hasFeatureAtPixel(event.pixel);
      const target = mapInstance.current?.getTargetElement() as HTMLElement;
      if (target) {
        target.style.cursor = hit ? 'pointer' : '';
      }
    };

    /* Zoom change */
    const handleZoomChange = () => {
      const zoom = mapInstance.current?.getView().getZoom();
      if (zoom) setZoomLevel(Math.round(zoom * 10) / 10);
    };

    mapInstance.current.on("pointermove", handlePointerMove);
    mapInstance.current.getView().on("change:resolution", handleZoomChange);

    return () => {
      mapInstance.current?.un("pointermove", handlePointerMove);
      mapInstance.current?.getView().un("change:resolution", handleZoomChange);
    };
  }, []);

  /* ---------------- WMS LAYER MANAGEMENT ---------------- */

  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing WMS layer if any
    if (wmsLayerRef.current) {
      mapInstance.current.removeLayer(wmsLayerRef.current);
      wmsLayerRef.current = null;
    }

    // If no layerInfo, just show India (already there)
    if (!layerInfo) {
      // Reset to India view
      mapInstance.current.getView().animate({
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
        duration: 500,
      });
      return;
    }

    // Add new WMS layer
    const wmsLayer = new TileLayer({
      source: new TileWMS({
        url: `${GEOSERVER_URL}/wms`,
        params: {
          LAYERS: `myworkspace:${layerInfo.layerName}`,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
      }),
      opacity: 0.6,
      zIndex: 10, // Above India layer
    });

    mapInstance.current.addLayer(wmsLayer);
    wmsLayerRef.current = wmsLayer;

    // Zoom to feature extent if bbox is available
    if (layerInfo.bbox) {
      const [minx, miny, maxx, maxy] = layerInfo.bbox;
      // Transform from EPSG:4326 to EPSG:3857
      const extent = transformExtent(
        [minx, miny, maxx, maxy],
        "EPSG:4326",
        "EPSG:3857"
      );

      // Add some padding (10%)
      const dx = (extent[2] - extent[0]) * 0.1;
      const dy = (extent[3] - extent[1]) * 0.1;
      const paddedExtent = [
        extent[0] - dx,
        extent[1] - dy,
        extent[2] + dx,
        extent[3] + dy,
      ];

      mapInstance.current.getView().fit(paddedExtent, {
        duration: 1000,
        maxZoom: 15,
      });
    }

  }, [layerInfo]);

  /* ---------------- WQI POINTS LAYER MANAGEMENT ---------------- */

  useEffect(() => {
    if (!mapInstance.current) return;

    // Create popup element if not exists (removed from JSX to avoid React/OL conflicts)
    if (!popupRef.current) {
      popupRef.current = document.createElement('div');
      popupRef.current.className = 'ol-popup';
    }

    // Remove existing WQI layer if any
    if (wqiLayerRef.current) {
      mapInstance.current.removeLayer(wqiLayerRef.current);
      wqiLayerRef.current = null;
    }

    // If no WQI points, nothing to do
    if (!wqiPoints || !wqiPoints.features || wqiPoints.features.length === 0) {
      return;
    }

    // Style function for WQI points
    const styleFunction = (feature: any) => {
      const props = feature.getProperties();
      const isValid = props.type === 'valid';
      const wqiScore = props.wqi_score || 0;
      const wqiColor = props.wqi_color || '#22c55e';

      if (isValid) {
        // Valid points: colored by WQI score
        return new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: wqiColor }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        });
      } else {
        // Rejected points (outside buffer): RED TRIANGLE POINTER marker
        return new Style({
          image: new RegularShape({
            fill: new Fill({ color: '#dc2626' }),  // Red-600
            stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
            points: 3,  // Triangle
            radius: 10,
            angle: 0,  // Points downward
          }),
        });
      }
    };

    // Create vector source from GeoJSON
    const vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(wqiPoints, {
        featureProjection: 'EPSG:3857',
      }),
    });

    // Create vector layer
    const wqiLayer = new VectorLayer({
      source: vectorSource,
      style: styleFunction,
      zIndex: 30, // Above everything
    });

    mapInstance.current.addLayer(wqiLayer);
    wqiLayerRef.current = wqiLayer;

    // Setup popup for click
    if (!popupOverlayRef.current && popupRef.current) {
      popupOverlayRef.current = new Overlay({
        element: popupRef.current,
        positioning: 'bottom-center',
        offset: [0, -10],
        autoPan: true,
      });
      mapInstance.current.addOverlay(popupOverlayRef.current);
    }

    // Click handler for points
    const handleClick = (event: any) => {
      const feature = mapInstance.current?.forEachFeatureAtPixel(
        event.pixel,
        (feature) => feature
      );

      if (feature && popupOverlayRef.current && popupRef.current) {
        const props = feature.getProperties();
        const coord = event.coordinate;

        if (props.type === 'valid') {
          popupRef.current.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-3 text-sm">
              <div class="font-bold text-gray-800 mb-1">WQI: ${props.wqi_score}</div>
              <div class="text-xs text-gray-600 mb-1">${props.wqi_class}</div>
              ${props.dataset_label ? `<div class="text-xs font-medium text-purple-600 mb-1 px-1.5 py-0.5 bg-purple-50 rounded w-fit">File: ${props.dataset_label}</div>` : ''}
              <div class="text-xs text-gray-400 mt-1">Lat: ${props.lat?.toFixed(4)}, Lon: ${props.lon?.toFixed(4)}</div>
            </div>
          `;
        } else {
          popupRef.current.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-3 text-sm">
              <div class="font-bold text-red-600 mb-1">Rejected Point</div>
              <div class="text-xs text-gray-600 mb-1">Outside buffer area</div>
               ${props.dataset_label ? `<div class="text-xs font-medium text-purple-600 mb-1 px-1.5 py-0.5 bg-purple-50 rounded w-fit">File: ${props.dataset_label}</div>` : ''}
              <div class="text-xs text-gray-400 mt-1">Lat: ${props.lat?.toFixed(4)}, Lon: ${props.lon?.toFixed(4)}</div>
            </div>
          `;
        }

        popupOverlayRef.current.setPosition(coord);
      } else if (popupOverlayRef.current) {
        popupOverlayRef.current.setPosition(undefined);
      }
    };

    mapInstance.current.on('click', handleClick);

    return () => {
      mapInstance.current?.un('click', handleClick);
    };

  }, [wqiPoints]);

  /* ---------------- WQI RASTER LAYER (FROM INTERPOLATION) ---------------- */
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing raster layer if it exists
    if (wqiRasterLayerRef.current) {
      mapInstance.current.removeLayer(wqiRasterLayerRef.current);
      wqiRasterLayerRef.current = null;
    }

    if (wqiRasterLayer) {

      // Determine the target GeoServer layer based on the active parameter.
      let targetLayerId = wqiRasterLayer.layerName;

      if (
        activeParameter !== "WQI" &&
        wqiRasterLayer.parameterLayers &&
        wqiRasterLayer.parameterLayers[activeParameter]
      ) {
        targetLayerId = wqiRasterLayer.parameterLayers[activeParameter];
      }

      const qualifiedLayerName = targetLayerId.includes(":")
        ? targetLayerId
        : `${wqiRasterLayer.workspace}:${targetLayerId}`;

      console.log("[WQI-DEBUG] Loading Raster Layer:", qualifiedLayerName);

      wqiRasterLayerRef.current = new TileLayer({
        source: new TileWMS({
          // Use the global WMS endpoint and pass fully qualified layer names.
          url: `${GEOSERVER_URL}/wms`,
          params: {
            LAYERS: qualifiedLayerName,
            TILED: true,
            FORMAT: "image/png",
            TRANSPARENT: true,
          },
          serverType: "geoserver",
          transition: 0,
        }),
        opacity: 0.85,
        zIndex: 6, // Below points, above buffer
      });

      mapInstance.current.addLayer(wqiRasterLayerRef.current);
    }

    return () => {
      if (wqiRasterLayerRef.current && mapInstance.current) {
        mapInstance.current.removeLayer(wqiRasterLayerRef.current);
      }
    };
  }, [wqiRasterLayer, activeParameter]);

  /* ---------------- FULLSCREEN ---------------- */

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Update map size after fullscreen change
      setTimeout(() => {
        mapInstance.current?.updateSize();
      }, 100);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!mapContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  /* ---------------- ZOOM CONTROLS ---------------- */

  const zoomIn = () => {
    const view = mapInstance.current?.getView();
    if (view) {
      view.animate({ zoom: (view.getZoom() || INDIA_ZOOM) + 1, duration: 300 });
    }
  };

  const zoomOut = () => {
    const view = mapInstance.current?.getView();
    if (view) {
      view.animate({ zoom: (view.getZoom() || INDIA_ZOOM) - 1, duration: 300 });
    }
  };

  /* ---------------- RESET VIEW ---------------- */

  const resetToIndia = () => {
    if (!mapInstance.current) return;

    // Remove uploaded layer
    if (wmsLayerRef.current) {
      mapInstance.current.removeLayer(wmsLayerRef.current);
      wmsLayerRef.current = null;
    }

    // Remove WQI points layer
    if (wqiLayerRef.current) {
      mapInstance.current.removeLayer(wqiLayerRef.current);
      wqiLayerRef.current = null;
    }

    // Hide popup
    if (popupOverlayRef.current) {
      popupOverlayRef.current.setPosition(undefined);
    }

    // Reset view to India
    mapInstance.current.getView().animate({
      center: INDIA_CENTER,
      zoom: INDIA_ZOOM,
      duration: 800,
    });

    // Notify parent to clear layerInfo
    if (onReset) {
      onReset();
    }
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div
      ref={mapContainerRef}
      className={`relative h-full ${isFullscreen ? "fixed inset-0 z-50 bg-gray-900" : ""}`}
    >
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full"
      />

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className="w-10 h-10 bg-white border border-gray-300 rounded-t-lg shadow-lg hover:bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-700 transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 bg-white border border-gray-300 rounded-b-lg shadow-lg hover:bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-700 transition-colors"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={resetToIndia}
          className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 flex items-center justify-center transition-colors"
          title="Reset to India (removes uploaded layer)"
        >
          🔄
        </button>

        <button
          onClick={toggleFullscreen}
          className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 flex items-center justify-center transition-colors"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? "✕" : "⛶"}
        </button>
      </div>

      {/* Info Panel - Bottom Left */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        {/* Coordinates */}
        {coordinates && (
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg px-4 py-2 shadow-lg">
            <div className="text-xs text-gray-500 mb-1">Coordinates</div>
            <div className="text-sm font-mono text-gray-800">
              {coordinates.lat}°N, {coordinates.lon}°E
            </div>
          </div>
        )}
      </div>

      {wqiRasterLayer && (
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg z-20 w-[200px]">
          <div className="text-xs font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1">
            {activeParameter === "WQI" ? "WQI Index (Min-Max)" : `${activeParameter} (Min-Max)`}
          </div>

          {/* Gradient Bar */}
          <div
            className="h-4 w-full rounded-md mb-2"
            style={{
              background: "linear-gradient(to right, #22c55e, #a3e635, #eab308, #f97316, #ef4444)",
            }}
          ></div>

          {/* Labels */}
          <div className="flex justify-between text-[10px] text-gray-600 font-medium">
            <span>Min ({(activeLegendStats?.min ?? 0).toFixed(1)})</span>
            <span>Max ({(activeLegendStats?.max ?? 0).toFixed(1)})</span>
          </div>

          <div className="text-[10px] text-gray-400 text-center mt-1">
            {activeParameter === "WQI" ? "Excellent -> Unsuitable" : "Low -> High"}
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;

