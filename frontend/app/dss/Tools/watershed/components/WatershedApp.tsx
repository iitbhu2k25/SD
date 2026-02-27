import React, { useState, useEffect, useRef } from 'react';
import { Map as LeafletMap } from 'leaflet';
import WatershedMap from './WatershedMap';
import SelectionPanel from './SelectionPanel';
import InfoModal from './InfoModal';
import LayerPanel from './LayerPanel';
import SettingsPanel from './SettingsPanel';
import ExportPanel from './ExportPanel';
import Header from './Header';
import {
  GeoJSONResponse,
  AnalysisMode,
  MapSettings,
  CoordinateInput,
  LayerData,
} from './type';
import { fetchIndiaBaseMap } from './utils';

const WatershedApp: React.FC = () => {
  // State management
  const [clickedPoint, setClickedPoint] = useState<[number, number] | null>(null);
  const [watershedData, setWatershedData] = useState<GeoJSONResponse | null>(null);
  const [riversData, setRiversData] = useState<GeoJSONResponse | null>(null);
  const [flowpathData, setFlowpathData] = useState<GeoJSONResponse | null>(null);
  const [flowpathMessage, setFlowpathMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('upstream');
  const [indiaBaseMap, setIndiaBaseMap] = useState<GeoJSONResponse | null>(null);
  const [baseMapLoading, setBaseMapLoading] = useState<boolean>(true);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showLayerPanel, setShowLayerPanel] = useState<boolean>(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [showExportPanel, setShowExportPanel] = useState<boolean>(false);
  const [customLayers, setCustomLayers] = useState<LayerData[]>([]);
  const [drawnItems, setDrawnItems] = useState<any[]>([]);

  const [mapSettings, setMapSettings] = useState<MapSettings>({
    riverColor: '#3b82f6',
    riverOpacity: 0.9,
    riverThickness: 2,
    watershedColor: '#ef4444',
    watershedOpacity: 0.7,
    watershedFillOpacity: 0.1,
    baseMap: 'osm',
  });

  const mapRef = useRef<LeafletMap | null>(null);

  // Load India base map on mount
  useEffect(() => {
    const loadBaseMap = async () => {
      setBaseMapLoading(true);
      const data = await fetchIndiaBaseMap();
      if (data) {
        setIndiaBaseMap(data);
      }
      setBaseMapLoading(false);
    };
    loadBaseMap();
  }, []);

  // Handler functions
  const handleMapClick = (latlng: [number, number]) => {
    setClickedPoint(latlng);
    if (error) setError(null);
  };

  const handleModeChange = (newMode: AnalysisMode) => {
    setMode(newMode);
    handleClearData();
  };

  const handleClearData = () => {
    setWatershedData(null);
    setRiversData(null);
    setFlowpathData(null);
    setFlowpathMessage(null);
    setClickedPoint(null);
    setError(null);
  };

  const handleCoordinateSubmit = (coords: CoordinateInput) => {
    setClickedPoint([coords.latitude, coords.longitude]);
    if (error) setError(null);
    
    // Pan map to the new point
    if (mapRef.current) {
      mapRef.current.setView([coords.latitude, coords.longitude], 10);
    }
  };

  const handleSettingsChange = (newSettings: Partial<MapSettings>) => {
    setMapSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleAddLayer = (layer: LayerData) => {
    setCustomLayers((prev) => [...prev, layer]);
  };

  const handleToggleLayer = (layerId: string) => {
    setCustomLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const handleRemoveLayer = (layerId: string) => {
    setCustomLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  };

  const handleDrawnItemsChange = (items: any[]) => {
    setDrawnItems(items);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <Header
        onInfoClick={() => setShowInfoModal(true)}
        onLayersClick={() => setShowLayerPanel(!showLayerPanel)}
        onSettingsClick={() => setShowSettingsPanel(!showSettingsPanel)}
        onExportClick={() => setShowExportPanel(!showExportPanel)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Selection Tools */}
        <SelectionPanel
          mode={mode}
          onModeChange={handleModeChange}
          clickedPoint={clickedPoint}
          onCoordinateSubmit={handleCoordinateSubmit}
          watershedData={watershedData}
          riversData={riversData}
          flowpathData={flowpathData}
          flowpathMessage={flowpathMessage}
          error={error}
          indiaBaseMap={indiaBaseMap}
          onClearData={handleClearData}
        />

        {/* Map */}
        <WatershedMap
          mapRef={mapRef}
          clickedPoint={clickedPoint}
          onMapClick={handleMapClick}
          mode={mode}
          watershedData={watershedData}
          setWatershedData={setWatershedData}
          riversData={riversData}
          setRiversData={setRiversData}
          flowpathData={flowpathData}
          setFlowpathData={setFlowpathData}
          flowpathMessage={flowpathMessage}
          setFlowpathMessage={setFlowpathMessage}
          loading={loading}
          setLoading={setLoading}
          error={error}
          setError={setError}
          indiaBaseMap={indiaBaseMap}
          baseMapLoading={baseMapLoading}
          mapSettings={mapSettings}
          customLayers={customLayers}
          drawnItems={drawnItems}
          onDrawnItemsChange={handleDrawnItemsChange}
        />

        {/* Right Panels */}
        {showLayerPanel && (
          <LayerPanel
            customLayers={customLayers}
            onAddLayer={handleAddLayer}
            onToggleLayer={handleToggleLayer}
            onRemoveLayer={handleRemoveLayer}
            onClose={() => setShowLayerPanel(false)}
          />
        )}

        {showSettingsPanel && (
          <SettingsPanel
            settings={mapSettings}
            onSettingsChange={handleSettingsChange}
            onClose={() => setShowSettingsPanel(false)}
          />
        )}

        {showExportPanel && (
          <ExportPanel
            watershedData={watershedData}
            riversData={riversData}
            flowpathData={flowpathData}
            drawnItems={drawnItems}
            mapRef={mapRef}
            onClose={() => setShowExportPanel(false)}
          />
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} />}
    </div>
  );
};

export default WatershedApp;