"use client";

import React, { useState } from "react";
// Import WeatherMap for the "weather" category
import WeatherMap from "./weather/components/map"; 
// CORRECTED: Path changed from 'weather' to 'Weather' (capital 'W')
import { WeatherMapProvider } from "@/contexts/extract/Weather/MapContext";

// Existing Imports
import { DailyProvider } from "@/contexts/extract/Rainfal/RaifallContext";
import { MapProvider } from "@/contexts/extract/Rainfal/MapContext";
import { RainfallSelector } from "./rainfall/components/selector";
import RainfallMap from "./rainfall/components/map";
import { DailyRainfallTable } from "./rainfall/components/daily";
import { RainfallStatistics } from "./rainfall/components/statistics";
import { motion, AnimatePresence } from "framer-motion";

import { WaterLevelMapProvider } from "@/contexts/extract/Waterlevel/MapContext";
import WaterLevelMap from "./waterlevel/components/level";
import {
  CloudRain,
  Cloud,
  ChevronDown,
  Map as MapIcon,
  BarChart3,
  Waves,
  Globe2,
  Droplet,
} from "lucide-react";



type MainCategory = "rainfall" | "weather" | "waterlevel" | null;
type RainfallSubCategory =
  | "state"
  | "district"
  | "statistics"
  | "river-basin"
  | null;
type PeriodType = "daily" | "weekly" | "monthly" | "cumulative";
type RiverBasinDayType =
  | "day1"
  | "day2"
  | "day3"
  | "day4"
  | "day5"
  | "day6"
  | "day7"
  | "aap";

