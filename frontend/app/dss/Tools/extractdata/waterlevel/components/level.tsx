// frontend/app/dss/extractdata/waterlevel/components/level.tsx 
"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { useMap } from "@/contexts/extract/Waterlevel/MapContext";
import MapComponent from "./map";
import Data from "./data";
import Select from "react-select";

import {
  Info,
  Layers,
  MapPin,
  Waves,
  AlertTriangle,
  TrendingUp,
  Droplets,
  Eye,
  EyeOff,
  X
} from "lucide-react";

const WaterLevelMap = () => {
  const mapContext = useMap();

  const {
    map = null,
    toggleBaseMap = () => { },
    isSatellite = false,
    popupOverlay = null,
    popupData = null,
    isPopupVisible = false,
    isLoading = false,
    closePopup = () => { },
    handleZoomIn = () => { },
    handleZoomOut = () => { },
    states = [],
    selectedStateCode = null,
    setSelectedStateCode = () => { },
    districts = [],
    selectedDistrictCode = null,
    setSelectedDistrictCode = () => { },
    rivers = [],
    selectedRiverName = null,
    setSelectedRiverName = () => { },
    hoverInfo = null,
  } = mapContext || {};

  const mapElement = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'trend' | 'data'>('current');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  // Layer visibility toggles
  const [showWaterLevelLayer, setShowWaterLevelLayer] = useState(true);
  const [showStateLayer, setShowStateLayer] = useState(true);
  const [showDistrictLayer, setShowDistrictLayer] = useState(true);
  const [showRiverLayer, setShowRiverLayer] = useState(true);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showWaterLevel, setShowWaterLevel] = useState(true);
  const [showDangerLevel, setShowDangerLevel] = useState(true);
  const [showWarningLevel, setShowWarningLevel] = useState(true);
  const [showHighestFlow, setShowHighestFlow] = useState(true);

  // Statistics
  const [stationCount, setStationCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  const downloadCSV = (data: any[]) => {
    const validData = data.filter(item => item.value != null && item.actualTime);
    const header = ["Water Level (m)", "Date & Time"];
    const rows = validData.map(item => [
      Number(item.value).toFixed(2),
      new Date(item.actualTime).toLocaleString("en-GB")
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...rows].map(e => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "water_level_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const realisticSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: "42px",
      borderRadius: "10px",
      borderColor: state.isFocused ? "#2563eb" : "#d1d5db",
      boxShadow: state.isFocused
        ? "0 0 0 3px rgba(37,99,235,0.25)"
        : "none",
      transition: "all 0.2s ease",
      "&:hover": { borderColor: "#2563eb" }
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: "12px",
      padding: "6px",
      zIndex: 50
    }),
    option: (base: any, state: any) => ({
      ...base,
      borderRadius: "8px",
      margin: "2px 0",
      backgroundColor: state.isSelected
        ? "#2563eb"
        : state.isFocused
          ? "#eff6ff"
          : "white",
      color: state.isSelected ? "white" : "#111827",
      cursor: "pointer"
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "#9ca3af"
    })
  };



  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const defaultStartDate = "2025-01-01";

    if (!filterFrom) setFilterFrom(defaultStartDate);
    if (!filterTo) setFilterTo(today);
  }, [filterFrom, filterTo]);

  useEffect(() => {
    if (map && mapElement.current && !map.getTarget()) {
      try {
        map.setTarget(mapElement.current);
      } catch (error) {
        console.error("Error setting map target:", error);
      }
    }
  }, [map, mapElement]);

  useEffect(() => {
    if (popupOverlay && popupRef.current) {
      try {
        popupOverlay.setElement(popupRef.current);
      } catch (error) {
        console.error("Error setting popup overlay:", error);
      }
    }
  }, [popupOverlay, popupRef]);

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current.requestFullscreen?.();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Map fullscreen error:", e);
    }
  };

  // Toggle layer visibility
  useEffect(() => {
    if (!map) return;
    map.getLayers().forEach(layer => {
      const name = layer.get("name");
      if (name === "waterLevel") layer.setVisible(showWaterLevelLayer);
      if (name === "indiaBase") layer.setVisible(showStateLayer);
      if (name === "districtBase") layer.setVisible(showDistrictLayer);
      if (name === "riverLayer") layer.setVisible(showRiverLayer);
    });
  }, [map, showWaterLevelLayer, showStateLayer, showDistrictLayer, showRiverLayer]);

  const chartData = popupData?.allData
    ?.map((item) => {
      if (item.value == null || item.actualTime == null) return null;
      const numValue = Number(item.value);
      if (isNaN(numValue)) return null;
      const dateTime = new Date(item.actualTime);
      if (isNaN(dateTime.getTime())) return null;

      return {
        time: dateTime,
        timeFormatted: dateTime.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        waterLevel: numValue,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    ?.sort((a, b) => a.time.getTime() - b.time.getTime()) || [];

  const filteredData = chartData.filter((item) => {
    if (!filterFrom && !filterTo) return true;
    const itemDate = item.time.toISOString().split("T")[0];
    if (filterFrom && itemDate < filterFrom) return false;
    if (filterTo && itemDate > filterTo) return false;
    return true;
  });

  const plotlyTraces: any[] = [];

  if (showWaterLevel && filteredData.length > 0) {
    plotlyTraces.push({
      x: filteredData.map(d => d.time),
      y: filteredData.map(d => d.waterLevel),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Water Level',
      line: { color: '#2563eb', width: 3 },
      marker: { size: 4, color: '#2563eb' },
      hovertemplate: '<b>%{x|%d %b %Y, %H:%M}</b><br>Water Level: %{y:.2f} m<extra></extra>',
    });
  }

  if (showDangerLevel && popupData?.latestData?.dangerLevel != null) {
    plotlyTraces.push({
      x: filteredData.map(d => d.time),
      y: Array(filteredData.length).fill(popupData.latestData.dangerLevel),
      type: 'scatter',
      mode: 'lines',
      name: 'Danger Level',
      line: { color: '#dc2626', width: 2, dash: 'dash' },
      hovertemplate: '<b>Danger Level</b><br>%{y:.2f} m<extra></extra>',
    });
  }

  if (showWarningLevel && popupData?.latestData?.warningLevel != null) {
    plotlyTraces.push({
      x: filteredData.map(d => d.time),
      y: Array(filteredData.length).fill(popupData.latestData.warningLevel),
      type: 'scatter',
      mode: 'lines',
      name: 'Warning Level',
      line: { color: '#f97316', width: 2, dash: 'dot' },
      hovertemplate: '<b>Warning Level</b><br>%{y:.2f} m<extra></extra>',
    });
  }

  if (showHighestFlow && popupData?.latestData?.highestFlowLevel != null) {
    plotlyTraces.push({
      x: filteredData.map(d => d.time),
      y: Array(filteredData.length).fill(popupData.latestData.highestFlowLevel),
      type: 'scatter',
      mode: 'lines',
      name: 'Highest Flow',
      line: { color: '#8b5cf6', width: 2, dash: 'dashdot' },
      hovertemplate: '<b>Highest Flow</b><br>%{y:.2f} m<extra></extra>',
    });
  }

  if (!mapContext) {
    return (
      <div className="h-screen w-full bg-gray-100 p-10 pt-15 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing Water Level Map...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`${isFullScreen ? "fixed inset-0 z-50 bg-white" : "h-screen w-full"} bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50`}>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Droplets size={32} />
                <h2 className="text-2xl font-bold">Water Level Monitoring System</h2>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Overview */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Info className="text-blue-600" size={20} />
                  Overview
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  The Water Level Monitoring System provides real-time water level data across India's rivers,
                  reservoirs, and hydrological stations. This system helps in flood forecasting, water resource
                  management, and disaster preparedness.
                </p>
              </section>

              {/* Water Level Categories */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Layers className="text-green-600" size={20} />
                  Water Level Categories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-800 mb-1">Normal Level</h4>
                    <p className="text-sm text-gray-600">Water level within safe operating range</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                    <h4 className="font-semibold text-yellow-800 mb-1">Warning Level (WL)</h4>
                    <p className="text-sm text-gray-600">Indicates need for increased monitoring and preparedness</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                    <h4 className="font-semibold text-orange-800 mb-1">Danger Level (DL)</h4>
                    <p className="text-sm text-gray-600">Critical level requiring immediate action and alerts</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                    <h4 className="font-semibold text-red-800 mb-1">Highest Flood Level (HFL)</h4>
                    <p className="text-sm text-gray-600">Maximum recorded flood level at the station</p>
                  </div>
                </div>
              </section>

              {/* Key Metrics */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="text-purple-600" size={20} />
                  Key Metrics
                </h3>
                <div className="space-y-2 text-gray-600">
                  <p><strong>FRL (Full Reservoir Level):</strong> Maximum water storage capacity</p>
                  <p><strong>MWL (Maximum Water Level):</strong> Highest permissible water level</p>
                  <p><strong>Data Frequency:</strong> Updated every 15-30 minutes from automated sensors</p>
                  <p><strong>Station Types:</strong> River, Reservoir, Lake, and Dam monitoring stations</p>
                </div>
              </section>

              {/* How to Use */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <MapPin className="text-indigo-600" size={20} />
                  How to Use
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>Select a <strong>State</strong> from the left panel to view state-level data</li>
                  <li>Choose a <strong>District</strong> to narrow down to specific areas</li>
                  <li>Filter by <strong>River</strong> to view water levels along specific rivers</li>
                  <li>Click on any station marker to view detailed information and trends</li>
                  <li>Use layer controls to toggle visibility of different data layers</li>
                  <li>Toggle between Street and Satellite view for better context</li>
                </ol>
              </section>

              {/* Color Legend */}
              <section>
                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="text-amber-600" size={20} />
                  Alert Status Colors
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">Safe</span>
                  </div>
                  <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                    <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium">Caution</span>
                  </div>
                  <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span className="text-sm font-medium">Warning</span>
                  </div>
                  <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium">Danger</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="h-full w-full flex">
        {/* Left Panel */}
        <div className={`${leftPanelCollapsed ? 'w-16' : 'w-80'} bg-white shadow-2xl transition-all duration-300 flex flex-col border-r border-gray-200`}>

          {/* Panel Header */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 flex items-center justify-between">
            {!leftPanelCollapsed && (
              <div className="flex items-center gap-2">
                <Waves size={24} />
                <h2 className="font-bold text-lg">Water Level Control</h2>
              </div>
            )}
            <button
              onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              {leftPanelCollapsed ? '→' : '←'}
            </button>
          </div>

          {!leftPanelCollapsed && (
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

              {/* Info Button */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Info size={20} />
                About Water Level System
              </button>

             

              {/* Filters Section */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                  <Layers size={18} />
                  Geographic Filters
                </h3>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>

                  <Select
                    instanceId="waterlevel-state-select"
                    value={
                      selectedStateCode
                        ? states.find(s => s.state_code === selectedStateCode)
                        : null
                    }
                    onChange={(option) => {
                      setSelectedStateCode(option?.state_code || null);
                      setSelectedDistrictCode(null);
                    }}
                    options={states}
                    getOptionLabel={(option) => option.label}
                    getOptionValue={(option) => option.state_code}
                    placeholder="Search state..."
                    isClearable
                    isDisabled={!states || states.length === 0}
                    styles={realisticSelectStyles}
                  />
                </div>

                {/* District */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District
                  </label>

                  <Select
                    instanceId="waterlevel-district-select"
                    value={
                      selectedDistrictCode
                        ? districts.find(d => d.district_code === selectedDistrictCode)
                        : null
                    }
                    onChange={(option) =>
                      setSelectedDistrictCode(option?.district_code || null)
                    }
                    options={districts}
                    getOptionLabel={(option) => option.label}
                    getOptionValue={(option) => option.district_code}
                    placeholder={
                      selectedStateCode
                        ? "Search district..."
                        : "Select state first..."
                    }
                    isClearable
                    isDisabled={!districts || districts.length === 0}
                    styles={realisticSelectStyles}
                  />
                </div>

                {/* River */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    River
                  </label>

                  <Select
                    instanceId="waterlevel-river-select"
                    value={
                      selectedRiverName
                        ? rivers.find(r => r.rivname === selectedRiverName)
                        : null
                    }
                    onChange={(option) =>
                      setSelectedRiverName(option?.rivname || null)
                    }
                    options={rivers}
                    getOptionLabel={(option) => option.label}
                    getOptionValue={(option) => option.rivname}
                    placeholder="Search river..."
                    isClearable
                    isDisabled={!rivers || rivers.length === 0}
                    styles={realisticSelectStyles}
                  />
                </div>
              </div>

              {/* Layer Visibility Controls */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                  <Eye size={18} />
                  Layer Visibility
                </h3>

                <label className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">Water Level Stations</span>
                  <input
                    type="checkbox"
                    checked={showWaterLevelLayer}
                    onChange={(e) => setShowWaterLevelLayer(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">State Boundaries</span>
                  <input
                    type="checkbox"
                    checked={showStateLayer}
                    onChange={(e) => setShowStateLayer(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">District Boundaries</span>
                  <input
                    type="checkbox"
                    checked={showDistrictLayer}
                    onChange={(e) => setShowDistrictLayer(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">Rivers</span>
                  <input
                    type="checkbox"
                    checked={showRiverLayer}
                    onChange={(e) => setShowRiverLayer(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 flex rounded-xl overflow-hidden shadow-2xl">
          <MapComponent
            mapElement={mapElement}
            popupRef={popupRef}
            map={map}
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            toggleBaseMap={toggleBaseMap}
            isSatellite={isSatellite}
            isFullScreen={isFullScreen}
            toggleFullscreen={toggleFullscreen}
            isPopupVisible={isPopupVisible}
            states={states}
            selectedStateCode={selectedStateCode}
            setSelectedStateCode={setSelectedStateCode}
            districts={districts}
            selectedDistrictCode={selectedDistrictCode}
            setSelectedDistrictCode={setSelectedDistrictCode}
            rivers={rivers}
            selectedRiverName={selectedRiverName}
            setSelectedRiverName={setSelectedRiverName}
            hoverInfo={hoverInfo}
          />

          <Data
            isPopupVisible={isPopupVisible}
            isLoading={isLoading}
            popupData={popupData}
            closePopup={closePopup}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            filterFrom={filterFrom}
            setFilterFrom={setFilterFrom}
            filterTo={filterTo}
            setFilterTo={setFilterTo}
            showWaterLevel={showWaterLevel}
            setShowWaterLevel={setShowWaterLevel}
            showDangerLevel={showDangerLevel}
            setShowDangerLevel={setShowDangerLevel}
            showWarningLevel={showWarningLevel}
            setShowWarningLevel={setShowWarningLevel}
            showHighestFlow={showHighestFlow}
            setShowHighestFlow={setShowHighestFlow}
            chartData={chartData}
            filteredData={filteredData}
            plotlyTraces={plotlyTraces}
            downloadCSV={downloadCSV}
            isFullScreen={isFullScreen}
          />
        </div>
      </div>
    </div>
  );
};

export default WaterLevelMap;