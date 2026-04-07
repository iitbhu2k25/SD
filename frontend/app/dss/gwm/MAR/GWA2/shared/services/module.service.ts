'use client';

import pako from "pako";

import { GWA_API } from "../utils/constants";
import { csvFromRows } from "../utils/helpers";
import type { ConfirmedLocation } from "../types/location.types";
import type { TableRow } from "../types/module.types";
import { getConfirmedAreaCodes } from "../utils/helpers";

async function parseJson<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${errorMessage}: ${response.status} ${text}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchWellsForLocation(location: ConfirmedLocation) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const body =
    location.mode === "admin"
      ? JSON.stringify({ subdis_cod: adminCodes })
      : JSON.stringify(villageCodes);

  const response = await fetch(GWA_API.WELLS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  return parseJson<TableRow[]>(response, "Failed to fetch wells");
}

export async function validateCsv(file: File) {
  const formData = new FormData();
  formData.append("csv_file", file);

  const response = await fetch(GWA_API.VALIDATE_CSV, { method: "POST", body: formData });
  return parseJson<{ valid?: boolean; message?: string }>(response, "Failed to validate CSV");
}

export async function uploadRowsAsCsv(rows: TableRow[], columns: string[], mode: string | null) {
  const csvContent = csvFromRows(rows, columns);
  const blob = new Blob([csvContent], { type: "text/csv" });
  const formData = new FormData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const prefix = mode === "upload_csv" ? "uploaded_csv" : "existing_wells";
  formData.append("csv_file", blob, `${prefix}_${timestamp}.csv`);

  const response = await fetch(GWA_API.UPLOAD_CSV, { method: "POST", body: formData });
  const result = await parseJson<{ data?: { filename?: string } }>(response, "Failed to upload CSV");
  return result.data?.filename ?? null;
}

export async function computeTrend(location: ConfirmedLocation, csvFilename: string, years: string[]) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const payload: Record<string, unknown> = {
    wells_csv_filename: csvFilename,
    trend_years: years,
    return_type: "json",
  };

  if (location.mode === "admin") payload.subdis_codes = adminCodes;
  else payload.village_codes = villageCodes;

  const response = await fetch(GWA_API.TREND, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJson<any>(response, "Failed to generate trend analysis");
}

export async function computeRecharge(location: ConfirmedLocation, csvFilename: string) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const payload =
    location.mode === "admin"
      ? { csvFilename, selectedSubDistricts: adminCodes }
      : { csvFilename, selectedVillages: villageCodes };

  const response = await fetch(GWA_API.RECHARGE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJson<any>(response, "Failed to compute recharge");
}

export async function fetchCropsForSeason(season: string) {
  const response = await fetch(GWA_API.CROPS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season }),
  });

  return parseJson<any>(response, `Failed to fetch ${season} crops`);
}

export async function computeDomesticDemand(location: ConfirmedLocation, csvFilename: string, lpcd: number) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const payload =
    location.mode === "admin"
      ? { subdistrict_code: adminCodes, csv_filename: csvFilename, lpcd }
      : { village_code: villageCodes, csv_filename: csvFilename, lpcd };

  const response = await fetch(GWA_API.DOMESTIC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJson<any>(response, "Failed to compute domestic demand");
}

export async function computeAgriculturalDemand(
  location: ConfirmedLocation,
  selectedCrops: Record<string, string[]>,
  groundwaterFactor: number,
  seasons: Record<string, boolean>,
) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const payload: Record<string, unknown> = {
    selectedCrops,
    groundwaterFactor,
    irrigationIntensity: 0.8,
    seasons,
    include_charts: true,
  };

  if (location.mode === "admin") payload.subdistrict_code = adminCodes;
  else payload.village_code = villageCodes.map(String);

  const response = await fetch(GWA_API.AGRICULTURAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJson<any>(response, "Failed to compute agricultural demand");
}

export async function computeIndustrialDemand(
  location: ConfirmedLocation,
  csvFilename: string,
  groundwaterIndustrialDemand: number,
) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const payload =
    location.mode === "admin"
      ? { csv_filename: csvFilename, groundwater_industrial_demand: groundwaterIndustrialDemand, subdistrict_codes: adminCodes }
      : { csv_filename: csvFilename, groundwater_industrial_demand: groundwaterIndustrialDemand, village_codes: villageCodes };

  const response = await fetch(GWA_API.INDUSTRIAL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJson<any>(response, "Failed to compute industrial demand");
}

export async function computeGsr(
  location: ConfirmedLocation,
  rechargeData: TableRow[],
  combinedDemandData: TableRow[],
  trendCsvFilename: string,
) {
  const { adminCodes } = getConfirmedAreaCodes(location);
  const payload = {
    selectedSubDistricts: location.mode === "admin" ? adminCodes : [],
    selectedVillages: location.mode === "drain" ? getConfirmedAreaCodes(location).villageCodes : [],
    rechargeData,
    combinedDemandData,
    hasRechargeData: rechargeData.length > 0,
    hasDemandData: combinedDemandData.length > 0,
    trendCsvFilename: trendCsvFilename || "",
    timestamp: new Date().toISOString(),
  };

  const compressed = pako.gzip(JSON.stringify(payload));
  let binary = "";
  for (let index = 0; index < compressed.byteLength; index += 1) {
    binary += String.fromCharCode(compressed[index]);
  }

  const response = await fetch(GWA_API.GSR, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zipped_data: btoa(binary) }),
  });

  return parseJson<any>(response, "Failed to compute GSR");
}

export async function computeStress(location: ConfirmedLocation, gsrData: TableRow[], yearsCount: number) {
  const { adminCodes, villageCodes } = getConfirmedAreaCodes(location);
  const response = await fetch(GWA_API.STRESS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gsrData,
      years_count: yearsCount,
      selectedSubDistricts: adminCodes,
      selectedVillages: villageCodes,
      timestamp: new Date().toISOString(),
    }),
  });

  return parseJson<any>(response, "Failed to compute stress");
}

export async function computeForecast(
  method: string,
  forecastType: string,
  targetYears: number[],
  timeseriesCsvFilename: string,
) {
  const response = await fetch(GWA_API.FORECAST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      method,
      forecast_type: forecastType,
      target_years: targetYears,
      timeseries_yearly_csv_filename: timeseriesCsvFilename,
    }),
  });

  return parseJson<any>(response, "Failed to compute forecast");
}
