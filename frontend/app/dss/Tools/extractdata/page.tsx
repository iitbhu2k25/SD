"use client";

import React, { useState, useEffect } from "react";
import WeatherMap from "./weather/components/map";
import { WeatherMapProvider } from "@/contexts/extract/Weather/MapContext";
import { DailyProvider } from "@/contexts/extract/Rainfal/RaifallContext";
import { MapProvider } from "@/contexts/extract/Rainfal/MapContext";
import { RainfallSelector } from "./rainfall/components/selector";
import RainfallMap from "./rainfall/components/map";
import { DailyRainfallTable } from "./rainfall/components/daily";
import { RainfallStatistics } from "./rainfall/components/statistics";
import { WaterLevelMapProvider } from "@/contexts/extract/Waterlevel/MapContext";
import WaterLevelMap from "./waterlevel/components/level";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloudRain,
  Cloud,
  ChevronDown,
  Map as MapIcon,
  BarChart3,
  Waves,
  Globe2,
  Droplet,
  Menu,
  X,
  Calendar,
  TrendingUp,
  AlertCircle,
  Download,
  Settings,
  Bell,
} from "lucide-react";

type MainCategory = "rainfall" | "weather" | "waterlevel" | null;
type RainfallSubCategory = "state" | "district" | "statistics" | "river-basin" | null;
type PeriodType = "daily" | "weekly" | "monthly" | "cumulative";
type RiverBasinDayType = "day1" | "day2" | "day3" | "day4" | "day5" | "day6" | "day7" | "aap";

