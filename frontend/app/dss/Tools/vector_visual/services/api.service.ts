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
  phase: string;  // 'receiving' | 'extracting' | 'reading' | 'crs_check' | 'converting' | 'streaming' | 'done' | 'error'
  msg: string;
  meta?: { feature_count?: number; crs?: CrsMeta; source_file?: string };
  /** Partial FeatureCollection emitted during progressive streaming — use for incremental map rendering */
  geojsonChunk?: { type: 'FeatureCollection'; features: any[] };
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
//  Upload shapefile — chunked binary upload + real SSE progress
// ─────────────────────────────────────────────────────────────────

const FILE_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per binary chunk

/**
 * Stream SSE events from an already-established Response (text/event-stream).
 *
 * Handles two kinds of backend events:
 *  • Progress events (receiving / extracting / reading / crs_check / converting)
 *  • Feature-batch events (streaming / done) — each carries a `chunk` field
 *    containing a partial FeatureCollection.  Features are accumulated here
 *    and the caller receives them via `onProgress.geojsonChunk` for progressive
 *    map rendering.  The Promise resolves with the fully-assembled GeoJSON.
 *
 * @param pctOffset  Progress already consumed by the binary upload phase (0-40).
 *                   Backend pct [0-100] is mapped into [pctOffset, 100].
 */
function streamSSE(
  res: Response,
  onProgress: ProgressCallback | undefined,
  pctOffset = 0,
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const allFeatures: any[] = [];   // accumulate every feature across all batches
    let doneMeta: any = {};

    const scalePct = (backendPct: number) =>
      Math.round(pctOffset + backendPct * (100 - pctOffset) / 100);

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;

            let event: any;
            try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }

            const { pct, phase, msg, crs, feature_count, source_file, chunk } = event;

            if (phase === 'error') {
              onProgress?.({ pct: 0, phase: 'error', msg });
              reject(new Error(msg || 'Upload failed'));
              return;
            }

            // Feature-batch events (streaming or final done chunk)
            if (chunk?.features?.length) {
              allFeatures.push(...chunk.features);
              onProgress?.({
                pct: scalePct(pct),
                phase,
                msg,
                meta: crs ? { crs } : undefined,
                geojsonChunk: chunk,  // partial FeatureCollection for incremental rendering
              });
            } else if (phase !== 'done') {
              // Plain progress event (receiving, extracting, reading, crs_check, converting)
              onProgress?.({ pct: scalePct(pct), phase, msg, meta: crs ? { crs } : undefined });
            }

            if (phase === 'done') {
              doneMeta = { feature_count, crs, source_file };
              onProgress?.({ pct: 100, phase: 'done', msg, meta: doneMeta });
              resolve({
                type: 'FeatureCollection',
                features: allFeatures,
                _crs: crs,
                _feature_count: feature_count ?? allFeatures.length,
                _source_file: source_file,
              });
              return;
            }
          }
        }
        reject(new Error('Upload stream ended unexpectedly'));
      } catch (err) {
        reject(err);
      }
    };

    pump();
  });
}

