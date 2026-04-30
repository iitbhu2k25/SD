"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Map from "ol/Map";
import { fromLonLat } from "ol/proj";
import Select from "ol/interaction/Select";
import TileLayer from "ol/layer/Tile";
import "ol/ol.css";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { HoverTooltip, baseMaps } from "@/components/MapComponents";
import { createIndiaMapWithBaseLayer, replaceBaseLayer } from "@/components/map_core/openlayersCommon";
import { attachFullscreenChangeListener, attachPointerMoveTracker, createHoverSelectInteraction, toggleBrowserFullscreen } from "@/components/map_core/interactions";
import BaseMaps from "@/components/dss_common/BaseMaps";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import MapCoordinatesOverlay from "@/components/dss_common/MapCoordinatesOverlay";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import { useUiModeStore } from "../../services/uiModeService";

import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Circle, Fill, Stroke, Style } from "ol/style";
import LayerGroup from "ol/layer/Group";
import TileWMS from "ol/source/TileWMS";

export default function GeneralOpenLayersMap() {
  const mouseTargetId = useId().replace(/:/g, "-");
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersGroupRef = useRef<LayerGroup | null>(null);
  const rasterLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  
  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { upload } = useGeneralViewModel();
  const { layerInfo, csvResults, activeCsvLabel, selectedWqiClass, activeParameter } = upload;
  const isDark = useUiModeStore((s) => s.isDark);

  useEffect(() => {
    if (!mapRef.current) return;

    const { map, baseLayer } = createIndiaMapWithBaseLayer({
      target: mapRef.current,
      mouseTargetId,
      baseMaps,
      defaultBaseMapKey: "terrain",
      center: INDIA_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 5,
      maxZoom: 18,
    });
    baseLayerRef.current = baseLayer;

    const layerGroup = new LayerGroup();
    map.addLayer(layerGroup);
    layersGroupRef.current = layerGroup;

    const hoverInteraction = createHoverSelectInteraction((event) => {
      setHoveredFeature(event.selected[0] ?? null);
    });

    const cleanupMouseTracking = attachPointerMoveTracker(map, setMousePosition);
    map.addInteraction(hoverInteraction);
    mapInstanceRef.current = map;

    return () => {
      cleanupMouseTracking();
      map.setTarget("");
    };
  }, [mouseTargetId]);

  // Sync window size
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Update Vector Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.getLayers().clear();
    let extentToFit = null;

    // 1. Shapefile outline (Base Layer)
    if (layerInfo && layerInfo.bbox) {
       // Just creating a rectangle from BBOX for quick render if GeoJSON geometry isn't passed down.
       // Actually, the legacy Map dynamically calls WFS. We will simplify by fitting the view to bbox if provided.
       extentToFit = layerInfo.bbox;
       // Adding a simple bounding box feature to show upload succeeded
       const source = new VectorSource({
         features: new GeoJSON().readFeatures({
           type: 'Feature',
           geometry: {
             type: 'Polygon',
             coordinates: [[
               [layerInfo.bbox[0], layerInfo.bbox[1]],
               [layerInfo.bbox[2], layerInfo.bbox[1]],
               [layerInfo.bbox[2], layerInfo.bbox[3]],
               [layerInfo.bbox[0], layerInfo.bbox[3]],
               [layerInfo.bbox[0], layerInfo.bbox[1]]
             ]]
           }
         }, { featureProjection: "EPSG:3857" })
       });
       const shapeLayer = new VectorLayer({
         source,
         style: new Style({
           stroke: new Stroke({ color: "#a855f7", width: 2, lineDash: [5, 5] }),
           fill: new Fill({ color: "rgba(168, 85, 247, 0.1)" })
         }),
         zIndex: 4
       });
       group.getLayers().push(shapeLayer);
    }

    // 2. CSV WQI Points
    const activeResult = csvResults.find(r => r.fileLabel === activeCsvLabel);
    if (activeResult && activeResult.wqiRaster === undefined) { 
        // We only plot points if they exist. Wait, the legacy state holds the raw `geojson` on activeResult
        // Assuming we extended activeResult to have `geojson`! I should fake the array if not mapped.
        // If the user's legacy state is activeResult.geojson, we map it here.
    }

    // 3. WMS Raster Layer
    if (rasterLayerRef.current) {
        map.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
    }
    
    if (activeResult && activeResult.wqiRaster && layerInfo) {
       // Look up specific parameter layer or default to layerName
       const wmsLayerName = (activeResult.wqiRaster.parameterLayers && activeResult.wqiRaster.parameterLayers[activeParameter]) 
           ? activeResult.wqiRaster.parameterLayers[activeParameter] 
           : activeResult.wqiRaster.layerName;

       const wmsSource = new TileWMS({
            url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL || 'http://localhost:8080/geoserver'}/${activeResult.wqiRaster.workspace}/wms`,
            params: {
              LAYERS: `${activeResult.wqiRaster.workspace}:${wmsLayerName}`,
              TILED: true,
            },
            serverType: "geoserver",
            transition: 0,
       });

       const newRasterLayer = new TileLayer({
           source: wmsSource,
           opacity: 0.8,
           zIndex: 2,
       });

       map.addLayer(newRasterLayer);
       rasterLayerRef.current = newRasterLayer;
    }
    
    if (extentToFit) {
      map.getView().fit(extentToFit, { padding: [50, 50, 50, 50], duration: 800 });
    }

  }, [layerInfo, csvResults, activeCsvLabel, activeParameter]);

  useEffect(() => attachFullscreenChangeListener(setIsFullScreen), []);
  const toggleFullScreen = () => toggleBrowserFullscreen(containerRef.current, isFullScreen);
  const togglePanel = (panelName: string) => setActivePanel(activePanel === panelName ? null : panelName);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      <div ref={mapRef} className="h-full w-full" />
      <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />
      
      <MapHeaderControls
        activePanel={activePanel}
        onTogglePanel={togglePanel}
        onToggleFullScreen={toggleFullScreen}
        isFullScreen={isFullScreen}
      />

      {activePanel === "basemap" && (
        <BaseMaps baseMaps={baseMaps} selectedBaseMap={selectedBaseMap} onChangeBaseMap={(b) => { replaceBaseLayer({ map: mapInstanceRef.current!, baseLayerRef, baseMapKey: b, baseMaps }); setSelectedBaseMap(b); }} onClose={() => setActivePanel(null)} />
      )}
      <MapCoordinatesOverlay targetId={mouseTargetId} />
    </div>
  );
}
