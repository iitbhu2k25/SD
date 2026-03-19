'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import {
  ANALYSIS_TOOLS,
} from '../constants/app.constants';
import type { SidebarProps } from '../types/map.types';
import { fetchGeoJSON, fetchShapefileDirectory, isAcceptedFile, uploadShapefile } from '../services/api.service';
import type { UploadProgress, CrsMeta } from '../services/api.service';

// ─────────────────────────────────────────────────────────────────
//  Phase display maps
// ─────────────────────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  queued:     'Queued…',
  receiving:  'Uploading',
  extracting: 'Extracting',
  reading:    'Reading data',
  crs_check:  'Checking CRS',
  converting: 'Converting',
  done:       'Complete',
  error:      'Error',
};

const PHASE_ICON: Record<string, string> = {
  queued:     'fas fa-hourglass-start',
  receiving:  'fg-layer-upload',
  extracting: 'fg-geojson-file',
  reading:    'fg-map',
  crs_check:  'fg-globe',
  converting: 'fas fa-cogs',
  done:       'fas fa-check-circle',
  error:      'fas fa-times-circle',
};

function CrsTag({ crs }: { crs: CrsMeta }) {
  const orig = crs.original;
  const wasReprojected = crs.reprojected;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <i className="fg-globe" style={{ fontSize: 9 }} />
        {orig.code || 'No CRS'}
      </span>
      {wasReprojected ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <i className="fas fa-arrow-right text-[9px]" />
          WGS-84
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <i className="fas fa-check text-[9px]" />
          WGS-84
        </span>
      )}
      {orig.assumed && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <i className="fas fa-exclamation-triangle text-[9px]" />
          CRS assumed
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Sidebar component
// ─────────────────────────────────────────────────────────────────

export default function Sidebar({
  collapsed,
  onToggle,
  onMapLayerChange,
  onFeatureInfoToggle,
  onCompassToggle,
  onGridToggle,
  showNotification,
  onUploadShapefile,
}: SidebarProps) {

  // ── Feature selection state ──────────────────────────────────
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [directory, setDirectory] = useState<Record<string, string[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);

  // ── Display settings ─────────────────────────────────────────
  const [showGrid, setShowGrid] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showCompass, setShowCompass] = useState(true);

  // ── Upload state ─────────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadDone, setUploadDone] = useState(false);

  // ── Dropdown state ───────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryLoadedRef = useRef(false);

  // ── Load directory once ──────────────────────────────────────
  useEffect(() => {
    if (directoryLoadedRef.current) return;
    const load = async () => {
      try {
        setLoadingDirectory(true);
        const data = await fetchShapefileDirectory();
        setDirectory(data);
        const cats = Object.keys(data);
        setCategories(cats);
        if (cats.length > 0) setCategory(cats[0]);
        directoryLoadedRef.current = true;
      } catch {
        showNotification('Error', 'Failed to load shapefile directory', 'error');
      } finally {
        setLoadingDirectory(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (category && directory[category]) {
      const subs = directory[category];
      setSubcategories(subs);
      setSubcategory(subs[0] ?? '');
    } else {
      setSubcategories([]);
      setSubcategory('');
    }
  }, [category, directory]);

  useEffect(() => { onGridToggle?.(showGrid); }, [showGrid, onGridToggle]);
  useEffect(() => { onFeatureInfoToggle?.(showInfoPanel); }, [showInfoPanel, onFeatureInfoToggle]);
  useEffect(() => { onCompassToggle?.(showCompass); }, [showCompass, onCompassToggle]);

  const toggleDropdown = useCallback((id: string) => {
    setOpenDropdown(prev => prev === id ? '' : id);
  }, []);

  // ── Load shapefile from server ───────────────────────────────
  const loadShapefile = useCallback(async () => {
    if (!category || !subcategory) {
      showNotification('Error', 'Please select both category and subcategory', 'error');
      return;
    }
    try {
      showNotification('Loading', 'Fetching vector data…', 'info');
      const geoJsonData = await fetchGeoJSON(category, subcategory);
      if (typeof window !== 'undefined' && window.loadGeoJSON) {
        const layer = await window.loadGeoJSON(geoJsonData, {});
        if (layer) {
          onMapLayerChange(layer);
          showNotification('Success', 'Vector data loaded successfully', 'success');
        }
      }
    } catch (error: any) {
      showNotification('Error', `Failed to load data: ${error.message}`, 'error');
    }
  }, [category, subcategory, showNotification, onMapLayerChange]);

  // ── Analysis ─────────────────────────────────────────────────
  const selectAnalysisTool = useCallback((tool: string) => {
    toggleDropdown('');
    if (tool === 'Spatial Analysis (All Operations)') {
      if (typeof window !== 'undefined' && window.openSpatialAnalysisModal) window.openSpatialAnalysisModal();
      showNotification('Spatial Analysis', 'Opening spatial analysis toolkit', 'info');
    } else if (tool === 'Intersection') {
      if (typeof window !== 'undefined' && window.openIntersectionModal) window.openIntersectionModal();
      showNotification('Analysis Tool', `${tool} selected`, 'info');
    } else {
      showNotification('Analysis Tool', `${tool} selected`, 'info');
    }
  }, [showNotification, toggleDropdown]);

  // ── File picking ─────────────────────────────────────────────
  const handleFilePick = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const rejected = arr.filter(f => !isAcceptedFile(f.name));
    if (rejected.length > 0 && rejected.length === arr.length) {
      showNotification('Warning', 'Unrecognised file type — the server will validate. Continuing…', 'error');
    }
    setSelectedFiles(arr);
    setUploadProgress(null);
    setUploadDone(false);
  }, [showNotification]);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilePick(e.target.files);
  }, [handleFilePick]);

  // ── Drag-and-drop ────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragOver(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFilePick(e.dataTransfer.files);
  }, [handleFilePick]);

  // ── Upload ───────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      showNotification('Error', 'No file selected', 'error');
      return;
    }

    setUploadDone(false);
    setUploadProgress({ pct: 0, phase: 'queued', msg: 'Starting…' });

    const onProgress = (p: UploadProgress) => {
      setUploadProgress(p);
      // Progressive rendering: add each feature batch to the map as it arrives
      if (p.geojsonChunk && typeof window !== 'undefined' && window.addGeoJSONChunk) {
        window.addGeoJSONChunk(p.geojsonChunk);
      }
    };

    try {
      // uploadShapefile streams SSE progress and resolves with fully-accumulated GeoJSON
      const geojson = await uploadShapefile(selectedFiles, onProgress);

      // Mark done in UI
      setUploadDone(true);

      // Finalize the layer (fit bounds, register in layer panel)
      // All features are already on the map via addGeoJSONChunk above
      if (typeof window !== 'undefined' && window.finalizeGeoJSONLayer) {
        window.finalizeGeoJSONLayer(geojson);
      }

      const count = geojson._feature_count ?? geojson.features?.length ?? '?';
      showNotification('Success', `${count} features plotted`, 'success');

    } catch (e: any) {
      setUploadProgress({ pct: 0, phase: 'error', msg: e?.message || 'Upload failed' });
      setUploadDone(false);
      showNotification('Error', e?.message || 'Upload failed', 'error');
    }
  }, [selectedFiles, onMapLayerChange, showNotification]);

  // ── New Upload — clears state so user can upload another file ─
  const handleNewUpload = useCallback(() => {
    setSelectedFiles([]);
    setUploadProgress(null);
    setUploadDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Clear (error / pre-upload) ────────────────────────────────
  const clearUpload = useCallback(() => {
    setSelectedFiles([]);
    setUploadProgress(null);
    setUploadDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Derived ──────────────────────────────────────────────────
  const isUploading = uploadProgress !== null && !uploadDone && uploadProgress.phase !== 'error';
  const hasError    = uploadProgress?.phase === 'error';
  const crsData     = uploadProgress?.meta?.crs as CrsMeta | undefined;
  const featureCount = uploadProgress?.meta?.feature_count;

  const progressPct = uploadProgress?.pct ?? 0;
  const phaseLabel  = uploadProgress ? (PHASE_LABELS[uploadProgress.phase] ?? uploadProgress.phase) : '';
  const phaseIcon   = uploadProgress ? (PHASE_ICON[uploadProgress.phase]  ?? 'fa-spinner') : '';

  return (
    <>
      <div
        className="w-[300px] h-full overflow-y-auto z-10 flex-shrink-0"
        style={{ background: '#f8fafc', borderRight: '1px solid #e2e8f0', boxShadow: '2px 0 12px rgba(0,0,0,0.08)' }}
      >
        <div style={{ padding: '14px 14px 14px' }}>

        {/* ══════════════════════════════════════════════════════
            UPLOAD SECTION
        ══════════════════════════════════════════════════════ */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md">
          <div className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
            <i className="fg-layer-upload text-emerald-600 text-base" />
            Upload Spatial File
          </div>

          {/* Drop zone — hidden when upload is done */}
          {!uploadDone && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed
                cursor-pointer select-none transition-all duration-200 py-5 px-3 text-center
                ${isDragOver
                  ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                  : selectedFiles.length > 0
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40'
                }
                ${isUploading ? 'cursor-not-allowed opacity-70' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".zip,.shp,.dbf,.shx,.prj,.cpg,.qpj,.geojson,.json,.gpkg,.kml,.kmz,.gml,.fgb,.tab,.mif,.csv"
                className="hidden"
                onChange={onFileInputChange}
                disabled={isUploading}
              />

              {selectedFiles.length === 0 ? (
                <>
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors
                    ${isDragOver ? 'bg-emerald-100' : 'bg-gray-100'}
                  `}>
                    <i className={`fg-layer-upload text-xl ${isDragOver ? 'text-emerald-600' : 'text-gray-400'}`} />
                  </div>
                  <p className="text-xs font-medium text-gray-600">
                    {isDragOver ? 'Drop files here' : 'Drag & drop or click to browse'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    .zip · .shp · .geojson · .gpkg · .kml · and more
                  </p>
                </>
              ) : (
                <div className="w-full space-y-1">
                  {selectedFiles.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-left bg-white rounded-lg px-2 py-1.5 border border-blue-100">
                      <i className="fg-geojson-file text-blue-400 flex-shrink-0" />
                      <span className="truncate text-gray-700 flex-1">{f.name}</span>
                      <span className="text-gray-400 flex-shrink-0 text-[10px]">
                        {f.size > 1_048_576
                          ? `${(f.size / 1_048_576).toFixed(1)} MB`
                          : `${(f.size / 1024).toFixed(0)} KB`}
                      </span>
                    </div>
                  ))}
                  {selectedFiles.length > 4 && (
                    <p className="text-[10px] text-gray-400 text-center">
                      +{selectedFiles.length - 4} more file{selectedFiles.length - 4 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress block */}
          {uploadProgress && (
            <div className={`
              mt-3 rounded-xl border px-3 py-2.5 transition-all
              ${hasError
                ? 'bg-red-50 border-red-200'
                : uploadDone
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-white border-gray-200 shadow-sm'
              }
            `}>
              {/* Phase header */}
              <div className="flex items-center gap-2 mb-1.5">
                <i className={`${phaseIcon} text-sm ${
                  hasError ? 'text-red-500' : uploadDone ? 'text-emerald-600' : 'text-blue-500'
                } ${isUploading ? 'fa-spin' : ''}`} />
                <span className={`text-xs font-semibold ${
                  hasError ? 'text-red-700' : uploadDone ? 'text-emerald-700' : 'text-gray-700'
                }`}>
                  {phaseLabel}
                </span>
                <span className="ml-auto text-xs font-mono font-medium text-gray-500">
                  {progressPct}%
                </span>
              </div>

              {/* Progress bar */}
              {!hasError && (
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      uploadDone ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              {/* Message */}
              <p className={`text-[10px] leading-relaxed ${
                hasError ? 'text-red-600' : 'text-gray-500'
              }`}>
                {uploadProgress.msg}
              </p>

              {/* CRS tags */}
              {crsData && <CrsTag crs={crsData} />}

              {/* Feature count */}
              {featureCount !== undefined && uploadDone && (
                <p className="mt-1.5 text-[11px] font-semibold text-emerald-700">
                  <i className="fg-layer-stack mr-1" />
                  {featureCount.toLocaleString()} features loaded
                </p>
              )}
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────── */}
          <div className="flex gap-2 mt-3">

            {/* SUCCESS STATE — show only "New Upload" button */}
            {uploadDone && (
              <button
                onClick={handleNewUpload}
                className="flex-1 py-2 px-3 rounded-lg text-white text-xs font-semibold
                  flex items-center justify-center gap-1.5 transition-all duration-200
                  bg-blue-500 hover:bg-blue-600 hover:shadow-md active:scale-95"
              >
                <i className="fas fa-plus" /> New Upload
              </button>
            )}

            {/* ERROR STATE — retry button */}
            {hasError && (
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0}
                className="flex-1 py-2 px-3 rounded-lg text-white text-xs font-semibold
                  flex items-center justify-center gap-1.5 transition-all duration-200
                  bg-red-500 hover:bg-red-600 hover:shadow-md active:scale-95"
              >
                <i className="fas fa-redo" /> Retry
              </button>
            )}

            {/* DEFAULT / UPLOADING STATE — Upload & Plot button */}
            {!uploadDone && !hasError && (
              <button
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className={`
                  flex-1 py-2 px-3 rounded-lg text-white text-xs font-semibold
                  flex items-center justify-center gap-1.5 transition-all duration-200
                  ${isUploading || selectedFiles.length === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md active:scale-95'
                  }
                `}
              >
                {isUploading
                  ? <><i className="fas fa-circle-notch fa-spin" /> Uploading…</>
                  : <><i className="fg-layer-upload" /> Upload & Plot</>
                }
              </button>
            )}

            {/* Clear / cancel button — hidden when done */}
            {!uploadDone && (selectedFiles.length > 0 || uploadProgress) && (
              <button
                onClick={clearUpload}
                disabled={isUploading}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs transition-colors active:scale-95"
                title="Clear"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            FEATURE SELECTION
        ══════════════════════════════════════════════════════ */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md">
          <div className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
            <i className="fg-layers text-blue-500" />
            Feature Selection
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loadingDirectory || categories.length === 0}
                className="w-full p-2.5 pr-8 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm cursor-pointer transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              <i className="fas fa-chevron-down text-gray-400 text-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {loadingDirectory && <p className="mt-1 text-[10px] text-blue-500">Loading…</p>}
            {!loadingDirectory && categories.length === 0 && (
              <p className="mt-1 text-[10px] text-amber-600">No categories available</p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Subcategory <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={subcategory}
                disabled={!category || subcategories.length === 0}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full p-2.5 pr-8 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm cursor-pointer transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200 appearance-none"
              >
                <option value="">Select Subcategory</option>
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub === 'all' ? 'All Files' : sub.charAt(0).toUpperCase() + sub.slice(1)}
                  </option>
                ))}
              </select>
              <i className="fas fa-chevron-down text-gray-400 text-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {!category && <p className="mt-1 text-[10px] text-gray-400 italic">Select category first</p>}
          </div>

          <button
            onClick={loadShapefile}
            disabled={!category || !subcategory}
            className={`
              w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold flex justify-center items-center gap-2 transition-all duration-200
              ${!category || !subcategory
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 hover:shadow-md active:scale-[0.98]'
              }
            `}
          >
            <i className="fg-map" /> Plot Features
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            DISPLAY SETTINGS
        ══════════════════════════════════════════════════════ */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md">
          <div className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
            <i className="fas fa-sliders-h text-blue-500" />
            Display Settings
          </div>

          {[
            { id: 'info',    label: 'Show Info Panel', value: showInfoPanel, onChange: setShowInfoPanel },
            { id: 'compass', label: 'Show Compass',    value: showCompass,   onChange: setShowCompass  },
          ].map(({ id, label, value, onChange }) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer select-none mb-2 last:mb-0">
              <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-xs text-gray-600">{label}</span>
            </label>
          ))}
        </div>
        </div>{/* end padding wrapper */}
      </div>

    </>
  );
}