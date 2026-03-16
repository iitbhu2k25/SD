// app/vector/services/api.service.ts
// API service for backend communication

// ─────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────

export interface CrsMeta {
  original: { code: string; name: string; is_geographic: boolean; unit: string; assumed?: boolean };
  final: { code: string; name: string; is_geographic: boolean; unit: string };
  reprojected: boolean;
}

export interface UploadProgress {
  pct: number;
  phase: string;  // 'receiving' | 'extracting' | 'reading' | 'crs_check' | 'converting' | 'done' | 'error'
  msg: string;
  meta?: { feature_count?: number; crs?: CrsMeta; source_file?: string };
}

export type ProgressCallback = (progress: UploadProgress) => void;

// ─────────────────────────────────────────────────────────────────
//  Accepted extensions (UI hint only — backend validates)
// ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = [
  '.zip',
  '.shp', '.dbf', '.shx', '.prj', '.cpg', '.qpj',
  '.geojson', '.json',
  '.gpkg',
  '.kml', '.kmz',
  '.gml',
  '.fgb',
  '.tab', '.mif',
  '.csv',
];

export function isAcceptedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

// ─────────────────────────────────────────────────────────────────
//  Shapefile directory
// ─────────────────────────────────────────────────────────────────

export async function fetchShapefileDirectory(): Promise<Record<string, string[]>> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/shapefiles`);
  if (!response.ok) throw new Error(`Failed to fetch directory: ${response.statusText}`);
  return await response.json();
}

// ─────────────────────────────────────────────────────────────────
//  GeoJSON data
// ─────────────────────────────────────────────────────────────────

export async function fetchGeoJSON(category: string, subcategory: string): Promise<any> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/get_shapefile/?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(subcategory)}`
  );
  if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);

  const geoJsonData = await response.json();
  if (!geoJsonData.features || geoJsonData.features.length === 0) {
    throw new Error('No feature data received');
  }

  if (!geoJsonData.category) geoJsonData.category = category;
  if (!geoJsonData.subcategory) geoJsonData.subcategory = subcategory;
  return geoJsonData;
}

// ─────────────────────────────────────────────────────────────────
//  Upload shapefile — real SSE progress from backend
// ─────────────────────────────────────────────────────────────────

/**
 * Upload spatial files and stream real progress from the backend via SSE.
 *
 * The backend emits one event per processing step:
 *   receiving → extracting → reading → crs_check → converting → done
 *
 * Each event: { pct, phase, msg, [crs], [feature_count], [geojson] }
 *
 * @param files      FileList or File[]
 * @param onProgress Called on every SSE event from the server
 * @returns          GeoJSON FeatureCollection (from the final "done" event)
 */
export async function uploadShapefile(
  files: FileList | File[],
  onProgress?: ProgressCallback,
): Promise<any> {
  const fileArray = Array.from(files);

  if (fileArray.length === 0) throw new Error('No files selected');

  const hasKnown = fileArray.some(f => isAcceptedFile(f.name));
  if (!hasKnown) {
    throw new Error(
      'None of the selected files look like spatial data. ' +
      'Try uploading a .zip, .shp, .geojson, .gpkg, .kml, etc.'
    );
  }

  const form = new FormData();
  fileArray.forEach(f => form.append('file', f));

  // POST the file — backend responds with text/event-stream
  const res = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/upload-shapefile`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok || !res.body) {
    const msg = res.headers.get('content-type')?.includes('application/json')
      ? (await res.json())?.error
      : `Upload failed (${res.status})`;
    throw new Error(msg || `Upload failed (${res.status})`);
  }

  // ── Stream SSE lines from the response body ──────────────────
  return new Promise<any>((resolve, reject) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by \n\n
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';   // keep incomplete last chunk

          for (const part of parts) {
            // Each part may be:   data: {...}
            const line = part.trim();
            if (!line.startsWith('data:')) continue;

            let event: any;
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            const { pct, phase, msg, crs, feature_count, source_file, geojson } = event;

            if (phase === 'error') {
              onProgress?.({ pct: 0, phase: 'error', msg });
              reject(new Error(msg || 'Upload failed'));
              return;
            }

            if (phase === 'done') {
              onProgress?.({
                pct: 100,
                phase: 'done',
                msg,
                meta: { feature_count, crs, source_file },
              });
              resolve(geojson);
              return;
            }

            // Intermediate progress step
            onProgress?.({
              pct,
              phase,
              msg,
              meta: crs ? { crs } : undefined,
            });
          }
        }

        // Stream ended without a 'done' event
        reject(new Error('Upload stream ended unexpectedly'));
      } catch (err) {
        reject(err);
      }
    };

    pump();
  });
}

// ─────────────────────────────────────────────────────────────────
//  Spatial analysis
// ─────────────────────────────────────────────────────────────────

export async function performSpatialAnalysis(
  operation: string,
  files: File[],
  options?: Record<string, any>
): Promise<any> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('operation', operation);
  if (options) {
    Object.entries(options).forEach(([k, v]) => formData.append(k, String(v)));
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/spatial/process`, { method: 'POST', body: formData });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Spatial analysis failed: ${response.statusText}`);
  }
  return await response.json();
}

export async function getSpatialOperations(): Promise<any> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/spatial/operations`);
  if (!response.ok) throw new Error(`Failed to fetch operations: ${response.statusText}`);
  return await response.json();
}

// ─────────────────────────────────────────────────────────────────
//  Export helpers
// ─────────────────────────────────────────────────────────────────

export async function exportMapPNG(geojson: any, width = 1920, height = 1080, dpi = 300): Promise<Blob> {
  const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/export/png`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geojson, width, height, dpi }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || `PNG export failed: ${r.statusText}`); }
  return r.blob();
}

export async function exportMapPDFServer(
  geojson: any,
  format: 'a4' | 'a3' = 'a4',
  orientation: 'portrait' | 'landscape' = 'landscape',
  heading = 'Map Export',
): Promise<Blob> {
  const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/export/pdf`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geojson, format, orientation, heading }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || `PDF export failed: ${r.statusText}`); }
  return r.blob();
}

export async function geojsonToShapefile(geojson: any, filename = 'export'): Promise<Blob> {
  const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/export/shapefile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geojson, filename }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || `Shapefile export failed: ${r.statusText}`); }
  return r.blob();
}