/**
 * Upload spatial files and stream real progress from the backend via SSE.
 *
 * Files larger than 5 MB are automatically split into 5 MB binary chunks and
 * uploaded piece-by-piece to POST /mapplot/upload-file-chunk before triggering
 * SSE processing via POST /mapplot/upload-shapefile.  Small files use the
 * original single-request path.
 *
 * Backend SSE phases: receiving → extracting → reading → crs_check → converting → done
 *
 * @param files      FileList or File[]
 * @param onProgress Called on every progress event (upload chunks + SSE steps)
 * @returns          GeoJSON FeatureCollection
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

  const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);

  // ── Large file path: chunk each file then trigger SSE processing ──────
  if (totalSize > FILE_CHUNK_SIZE) {
    const upload_id = crypto.randomUUID();
    let uploadedBytes = 0;

    for (let fileIndex = 0; fileIndex < fileArray.length; fileIndex++) {
      const file = fileArray[fileIndex];
      const totalChunks = Math.ceil(file.size / FILE_CHUNK_SIZE);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * FILE_CHUNK_SIZE;
        const blob = file.slice(start, start + FILE_CHUNK_SIZE);

        const form = new FormData();
        form.append('upload_id', upload_id);
        form.append('file_index', String(fileIndex));
        form.append('chunk_index', String(chunkIndex));
        form.append('total_chunks', String(totalChunks));
        form.append('filename', file.name);
        form.append('data', blob, file.name);

        const r = await fetch(
          `${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/upload-file-chunk`,
          { method: 'POST', body: form },
        );
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || `Chunk upload failed (chunk ${chunkIndex + 1}/${totalChunks})`);
        }

        uploadedBytes += blob.size;
        // Reserve 0-40 % of the progress bar for the binary upload phase
        const uploadPct = Math.round((uploadedBytes / totalSize) * 40);
        onProgress?.({ pct: uploadPct, phase: 'receiving', msg: `Uploading… ${uploadPct}%` });
      }
    }

    // Trigger SSE processing with the assembled upload_id
    const form = new FormData();
    form.append('upload_id', upload_id);
    const res = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/upload-shapefile`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok || !res.body) {
      const msg = res.headers.get('content-type')?.includes('application/json')
        ? (await res.json())?.error
        : `Processing failed (${res.status})`;
      throw new Error(msg || `Processing failed (${res.status})`);
    }
    // SSE pct values (15-100) get mapped into the 40-100 range
    return streamSSE(res, onProgress, 40);
  }

  // ── Small file path: original single-request upload ───────────────────
  const form = new FormData();
  fileArray.forEach(f => form.append('file', f));

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
  return streamSSE(res, onProgress, 0);
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
//  Chunked GeoJSON upload helper
// ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB per chunk

// ─────────────────────────────────────────────────────────────────
//  Shared GeoJSON chunking utility (used by export AND spatial ops)
// ─────────────────────────────────────────────────────────────────

/**
 * Prepare a GeoJSON object for inclusion in a FormData or JSON body.
 *
 * If the serialised payload is ≤ 1 MB it is returned as a plain JSON string
 * (`direct`).  Otherwise it is split into 1 MB chunks, each POSTed to
 * `POST /mapplot/chunk`, and the resulting `upload_id` is returned instead.
 *
 * Usage in FormData:
 *   const r = await prepareGeoJSONField(geojson);
 *   if (r.upload_id) fd.append('geojson_0_upload_id', r.upload_id);
 *   else             fd.append('geojson_0', r.direct!);
 */
export async function prepareGeoJSONField(
  geojson: any,
): Promise<{ upload_id?: string; direct?: string }> {
  const str = JSON.stringify(geojson);
  if (str.length <= CHUNK_SIZE) return { direct: str };

  const upload_id = crypto.randomUUID();
  const total_chunks = Math.ceil(str.length / CHUNK_SIZE);

  for (let i = 0; i < total_chunks; i++) {
    const data = str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id, chunk_index: i, total_chunks, data }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `GeoJSON chunk upload failed (chunk ${i + 1}/${total_chunks})`);
    }
  }
  return { upload_id };
}

/**
 * If the serialised GeoJSON exceeds 1 MB, splits it into 1 MB string slices
 * and POSTs each slice to /mapplot/chunk.  Returns either the original object
 * (small data) or an upload_id string (large data) for the caller to embed in
 * the subsequent export request body.
 */
async function uploadGeoJSONInChunks(
  geojson: any,
): Promise<{ upload_id?: string; geojson?: any; chunked: boolean }> {
  const str = JSON.stringify(geojson);

  if (str.length <= CHUNK_SIZE) {
    return { geojson, chunked: false };
  }

  const upload_id = crypto.randomUUID();
  const total_chunks = Math.ceil(str.length / CHUNK_SIZE);

  for (let i = 0; i < total_chunks; i++) {
    const data = str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id, chunk_index: i, total_chunks, data }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `Chunk upload failed at chunk ${i} of ${total_chunks}`);
    }
  }

  return { upload_id, chunked: true };
}

// ─────────────────────────────────────────────────────────────────
//  Export helpers
// ─────────────────────────────────────────────────────────────────

export async function exportMapPNG(geojson: any, width = 1920, height = 1080, dpi = 300): Promise<Blob> {
  const { geojson: direct, upload_id, chunked } = await uploadGeoJSONInChunks(geojson);
  const body = chunked ? { upload_id, width, height, dpi } : { geojson: direct, width, height, dpi };
  const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/export/png`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  const { geojson: direct, upload_id, chunked } = await uploadGeoJSONInChunks(geojson);
  const body = chunked
    ? { upload_id, format, orientation, heading }
    : { geojson: direct, format, orientation, heading };
  const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/export/pdf`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || `PDF export failed: ${r.statusText}`); }
  return r.blob();
}

export async function geojsonToShapefile(geojson: any, filename = 'export'): Promise<Blob> {
  const { geojson: direct, upload_id, chunked } = await uploadGeoJSONInChunks(geojson);
  const body = chunked ? { upload_id, filename } : { geojson: direct, filename };
  const r = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/mapplot/export/shapefile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || `Shapefile export failed: ${r.statusText}`); }
  return r.blob();
}