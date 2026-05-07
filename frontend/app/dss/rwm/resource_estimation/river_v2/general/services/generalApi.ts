import type {
  GeneralLayerInfo,
  GeneralRasterDownloadFormat,
  GeneralWqiRasterInfo,
} from "../types";

const DJANGO_URL = process.env.NEXT_PUBLIC_DJANGO_URL || "/django";

const normalizeDjangoUrl = () => DJANGO_URL.replace(/\/+$/, "");

const readErrorMessage = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return payload?.error || payload?.message || fallback;
  }
  const text = await response.text().catch(() => "");
  return text || fallback;
};

export async function uploadGeneralShapefile(file: File): Promise<GeneralLayerInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${normalizeDjangoUrl()}/rwm/general/upload`, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Upload failed (${response.status}).`);
  }

  return {
    layerName: payload.layer_name,
    wmsUrl: payload.wms_url,
    wfsUrl: payload.wfs_url,
    geometryType: payload.geometry_type,
    bufferCreated: Boolean(payload.buffer_created),
    featureCount: Number(payload.feature_count || 0),
    bbox: payload.bbox || null,
  };
}

export async function uploadGeneralCsv(file: File, layerName: string): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("layer_name", layerName);

  const response = await fetch(`${normalizeDjangoUrl()}/rwm/general/upload-csv`, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const missing = payload?.missing_columns;
    const message = Array.isArray(missing)
      ? `Missing required columns: ${missing.join(", ")}`
      : payload?.error || `CSV upload failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

export interface GeneralInterpolationPayload {
  layer_name: string;
  wqi_geojson: any;
  source_file_name: string;
  upload_id: string;
  min_value: number;
  max_value: number;
}

export async function interpolateGeneralWqi(
  payload: GeneralInterpolationPayload,
): Promise<GeneralWqiRasterInfo> {
  const response = await fetch(`${normalizeDjangoUrl()}/rwm/general/interpolate-wqi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Raster generation failed (${response.status}).`);
  }
  if (data.style_error) {
    throw new Error(`Raster created but styling failed: ${data.style_error}`);
  }

  return {
    layerName: data.layer_name,
    workspace: data.workspace,
    styleName: data.style_name || "",
    statistics: data.statistics,
    mapImage: data.map_image,
    legendImage: data.legend_image,
    profileData: data.profile_data || [],
    profileMeta: data.profile_meta || null,
    rowProfileData: data.row_profile_data || [],
    rowProfileMeta: data.row_profile_meta || null,
    parameterLayers: data.parameter_layers || {},
    parameterStatistics: data.parameter_statistics || {},
  };
}

export async function downloadGeneralRaster({
  layerName,
  workspace,
  fileName,
  format,
}: {
  layerName: string;
  workspace: string;
  fileName: string;
  format: GeneralRasterDownloadFormat;
}): Promise<Blob> {
  const response = await fetch(
    `${normalizeDjangoUrl()}/rwm/general/download-raster?layer_name=${encodeURIComponent(layerName)}&workspace=${encodeURIComponent(workspace)}&filename=${encodeURIComponent(fileName)}&format=${encodeURIComponent(format)}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Download failed (${response.status}).`));
  }

  return response.blob();
}

