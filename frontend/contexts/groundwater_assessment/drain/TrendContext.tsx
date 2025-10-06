"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useMap } from "@/contexts/groundwater_assessment/drain/MapContext";
import { useLocation } from "./LocationContext";
import { useWell } from "./WellContext";

interface TrendSummaryStats {
  statistical_summary: any;
  file_info: {
    total_villages: number;
    analysis_date: string;
    analysis_timestamp: string;
    filtered_by_subdis_cod: number[];
    filtered_by_village_codes: number[];
    wells_csv_filename: string;
    trend_csv_filename: string;
    timeseries_yearly_csv_filename: string;
    timeseries_seasonal_csv_filename: string;
    trend_map_filename: string;
    trend_map_base64: string; // NEW: Base64 encoded map image
  };
  trend_distribution: {
    increasing: number;
    decreasing: number;
    no_trend: number;
    insufficient_data: number;
    total: number;
  };
}

interface VillageFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    Village_ID: string;
    Village_Name: string;
    Block: string;
    District: string;
    SUBDIS_COD: string;
    Mann_Kendall_Tau: number | null;
    P_Value: number | null;
    Trend_Status: string;
    Sen_Slope: number | null;
    Data_Points: number;
    Years_Analyzed: string;
    Mean_Depth: number | null;
    Color: string;
    time_series: Record<string, number | null>;
    bounds: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  };
}

interface VillageGeoJSON {
  type: 'FeatureCollection';
  features: VillageFeature[];
  crs: {
    type: string;
    properties: {
      name: string;
    };
  };
}

interface VillageData {
  Village_ID: string;
  Village_Name: string;
  Block: string;
  District: string;
  SUBDIS_COD: string;
  Mann_Kendall_Tau: number | null;
  P_Value: number | null;
  Trend_Status: string;
  Sen_Slope: number | null;
  Data_Points: number;
  Years_Analyzed: string;
  Start_Year: number;
  End_Year: number;
  Mean_Depth: number | null;
  Std_Depth: number | null;
  Min_Depth: number | null;
  Max_Depth: number | null;
  Total_Years_Available: number;
  All_Years_Available: string;
  Color: string;
}

interface TrendData {
  success: boolean;
  summary_stats: TrendSummaryStats;
  village_geojson: VillageGeoJSON;
  villages: VillageData[];
  charts: Record<string, string>; // base64 encoded charts
  summary_tables: Record<string, any[]>;
  color_mapping: Record<string, {
    color: string;
    description: string;
  }>;
  total_villages: number;
  analysis_timestamp: string;
  filtered_by_subdis_cod: number[];
  filtered_by_village_codes: number[];
  trend_map_filename: string;
  trend_map_base64: string; // NEW: Base64 encoded map image
}

interface GroundwaterTrendContextType {
  trendData: TrendData | null;
  trendMethod: string;
  yearStart: string;
  yearEnd: string;
  returnType: string;
  isLoading: boolean;
  error: string | null;
  
  // Map image functionality
  trendMapFilename: string | null;
  trendMapBase64: string | null; // NEW: Base64 data
  getTrendMapUrl: () => string | null;
  
  setTrendMethod: (value: string) => void;
  setYearStart: (value: string) => void;
  setYearEnd: (value: string) => void;
  setReturnType: (value: string) => void;
  handleGenerate: () => Promise<void>;
  clearTrendData: () => void;
  resetForm: () => void;
  availableCharts: string[];
  getChartImage: (chartKey: string) => string | null;
}

interface GroundwaterTrendProviderProps {
  children: ReactNode;
  activeTab: string;
  onTrendData?: (data: TrendData) => void;
}

export const GroundwaterTrendContext = createContext<GroundwaterTrendContextType>({
  trendData: null,
  trendMethod: "",
  yearStart: "",
  yearEnd: "",
  returnType: "all",
  isLoading: false,
  error: null,
  
  // Map image defaults
  trendMapFilename: null,
  trendMapBase64: null,
  getTrendMapUrl: () => null,
  
  setTrendMethod: () => { },
  setYearStart: () => { },
  setYearEnd: () => { },
  setReturnType: () => { },
  handleGenerate: async () => { },
  clearTrendData: () => { },
  resetForm: () => { },
  availableCharts: [],
  getChartImage: () => null,
});

