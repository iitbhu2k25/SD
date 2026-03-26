"use client";

import React, { createContext, useContext, ReactNode, useMemo, useState } from "react";
import { useStretch } from "./LocationContext";

// Processed data interface for charts
export interface ProcessedWaterQualityData {
  id: string;
  stretchId: string;
  stretchName: string;
  riverName: string;
  sampling: string;
  originalSampling: string;
  location: string;
  latitude: number;
  longitude: number;
  // Water quality parameters
  ph: number;
  temperature: number;
  ec: number;
  tds: number;
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
  // WQI data (if available)
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
  stretchName: string;
  riverName: string;
  premonsoon: ProcessedWaterQualityData | null;
  monsoon: ProcessedWaterQualityData | null;
  postmonsoon: ProcessedWaterQualityData | null;
}


interface StretchChartContextType {
  // Original water quality data from LocationContext
  waterQualityData: any;
  processedChartData: ProcessedWaterQualityData[];

  // Stretch lines data
  stretchLinesData: any;
  processedStretchLines: any[];

  // Loading and error states
  isLoadingWaterQuality: boolean;
  isLoadingStretchLines: boolean;
  waterQualityError: string | null;
  stretchLinesError: string | null;

  // Context data
  selectedStretches: string[];
  selectedSeason: string;
  areaConfirmed: boolean;

  // Functions
  fetchWaterQualityData: (
    stretchIds: string[],
    season: string
  ) => Promise<void>;
  fetchStretchLines: (stretchIds: string[]) => Promise<void>;

  seasonalProcessedData: SeasonalProcessedData;
  comparisonTableData: ComparisonTableRow[];
  isLoadingAllSeasons: boolean;
  allSeasonsError: string | null;

  // Selected parameter (shared between chart and map)
  selectedAttribute: string;
  setSelectedAttribute: (attr: string) => void;
}

interface StretchChartProviderProps {
  children: ReactNode;
}

const StretchChartContext = createContext<StretchChartContextType | undefined>(
  undefined
);

export const StretchChartProvider: React.FC<StretchChartProviderProps> = ({
  children,
}) => {
  const {
    waterQualityData,
    isLoadingWaterQuality,
    waterQualityError,
    fetchWaterQualityData,
    stretchLinesData,
    isLoadingStretchLines,
    stretchLinesError,
    fetchStretchLines,
    selectedStretches,
    selectedSeason,
    areaConfirmed,
    seasonalWaterQualityData,
    isLoadingAllSeasons,
    allSeasonsError,
  } = useStretch();

  // Selected parameter state — shared with map for hover tooltips
  const [selectedAttribute, setSelectedAttribute] = useState("ph");

  // Process water quality data for charts
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
        stretchId: props.Stretch_ID?.toString() || "",
        stretchName: props.Stretch_Name || "",
        riverName: props.River_Name || "",
        sampling: normalizedSampling,
        originalSampling: originalSampling,
        location: props.Location || "",
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
        latitude: coords[1] || parseFloat(props.LATITUDE) || 0,
        longitude: coords[0] || parseFloat(props.LONGITUDE) || 0,
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
        stretchId: props.Stretch_ID?.toString() || "",
        stretchName: props.Stretch_Name || "",
        riverName: props.River_Name || "",
        sampling: normalizedSampling,
        originalSampling: originalSampling,
        location: props.Location || "",
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
        latitude: coords[1] || parseFloat(props.LATITUDE) || 0,
        longitude: coords[0] || parseFloat(props.LONGITUDE) || 0,
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
            stretchName: point.stretchName,
            riverName: point.riverName,
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

    console.log("Comparison table data generated:", result.length, "rows");
    return result;
  }, [seasonalProcessedData]);


  // Process stretch lines data
  const processedStretchLines = useMemo(() => {
    if (!stretchLinesData || !stretchLinesData.features) return [];

    return stretchLinesData.features.map((feature: any) => ({
      id: feature.id,
      stretchId: feature.properties.Stretch_ID,
      stretchName: feature.properties.Stretch_Na,
      riverCode: feature.properties.River_Code,
      inLineFID: feature.properties.InLine_FID,
      geometry: feature.geometry,
    }));
  }, [stretchLinesData]);

  const contextValue: StretchChartContextType = {
    waterQualityData,
    processedChartData,
    stretchLinesData,
    processedStretchLines,
    isLoadingWaterQuality,
    isLoadingStretchLines,
    waterQualityError,
    stretchLinesError,
    selectedStretches,
    selectedSeason,
    areaConfirmed,
    fetchWaterQualityData,
    fetchStretchLines,
    seasonalProcessedData,
    comparisonTableData,
    isLoadingAllSeasons,
    allSeasonsError,
    selectedAttribute,
    setSelectedAttribute,
  };

  return (
    <StretchChartContext.Provider value={contextValue}>
      {children}
    </StretchChartContext.Provider>
  );
};

export const useStretchChart = (): StretchChartContextType => {
  const context = useContext(StretchChartContext);
  if (context === undefined) {
    throw new Error(
      "useStretchChart must be used within a StretchChartProvider"
    );
  }
  return context;
};
