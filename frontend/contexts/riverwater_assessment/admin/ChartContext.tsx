"use client";

import React, { createContext, useContext, ReactNode, useMemo, useState } from "react";
import { useLocation } from "./LocationContext";

export interface ProcessedWaterQualityData {
  id: string;
  location: string;
  subDistrict: string;
  sampling: string;
  originalSampling: string;
  ph: number;
  temperature: number;
  tds: number;
  ec: number;
  tss: number;
  ts: number;
  dissolvedOxygen: number;
  turbidity: number;
  orp: number;
  cod: number;
  bod: number;
  chloride: number;
  nitrate: number;
  hardness: number;
  faecalColiform: string;
  totalColiform: string;
  latitude: number;
  longitude: number;
  stretchId: number;
  wqi?: number;
  wqiCategory?: string;
  [key: string]: string | number | undefined;
}

// NEW: Seasonal processed data type
export interface SeasonalProcessedData {
  premonsoon: ProcessedWaterQualityData[];
  monsoon: ProcessedWaterQualityData[];
  postmonsoon: ProcessedWaterQualityData[];
}

// NEW: Comparison table row type
export interface ComparisonTableRow {
  location: string; // Combined: "Sampling Name - Location Type"
  normalizedSampling: string;
  locationType: string;
  premonsoon: ProcessedWaterQualityData | null;
  monsoon: ProcessedWaterQualityData | null;
  postmonsoon: ProcessedWaterQualityData | null;
}

interface ChartContextType {
  // EXISTING: Single season data
  waterQualityData: any;
  processedChartData: ProcessedWaterQualityData[];
  isLoadingWaterQuality: boolean;
  waterQualityError: string | null;

  // NEW: Seasonal data
  seasonalProcessedData: SeasonalProcessedData;
  comparisonTableData: ComparisonTableRow[];
  isLoadingAllSeasons: boolean;
  allSeasonsError: string | null;

  // Global UI parameter selection
  selectedAttribute: string;
  setSelectedAttribute: (attr: string) => void;
}

interface ChartProviderProps {
  children: ReactNode;
}

const ChartContext = createContext<ChartContextType | undefined>(undefined);