const RainfallPage = () => {
  const [mainCategory, setMainCategory] = useState<MainCategory>(null);
  const [rainfallSubCategory, setRainfallSubCategory] =
    useState<RainfallSubCategory>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("daily");
  const [selectedRiverBasinDay, setSelectedRiverBasinDay] =
    useState<RiverBasinDayType>("day1");
  const [showRainfallDropdown, setShowRainfallDropdown] = useState(false);

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

  const renderContent = () => {
    // START: Updated 'weather' content to render WeatherMap
    if (mainCategory === "weather") {
      return (
        <WeatherMapProvider>
          <div className="flex items-center justify-center h-full">
            <WeatherMap />
          </div>
        </WeatherMapProvider>
      );
    }
    // END: Updated 'weather' content

    if (mainCategory === "waterlevel") {
      return (
        <WaterLevelMapProvider>
          <div className="flex items-center justify-center h-full">
            <WaterLevelMap />
          </div>
        </WaterLevelMapProvider>
      );
    }


    if (mainCategory === "rainfall") {
      if (rainfallSubCategory === "statistics") {
        return <RainfallStatistics />;
      }

      if (rainfallSubCategory === "river-basin") {
        return (
          <DailyProvider>
            <MapProvider>
              <div className="flex h-full bg-gradient-to-br from-white via-slate-100 to-gray-100">
                <div className="flex-[6] flex flex-col bg-white border-r border-gray-300 shadow-lg overflow-auto">
                  <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                    <RainfallSelector forcedCategory="riverbasin" />
                  </div>
                  <div className="p-4 flex-1 overflow-auto">
                    <DailyRainfallTable />
                  </div>
                </div>
                <div className="flex-[4] rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <RainfallMap />
                </div>
              </div>
            </MapProvider>
          </DailyProvider>
        );
      }

      if (
        rainfallSubCategory === "state" ||
        rainfallSubCategory === "district"
      ) {
       return (
          <DailyProvider>
            <MapProvider>
              <div className="flex h-full bg-gradient-to-br from-white via-slate-100 to-gray-100">
                
                {/* LEFT PANEL */}
                <div className="flex-[6] flex flex-col bg-white border-r border-gray-300 shadow-lg overflow-hidden">
                  
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                    <RainfallSelector
                      forcedCategory={rainfallSubCategory}
                      selectedPeriod={selectedPeriod}
                      onPeriodChange={setSelectedPeriod}
                    />
                  </div>

                  {/* Table Wrapper (NO HYDRATION ERROR HERE) */}
                  <div className="p-4 flex-1 overflow-auto">
                    {/* This will NOT cause hydration issues IF table component is fixed */}
                    <DailyRainfallTable />
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="flex-[4] rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <RainfallMap />
                </div>
              </div>
            </MapProvider>
          </DailyProvider>
        );

      }
    }

    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CloudRain size={80} className="mx-auto mb-6 text-blue-500" />
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Data Extraction Portal
          </h2>
          <p className="text-gray-600 text-lg">
            Select a category from the navigation above to get started
          </p>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-300 shadow-md px-6 py-4 relative">
        <div className="flex items-center gap-4">
          {/* Rainfall Button */}
          <div className="relative">
            <motion.button
              onClick={() => handleMainCategoryClick("rainfall")}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${mainCategory === "rainfall"
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <CloudRain size={20} />
              Rainfall
              <ChevronDown
                size={16}
                className={`transition-transform ${showRainfallDropdown ? "rotate-180" : ""
                  }`}
              />
            </motion.button>
          </div>

          {/* Weather Button */}
          <motion.button
            onClick={() => handleMainCategoryClick("weather")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${mainCategory === "weather"
                ? "bg-orange-500 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Cloud size={20} />
            Weather
          </motion.button>

          {/* Water Level Button */}
          <motion.button
            onClick={() => handleMainCategoryClick("waterlevel")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${mainCategory === "waterlevel"
                ? "bg-cyan-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Droplet size={20} />
            Water Level
          </motion.button>
        </div>

        {/* Dropdown */}
        <AnimatePresence>
          {showRainfallDropdown && (
            <motion.div
              className="mt-4 flex flex-wrap items-center gap-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4 relative z-10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* State */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRainfallSubCategoryClick("state")}
                  className="flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium"
                >
                  <Globe2 size={18} />
                  State
                </button>
                <div className="flex gap-2">
                  {["daily", "weekly", "monthly", "cumulative"].map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setSelectedPeriod(period as PeriodType);
                        handleRainfallSubCategoryClick("state");
                      }}
                      className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 capitalize"
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* District */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRainfallSubCategoryClick("district")}
                  className="flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-md bg-green-50 hover:bg-green-100 text-green-700 font-medium"
                >
                  <MapIcon size={18} />
                  District
                </button>
                <div className="flex gap-2">
                  {["daily", "weekly", "monthly", "cumulative"].map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setSelectedPeriod(period as PeriodType);
                        handleRainfallSubCategoryClick("district");
                      }}
                      className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 hover:bg-green-200 capitalize"
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* River Basin */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRainfallSubCategoryClick("river-basin")}
                  className="flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-md bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium"
                >
                  <Waves size={18} />
                  River Basin
                </button>
                <div className="flex gap-2">
                  {[
                    "day1",
                    "day2",
                    "day3",
                    "day4",
                    "day5",
                    "day6",
                    "day7",
                    "aap",
                  ].map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedRiverBasinDay(day as RiverBasinDayType);
                        handleRainfallSubCategoryClick("river-basin");
                      }}
                      className="px-2 py-1 text-xs rounded-full bg-cyan-100 text-cyan-700 hover:bg-cyan-200 capitalize"
                    >
                      {day === "aap"
                        ? "Actual Accumulated Precipitation(Observed Value)"
                        : day.replace("day", "Day")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Statistics */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRainfallSubCategoryClick("statistics")}
                  className="flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium"
                >
                  <BarChart3 size={18} />
                  Rainfall Statistics
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breadcrumb */}
        {mainCategory && (
          <motion.div
            className="mt-4 text-sm text-gray-600 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="capitalize font-medium">{mainCategory}</span>
            {rainfallSubCategory && (
              <>
                <span>/</span>
                <span className="capitalize">
                  {rainfallSubCategory === "river-basin"
                    ? "River Basin"
                    : rainfallSubCategory}
                </span>
                {(rainfallSubCategory === "state" ||
                  rainfallSubCategory === "district") && (
                    <>
                      <span>/</span>
                      <span className="capitalize">{selectedPeriod}</span>
                    </>
                  )}
                {rainfallSubCategory === "river-basin" && (
                  <>
                    <span>/</span>
                    <span className="uppercase">
                      {selectedRiverBasinDay === "aap"
                        ? "Actual Accumulated Precipitation"
                        : selectedRiverBasinDay.replace("day", "Day ")}
                    </span>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  );
};

export default RainfallPage;