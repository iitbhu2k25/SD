"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { useMap } from "@/contexts/extract/Waterlevel/MapContext";
import MapComponent from "./map";
import Data from "./data";

const WaterLevelMap = () => {
  const mapContext = useMap();

  const {
    map = null,
    toggleBaseMap = () => {},
    isSatellite = false,
    popupOverlay = null,
    popupData = null,
    isPopupVisible = false,
    isLoading = false,
    closePopup = () => {},
    handleZoomIn = () => {},
    handleZoomOut = () => {},
    states = [],
    selectedStateCode = null,
    setSelectedStateCode = () => {},
  } = mapContext || {};

  const mapElement = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'trend' | 'data'>('current');

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showWaterLevel, setShowWaterLevel] = useState(true);
  const [showDangerLevel, setShowDangerLevel] = useState(true);
  const [showWarningLevel, setShowWarningLevel] = useState(true);
  const [showHighestFlow, setShowHighestFlow] = useState(true);

  const downloadCSV = (data: any[]) => {
    // SAFELY filter out null/undefined values
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

  // FIXED: Safe handling of null/undefined values
  const chartData = popupData?.allData
    ?.map((item) => {
      // Skip invalid entries
      if (item.value == null || item.actualTime == null) {
        return null;
      }

      const numValue = Number(item.value);
      if (isNaN(numValue)) {
        return null; // skip non-numeric values
      }

      const dateTime = new Date(item.actualTime);
      if (isNaN(dateTime.getTime())) {
        return null; // invalid date
      }

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

  // Filtered data based on date range
  const filteredData = chartData.filter((item) => {
    if (!filterFrom && !filterTo) return true;
    const itemDate = item.time.toISOString().split("T")[0];
    if (filterFrom && itemDate < filterFrom) return false;
    if (filterTo && itemDate > filterTo) return false;
    return true;
  });

  // Prepare Plotly traces (also safe)
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
    <div ref={wrapRef} className={`${isFullScreen ? "fixed inset-0 z-50 bg-white" : "h-screen w-full"} bg-gray-100 p-10 pt-15`}>
      <div className="h-full w-full flex rounded-xl overflow-hidden shadow-2xl">
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
  );
};

export default WaterLevelMap;