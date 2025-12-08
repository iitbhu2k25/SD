"use client";

import React, { createContext, useState, useEffect, ReactNode, useContext } from "react";
import { useMap } from "@/contexts/groundwater_assessment/drain/MapContext";
import { useLocation } from "./LocationContext";
import { useWell } from "./WellContext";

interface VillageTimeseriesData {
  village_id: string;
  village_name: string;
  block: string;
  district: string;
  subdis_cod: string;
  trend_status: string;
  color: string;
  mann_kendall_tau: number | null;
  sen_slope: number | null;
  years: string[];
  depths: (number | null)[];
  trend_line: (number | null)[]; // Trend line calculated using Sen's slope
}

interface TrendSummaryStats {
  data_quality: any;
  data_quality_additional: any;
  file_info: {
    total_villages: number;
    analysis_date: string;
    analysis_timestamp: string;
    filtered_by_subdis_cod: number[];
    filtered_by_village_codes: number[];
    subdis_cod_count?: number;
    wells_csv_filename: string;
    trend_csv_filename: string;
    timeseries_yearly_csv_filename: string;
    timeseries_seasonal_csv_filename: string;
    trend_map_filename?: string;
    trend_map_base64?: string; // Base64 encoded trend map
  };
  trend_distribution: {
    increasing: number;
    decreasing: number;
    no_trend: number;
    insufficient_data: number;
    total: number;
  };
  trend_percentages: {
    increasing_percent: number;
    decreasing_percent: number;
    no_trend_percent: number;
    insufficient_data_percent: number;
  };
  statistical_summary: {
    mean_tau: number | null;
    median_tau: number | null;
    mean_sen_slope: number | null;
    median_sen_slope: number | null;
    significant_trends_count: number;
    significant_trends_percent: number;
  };
  analysis_parameters: {
    years_for_trend_analysis: string[];
    total_years_available: string[];
    analysis_year_range: string;
    total_analysis_years: number;
    village_codes_filter: number[];
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
    bounds?: {
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
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
}

interface TrendData {
  success: boolean;
  summary_stats: TrendSummaryStats;
  village_geojson: VillageGeoJSON;
  villages: any[];
  charts: Record<string, string>;
  summary_tables: Record<string, any[]>;
  color_mapping: Record<string, {
    color: string;
    description: string;
    icon?: string;
  }>;
  total_villages: number;
  analysis_timestamp: string;
  filtered_by_subdis_cod: number[];
  filtered_by_village_codes: number[];
  trend_map_filename?: string;
  trend_map_base64?: string;
  village_timeseries_data?: VillageTimeseriesData[];
  all_years?: string[];
}

interface GroundwaterTrendContextType {
  trendData: TrendData | null;
  trendMethod: string;
  yearStart: string;
  yearEnd: string;
  returnType: string;
  isLoading: boolean;
  error: string | null;
  trendMapFilename: string | null;
  trendMapBase64: string | null;
  setTrendMethod: (value: string) => void;
  setYearStart: (value: string) => void;
  setYearEnd: (value: string) => void;
  setReturnType: (value: string) => void;
  handleGenerate: () => Promise<void>;
  clearTrendData: () => void;
  resetForm: () => void;
  availableCharts: string[];
  getChartImage: (chartKey: string) => string | null;
  getTrendMapUrl: () => string | null;
  getTrendMapFilename: () => string | null;
  getTrendMapBase64: () => string | null;
  hasTrendMap: () => boolean;
  villageTimeseriesData: VillageTimeseriesData[];
  allYears: string[];
  getVillageTimeseries: (villageId: string) => VillageTimeseriesData | null;
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
  trendMapFilename: null,
  trendMapBase64: null,
  setTrendMethod: () => { },
  setYearStart: () => { },
  setYearEnd: () => { },
  setReturnType: () => { },
  handleGenerate: async () => { },
  clearTrendData: () => { },
  resetForm: () => { },
  availableCharts: [],
  getChartImage: () => null,
  getTrendMapUrl: () => null,
  getTrendMapFilename: () => null,
  getTrendMapBase64: () => null,
  hasTrendMap: () => false,
  villageTimeseriesData: [],
  allYears: [],
  getVillageTimeseries: () => null,
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
  const [trendMapFilename, setTrendMapFilename] = useState<string | null>(null);
  const [trendMapBase64, setTrendMapBase64] = useState<string | null>(null);

  // Get map context for adding trend layer
  const { addTrendLayer, removeTrendLayer, setLegendData } = useMap();

  // Get location context for village codes
  const { selectedVillages, areaConfirmed } = useLocation();

  // Get well context for csvFilename
  const { csvFilename } = useWell();

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

  const getTrendMapUrl = (): string | null => {
    if (!trendMapFilename) {
      return null;
    }
    return `/django/media/temp/${trendMapFilename}`;
  };

  const getTrendMapFilename = (): string | null => {
    return trendMapFilename;
  };

  // Get base64 directly
  const getTrendMapBase64 = (): string | null => {
    return trendMapBase64;
  };

  const hasTrendMap = (): boolean => {
    return trendMapBase64 !== null && trendMapBase64 !== '';
  };

  const availableCharts = trendData ? Object.keys(trendData.charts || {}) : [];

  // Extract village timeseries data and years
  const villageTimeseriesData = trendData?.village_timeseries_data || [];
  const allYears = trendData?.all_years || [];

  // Method to get timeseries for a specific village
  const getVillageTimeseries = (villageId: string): VillageTimeseriesData | null => {
    if (!villageTimeseriesData || villageTimeseriesData.length === 0) {
      return null;
    }
    const village = villageTimeseriesData.find(v => v.village_id === villageId);
    return village || null;
  };

  const handleGenerate = async () => {
    // Validation logic
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

    // Prepare payload with village_codes
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

      const response = await fetch("/fastm/gwa/trends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Trend API response status:", response.status);

      if (!response.ok) {
        let errorMessage = `Failed to generate trend analysis: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.log("Trend API error response:", errorData);
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

      //  Log village timeseries data with trend_line
      if (data.village_timeseries_data && data.village_timeseries_data.length > 0) {
        console.log("Village Timeseries Data Count:", data.village_timeseries_data.length);
        console.log("Sample Village Timeseries (first village):", {
          village_id: data.village_timeseries_data[0].village_id,
          village_name: data.village_timeseries_data[0].village_name,
          years: data.village_timeseries_data[0].years,
          depths: data.village_timeseries_data[0].depths,
          trend_line: data.village_timeseries_data[0].trend_line,
          sen_slope: data.village_timeseries_data[0].sen_slope,
          trend_status: data.village_timeseries_data[0].trend_status,
        });
      }

      // Handle trend map base64 (priority) and filename
      const mapBase64 = data.trend_map_base64 || data.summary_stats?.file_info?.trend_map_base64;
      const mapFilename = data.trend_map_filename || data.summary_stats?.file_info?.trend_map_filename;

      if (mapBase64) {
        console.log("Trend Map Base64 received (length):", mapBase64.length);
        setTrendMapBase64(mapBase64);
      } else {
        console.warn("No trend map base64 received from API");
      }

      if (mapFilename) {
        console.log("Trend Map Filename:", mapFilename);
        setTrendMapFilename(mapFilename);
      } else {
        console.warn("No trend map filename received from API");
      }

      // Validate response data
      if (!data || typeof data !== "object" || !data.success) {
        throw new Error("Invalid response data received from server");
      }

      setTrendData(data);
      onTrendData(data);

      // Add trend data to map if village_geojson is available
      if (data.village_geojson && data.village_geojson.features && data.village_geojson.features.length > 0) {
        console.log("Adding village trend data to map:", data.village_geojson.features.length, "villages");

        const transformedGeoJSON = {
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
        };

        addTrendLayer(transformedGeoJSON);
      } else {
        console.warn("No village GeoJSON data received or data is empty");
      }

      // Update legend data
      setLegendData((prev: any) => ({
        ...prev,
        trend: {
          totalVillages: data.summary_stats?.trend_distribution?.total || 0,
          increasing: data.summary_stats?.trend_distribution?.increasing || 0,
          decreasing: data.summary_stats?.trend_distribution?.decreasing || 0,
          noTrend: data.summary_stats?.trend_distribution?.no_trend || 0,
          insufficientData: data.summary_stats?.trend_distribution?.insufficient_data || 0,
          significant: data.summary_stats?.statistical_summary?.significant_trends_count || 0,
          method: trendMethod,
          period: `${yearStart}-${yearEnd}`,
          analysisDate: data.summary_stats?.file_info?.analysis_date || new Date().toLocaleDateString(),
          colorMapping: data.color_mapping,
          filteredVillages: selectedVillages,
          csvFiles: {
            trend: data.summary_stats?.file_info?.trend_csv_filename,
            yearly: data.summary_stats?.file_info?.timeseries_yearly_csv_filename,
            seasonal: data.summary_stats?.file_info?.timeseries_seasonal_csv_filename,
          },
          trendMapFilename: mapFilename,
          trendMapUrl: mapFilename ? `/django/media/temp/${mapFilename}` : null,
          trendMapBase64: mapBase64,
        },
      }));

      console.log(" Trend analysis completed successfully!");
      console.log(` Analyzed ${data.total_villages} villages`);
      console.log(` Trends: ${data.summary_stats.trend_distribution.increasing} increasing, ${data.summary_stats.trend_distribution.decreasing} decreasing, ${data.summary_stats.trend_distribution.no_trend} no trend`);
      console.log(` Generated 3 CSV files: 1 trend analysis + 1 yearly time series + 1 seasonal time series`);
      if (mapBase64) {
        console.log(` Generated trend map with base64 (ready for PDF)`);
      }
      if (data.village_timeseries_data && data.village_timeseries_data.length > 0) {
        console.log(`Village timeseries data with trend lines available for ${data.village_timeseries_data.length} villages`);
      }

    } catch (error) {
      console.error("❌ Error generating trend analysis:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred during trend analysis";
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
        trendMapFilename,
        trendMapBase64,
        setTrendMethod,
        setYearStart,
        setYearEnd,
        setReturnType,
        handleGenerate,
        clearTrendData,
        resetForm,
        availableCharts,
        getChartImage,
        getTrendMapUrl,
        getTrendMapFilename,
        getTrendMapBase64,
        hasTrendMap,
        villageTimeseriesData,
        allYears,
        getVillageTimeseries,
      }}
    >
      {children}
    </GroundwaterTrendContext.Provider>
  );
};

//  Export custom hook for easier usage
export const useGroundwaterTrend = () => {
  const context = useContext(GroundwaterTrendContext);
  if (!context) {
    throw new Error('useGroundwaterTrend must be used within a GroundwaterTrendProvider');
  }
  return context;
};