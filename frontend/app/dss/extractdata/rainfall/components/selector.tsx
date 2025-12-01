"use client";

import React, { useContext, useEffect, useState } from "react";
import { DailyContext } from "@/contexts/extract/Rainfal/RaifallContext";
import { useMapContext } from "@/contexts/extract/Rainfal/MapContext";
import { motion } from "framer-motion";
import { Droplets, MapPin, Calendar } from "lucide-react";

interface RainfallSelectorProps {
  forcedCategory?: "state" | "district" | "riverbasin";
  selectedPeriod?: "daily" | "weekly" | "monthly" | "cumulative";
  onPeriodChange?: (period: "daily" | "weekly" | "monthly" | "cumulative") => void;
}

export const RainfallSelector: React.FC<RainfallSelectorProps> = ({
  forcedCategory,
  selectedPeriod,
  onPeriodChange,
}) => {
  const dailyCtx = useContext(DailyContext);
  const mapCtx = useMapContext();

  if (!dailyCtx) throw new Error("RainfallSelector must be inside DailyProvider");
  if (!mapCtx) throw new Error("RainfallSelector must be inside MapProvider");

  const { period, setPeriod, category, setCategory, riverBasinDay, setRiverBasinDay, rainfallData } = dailyCtx;
  const { setSelectedDistrict } = mapCtx;

  const [selectedDistrictValue, setSelectedDistrictValue] = useState<string | undefined>(undefined);

  // Extract unique districts from data
  const districts = rainfallData
    ? Array.from(new Set(rainfallData.features.map((f) => f.properties.district).filter(Boolean))).sort()
    : [];

  // Sync forced category from parent
  useEffect(() => {
    if (forcedCategory) {
      setCategory(forcedCategory);
    }
  }, [forcedCategory, setCategory]);

  // Sync period from parent
  useEffect(() => {
    if (selectedPeriod) {
      setPeriod(selectedPeriod);
    }
  }, [selectedPeriod, setPeriod]);

  // Initialize district selection
  useEffect(() => {
    if (category === "district" && districts.length > 0 && !selectedDistrictValue) {
      setSelectedDistrictValue(districts[0]);
    }
  }, [districts, selectedDistrictValue, category]);

  // Sync to map context for district only
  useEffect(() => {
    if (category === "district" && selectedDistrictValue) {
      setSelectedDistrict(selectedDistrictValue);
    }
  }, [category, selectedDistrictValue, setSelectedDistrict]);

  const handlePeriodChange = (newPeriod: "daily" | "weekly" | "monthly" | "cumulative") => {
    setPeriod(newPeriod);
    if (onPeriodChange) {
      onPeriodChange(newPeriod);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-4 p-5 bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200 hover:shadow-2xl transition-all duration-500"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
        <Droplets className="text-blue-500" size={22} />
        Rainfall Selection
      </h2>

      <div className="flex flex-col gap-4">
        {/* Category Display (Read-only when forced) */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-xl border border-purple-200 shadow-sm"
        >
          <div className="flex items-center gap-2 text-purple-800 font-medium">
            <MapPin size={18} />
            <span>Category</span>
          </div>
          <div className="bg-white border border-purple-300 text-purple-800 rounded-lg px-4 py-1 font-semibold capitalize">
            {category === 'riverbasin' ? 'River Basin' : category}
          </div>
        </motion.div>

        {/* Period Display (for state/district only) */}
        {category !== 'riverbasin' && !onPeriodChange && (
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200 shadow-sm"
          >
            <div className="flex items-center gap-2 text-blue-800 font-medium">
              <Droplets size={18} />
              <span>Rainfall Period</span>
            </div>
            <div className="bg-white border border-blue-300 text-blue-800 rounded-lg px-4 py-1 font-semibold capitalize">
              {period}
            </div>
          </motion.div>
        )}

        {/* River Basin Day Selector */}
        {category === 'riverbasin' && (
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between bg-gradient-to-r from-teal-50 to-teal-100 p-3 rounded-xl border border-teal-200 shadow-sm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-2 text-teal-800 font-medium">
              <Calendar size={18} />
              <span>Forecast Day</span>
            </div>
            <select
              value={riverBasinDay}
              onChange={(e) => setRiverBasinDay(e.target.value as any)}
              className="bg-white border border-teal-300 text-teal-800 rounded-lg px-3 py-1 focus:ring-2 focus:ring-teal-400 focus:outline-none transition"
            >
              <option value="day1">Day 1</option>
              <option value="day2">Day 2</option>
              <option value="day3">Day 3</option>
              <option value="day4">Day 4</option>
              <option value="day5">Day 5</option>
              <option value="day6">Day 6</option>
              <option value="day7">Day 7</option>
              <option value="Actual Accumulated Precipitation">Actual Accumulated Precipitation(Observed Value)</option>
            </select>
          </motion.div>
        )}

        {/* District Selector (shown when category is 'district') */}
        {category === "district" && districts.length > 0 && (
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-amber-100 p-3 rounded-xl border border-amber-200 shadow-sm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-2 text-amber-800 font-medium">
              <MapPin size={18} />
              <span>District</span>
            </div>
            <select
              value={selectedDistrictValue || ""}
              onChange={(e) => setSelectedDistrictValue(e.target.value)}
              className="bg-white border border-amber-300 text-amber-800 rounded-lg px-3 py-1 focus:ring-2 focus:ring-amber-400 focus:outline-none transition"
            >
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};