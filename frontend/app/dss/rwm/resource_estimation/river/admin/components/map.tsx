"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { METERS_PER_UNIT } from "ol/proj/Units";
import { toLonLat } from "ol/proj";
import { useMap } from "@/contexts/riverwater_assessment/admin/MapContext";
import { useLocation } from "@/contexts/riverwater_assessment/admin/LocationContext";
import {
  Layers,
  ChevronDown,
  EyeOff,
  AlertCircle,
  Loader2,
  Eye,
} from "lucide-react";
import SimpleLegend from "../../drain/components/legend";

type BaseMapDefinition = {
  name: string;
  icon: string;
};

type BaseLayersConfig = {
  osm: BaseMapDefinition;
  satellite: BaseMapDefinition;
  terrain: BaseMapDefinition;
  topo: BaseMapDefinition;
  cartoLight: BaseMapDefinition;
} & Record<string, BaseMapDefinition>;

const baseLayersConfig: BaseLayersConfig = {
  osm: {
    name: "OpenStreetMap",
    icon: "M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146",
  },
  satellite: {
    name: "Satellite",
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  terrain: {
    name: "Stamen Terrain",
    icon: "M14 11l4-8H6l4 8H6l6 10 6-10h-4z",
  },
  topo: {
    name: "Topographic",
    icon: "M7 14l5-5 5 5",
  },
  cartoLight: {
    name: "Carto Light",
    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  },
};

const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const basemapPanelRef = useRef<HTMLDivElement>(null);
  const riverPanelRef = useRef<HTMLDivElement>(null);

  // Use MapContext
  const {
    mapInstance,
    selectedBaseMap,
    setMapContainer,
    changeBaseMap,
    zoomToCurrentExtent,
    fetchedData,
    isDataLoading,
    dataError,
    addRiverLayers,
    removeRiverLayers,
    isWaterQualityDisplayed,
    toggleWaterQualityPoints,
    isInterpolationDisplayed,
    isInterpolationLoading,
    interpolationError,
    toggleInterpolationLayer,
    addInterpolationLayer, // ADD THIS
    removeInterpolationLayer,
    addRasterLayer,
    removeRasterLayer,
    legendData,
    currentInterpolationParam,
    attributeMapping,
    interpolationOpacity,
    setInterpolationOpacity,
    isSubDistrictDisplayed,
    toggleSubDistrictLayer,
    isRiverDisplayed,
    toggleRiverLayer,
    isRiverBufferDisplayed,
    toggleRiverBufferLayer,
    isInterpolationVisible,
    hideShowInterpolationLayer,
  } = useMap();

  // Use LocationContext
  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    areaConfirmed,
    waterQualityData,
    selectedSeason,
  } = useLocation();

  // UI State
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState<boolean>(false);
  const [isRiverPanelOpen, setIsRiverPanelOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [scale, setScale] = useState<string>("");
  const [riverLayersVisible, setRiverLayersVisible] = useState<boolean>(true);
  const interpolationPanelRef = useRef<HTMLDivElement>(null);
  const [isInterpolationPanelOpen, setIsInterpolationPanelOpen] =
    useState<boolean>(false);

  const [selectedRasterParam, setSelectedRasterParam] = useState<string | null>(
    null
  );
  const [isLoadingRaster, setIsLoadingRaster] = useState(false);
  const [rasterError, setRasterError] = useState<string | null>(null);

  const [selectedDropdownParam, setSelectedDropdownParam] =
    useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Handle basemap panel
      if (
        basemapPanelRef.current &&
        !basemapPanelRef.current.contains(event.target as Node)
      ) {
        setIsBasemapPanelOpen(false);
      }

      // Handle river panel
      if (
        riverPanelRef.current &&
        !riverPanelRef.current.contains(event.target as Node)
      ) {
        setIsRiverPanelOpen(false);
      }

      // Handle interpolation panel
      if (
        interpolationPanelRef.current &&
        !interpolationPanelRef.current.contains(event.target as Node)
      ) {
        setIsInterpolationPanelOpen(false);
      }

      // Handle raster dropdown
      if (showDropdown && !target.closest(".relative")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]); // Only depend on showDropdown

  // Initialize map container
  useEffect(() => {
    if (mapRef.current) {
      setMapContainer(mapRef.current);
    }
    return () => setMapContainer(null);
  }, [setMapContainer]);

  // Mouse move handler for coordinates and scale
  useEffect(() => {
    if (!mapInstance) return;

    const handlePointerMove = (event: any) => {
      const coordinate = mapInstance.getEventCoordinate(event.originalEvent);
      if (coordinate) {
        const lonLat = toLonLat(coordinate);
        setCoordinates({
          lon: parseFloat(lonLat[0].toFixed(6)),
          lat: parseFloat(lonLat[1].toFixed(6)),
        });
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
  }, [mapInstance]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleBaseMapChange = (baseMapKey: string) => {
    changeBaseMap(baseMapKey);
    setIsBasemapPanelOpen(false);
  };

  const toggleFullscreen = async () => {
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
  };

  const resetView = () => {
    if (mapInstance) {
      const view = mapInstance.getView();
      const indiaCenter = [8659909.656851843, 2757043.7269756533]; // Pre-transformed center for India
      view.animate({
        center: indiaCenter,
        zoom: 5,
        duration: 1000,
      });
    }
  };

  const toggleRiverLayers = () => {
    if (riverLayersVisible) {
      removeRiverLayers();
    } else {
      addRiverLayers();
    }
    setRiverLayersVisible(!riverLayersVisible);
  };

  const hasRiverData = fetchedData.riverData || fetchedData.riverBufferData;
  const hasWaterQualityData =
    Array.isArray(waterQualityData) && waterQualityData.length > 0;

  const handleGenerateInterpolation = () => {
    if (selectedDropdownParam) {
      toggleInterpolationLayer(
        selectedDropdownParam,
        "subdistbased", // Using default analysis type
        selectedSeason || "premonsoon" // Using selectedSeason from LocationContext
      );
    }
    setIsInterpolationPanelOpen(false);
  };

  // Handle raster parameter selection
  const handleRasterParameterSelect = async (parameterKey: string) => {
    if (!areaConfirmed || selectedSubDistricts.length === 0) {
      setRasterError(
        "Please confirm area selection and select subdistricts first"
      );
      return;
    }

    setIsLoadingRaster(true);
    setRasterError(null);
    setSelectedDropdownParam(parameterKey);
    setShowDropdown(false);

    try {
      if (isInterpolationDisplayed) {
        console.log("Removing existing interpolation layer");
        removeInterpolationLayer();
      }
      // Your GeoServer URL - adjust this to match your setup
      const geoserverUrl =
        `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/myworkspace/wfs`;

      // You can also add color scheme configuration here
      const colorScheme = {
        parameter: parameterKey,
        colors: ["#blue", "#green", "#yellow", "#orange", "#red"], // Default colors
        labels: ["Low", "Medium-Low", "Medium", "Medium-High", "High"],
        classes: 5,
      };

      toggleInterpolationLayer(
        parameterKey,
        "subdistbased",
        selectedSeason || "premonsoon"
      );
      console.log(`Raster layer added for ${parameterKey}`);
    } catch (error) {
      console.log("Error adding raster layer:", error);
      setRasterError(`Failed to load ${parameterKey} raster layer`);
    } finally {
      setIsLoadingRaster(false);
    }
  };

  // Handle removing raster layer
  const handleRemoveRaster = () => {
    removeRasterLayer();
    setSelectedRasterParam(null);
    setRasterError(null);
  };

  return (
    <>
      <div
        className={`relative ${
          isFullscreen ? "fixed inset-0 z-50" : "w-full h-full"
        }`}
      >
        <div
          className="relative w-full h-full rounded-lg overflow-hidden border border-gray-300"
          ref={mapRef}
        >
          {/* Simple Parameter Dropdown - Top Left - Updated for fullscreen */}
          <div
            className={`absolute z-[10] flex gap-2 ${
              isFullscreen ? "top-2 left-10" : "top-2 left-10"
            }`}
          >
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={!areaConfirmed || selectedSubDistricts.length === 0}
                className={`min-w-[250px] p-3 text-left rounded-lg border bg-white shadow-lg transition-all duration-200 flex items-center justify-between ${
                  !areaConfirmed || selectedSubDistricts.length === 0
                    ? "opacity-50 cursor-not-allowed bg-gray-50"
                    : "cursor-pointer hover:bg-gray-50"
                } ${showDropdown ? "border-blue-300" : "border-gray-200"}`}
              >
                <span className="text-sm">
                  {selectedDropdownParam || "Select Parameter"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    showDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Options */}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                  {Object.keys(attributeMapping).map((paramKey) => (
                    <button
                      key={paramKey}
                      onClick={() => handleRasterParameterSelect(paramKey)}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        selectedDropdownParam === paramKey
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      <div className="font-medium text-sm">{paramKey}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Layer Controls Button */}
            <button
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg shadow-lg border border-gray-200 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Layers size={16} />
              <span className="font-medium">Layers</span>
            </button>
          </div>

          {/* Loading Overlay */}
          {isDataLoading && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-700 font-medium">
                  Loading river data...
                </span>
              </div>
            </div>
          )}

          {isInterpolationLoading && (
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
                    <span className="font-medium text-green-600">
                      {selectedDropdownParam || currentInterpolationParam}
                    </span>{" "}
                    data
                  </p>
                  <p className="text-gray-500 text-sm">
                    Season:{" "}
                    <span className="capitalize font-medium">
                      {selectedSeason}
                    </span>{" "}
                    • Areas: {selectedSubDistricts.length} selected
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>This may take 30-60 seconds...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Notification */}
          {dataError && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md">
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

          {/* Interpolation Control Panel */}
          {areaConfirmed &&
            selectedSubDistricts.length > 0 &&
            hasWaterQualityData && (
              <div
                className={`absolute z-10 ${
                  isFullscreen ? "top-20 left-4" : "top-20 left-4"
                }`}
                ref={interpolationPanelRef}
              >
                <button
                  onClick={() =>
                    setIsInterpolationPanelOpen(!isInterpolationPanelOpen)
                  }
                  className={`bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2 ${
                    isInterpolationDisplayed
                      ? "border-l-4 border-l-green-500"
                      : ""
                  }`}
                  title="Interpolation Controls"
                >
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v4m0 0h-4m4 0l-5-5"
                    />
                  </svg>
                  <span className="text-sm font-medium text-red-700">
                    Interpolation
                  </span>
                  {isInterpolationDisplayed && (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                  <svg
                    className={`w-4 h-4 text-gray-600 transition-transform ${
                      isInterpolationPanelOpen ? "rotate-180" : ""
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

                {isInterpolationPanelOpen && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-xl z-20">
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Generate Interpolation
                      </h3>

                      {isInterpolationLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                          <p className="text-sm text-gray-600 mt-3">
                            Generating interpolation...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Show selected season from Location */}
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-sm font-medium text-gray-700">
                                Season:{" "}
                              </span>
                              <span className="text-sm font-semibold text-blue-700 capitalize">
                                {selectedSeason.replace("monsoon", "-monsoon")}
                              </span>
                            </div>
                          </div>

                          {/* Parameter Selection */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Water Quality Parameter
                            </label>
                            <select
                              value={selectedDropdownParam}
                              onChange={(e) => {
                                setSelectedDropdownParam(e.target.value);
                                setShowDropdown(false);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <option value="">Select Parameter</option>
                              {Object.keys(attributeMapping).map((paramKey) => (
                                <option key={paramKey} value={paramKey}>
                                  {paramKey}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleGenerateInterpolation}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
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
                              Generate
                            </button>

                            {isInterpolationDisplayed && (
                              <button
                                onClick={() => {
                                  removeInterpolationLayer();
                                  setIsInterpolationPanelOpen(false);
                                }}
                                className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {interpolationError && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                              <p className="text-xs text-red-700">
                                {interpolationError}
                              </p>
                            </div>
                          )}

                          {/* Info */}
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                            <p className="text-xs text-gray-600">
                              Interpolation will be generated for the{" "}
                              <strong>{selectedSeason}</strong> season using{" "}
                              <strong>
                                {selectedDropdownParam || "selected parameter"}
                              </strong>{" "}
                              data within the river buffer zones.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Opacity Slider Control - Add this AFTER the Interpolation Control Panel */}
          {isInterpolationDisplayed && (
            <div
              className={`absolute z-[10] ${
                isFullscreen ? "bottom-80 left-2" : "bottom-80 left-2"
              }`}
            >
              <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg min-w-[300px]">
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
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                          interpolationOpacity * 100
                        }%, #e5e7eb ${
                          interpolationOpacity * 100
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

          {/* Basemap Selector */}
          <div
            className={`absolute z-10 ${
              isFullscreen ? "top-2 right-4" : "top-2 right-4"
            }`}
            ref={basemapPanelRef}
          >
            <button
              onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
              className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
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
                  d={baseLayersConfig[selectedBaseMap]?.icon}
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                {baseLayersConfig[selectedBaseMap]?.name}
              </span>
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform ${
                  isBasemapPanelOpen ? "rotate-180" : ""
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

            {isBasemapPanelOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-20">
                <div className="p-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">
                    Select Base Map
                  </h3>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(baseLayersConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleBaseMapChange(key)}
                        className={`flex items-center gap-3 w-full p-3 rounded-md text-left transition-colors duration-200 ${
                          selectedBaseMap === key
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
                            d={config.icon}
                          />
                        </svg>
                        <span className="text-sm font-medium">
                          {config.name}
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

          {/* Layer Panel */}
          {showLayerPanel && (
            <div className="absolute top-2 right-40 bg-white rounded-lg shadow-xl border border-gray-200 w-80 z-20">
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

                  {/* Sub-District Boundaries */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-purple-600 bg-purple-100"></div>
                      <span className="text-sm font-medium text-gray-700">
                        Sub-District Boundaries
                      </span>
                    </div>
                    <button
                      onClick={toggleSubDistrictLayer}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {isSubDistrictDisplayed ? (
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

                  {/* Interpolation Layer */}
                  {isInterpolationDisplayed && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-red-500"></div>
                          <span className="text-sm font-medium text-gray-700">
                            {currentInterpolationParam} Interpolation
                          </span>
                        </div>
                        <button
                          onClick={hideShowInterpolationLayer}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {isInterpolationVisible ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Map Controls */}
          <div
            className={`absolute z-10 flex flex-col gap-2 ${
              isFullscreen ? "bottom-10 right-4" : "bottom-10 right-4"
            }`}
          >
            {/* Zoom to Selection Button */}
            {(selectedState ||
              selectedDistricts.length > 0 ||
              selectedSubDistricts.length > 0 ||
              hasRiverData) && (
              <button
                onClick={zoomToCurrentExtent}
                className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
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
              className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
              title="Reset to India View"
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
              className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
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

          {/* Data Loading Status */}
          {areaConfirmed &&
            selectedSubDistricts.length > 0 &&
            !hasRiverData &&
            !isDataLoading &&
            !dataError && (
              <div className="absolute bottom-20 left-4 z-10">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-yellow-600"
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
                    <span className="text-yellow-800 text-sm">
                      Waiting for river data...
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Coordinates and Scale Display */}
          <div
            className={`absolute z-10 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg p-3 shadow-lg ${
              isFullscreen ? "bottom-2 left-2" : "bottom-2 left-2"
            }`}
          >
            <div className="space-y-1 text-xs">
              {coordinates && (
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
                    {coordinates.lat.toFixed(6)}°, {coordinates.lon.toFixed(6)}°
                  </span>
                </div>
              )}
              {scale && (
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
              )}
            </div>
          </div>

          {legendData && (
            <SimpleLegend
              min={legendData.min ?? 0}
              max={legendData.max ?? 0}
              mean={legendData.mean ?? 0}
              parameter={legendData.parameter ?? ""}
              isVisible={isInterpolationDisplayed}
              colors={legendData.colors}
            />
          )}

          {/* Fullscreen Indicator */}
          {isFullscreen && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                </svg>
                Fullscreen Mode
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MapComponent;
