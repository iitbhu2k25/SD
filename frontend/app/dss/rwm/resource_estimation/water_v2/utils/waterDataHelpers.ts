// Pure utility functions for water_v2 data transformations.
// No UI rendering, no store access, no side effects.

import { WaterRasterResponse, WaterRasterLayer } from "../services/waterApi";

/**
 * Derive a sorted unique list of years from a raster response.
 */
export function deriveAvailableYears(
  response: WaterRasterResponse | null,
): number[] {
  if (!response?.clipped_rasters) return [];
  return Array.from(
    new Set<number>(response.clipped_rasters.map((r) => r.year)),
  ).sort((a, b) => a - b);
}

/**
 * Find the raster layer entry for a specific year.
 */
export function getRasterForYear(
  response: WaterRasterResponse | null,
  year: number | null,
): WaterRasterLayer | null {
  if (!response?.clipped_rasters || year === null) return null;
  return response.clipped_rasters.find((r) => r.year === year) ?? null;
}

/**
 * Build the GeoServer WMS layer title string.
 * Used to match layer names when fetching or displaying rasters.
 */
export function formatLayerTitle(
  layerType: string,
  year: number,
  timeScale?: string,
  season?: string,
): string {
  const typeMap: Record<string, string> = {
    "Water Budget": "Water_budget",
    Surplus: "Surplus",
    Deficit: "Deficit",
    Index: "Index_class",
  };
  const prefix = typeMap[layerType] ?? layerType.replace(/\s+/g, "_");

  if (timeScale === "seasonal" && season) {
    return `${prefix}_${season}_${year}`;
  }
  return `${prefix}_${year}`;
}

/**
 * Transform a raster response into a flat water budget summary object.
 * Used by both admin and user view models.
 */
export function extractWaterBudgetSummary(
  response: WaterRasterResponse,
  defaultYear: number | null,
  productType: string,
  timeScale: string,
  season: string,
) {
  const raster =
    response.clipped_rasters.find((r) => r.year === defaultYear) ??
    response.clipped_rasters[0];

  return {
    totalWaterBudget: raster?.volume_MLD ?? null,
    productType: response.metadata?.product_type ?? productType,
    year: defaultYear ?? response.metadata?.year,
    season: raster?.season ?? response.metadata?.season ?? season,
    timeScale: response.metadata?.time_scale ?? timeScale,
    aggregationMethod: raster?.aggregation ?? "SUM",
    layersProcessed:
      response.metadata?.layers_processed ?? response.clipped_rasters.length,
  };
}
