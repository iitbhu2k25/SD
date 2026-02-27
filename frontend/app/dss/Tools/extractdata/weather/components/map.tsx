// components/weather/components/map.tsx
"use client";
import { useWeatherMap } from "@/contexts/extract/Weather/MapContext";
import { useState } from "react";
import Select from "react-select";
import { Layers, MapPin, X } from "lucide-react";

const WeatherMap = () => {
  const { 
    mapRef, 
    isLoading, 
    isSatellite, 
    toggleBaseMap,
    weatherData,
    isLoadingWeather,
    selectedStation,
    closeWeatherPanel,
    states,
    selectedStateCode,
    setSelectedStateCode,
    districts,
    selectedDistrictCode,
    setSelectedDistrictCode,
    map,
  } = useWeatherMap();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => {
    map?.getView().animate({ zoom: (map.getView().getZoom() || 0) + 1, duration: 250 });
  };

  const handleZoomOut = () => {
    map?.getView().animate({ zoom: (map.getView().getZoom() || 0) - 1, duration: 250 });
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('weather-map-container');
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const realisticSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: "42px",
      borderRadius: "10px",
      borderColor: state.isFocused ? "#f97316" : "#d1d5db",
      boxShadow: state.isFocused
        ? "0 0 0 3px rgba(249,115,22,0.25)"
        : "none",
      transition: "all 0.2s ease",
      "&:hover": { borderColor: "#f97316" }
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
        ? "#f97316"
        : state.isFocused
          ? "#ffedd5"
          : "white",
      color: state.isSelected ? "white" : "#111827",
      cursor: "pointer"
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "#9ca3af"
    })
  };

  return (
    <div id="weather-map-container" className="w-full h-full relative flex">
      {/* Left Filter Panel */}
      <div className="w-80 bg-white shadow-2xl flex flex-col border-r border-gray-200">
        {/* Panel Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-4">
          <div className="flex items-center gap-2">
            <MapPin size={24} />
            <h2 className="font-bold text-lg">Location Filters</h2>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Geographic Filters */}
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
                instanceId="weather-state-select"
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
                instanceId="weather-district-select"
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
          </div>

          {/* Info Box */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MapPin className="text-orange-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-orange-900 mb-1">How to Use</h4>
                <p className="text-xs text-orange-800">
                  Select a state and optionally a district to filter weather stations. 
                  Click on any weather station marker on the map to view detailed weather information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div 
          ref={mapRef} 
          className="w-full h-full"
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
            <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-gray-700">Loading Map</span>
            </div>
          </div>
        )}

        {/* Map Controls - Top Right */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={toggleBaseMap}
            className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition"
            disabled={!map}
            title={isSatellite ? "Switch to Street Map" : "Switch to Satellite"}
          >
            {isSatellite ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button 
            onClick={handleZoomIn} 
            className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition" 
            disabled={!map}
            title="Zoom In"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button 
            onClick={handleZoomOut} 
            className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition" 
            disabled={!map}
            title="Zoom Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>

        {/* Fullscreen Button - Bottom Right */}
        <div className="absolute bottom-4 right-4 z-20">
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Weather Info Sidebar */}
      {(weatherData || isLoadingWeather) && (
        <div className="w-96 bg-gradient-to-br from-white via-gray-200 to-gray-400 border-l border-gray-300 shadow-lg overflow-y-auto">
          <div className="p-6">
            {/* Close Button */}
            <button
              onClick={closeWeatherPanel}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close weather panel"
            >
              <X size={20} />
            </button>

            {isLoadingWeather ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-gray-600">Loading weather data...</span>
                </div>
              </div>
            ) : weatherData ? (
              <div className="space-y-4">
                {/* Location Header */}
                <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-2xl font-bold text-gray-800">{weatherData.locationName}</h2>
                  <p className="text-sm text-gray-500 mt-1">Station ID: {selectedStation}</p>
                </div>

                {/* Weather Condition */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🌫️</div>
                    <div>
                      <p className="text-sm text-gray-600">Current Weather</p>
                      <p className="text-lg font-semibold text-gray-800 capitalize">{weatherData.weather}</p>
                    </div>
                  </div>
                </div>

                {/* Temperature */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🌡️</span>
                      <p className="text-xs text-gray-600">Temperature</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{weatherData.temperature}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🌡️</span>
                      <p className="text-xs text-gray-600">Feels Like</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{weatherData.feelsLike}</p>
                  </div>
                </div>

                {/* Humidity & Wind */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-cyan-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💧</span>
                      <span className="text-sm font-medium text-gray-700">Humidity</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{weatherData.humidity}</span>
                  </div>
                  <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💨</span>
                      <span className="text-sm font-medium text-gray-700">Wind</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{weatherData.wind}</span>
                  </div>
                </div>

                {/* Observation Time */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🕐</span>
                    <div>
                      <p className="text-xs text-gray-600">Observation Time</p>
                      <p className="text-sm font-medium text-gray-800">{weatherData.observationTime}</p>
                    </div>
                  </div>
                </div>

                {/* Sun & Moon Times */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Sun & Moon</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌅</span>
                        <p className="text-xs text-gray-600">Sunrise</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{weatherData.sunrise}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌇</span>
                        <p className="text-xs text-gray-600">Sunset</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{weatherData.sunset}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌙</span>
                        <p className="text-xs text-gray-600">Moonrise</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{weatherData.moonrise}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌑</span>
                        <p className="text-xs text-gray-600">Moonset</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{weatherData.moonset}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-500">Failed to load weather data</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherMap;