import { ADMIN_API, API_BASE_URL, DRAIN_API, GEOSERVER_URL, GEOSERVER_WORKSPACE } from "../utils/constants";
import type {
  AdminSelection,
  DistrictOption,
  DrainItem,
  DrainRiver,
  DrainStretch,
  DrainVillage,
  StateOption,
  SubDistrictOption,
} from "../types/location.types";

async function parseJson<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) throw new Error(`${errorMessage} (${response.status})`);
  return response.json() as Promise<T>;
}

async function fetchGeoServerFeatures(layerName: string, cqlFilter?: string) {
  const query = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: `${GEOSERVER_WORKSPACE}:${layerName}`,
    outputFormat: "application/json",
  });

  if (cqlFilter) query.set("CQL_FILTER", cqlFilter);

  const url = `${GEOSERVER_URL}/${GEOSERVER_WORKSPACE}/wfs?${query.toString()}`;
  const response = await fetch(url);
  const data = await parseJson<{ features?: any[] }>(response, `Failed to fetch ${layerName}`);
  return data.features ?? [];
}

export async function fetchGeoServerGeoJson(layerName: string, cqlFilter?: string) {
  const features = await fetchGeoServerFeatures(layerName, cqlFilter);
  return {
    type: "FeatureCollection",
    features,
  };
}

export async function fetchStates(): Promise<StateOption[]> {
  const response = await fetch(ADMIN_API.STATE);
  const data = await parseJson<any[]>(response, "Failed to fetch states");
  return data
    .map((item) => ({
      state_code: String(item.state_code),
      state_name: String(item.state_name),
    }))
    .sort((a, b) => a.state_name.localeCompare(b.state_name));
}

export async function fetchDistricts(stateCode: string): Promise<DistrictOption[]> {
  const response = await fetch(ADMIN_API.DISTRICT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state_code: Number(stateCode) }),
  });
  const data = await parseJson<any[]>(response, "Failed to fetch districts");
  return data
    .map((item) => ({
      district_code: String(item.district_code),
      district_name: String(item.district_name),
      state_code: String(stateCode),
    }))
    .sort((a, b) => a.district_name.localeCompare(b.district_name));
}

export async function fetchSubDistricts(districtCodes: string[]): Promise<SubDistrictOption[]> {
  const response = await fetch(ADMIN_API.SUBDISTRICT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ district_code: districtCodes.map(Number) }),
  });
  const data = await parseJson<any[]>(response, "Failed to fetch sub-districts");
  return data
    .map((item) => ({
      subdistrict_code: String(item.subdistrict_code),
      subdistrict_name: String(item.subdistrict_name),
      district_code: String(item.district_code),
      population: Number(item.population ?? 0),
    }))
    .sort((a, b) => a.subdistrict_name.localeCompare(b.subdistrict_name));
}

export async function fetchDrainRivers(): Promise<DrainRiver[]> {
  const features = await fetchGeoServerFeatures("Rivers");
  return features
    .map((feature) => ({
      id: String(feature.properties.River_Code),
      name: String(feature.properties.River_Name),
      code: Number(feature.properties.River_Code),
    }))
    .filter((river, index, all) => index === all.findIndex((item) => item.code === river.code))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchDrainStretches(riverCode: number): Promise<DrainStretch[]> {
  const features = await fetchGeoServerFeatures("Stretches", `River_Code=${riverCode}`);
  return features
    .map((feature) => ({
      id: String(feature.properties.Stretch_ID),
      name: `Stretch ${feature.properties.Stretch_ID}`,
      stretchId: Number(feature.properties.Stretch_ID),
      riverCode: Number(feature.properties.River_Code),
    }))
    .sort((a, b) => a.stretchId - b.stretchId);
}

export async function fetchDrainItems(riverCode: number, stretchId: number): Promise<DrainItem[]> {
  const features = await fetchGeoServerFeatures(
    "Drain",
    `Stretch_ID=${stretchId} AND River_Code=${riverCode}`,
  );
  return features
    .map((feature) => ({
      id: String(feature.properties.Drain_No),
      name: `Drain ${feature.properties.Drain_No}`,
      drainNo: Number(feature.properties.Drain_No),
      stretchId: Number(feature.properties.Stretch_ID),
    }))
    .sort((a, b) => a.drainNo - b.drainNo);
}

export async function fetchDrainVillages(drainNos: number[]): Promise<DrainVillage[]> {
  const response = await fetch(DRAIN_API.VILLAGES, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Drain_No: drainNos }),
  });
  const data = await parseJson<{ villages?: any[] }>(response, "Failed to fetch drain villages");
  const unique = new Map<string, DrainVillage>();

  (data.villages ?? []).forEach((item) => {
    const village = {
      shapeID: String(item.village_code),
      shapeName: String(item.name ?? `Village ${item.village_code}`),
      village_code: String(item.village_code),
      catchment_gridcode: Number(item.Drain_No ?? 0),
      population: Number(item.population ?? 0),
    };
    if (!unique.has(village.shapeID)) unique.set(village.shapeID, village);
  });

  return [...unique.values()].sort((a, b) => a.shapeName.localeCompare(b.shapeName));
}

interface AdminUnitsResponse {
  state_code: number | null;
  district_codes: number[];
  subdistrict_codes: number[];
}

export async function fetchAdminUnitsForVillages(villageCodes: number[]): Promise<AdminUnitsResponse> {
  const response = await fetch(`${API_BASE_URL}/gwa/adminunit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ village_codes: villageCodes }),
  });

  return parseJson<AdminUnitsResponse>(response, "Failed to fetch admin units");
}

export function buildSwaQueryFromAdminSelection(selection: AdminSelection) {
  const params = new URLSearchParams();

  if (selection.state?.state_code) {
    params.set("state", String(selection.state.state_code));
  }

  if (selection.districts.length > 0) {
    params.set(
      "districts",
      selection.districts.map((item) => item.district_code).join(","),
    );
  }

  if (selection.subDistricts.length > 0) {
    params.set(
      "subdistricts",
      selection.subDistricts.map((item) => item.subdistrict_code).join(","),
    );
  }

  return params;
}
