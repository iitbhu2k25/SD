// components/weather/components/map.tsx
"use client";
import { useWeatherMap } from "@/contexts/extract/Weather/MapContext";

const WeatherMap = () => {
  const { 
    mapRef, 
    isLoading, 
    isSatellite, 
    toggleBaseMap,
    weatherData,
    isLoadingWeather,
    selectedStation,
    closeWeatherPanel
  } = useWeatherMap();

  return (
    <div className="w-full h-full relative flex">
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

        {/* Base map toggle */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 w-32">
            <button
              onClick={toggleBaseMap}
              className="w-full px-3 py-2 text-sm text-gray-700 text-left hover:bg-gray-50 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              {isSatellite ? 'Street Map' : 'Satellite'}
            </button>
          </div>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            {isLoadingWeather ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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