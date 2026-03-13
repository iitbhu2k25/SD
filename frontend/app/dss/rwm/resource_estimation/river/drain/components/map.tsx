"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import "ol/ol.css";
import {
  Eye,
  EyeOff,
  Layers,
  Map as MapIcon,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import SimpleLegend from "./legend";
import { useStretch } from "@/contexts/riverwater_assessment/drain/LocationContext";
import {
  useStretchMap,
  type WaterQualityParameter,
} from "@/contexts/riverwater_assessment/drain/MapContext";
import { useStretchChart } from "@/contexts/riverwater_assessment/drain/ChartContext";
import { fromLonLat, toLonLat } from "ol/proj";
import { METERS_PER_UNIT } from "ol/proj/Units";

// Mapping from frontend attribute keys to backend GeoJSON property names
const attributeMapping: Record<string, string> = {
  ph: "pH",
  tds: "TDS_mg_L_",
  ec: "EC__S_cm_",
  temperature: "Temperatur",
  turbidity: "Turbidity_",
  dissolvedOxygen: "DO_mg_L_",
  orp: "ORP",
  tss: "TSS_mg_L_",
  cod: "COD_mg_L_",
  bod: "BOD_mg_L_",
  ts: "TS_mg_L_",
  chloride: "Chloride_m",
  nitrate: "Nitrate_mg",
  hardness: "Hardness_m",
  faecalColiform: "Faecal_Col",
  totalColiform: "Total_Coli",
  wqi: "WQI",
};

const parameterLabels: Record<string, string> = {
  ph: "pH",
  tds: "TDS",
  ec: "EC",
  temperature: "Temperature",
  turbidity: "Turbidity",
  dissolvedOxygen: "Dissolved Oxygen",
  orp: "ORP",
  tss: "TSS",
  cod: "COD",
  bod: "BOD",
  ts: "Total Solids",
  chloride: "Chloride",
  nitrate: "Nitrate",
  hardness: "Hardness",
  faecalColiform: "Faecal Coliform",
  totalColiform: "Total Coliform",
  wqi: "WQI",
};

const StretchMapComponent: React.FC = () => {
  const { selectedStretches, selectedSeason, areaConfirmed, waterQualityData } =
    useStretch(); // Add waterQualityData here
  const {
    dataError,
    interpolationError,
    isProcessing,
    selectedDropdownParam,
    setSelectedDropdownParam,
    currentInterpolationParam,
    setCurrentInterpolationParam,
    generateInterpolation,
    setMapContainer,
    mapInstance,
    zoomToCurrentExtent,
    removeInterpolationLayer,
    selectedBaseMap,
    changeBaseMap,
    baseMaps,
    isWaterQualityDisplayed,
    isStretchLinesDisplayed,
    toggleWaterQualityPoints,
    toggleStretchLines,
    legendData,
    isInterpolationDisplayed,
    interpolationOpacity,
    setInterpolationOpacity,
    waterQualityParameters,
    isBasinDisplayed,
    isRiverDisplayed,
    isRiverBufferDisplayed,
    toggleBasinLayer,
    toggleRiverLayer,
    toggleRiverBufferLayer,
    toggleInterpolationLayer,
    showLayerPanel,
    setShowLayerPanel,
  } = useStretchMap();

  const { selectedAttribute } = useStretchChart();

  const mapRef = useRef<HTMLDivElement>(null);
  const [showBaseMapSelector, setShowBaseMapSelector] = useState(false);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [scale, setScale] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Tooltip state for hover over water quality points
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    content: React.ReactNode;
    top: number;
    left: number;
  }>({
    visible: false,
    content: null,
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Mouse move handler for coordinates, scale, and hover tooltip
  useEffect(() => {
    if (!mapInstance) return;

    const handlePointerMove = (event: any) => {
      if (event.dragging) {
        setTooltipData(prev => ({ ...prev, visible: false }));
        return;
      }

      const coordinate = mapInstance.getEventCoordinate(event.originalEvent);
      if (coordinate) {
        const lonLat = toLonLat(coordinate);
        setCoordinates({
          lon: parseFloat(lonLat[0].toFixed(6)),
          lat: parseFloat(lonLat[1].toFixed(6)),
        });
      }

      // Feature hit detection for tooltips
      const pixel = mapInstance.getEventPixel(event.originalEvent);
      const feature = mapInstance.forEachFeatureAtPixel(pixel, (feat: any) => feat);

      if (feature && feature.getGeometry()?.getType() === 'Point') {
        const properties = feature.getProperties();

        // Only show tooltip for water quality points (drain GeoJSON uses capital-L Location, S_No_)
        if (properties.Location !== undefined || properties.S_No_ !== undefined) {
          mapInstance.getTargetElement().style.cursor = 'pointer';

          const activeParameter = selectedAttribute || "ph";
          const backendKey =
            attributeMapping[activeParameter as keyof typeof attributeMapping] || activeParameter;
          const dataValue =
            properties[backendKey] ?? properties[activeParameter] ?? "N/A";

          const paramLabel = parameterLabels[activeParameter] || activeParameter;

          setTooltipData({
            visible: true,
            top: pixel[1],
            left: pixel[0],
            content: (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-800 border-b pb-1 mb-1">
                  {properties.Sampling || `Point ${properties.S_No_}`}
                </span>
                <span className="text-sm">
                  <span className="font-medium text-gray-600">
                    {paramLabel}:
                  </span>{" "}
                  {typeof dataValue === "number" ? dataValue.toFixed(2) : dataValue}
                </span>
              </div>
            ),
          });
        }
      } else {
        mapInstance.getTargetElement().style.cursor = '';
        setTooltipData(prev => ({ ...prev, visible: false }));
      }
    };

    const handleMoveEnd = () => {
      const view = mapInstance.getView();
      const resolution = view.getResolution();
      if (resolution) {
        const units = view.getProjection().getUnits();
        const dpi = 25.4 / 0.28;
        const mpu = METERS_PER_UNIT[units as keyof typeof METERS_PER_UNIT];
        const scaleValue = Math.round(resolution * mpu * 39.37 * dpi);
        setScale(`1:${scaleValue.toLocaleString()}`);
      }
    };

    mapInstance.on("pointermove", handlePointerMove);
    mapInstance.on("moveend", handleMoveEnd);
    handleMoveEnd(); // Initial scale calculation

    return () => {
      mapInstance.un("pointermove", handlePointerMove);
      mapInstance.un("moveend", handleMoveEnd);
    };
  }, [mapInstance, selectedAttribute]);

  // Set the map container when the ref is available
  useEffect(() => {
    if (mapRef.current) {
      console.log("Setting map container in MapContext");
      setMapContainer(mapRef.current);
    }

    // Cleanup function
    return () => {
      setMapContainer(null);
    };
  }, [setMapContainer]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDropdown && !target.closest(".relative")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const toggleFullscreen = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.log("Error toggling fullscreen:", error);
    }
  }, []);

  const resetView = () => {
    if (mapInstance) {
      const view = mapInstance.getView();
      const basinCenter = fromLonLat([82.495045, 25.628354]); // Pre-transformed center for Basin
      view.animate({
        center: basinCenter,
        zoom: 9.5,
        duration: 1000,
      });
    }
  };

  const hasMapLayers = useMemo(() => {
    return mapInstance && mapInstance.getLayers().getLength() > 1;
  }, [mapInstance]);

  // Place this function inside your component
  // const handleParameterChange = async (
  //   e: React.ChangeEvent<HTMLSelectElement>
  // ) => {
  //   const value = e.target.value;
  //   setSelectedDropdownParam(value);
  //   if (
  //     value &&
  //     selectedStretches.length > 0 &&
  //     selectedSeason &&
  //     areaConfirmed &&
  //     waterQualityData?.features?.length > 0 &&
  //     !isProcessing
  //   ) {
  //     setCurrentInterpolationParam(value);
  //     await generateInterpolation(selectedStretches, selectedSeason, value);
  //   }
  // };

  const handleParameterSelect = async (parameterKey: string) => {
    if (!areaConfirmed || selectedStretches.length === 0) {
      return;
    }

    setSelectedDropdownParam(parameterKey);
    setShowDropdown(false);

    if (
      parameterKey &&
      selectedStretches.length > 0 &&
      selectedSeason &&
      areaConfirmed &&
      waterQualityData?.features && waterQualityData.features.length > 0 &&
      !isProcessing
    ) {
      setCurrentInterpolationParam(parameterKey);
      await generateInterpolation(
        selectedStretches,
        selectedSeason,
        parameterKey
      );
    }
  };

  const getParameterLabel = (key: string) => {
    const param = waterQualityParameters.find(
      (p: WaterQualityParameter) => p.key === key
    );
    return param
      ? `${param.label}${param.unit ? ` (${param.unit})` : ""}`
      : key;
  };

  return (
    <div className="relative h-full w-full bg-gray-100 rounded-xl ">
      {/* Map container */}
      <div ref={mapRef} className="h-full w-full">
        {/* Loading Overlay - When Interpolation is Processing */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4 min-w-[350px]">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                <span className="text-gray-700 font-semibold text-xl">
                  Generating Interpolation
                </span>
              </div>

              <div className="text-center space-y-2">
                <p className="text-gray-600">
                  Processing{" "}
                  <span className="capitalize font-medium text-green-600">
                    {selectedDropdownParam || currentInterpolationParam}
                  </span>{" "}
                  data
                </p>
                <p className="text-gray-500 text-sm">
                  Season:{" "}
                  <span className="capitalize font-medium">
                    {selectedSeason}
                  </span>{" "}
                  • Stretches: {selectedStretches.length} selected
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>This may take 30-60 seconds...</span>
              </div>
            </div>
          </div>
        )}

        {/* Data Loading Overlay */}
        {dataError && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-30 flex items-center justify-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-xl max-w-md">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="text-red-800 font-medium text-sm">
                    Data Loading Error
                  </h4>
                  <p className="text-red-700 text-sm mt-1">{dataError}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls Bar */}
        <div className="absolute top-2 left-10 right-4 z-10">
          <div className="flex justify-between items-start">
            {/* Left Controls - Parameter Selection & Layers */}
            <div className="flex gap-2">
              {/* Parameter Selection & Interpolation */}
              {areaConfirmed && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    disabled={!areaConfirmed || selectedStretches.length === 0}
                    className={`min-w-[250px] p-3 text-left rounded-lg border bg-white/50 hover:bg-white shadow-lg transition-all duration-200 flex items-center justify-between ${!areaConfirmed || selectedStretches.length === 0
                      ? "opacity-50 cursor-not-allowed bg-gray-50"
                      : "cursor-pointer"
                      } ${showDropdown ? "border-blue-300" : "border-gray-200"}`}
                  >
                    <span className="text-sm">
                      {selectedDropdownParam
                        ? getParameterLabel(selectedDropdownParam)
                        : "Select Parameter"}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                      {waterQualityParameters.map(
                        (param: WaterQualityParameter) => (
                          <button
                            key={param.key}
                            onClick={() => handleParameterSelect(param.key)}
                            className={`w-full p-3 text-left hover:bg-gray-50 transition-colors border-b cursor-pointer border-gray-100 last:border-b-0 ${selectedDropdownParam === param.key
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700"
                              }`}
                          >
                            <div className="font-medium text-sm">
                              {param.label}{" "}
                              {param.unit ? `(${param.unit})` : ""}
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Layer Controls */}
              <button
                onClick={() => setShowLayerPanel(!showLayerPanel)}
                className="bg-white/50 hover:bg-white text-gray-700 px-3 py-2 rounded-lg shadow-lg border border-gray-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Layers size={16} />
                <span className="font-medium">Layers</span>
              </button>
            </div>
          </div>
        </div>

        {/* This replaces both the old top-right selector AND the duplicate enhanced one */}
        <div className="absolute top-2 right-4 z-10">
          <div className="relative">
            {/* Base Map Button */}
            <button
              onClick={() => setShowBaseMapSelector(!showBaseMapSelector)}
              className="bg-white/50 hover:bg-white border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
              title="Change Base Map"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={baseMaps[selectedBaseMap]?.icon}
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                {baseMaps[selectedBaseMap]?.name}
              </span>
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform ${showBaseMapSelector ? "rotate-180" : ""
                  }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showBaseMapSelector && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white/50 hover:bg-white border border-gray-300 rounded-lg shadow-xl z-20">
                <div className="p-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">
                    Select Base Map
                  </h3>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(baseMaps).map(([key, baseMap]) => (
                      <button
                        key={key}
                        onClick={() => {
                          changeBaseMap(key);
                          setShowBaseMapSelector(false);
                        }}
                        className={`flex items-center gap-3 w-full p-3 rounded-md text-left transition-colors duration-200 ${selectedBaseMap === key
                          ? "bg-blue-50 border border-blue-200 text-blue-700"
                          : "hover:bg-gray-50 border border-transparent text-gray-700"
                          }`}
                      >
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={baseMap.icon}
                          />
                        </svg>
                        <span className="text-sm font-medium">
                          {baseMap.name}
                        </span>
                        {selectedBaseMap === key && (
                          <svg
                            className="w-4 h-4 text-blue-600 ml-auto"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Layer Panel */}
        {showLayerPanel && (
          <div className="absolute top-2 right-40 bg-white/50 hover:bg-white rounded-lg shadow-xl border border-gray-200 w-80 z-20 cursor-pointer">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Map Layers
                </h3>
                <button
                  onClick={() => setShowLayerPanel(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {/* Water Quality Points */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Water Quality Points
                    </span>
                  </div>
                  <button
                    onClick={toggleWaterQualityPoints}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {isWaterQualityDisplayed ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>

                {/* Stretch Lines */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-1 bg-orange-500"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Stretch Lines
                    </span>
                  </div>
                  <button
                    onClick={toggleStretchLines}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {isStretchLinesDisplayed ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>

                {/* Basin Boundary */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-600 bg-blue-100"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Basin Boundary
                    </span>
                  </div>
                  <button
                    onClick={toggleBasinLayer}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {isBasinDisplayed ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>

                {/* Rivers */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-1 bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Rivers
                    </span>
                  </div>
                  <button
                    onClick={toggleRiverLayer}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {isRiverDisplayed ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>

                {/* River Buffer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border border-yellow-500 bg-yellow-100"></div>
                    <span className="text-sm font-medium text-gray-700">
                      River Buffer
                    </span>
                  </div>
                  <button
                    onClick={toggleRiverBufferLayer}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {isRiverBufferDisplayed ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>

                {currentInterpolationParam && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-red-500"></div>
                      <span className="text-sm font-medium text-gray-700">
                        {currentInterpolationParam} Interpolation
                      </span>
                    </div>
                    <button
                      onClick={toggleInterpolationLayer}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {isInterpolationDisplayed ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {legendData && (
          <SimpleLegend
            min={legendData.min}
            max={legendData.max}
            mean={legendData.mean}
            parameter={legendData.parameter}
            isVisible={isInterpolationDisplayed}
            colors={legendData.colors}
          />
        )}

        {/* Map Controls - Bottom Right */}
        <div
          className={`absolute z-10 flex flex-col gap-2 ${isFullscreen ? "bottom-10 right-4" : "bottom-10 right-4"
            }`}
        >
          {/* Zoom to Selection Button */}
          {(selectedStretches.length > 0 || hasMapLayers) && (
            <button
              onClick={zoomToCurrentExtent}
              className="bg-white/50 hover:bg-white border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
              title="Zoom to Selected Area"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </button>
          )}

          {/* Reset View Button */}
          <button
            onClick={resetView}
            className="bg-white/50 hover:bg-white border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
            title="Reset to Default View"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="bg-white/50 hover:bg-white border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isFullscreen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Opacity Slider Control - Enhanced Version */}
        {isInterpolationDisplayed && (
          <div
            className={`absolute z-10 ${isFullscreen ? "bottom-80 left-2" : "bottom-80 left-2"
              }`}
          >
            <div className="bg-white/50 hover:bg-white border border-gray-300 rounded-lg p-4 shadow-lg min-w-[300px] transition-colors duration-300">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <h4 className="text-sm font-semibold text-gray-700">
                  Layer Opacity
                </h4>
                <span className="text-sm font-medium text-blue-600 ml-auto">
                  {Math.round(interpolationOpacity * 100)}%
                </span>
              </div>

              {/* Slider Section */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={interpolationOpacity}
                    onChange={(e) =>
                      setInterpolationOpacity(parseFloat(e.target.value))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${interpolationOpacity * 100
                        }%, #e5e7eb ${interpolationOpacity * 100
                        }%, #e5e7eb 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coordinates and Scale Display - Bottom Left */}
        {coordinates && (
          <div className="absolute z-10 bg-white/90 border border-gray-300 rounded-lg p-3 shadow-lg bottom-2 left-2">
            <div className="space-y-1 text-xs">
              {/* Coordinates */}
              <div className="flex items-center gap-2">
                <svg
                  className="w-3 h-3 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-gray-700 font-mono">
                  {coordinates.lat.toFixed(6)}, {coordinates.lon.toFixed(6)}
                </span>
              </div>

              {/* Scale */}
              {/* {scale && (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-3 h-3 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-gray-700 font-mono">
                    Scale: {scale}
                  </span>
                </div>
              )} */}
            </div>
          </div>
        )}
        {/* Tooltip Element */}
        <div
          className={`absolute bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-lg p-3 z-50 pointer-events-none transition-opacity duration-200 min-w-[150px] ${tooltipData.visible ? 'opacity-100' : 'opacity-0'}`}
          style={{
            left: tooltipData.left + 15,
            top: tooltipData.top,
            transform: 'translate(0, -50%)',
          }}
        >
          {tooltipData.content}
        </div>
      </div>
    </div>
  );
};

export default StretchMapComponent;