export const ChartProvider: React.FC<ChartProviderProps> = ({ children }) => {
  const {
    waterQualityData,
    isLoadingWaterQuality,
    waterQualityError,
    seasonalWaterQualityData,
    isLoadingAllSeasons,
    allSeasonsError,
  } = useLocation();

  const [selectedAttribute, setSelectedAttribute] = useState<string>("ph");

  // EXISTING: Process single season data (unchanged)
  const processedChartData = useMemo(() => {
    if (!waterQualityData || !waterQualityData.features) return [];

    return waterQualityData.features.map((feature: any) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      const originalSampling = props.Sampling || "";

      let normalizedSampling = originalSampling
        // Remove patterns like "(US)", "(DS)", "(Drain)"
        .replace(/\s*\((US|DS|Drain)\)\s*$/i, "")
        // Remove patterns like "Drain (US)" or "Drain (DS)"
        .replace(/\s*Drain\s*\((US|DS)\)\s*$/i, "")
        // Remove standalone words: "Drain", "Upstream", "Downstream"
        .replace(/\s*(Drain|Upstream|Downstream)\s*$/i, "")
        .trim();

      return {
        id: props.S_No_?.toString() || "",
        location: props.Location || "",
        subDistrict: props.Sub_Distri || "",
        sampling: normalizedSampling,
        originalSampling: originalSampling,
        ph: parseFloat(props.pH) || 0,
        temperature: parseFloat(props.Temperatur) || 0,
        tds: parseFloat(props.TDS_mg_L_) || 0,
        ec: parseFloat(props.EC__S_cm_) || 0,
        tss: parseFloat(props.TSS_mg_L_) || 0,
        ts: parseFloat(props.TS_mg_L_) || 0,
        dissolvedOxygen: parseFloat(props.DO_mg_L_) || 0,
        turbidity: parseFloat(props.Turbidity_) || 0,
        orp: parseFloat(props.ORP) || 0,
        cod: parseFloat(props.COD_mg_L_) || 0,
        bod: parseFloat(props.BOD_mg_L_) || 0,
        chloride: parseFloat(props.Chloride_m) || 0,
        nitrate: parseFloat(props.Nitrate_mg) || 0,
        hardness: parseFloat(props.Hardness_m) || 0,
        faecalColiform: props.Faecal_Col || "",
        totalColiform: props.Total_Coli || "",
        latitude: coords[1] || 0,
        longitude: coords[0] || 0,
        stretchId: props.Stretch_ID || 0,
        wqi: props.WQI ? parseFloat(props.WQI) : undefined,
        wqiCategory: props.WQI_Class || undefined,
      };
    });
  }, [waterQualityData]);

  // NEW: Process individual season data helper function
  const processSeasonData = (
    seasonData: any
  ): ProcessedWaterQualityData[] => {
    if (!seasonData || !seasonData.features) return [];

    return seasonData.features.map((feature: any) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      // Use pre-normalized sampling name from LocationContext
      const normalizedSampling = props.NormalizedSampling || props.Sampling || "";
      const originalSampling = props.Sampling || "";

      return {
        id: props.S_No_?.toString() || "",
        location: props.Location || "",
        subDistrict: props.Sub_Distri || "",
        sampling: normalizedSampling,
        originalSampling: originalSampling,
        ph: parseFloat(props.pH) || 0,
        temperature: parseFloat(props.Temperatur) || 0,
        tds: parseFloat(props.TDS_mg_L_) || 0,
        ec: parseFloat(props.EC__S_cm_) || 0,
        tss: parseFloat(props.TSS_mg_L_) || 0,
        ts: parseFloat(props.TS_mg_L_) || 0,
        dissolvedOxygen: parseFloat(props.DO_mg_L_) || 0,
        turbidity: parseFloat(props.Turbidity_) || 0,
        orp: parseFloat(props.ORP) || 0,
        cod: parseFloat(props.COD_mg_L_) || 0,
        bod: parseFloat(props.BOD_mg_L_) || 0,
        chloride: parseFloat(props.Chloride_m) || 0,
        nitrate: parseFloat(props.Nitrate_mg) || 0,
        hardness: parseFloat(props.Hardness_m) || 0,
        faecalColiform: props.Faecal_Col || "",
        totalColiform: props.Total_Coli || "",
        latitude: coords[1] || 0,
        longitude: coords[0] || 0,
        stretchId: props.Stretch_ID || 0,
        wqi: props.WQI ? parseFloat(props.WQI) : undefined,
        wqiCategory: props.WQI_Class || undefined,
      };
    });
  };

  // NEW: Process all seasonal data
  const seasonalProcessedData = useMemo(() => {
    return {
      premonsoon: processSeasonData(seasonalWaterQualityData.premonsoon),
      monsoon: processSeasonData(seasonalWaterQualityData.monsoon),
      postmonsoon: processSeasonData(seasonalWaterQualityData.postmonsoon),
    };
  }, [seasonalWaterQualityData]);

  // NEW: Create comparison table data structure
  const comparisonTableData = useMemo(() => {
    const comparisonMap = new Map<string, ComparisonTableRow>();

    const seasons: Array<"premonsoon" | "monsoon" | "postmonsoon"> = [
      "premonsoon",
      "monsoon",
      "postmonsoon",
    ];

    // Iterate through all seasons and build comparison structure
    seasons.forEach((season) => {
      seasonalProcessedData[season]?.forEach((point) => {
        // Create unique key: normalized sampling + location type
        const uniqueKey = `${point.sampling}|${point.location}`;

        if (!comparisonMap.has(uniqueKey)) {
          // Initialize row with all seasons as null
          comparisonMap.set(uniqueKey, {
            location: `${point.sampling} - ${point.location}`,
            normalizedSampling: point.sampling,
            locationType: point.location,
            premonsoon: null,
            monsoon: null,
            postmonsoon: null,
          });
        }

        // Add data for current season
        const row = comparisonMap.get(uniqueKey)!;
        row[season] = point;
      });
    });

    // Convert map to array and sort
    const result = Array.from(comparisonMap.values()).sort((a, b) => {
      // Sort by normalized sampling name first
      const samplingCompare = a.normalizedSampling.localeCompare(
        b.normalizedSampling
      );
      if (samplingCompare !== 0) return samplingCompare;

      // Then by location type (Drain, Upstream, Downstream)
      const locationOrder: Record<string, number> = {
        Drain: 1,
        Upstream: 2,
        Downstream: 3,
      };
      return (
        (locationOrder[a.locationType] || 999) -
        (locationOrder[b.locationType] || 999)
      );
    });

    return result;
  }, [seasonalProcessedData]);

  const contextValue: ChartContextType = {
    // EXISTING
    waterQualityData,
    processedChartData,
    isLoadingWaterQuality,
    waterQualityError,

    // NEW
    seasonalProcessedData,
    comparisonTableData,
    isLoadingAllSeasons,
    allSeasonsError,

    // Global UI parameter selection
    selectedAttribute,
    setSelectedAttribute,
  };

  return (
    <ChartContext.Provider value={contextValue}>
      {children}
    </ChartContext.Provider>
  );
};

export const useChart = (): ChartContextType => {
  const context = useContext(ChartContext);
  if (context === undefined) {
    throw new Error("useChart must be used within a ChartProvider");
  }
  return context;
};