const RainfallPage = () => {
  // Set initial state to waterlevel instead of null
  const [mainCategory, setMainCategory] = useState<MainCategory>("waterlevel");
  const [rainfallSubCategory, setRainfallSubCategory] = useState<RainfallSubCategory>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("daily");
  const [selectedRiverBasinDay, setSelectedRiverBasinDay] = useState<RiverBasinDayType>("day1");
  const [showRainfallDropdown, setShowRainfallDropdown] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleMainCategoryClick = (category: MainCategory) => {
    if (category === "rainfall") {
      setShowRainfallDropdown(!showRainfallDropdown);
      setMainCategory(category);
    } else {
      setMainCategory(category);
      setShowRainfallDropdown(false);
      setRainfallSubCategory(null);
    }
  };

  const handleRainfallSubCategoryClick = (subCategory: RainfallSubCategory) => {
    setRainfallSubCategory(subCategory);
    setShowRainfallDropdown(false);
  };

  // Category configurations
  const categoryConfig = {
    rainfall: {
      icon: CloudRain,
      color: "blue",
      gradient: "from-blue-500 to-blue-600",
      description: "Real-time rainfall monitoring and analysis"
    },
    weather: {
      icon: Cloud,
      color: "orange",
      gradient: "from-orange-500 to-amber-600",
      description: "Comprehensive weather data and forecasts"
    },
    waterlevel: {
      icon: Droplet,
      color: "cyan",
      gradient: "from-cyan-500 to-blue-600",
      description: "Water level tracking and alerts"
    }
  };

  const renderContent = () => {
    if (mainCategory === "weather") {
      return (
        <WeatherMapProvider>
          <div className="h-full bg-gradient-to-br from-slate-50 to-gray-100 p-6">
            <div className="bg-white rounded-2xl shadow-xl h-full overflow-hidden border border-gray-200">
              <div className="h-full flex flex-col">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Cloud className="w-7 h-7" />
                        Weather Monitoring
                      </h2>
                      <p className="text-orange-100 text-sm mt-1">Live weather data and forecasts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <WeatherMap />
                </div>
              </div>
            </div>
          </div>
        </WeatherMapProvider>
      );
    }

    if (mainCategory === "waterlevel") {
      return (
        <WaterLevelMapProvider>
          <div className=" bg-gradient-to-br from-slate-50 to-gray-100 p-6">
            <div className="bg-white rounded-2xl shadow-xl h-full overflow-hidden border border-gray-200">
              <div className="h-full flex flex-col">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Droplet className="w-7 h-7" />
                        Water Level Monitoring
                      </h2>
                      <p className="text-cyan-100 text-sm mt-1">Track water levels and flood alerts</p>
                    </div>
                 
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <WaterLevelMap />
                </div>
              </div>
            </div>
          </div>
        </WaterLevelMapProvider>
      );
    }

    if (mainCategory === "rainfall") {
      if (rainfallSubCategory === "statistics") {
        return (
          <div className="h-full bg-gradient-to-br from-slate-50 to-gray-100 p-6">
            <div className="bg-white rounded-2xl shadow-xl h-full overflow-hidden border border-gray-200">
              <div className="h-full flex flex-col">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <BarChart3 className="w-7 h-7" />
                        Rainfall Statistics
                      </h2>
                      <p className="text-purple-100 text-sm mt-1">Comprehensive rainfall analysis and trends</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        View Trends
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  <RainfallStatistics />
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (rainfallSubCategory === "river-basin" || rainfallSubCategory === "state" || rainfallSubCategory === "district") {
        const isRiverBasin = rainfallSubCategory === "river-basin";
        
        return (
          <DailyProvider>
            <MapProvider>
              <div className="h-full bg-gradient-to-br from-slate-50 to-gray-100 p-6">
                <div className="grid grid-cols-12 gap-6 h-full">
                  {/* Data Panel */}
                  <div className="col-span-7 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                    <div className="h-full flex flex-col">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                              {isRiverBasin ? <Waves className="w-7 h-7" /> : 
                               rainfallSubCategory === "state" ? <Globe2 className="w-7 h-7" /> : 
                               <MapIcon className="w-7 h-7" />}
                              {rainfallSubCategory === "river-basin" ? "River Basin" :
                               rainfallSubCategory === "state" ? "State-wise" : "District-wise"} Data
                            </h2>
                            <p className="text-blue-100 text-sm mt-1">
                              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} rainfall measurements
                            </p>
                          </div>
                          
                        </div>
                      </div>

                      {/* Selector */}
                      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                        <RainfallSelector
                          forcedCategory={isRiverBasin ? "riverbasin" : rainfallSubCategory}
                          selectedPeriod={selectedPeriod}
                          onPeriodChange={setSelectedPeriod}
                        />
                      </div>

                      {/* Table */}
                      <div className="flex-1 overflow-auto p-6">
                        <DailyRainfallTable />
                      </div>
                    </div>
                  </div>

                  {/* Map Panel */}
                  <div className="col-span-5 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                    <div className="h-full flex flex-col">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                              <MapIcon className="w-6 h-6" />
                              Geographic View
                            </h2>
                            <p className="text-emerald-100 text-xs mt-1">Interactive rainfall map</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <RainfallMap />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </MapProvider>
          </DailyProvider>
        );
      }
    }

    // Fallback - should not reach here since waterlevel is default
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <motion.div
        className={`bg-white border-r border-gray-200 shadow-lg flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-72"
        }`}
        initial={false}
      >
        {/* Logo & Toggle */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-gray-900">DataHub</h1>
              <p className="text-xs text-gray-500 mt-1">Environmental Monitor</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {Object.entries(categoryConfig).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = mainCategory === key;
            
            return (
              <div key={key}>
                <motion.button
                  onClick={() => handleMainCategoryClick(key as MainCategory)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left capitalize">{key}</span>
                      {key === "rainfall" && (
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            showRainfallDropdown ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </>
                  )}
                </motion.button>

                {/* Rainfall Submenu */}
                {key === "rainfall" && !sidebarCollapsed && (
                  <AnimatePresence>
                    {showRainfallDropdown && (
                      <motion.div
                        className="ml-4 mt-2 space-y-1 border-l-2 border-blue-200 pl-4"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <button
                          onClick={() => handleRainfallSubCategoryClick("state")}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            rainfallSubCategory === "state"
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <Globe2 className="w-4 h-4" />
                          State-wise
                        </button>
                        <button
                          onClick={() => handleRainfallSubCategoryClick("district")}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            rainfallSubCategory === "district"
                              ? "bg-green-50 text-green-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <MapIcon className="w-4 h-4" />
                          District-wise
                        </button>
                        {/* <button
                          onClick={() => handleRainfallSubCategoryClick("river-basin")}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            rainfallSubCategory === "river-basin"
                              ? "bg-cyan-50 text-cyan-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <Waves className="w-4 h-4" />
                          River Basi
                        </button> */}
                        <button
                          onClick={() => handleRainfallSubCategoryClick("statistics")}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            rainfallSubCategory === "statistics"
                              ? "bg-purple-50 text-purple-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <BarChart3 className="w-4 h-4" />
                          Statistics
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </nav>

        {/* Period Selector */}
        {!sidebarCollapsed && (rainfallSubCategory === "state" || rainfallSubCategory === "district") && (
          <div className="p-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Time Period</p>
            <div className="grid grid-cols-2 gap-2">
              {["daily", "weekly", "monthly", "cumulative"].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period as PeriodType)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedPeriod === period
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Dashboard</span>
              {mainCategory && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="font-medium text-gray-700 capitalize">{mainCategory}</span>
                </>
              )}
              {rainfallSubCategory && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="font-medium text-gray-700">
                    {rainfallSubCategory === "river-basin" ? "River Basin" : 
                     rainfallSubCategory.charAt(0).toUpperCase() + rainfallSubCategory.slice(1)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default RainfallPage;