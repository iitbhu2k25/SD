export interface State {
  id: string | number;
  name: string;
}

export interface District {
  id: string | number;
  name: string;
  stateId: string | number;
}

export interface SubDistrict {
  id: string | number;
  name: string;
  districtId: string | number;
  districtName: string;
}

export interface Stretch {
  stretch_name: string;
  stretch_code: number;
  Stretch_ID: number;
  River_Code: number;
}

interface AdminInterpolationRequest {
  subDistrictCodes: number[];
  season: string;
  attribute: string;
  riverData: any;
  riverBufferData: any;
  pointsData: any;
}

interface DrainInterpolationRequest {
  stretchIds: string[];
  season: string;
  attribute: string;
  pointsData: any;
}

interface WqiProfileRequest {
  layerName: string;
  riverBufferData: any;
  profileStepM?: number;
}

interface PdfReportRequest {
  attributes: string[];
  season: string;
  dataType: "subdistbased" | "stretchbased";
  subDistrictCodes?: number[];
  stretchIds?: string[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const DJANGO_URL = process.env.NEXT_PUBLIC_DJANGO_URL || "/django";
const GEOSERVER_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://localhost:8080/geoserver";
const WEBSOCKET_DJANGO_URL = process.env.NEXT_PUBLIC_WEBSOCKET_DJANGO_URL || "";

// ------------------------------------------------------------------
// Admin Endpoints
// ------------------------------------------------------------------

export async function fetchAdminStates(): Promise<State[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/state`);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  const data = await response.json();
  return data.map((state: any) => ({
    id: state.state_code,
    name: state.state_name,
  }));
}

export async function fetchAdminDistricts(stateCode: number): Promise<District[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/district/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state_code: stateCode }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  const data = await response.json();
  return data.map((district: any) => ({
    id: district.district_code,
    name: district.district_name,
    stateId: stateCode,
  }));
}

export async function fetchAdminSubDistricts(districtCodes: number[], districts: District[]): Promise<SubDistrict[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/subdistrict/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ district_code: districtCodes }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  const data = await response.json();
  
  const districtMap = new Map(districts.map((d) => [d.id.toString(), d.name]));
  return data.map((subDistrict: any) => ({
    id: subDistrict.subdistrict_code,
    name: subDistrict.subdistrict_name,
    districtId: parseInt(subDistrict.district_code),
    districtName: districtMap.get(subDistrict.district_code.toString()) || "Unknown District",
  }));
}

export async function fetchAdminWqiData(subDistrictCodes: number[], season: string): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/water_quality/subdistbased/${season}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Sub_District_Code: subDistrictCodes }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminShapefiles(subDistrictCodes: number[], season: string, signal?: AbortSignal): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/shapefile/subdistbased/${season}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Sub_District_Code: subDistrictCodes }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminIndiaBoundary(): Promise<any> {
  const url = `${GEOSERVER_URL}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=dss_vector:B_State&outputFormat=application/json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminStateBoundary(stateCode: number): Promise<any> {
  const formattedCode = stateCode.toString().padStart(2, '0'); // e.g. 9 -> '09'
  const filter = encodeURIComponent(`state_code = '${formattedCode}'`);
  const url = `${GEOSERVER_URL}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=dss_vector:B_State&outputFormat=application/json&CQL_FILTER=${filter}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminDistrictBoundaries(districtCodes: number[]): Promise<any> {
  if (districtCodes.length === 0) return null;
  const codesStr = districtCodes.map(c => `'${c}'`).join(',');
  const filter = encodeURIComponent(`DISTRICT_C IN (${codesStr})`);
  const url = `${GEOSERVER_URL}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=dss_vector:B_district&outputFormat=application/json&CQL_FILTER=${filter}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminSubDistrictBoundaries(subDistrictCodes: number[]): Promise<any> {
  if (subDistrictCodes.length === 0) return null;
  const codesStr = subDistrictCodes.map((c) => `'${c}'`).join(",");
  const filter = encodeURIComponent(`SUBDIS_COD IN (${codesStr})`);
  const url = `${GEOSERVER_URL}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=dss_vector:B_subdistrict&outputFormat=application/json&CQL_FILTER=${filter}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminRiverData(subDistrictCodes: number[]): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/river`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Sub_District_Code: subDistrictCodes }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchAdminRiverBuffer(subDistrictCodes: number[]): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/river_100m_buffer/subdistbased`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Sub_District_Code: subDistrictCodes }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function executeAdminInterpolation({
  subDistrictCodes,
  season,
  attribute,
  riverData,
  riverBufferData,
  pointsData,
}: AdminInterpolationRequest): Promise<any> {
  const response = await fetch(
    `${DJANGO_URL}/rwm/interpolate/${encodeURIComponent(attribute)}/subdistbased/${season}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Sub_District_Code: subDistrictCodes,
        river_data: riverData,
        river_buffer_data: riverBufferData,
        points_data: pointsData,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Interpolation failed (${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  return response.json();
}

export async function downloadRasterLayer(
  layerName: string,
  format: "png" | "tiff",
  fileName: string,
): Promise<Blob> {
  const workspace = layerName.includes(":")
    ? layerName.split(":", 1)[0]
    : "myworkspace";

  const response = await fetch(
    `${DJANGO_URL}/rwm/general/download-raster?layer_name=${encodeURIComponent(layerName)}&workspace=${encodeURIComponent(workspace)}&filename=${encodeURIComponent(fileName)}&format=${encodeURIComponent(format)}`,
    { method: "GET" },
  );

  if (!response.ok) {
    let errorMessage = `Download failed (${response.status})`;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      errorMessage = payload?.error || errorMessage;
      if (Array.isArray(payload?.details) && payload.details.length > 0) {
        errorMessage = `${errorMessage} ${payload.details[0]}`;
      }
    }
    throw new Error(errorMessage);
  }

  return response.blob();
}

export async function fetchWqiProfile({
  layerName,
  riverBufferData,
  profileStepM = 100,
}: WqiProfileRequest): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/wqi-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layer_name: layerName,
      river_buffer_data: riverBufferData,
      profile_step_m: profileStepM,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Profile generation failed (${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  return response.json();
}

export async function startPdfReportJob({
  attributes,
  season,
  dataType,
  subDistrictCodes,
  stretchIds,
}: PdfReportRequest): Promise<{ job_id: string }> {
  const body =
    dataType === "subdistbased"
      ? {
          subdistrict_codes: subDistrictCodes || [],
          attributes,
          season,
          data_type: dataType,
        }
      : {
          stretch_ids: stretchIds || [],
          attributes,
          season,
          data_type: dataType,
        };

  const response = await fetch(`${DJANGO_URL}/rwm/start-pdf-report/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Report job failed (${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  return response.json();
}

export function getPdfReportSocketUrl(jobId: string): string {
  const baseUrl = WEBSOCKET_DJANGO_URL || DJANGO_URL.replace(/^http/, "ws");
  return `${baseUrl}/task/${jobId}`;
}

// ------------------------------------------------------------------
// Drain Endpoints
// ------------------------------------------------------------------

export async function fetchDrainStretches(): Promise<Stretch[]> {
  const response = await fetch(`${DJANGO_URL}/rwm/stretches`);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchDrainBasins(): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/basin`);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchDrainRivers(): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/river`);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchDrainLines(stretchIds: string[]): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/stretch_lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Stretch_ID: stretchIds }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchDrainBuffer(stretchIds: string[]): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/river_100m_buffer/stretchbased`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Stretch_ID: stretchIds }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function fetchDrainShapefiles(stretchIds: string[], season: string, signal?: AbortSignal): Promise<any> {
  const response = await fetch(`${DJANGO_URL}/rwm/shapefile/stretchbased/${season}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Stretch_ID: stretchIds }),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function executeDrainInterpolation({
  stretchIds,
  season,
  attribute,
  pointsData,
}: DrainInterpolationRequest): Promise<any> {
  const response = await fetch(
    `${DJANGO_URL}/rwm/interpolate/${encodeURIComponent(attribute)}/stretchbased/${season}/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Stretch_ID: stretchIds,
        points_data: pointsData,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Interpolation failed (${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  return response.json();
}

// ------------------------------------------------------------------
// General Endpoints
// ------------------------------------------------------------------

export async function uploadGeneralShapefile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${BACKEND_URL}/django/rwm/general/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function uploadGeneralCsv(file: File, layerName: string, workspace: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("layer_name", layerName);
  formData.append("workspace", workspace);

  const response = await fetch(`${BACKEND_URL}/django/rwm/general/upload-csv`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `CSV Upload failed: ${response.status}`);
  }
  return response.json();
}

export async function executeGeneralInterpolation(payload: any): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/django/rwm/general/interpolate-wqi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Interpolation failed: ${response.status}`);
  }
  return response.json();
}