export const GroundwaterTrendProvider = ({
  children,
  activeTab,
  onTrendData = () => { },
}: GroundwaterTrendProviderProps) => {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [trendMethod, setTrendMethod] = useState<string>("mann_kendall");
  const [yearStart, setYearStart] = useState<string>("");
  const [yearEnd, setYearEnd] = useState<string>("");
  const [returnType, setReturnType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Map image state
  const [trendMapFilename, setTrendMapFilename] = useState<string | null>(null);
  const [trendMapBase64, setTrendMapBase64] = useState<string | null>(null);

  // Get map context for adding trend layer
  const { addTrendLayer, removeTrendLayer, setLegendData } = useMap();

  // Get location context for village codes
  const { selectedVillages, areaConfirmed } = useLocation();

  // Get well context for csvFilename
  const { csvFilename } = useWell();

  // Helper function to get full map image URL (fallback if needed)
  const getTrendMapUrl = (): string | null => {
    if (!trendMapFilename) return null;
    return `/django/media/temp/${trendMapFilename}`;
  };

  // Clear data when tab changes
  useEffect(() => {
    if (activeTab !== "groundwater-trend") {
      clearTrendData();
    }
  }, [activeTab]);

  const clearTrendData = () => {
    setTrendData(null);
    setError(null);
    setTrendMapFilename(null);
    setTrendMapBase64(null);
    removeTrendLayer();
    setLegendData((prev: any) => ({
      ...prev,
      trend: undefined,
    }));
  };

  const resetForm = () => {
    setTrendMethod("mann_kendall");
    setYearStart("");
    setYearEnd("");
    setReturnType("all");
    clearTrendData();
  };

  const getChartImage = (chartKey: string): string | null => {
    if (!trendData || !trendData.charts || !trendData.charts[chartKey]) {
      return null;
    }
    return `data:image/png;base64,${trendData.charts[chartKey]}`;
  };

  const availableCharts = trendData ? Object.keys(trendData.charts || {}) : [];

  const handleGenerate = async () => {
    if (!trendMethod || !yearStart || !yearEnd) {
      alert("Please fill all required fields: Trend Method, Start Year, and End Year.");
      return;
    }

    if (!areaConfirmed) {
      alert("Please confirm the area selection in Step 1 before generating the trend.");
      return;
    }

    if (selectedVillages.length === 0) {
      alert("No villages selected. Please select at least one village.");
      return;
    }

    if (!csvFilename) {
      alert("No wells data found. Please complete Step 2 (Well Selection) first.");
      return;
    }

    const startYearNum = parseInt(yearStart);
    const endYearNum = parseInt(yearEnd);

    if (isNaN(startYearNum) || isNaN(endYearNum)) {
      alert("Please enter valid years.");
      return;
    }

    if (startYearNum >= endYearNum) {
      alert("Start Year must be less than End Year.");
      return;
    }

    if (endYearNum - startYearNum < 2) {
      alert("Analysis period must be at least 3 years for meaningful trend detection.");
      return;
    }

    // Prepare payload with village_codes (matching API expectations)
    const payload = {
      wells_csv_filename: csvFilename,
      trend_years: Array.from({ length: endYearNum - startYearNum + 1 }, (_, i) => String(startYearNum + i)),
      village_codes: selectedVillages,
      return_type: returnType,
    };

    try {
      setIsLoading(true);
      setError(null);
      setTrendData(null);
      setTrendMapFilename(null);
      setTrendMapBase64(null);
      removeTrendLayer();

      console.log("Sending trend analysis request:", payload);

      const response = await fetch("/django/gwa/trends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Failed to generate trend analysis: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = `Server error: ${errorData.error}`;
          }
        } catch (parseError) {
          console.log("Could not parse error response as JSON:", parseError);
        }
        throw new Error(errorMessage);
      }

      const data: TrendData = await response.json();
      console.log("Trend analysis data received successfully:", data);

      // Log CSV filenames
      console.log("Trend CSV Filename:", data.summary_stats.file_info.trend_csv_filename);
      console.log("Yearly Timeseries CSV Filename:", data.summary_stats.file_info.timeseries_yearly_csv_filename);
      console.log("Seasonal Timeseries CSV Filename:", data.summary_stats.file_info.timeseries_seasonal_csv_filename);
      
      // Handle trend map filename and base64 data
      const mapFilename = data.trend_map_filename || data.summary_stats?.file_info?.trend_map_filename;
      const mapBase64 = data.trend_map_base64 || data.summary_stats?.file_info?.trend_map_base64;
      
      if (mapFilename) {
        setTrendMapFilename(mapFilename);
        console.log("✅ Trend Map Image Generated:", mapFilename);
      }
      
      if (mapBase64) {
        setTrendMapBase64(mapBase64);
        console.log("✅ Trend Map Base64 Data Available");
      } else {
        console.log("⚠️ No trend map base64 data available");
      }

      if (!data || typeof data !== "object" || !data.success) {
        throw new Error("Invalid response data received from server");
      }

      setTrendData(data);
      onTrendData(data);

      if (data.village_geojson?.features?.length > 0) {
        addTrendLayer({
          ...data.village_geojson,
          features: data.village_geojson.features.map(feature => ({
            ...feature,
            properties: {
              ...feature.properties,
              trend_color: feature.properties.Color,
              village_name: feature.properties.Village_Name,
              trend: feature.properties.Trend_Status,
              tau: feature.properties.Mann_Kendall_Tau,
              p_value: feature.properties.P_Value,
              mean_value: feature.properties.Mean_Depth,
              data_points: feature.properties.Data_Points,
              years_range: feature.properties.Years_Analyzed,
              subdis_name: feature.properties.Block,
              district_name: feature.properties.District,
              yearly_values: feature.properties.time_series,
            }
          }))
        });
      }

      setLegendData((prev: any) => ({
        ...prev,
        trend: {
          totalVillages: data.summary_stats?.trend_distribution?.total || 0,
          increasing: data.summary_stats?.trend_distribution?.increasing || 0,
          decreasing: data.summary_stats?.trend_distribution?.decreasing || 0,
          noTrend: data.summary_stats?.trend_distribution?.no_trend || 0,
          insufficientData: data.summary_stats?.trend_distribution?.insufficient_data || 0,
          method: trendMethod,
          period: `${yearStart}-${yearEnd}`,
          analysisDate: data.summary_stats?.file_info?.analysis_date || new Date().toLocaleDateString(),
          colorMapping: data.color_mapping,
          filteredVillages: selectedVillages,
          // CSV filenames for easy access
          csvFiles: {
            trend: data.summary_stats?.file_info?.trend_csv_filename,
            yearly: data.summary_stats?.file_info?.timeseries_yearly_csv_filename,
            seasonal: data.summary_stats?.file_info?.timeseries_seasonal_csv_filename,
          },
          // Map image info
          mapImage: {
            filename: mapFilename,
            url: getTrendMapUrl(),
            base64: mapBase64,
          },
        },
      }));

      console.log("✅ Trend analysis completed successfully!");
      console.log(`📊 Analyzed ${data.total_villages} villages`);
      console.log(`📈 Trends: ${data.summary_stats.trend_distribution.increasing} increasing, ${data.summary_stats.trend_distribution.decreasing} decreasing, ${data.summary_stats.trend_distribution.no_trend} no trend`);
      console.log(`📁 Generated 3 CSV files: 1 trend analysis + 1 yearly time series + 1 seasonal time series`);
      console.log(`🗺️ Generated trend map: ${mapFilename || 'none'} ${mapBase64 ? '(with base64 data)' : '(no base64 data)'}`);

    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred during trend analysis";
      setError(errorMessage);
      setTrendData(null);
      setTrendMapFilename(null);
      setTrendMapBase64(null);
      removeTrendLayer();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GroundwaterTrendContext.Provider
      value={{
        trendData,
        trendMethod,
        yearStart,
        yearEnd,
        returnType,
        isLoading,
        error,
        
        // Map image functionality
        trendMapFilename,
        trendMapBase64,
        getTrendMapUrl,
        
        setTrendMethod,
        setYearStart,
        setYearEnd,
        setReturnType,
        handleGenerate,
        clearTrendData,
        resetForm,
        availableCharts,
        getChartImage,
      }}
    >
      {children}
    </GroundwaterTrendContext.Provider>
  );
};