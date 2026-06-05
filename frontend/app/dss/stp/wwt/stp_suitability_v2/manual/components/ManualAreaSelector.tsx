"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { useManualAreaStore, type AreaInputMethod } from "../stores/manualAreaStore";
import { useManualMapStore } from "../stores/manualMapStore";
import { useManualUiStore } from "../stores/manualUiStore";
import { useManualCategoryStore } from "../stores/manualCategoryStore";
import { confirmManualAreaSelection, fetchManualSuitabilityDisplayRaster, fetchDrainsInBbox, checkManualConstraints, confirmMultiPolygonSingleFile, confirmMultiDrawnPolygons, previewPolygon } from "../services/manual_stpSuitabilityApi";
import type { ClipRasters, MultiPolygonEntry } from "../services/manual_stpSuitabilityTypes";
import { useManualMultiStore } from "../stores/manualMultiStore";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import turfArea from "@turf/area";

const GEOSERVER_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? "";

async function fetchVillageGeoJSON(layerName: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const url = `${GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=vector_work:${layerName}&outputFormat=application/json&srsname=EPSG:4326`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as GeoJSON.FeatureCollection;
  } catch {
    return null;
  }
}

function filterDrainsInsideVillages(
  drains: { Drain_No: number; latitude: number; longitude: number }[],
  villageGeoJSON: GeoJSON.FeatureCollection,
): { Drain_No: number; latitude: number; longitude: number }[] {
  return drains.filter((d) => {
    const pt = point([d.longitude, d.latitude]);
    return villageGeoJSON.features.some((feature) =>
      booleanPointInPolygon(pt, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
    );
  });
}

const METHOD_OPTIONS: { id: AreaInputMethod; label: string; icon: React.ReactNode }[] = [
  {
    id: "shapefile",
    label: "Upload Shapefile",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: "polygon",
    label: "Draw Polygon",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: "kml",
    label: "Upload KML",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

function ShapefileUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFiles = useManualAreaStore((s) => s.uploadedFiles);
  const addUploadedFile = useManualAreaStore((s) => s.addUploadedFile);
  const removeUploadedFile = useManualAreaStore((s) => s.removeUploadedFile);
  const setPreviewGeojson = useManualAreaStore((s) => s.setPreviewGeojson);
  const previewGeojson = useManualAreaStore((s) => s.previewGeojson);
  const markedAreaHa = useManualAreaStore((s) => s.markedAreaHa);
  const selectionsLocked = useManualAreaStore((s) => s.selectionsLocked);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setPreviewGeojson(null);
    for (const file of picked) {
      if (!file.name.endsWith(".zip") && !file.name.endsWith(".shp")) {
        toast.error(`${file.name}: please upload .zip or .shp files only`);
        continue;
      }
      addUploadedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Upload one or more zipped shapefiles (.zip) or .shp files.
      </p>
      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-6 text-center transition hover:border-violet-500 hover:bg-violet-100"
        onClick={() => fileInputRef.current?.click()}
      >
        <svg className="mb-2 h-8 w-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span className="text-sm font-medium text-violet-600">Click to browse</span>
        <span className="mt-0.5 text-xs text-slate-400">.zip or .shp — multiple allowed</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.shp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {uploadedFiles.length > 0 && (
        <ul className="space-y-1">
          {uploadedFiles.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-slate-700">
              <span className="truncate max-w-[80%]">{f.name}</span>
              <button
                type="button"
                onClick={() => { removeUploadedFile(i); setPreviewGeojson(null); }}
                className="ml-2 text-red-400 hover:text-red-600 shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {(() => {
        const totalHa = previewGeojson
          ? previewGeojson.features.reduce((sum, f) => sum + (Number((f as any).properties?.area_ha) || 0), 0)
          : selectionsLocked ? markedAreaHa : 0;
        return totalHa > 0 ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs font-semibold text-emerald-700">
              Area: {totalHa.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ha
            </span>
          </div>
        ) : null;
      })()}
    </div>
  );
}

function KmlUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFiles = useManualAreaStore((s) => s.uploadedFiles);
  const addUploadedFile = useManualAreaStore((s) => s.addUploadedFile);
  const removeUploadedFile = useManualAreaStore((s) => s.removeUploadedFile);
  const setPreviewGeojson = useManualAreaStore((s) => s.setPreviewGeojson);
  const previewGeojson = useManualAreaStore((s) => s.previewGeojson);
  const markedAreaHa = useManualAreaStore((s) => s.markedAreaHa);
  const selectionsLocked = useManualAreaStore((s) => s.selectionsLocked);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setPreviewGeojson(null);
    for (const file of picked) {
      if (!file.name.endsWith(".kml") && !file.name.endsWith(".kmz")) {
        toast.error(`${file.name}: please upload .kml or .kmz files only`);
        continue;
      }
      addUploadedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Upload one or more KML or KMZ files exported from Google Earth or similar tools.
      </p>
      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 px-4 py-6 text-center transition hover:border-violet-500 hover:bg-violet-100"
        onClick={() => fileInputRef.current?.click()}
      >
        <svg className="mb-2 h-8 w-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium text-violet-600">Click to browse</span>
        <span className="mt-0.5 text-xs text-slate-400">.kml or .kmz — multiple allowed</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".kml,.kmz"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {uploadedFiles.length > 0 && (
        <ul className="space-y-1">
          {uploadedFiles.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-slate-700">
              <span className="truncate max-w-[80%]">{f.name}</span>
              <button
                type="button"
                onClick={() => { removeUploadedFile(i); setPreviewGeojson(null); }}
                className="ml-2 text-red-400 hover:text-red-600 shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {(() => {
        const totalHa = previewGeojson
          ? previewGeojson.features.reduce((sum, f) => sum + (Number((f as any).properties?.area_ha) || 0), 0)
          : selectionsLocked ? markedAreaHa : 0;
        return totalHa > 0 ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs font-semibold text-emerald-700">
              Area: {totalHa.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ha
            </span>
          </div>
        ) : null;
      })()}
    </div>
  );
}

function PolygonDrawer() {
  const { drawnPolygon, setDrawnPolygon, drawnPolygons, removeDrawnPolygon, setDrawnPolygons } = useManualAreaStore();
  const drawingActive = useManualMapStore((state) => state.drawingActive);
  const setDrawingActive = useManualMapStore((state) => state.setDrawingActive);

  const handleClearAll = () => {
    setDrawnPolygon(null);
    setDrawnPolygons([]);
    setDrawingActive(false);
  };

  const handleRemoveOne = (index: number) => {
    removeDrawnPolygon(index);
    if (drawnPolygons.length === 1) setDrawnPolygon(null);
  };

  return (
    <div className="space-y-2">
      {/* Drawing active indicator — low opacity, informational only */}
      {drawingActive && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 opacity-70">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Click on map to draw polygons · Double click to complete polygon · Right-click or click Done to stop drawing
          </div>
          <button
            type="button"
            onClick={() => setDrawingActive(false)}
            className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
          >
            Done
          </button>
        </div>
      )}

      {/* Drawn polygons list */}
      {drawnPolygons.length > 0 && (
        <div className="space-y-1.5">
          {drawnPolygons.map((p, i) => {
            const areaHa = turfArea({ type: "Feature", geometry: p.geojson, properties: {} }) / 10000;
            return (
              <div key={i} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Polygon {i + 1}</p>
                  <p className="text-[10px] text-emerald-600">{areaHa.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ha</p>
                </div>
                <button type="button" onClick={() => handleRemoveOne(i)} className="ml-2 text-red-400 hover:text-red-600 text-xs font-semibold">✕</button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDrawingActive(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 shadow-sm transition hover:border-violet-400 hover:bg-violet-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Another
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-500 shadow-sm transition hover:border-red-300 hover:bg-red-50"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* No polygons yet — show Draw on Map button */}
      {drawnPolygons.length === 0 && !drawingActive && (
        <button
          type="button"
          onClick={() => setDrawingActive(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-300 bg-violet-50 px-3 py-3 text-xs font-semibold text-violet-600 transition hover:border-violet-400 hover:bg-violet-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Draw on Map
        </button>
      )}
    </div>
  );
}

function isReadyToConfirm(
  method: AreaInputMethod,
  uploadedFiles: File[],
  drawnPolygon: { geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon; label: string } | null,
  previewGeojson: GeoJSON.FeatureCollection | null,
  drawnPolygons: { geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon; label: string }[],
): boolean {
  if (method === "shapefile" || method === "kml") return uploadedFiles.length > 0 && previewGeojson !== null;
  return drawnPolygons.length > 0 || drawnPolygon !== null;
}

function DrainSelector() {
  const drainPoints = useManualAreaStore((state) => state.drainPoints);
  const selectedDrainNos = useManualAreaStore((state) => state.selectedDrainNos);
  const setSelectedDrainNos = useManualAreaStore((state) => state.setSelectedDrainNos);
  const drainCapacityMld = useManualAreaStore((state) => state.drainCapacityMld);
  const setDrainCapacityMld = useManualAreaStore((state) => state.setDrainCapacityMld);
  const setRightPanelOpen = useManualUiStore((state) => state.setRightPanelOpen);
  const showDrainLabels = useManualMapStore((state) => state.showDrainLabels);
  const setShowDrainLabels = useManualMapStore((state) => state.setShowDrainLabels);
  const [open, setOpen] = useState(false);
  const [nextClicked, setNextClicked] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (drainPoints.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
        <label className="block mb-3">
          <span className="mb-1 block text-xs font-semibold text-violet-700">
            Drain Capacity (MLD) <span className="text-red-500">*</span>
          </span>
          <p className="mb-1.5 text-[10px] text-slate-500">
            Total capacity of the drain(s). An alert will show if STP Capacity is set lower.
          </p>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100000}
              step={0.1}
              value={drainCapacityMld ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Math.min(Number(e.target.value), 100000);
                setDrainCapacityMld(v !== null && Number.isFinite(v) ? v : null);
                setNextClicked(false);
              }}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-violet-300 bg-white px-3 py-2 pr-14 text-sm text-slate-700 outline-none transition focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
              MLD
            </span>
          </div>
        </label>
        <button
          type="button"
          disabled={drainCapacityMld === null || drainCapacityMld === undefined || nextClicked}
          onClick={() => { setNextClicked(true); setRightPanelOpen(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          Next
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  const allSelected = selectedDrainNos.length === 0;

  const toggleDrain = (no: number) => {
    if (selectedDrainNos.includes(no)) {
      const next = selectedDrainNos.filter((n) => n !== no);
      setSelectedDrainNos(next);
    } else {
      setSelectedDrainNos([...selectedDrainNos, no]);
    }
  };

  const selectAll = () => setSelectedDrainNos([]);

  const label = allSelected
    ? `All Drains (${drainPoints.length})`
    : selectedDrainNos.length === 1
    ? `Drain ${selectedDrainNos[0]}`
    : `${selectedDrainNos.length} Drains selected`;

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-violet-700">Available Drains</p>
        <button
          type="button"
          onClick={() => setShowDrainLabels(!showDrainLabels)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
            showDrainLabels
              ? "border-violet-400 bg-violet-600 text-white"
              : "border-violet-300 bg-white text-violet-600 hover:bg-violet-50"
          }`}
        >
          {showDrainLabels ? "Labels ON" : "Labels OFF"}
        </button>
      </div>
      <p className="mb-2 text-[10px] text-slate-500">
        Select drains for path-finding. Leave all selected to find nearest from all.
      </p>

      {/* Dropdown trigger */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-400"
        >
          <span>{label}</span>
          <svg
            className={`h-3.5 w-3.5 text-violet-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-violet-200 bg-white shadow-lg">
            {/* All option */}
            <button
              type="button"
              onClick={() => { selectAll(); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-violet-50 ${
                allSelected ? "font-semibold text-violet-700 bg-violet-50" : "text-slate-600"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  allSelected ? "border-violet-500 bg-violet-500" : "border-slate-300 bg-white"
                }`}
              >
                {allSelected && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              All Drains ({drainPoints.length})
            </button>

            <div className="border-t border-slate-100" />

            {/* Individual drains */}
            {drainPoints.map((dp) => {
              const checked = selectedDrainNos.includes(dp.Drain_No);
              return (
                <button
                  key={dp.Drain_No}
                  type="button"
                  onClick={() => toggleDrain(dp.Drain_No)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-violet-50 ${
                    checked ? "font-semibold text-violet-700 bg-violet-50" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      checked ? "border-violet-500 bg-violet-500" : "border-slate-300 bg-white"
                    }`}
                  >
                    {checked && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  Drain {dp.Drain_No}
                  <span className="ml-auto text-[10px] text-slate-400">
                    {dp.latitude.toFixed(4)}, {dp.longitude.toFixed(4)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Drain capacity input */}
      <div className="mt-3 border-t border-violet-200 pt-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-violet-700">
            Drain Capacity (MLD) <span className="text-red-500">*</span>
          </span>
          <p className="mb-1.5 text-[10px] text-slate-500">
            Total capacity of the drain(s). An alert will show if STP Capacity is set lower.
          </p>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100000}
              step={0.1}
              value={drainCapacityMld ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Math.min(Number(e.target.value), 100000);
                setDrainCapacityMld(v !== null && Number.isFinite(v) ? v : null);
                setNextClicked(false);
              }}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-violet-300 bg-white px-3 py-2 pr-14 text-sm text-slate-700 outline-none transition focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
              MLD
            </span>
          </div>
        </label>
      </div>

      {/* Next button — opens right panel */}
      <button
        type="button"
        disabled={drainCapacityMld === null || drainCapacityMld === undefined || nextClicked}
        onClick={() => { setNextClicked(true); setRightPanelOpen(true); }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
      >
        Next
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function PolygonDrainDropdown({ entry }: { entry: import("../services/manual_stpSuitabilityTypes").MultiPolygonEntry }) {
  const updateEntryDrainNos = useManualMultiStore((s) => s.updateEntryDrainNos);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allSelected = entry.selectedDrainNos.length === 0;

  const toggle = (no: number) => {
    const next = entry.selectedDrainNos.includes(no)
      ? entry.selectedDrainNos.filter((n) => n !== no)
      : [...entry.selectedDrainNos, no];
    updateEntryDrainNos(entry.index, next);
  };

  const label = allSelected
    ? `All Drains (${entry.drainPoints.length})`
    : entry.selectedDrainNos.length === 1
    ? `Drain ${entry.selectedDrainNos[0]}`
    : `${entry.selectedDrainNos.length} Drains selected`;

  if (entry.drainPoints.length === 0) {
    return <p className="text-[10px] text-slate-400 italic">No drains found in this area.</p>;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-400"
      >
        <span>{label}</span>
        <svg className={`h-3.5 w-3.5 text-violet-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-violet-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { updateEntryDrainNos(entry.index, []); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-violet-50 ${allSelected ? "font-semibold text-violet-700 bg-violet-50" : "text-slate-600"}`}
          >
            <span className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${allSelected ? "border-violet-500 bg-violet-500" : "border-slate-300 bg-white"}`}>
              {allSelected && <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </span>
            All Drains ({entry.drainPoints.length})
          </button>
          <div className="border-t border-slate-100" />
          {entry.drainPoints.map((dp) => {
            const checked = entry.selectedDrainNos.includes(dp.Drain_No);
            return (
              <button
                key={dp.Drain_No}
                type="button"
                onClick={() => toggle(dp.Drain_No)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-violet-50 ${checked ? "font-semibold text-violet-700 bg-violet-50" : "text-slate-600"}`}
              >
                <span className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? "border-violet-500 bg-violet-500" : "border-slate-300 bg-white"}`}>
                  {checked && <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </span>
                Drain {dp.Drain_No}
                <span className="ml-auto text-[10px] text-slate-400">{dp.latitude.toFixed(4)}, {dp.longitude.toFixed(4)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultiDrainSelector() {
  const polygonEntries = useManualMultiStore((s) => s.polygonEntries);
  const drainCapacityMld = useManualMultiStore((s) => s.drainCapacityMld);
  const setDrainCapacityMld = useManualMultiStore((s) => s.setDrainCapacityMld);
  const setRightPanelOpen = useManualUiStore((s) => s.setRightPanelOpen);
  const showDrainLabels = useManualMapStore((s) => s.showDrainLabels);
  const setShowDrainLabels = useManualMapStore((s) => s.setShowDrainLabels);
  const [nextClicked, setNextClicked] = useState(false);

  const totalDrains = polygonEntries.reduce((sum, e) => sum + e.drainPoints.length, 0);

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-violet-700">
          {polygonEntries.length} polygon(s) — {totalDrains} drain(s) found
        </p>
        <button
          type="button"
          onClick={() => setShowDrainLabels(!showDrainLabels)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
            showDrainLabels
              ? "border-violet-400 bg-violet-600 text-white"
              : "border-violet-300 bg-white text-violet-600 hover:bg-violet-50"
          }`}
        >
          {showDrainLabels ? "Labels ON" : "Labels OFF"}
        </button>
      </div>
      <p className="mb-2 text-[10px] text-slate-500">
        Select drains per polygon for path-finding. Leave all selected to use all drains.
      </p>

      {/* Per-polygon drain dropdowns */}
      <div className="mb-3 space-y-2">
        {polygonEntries.map((entry) => (
          <div key={entry.index}>
            <p className="mb-1 text-[10px] font-semibold text-violet-600">Polygon {entry.index + 1}</p>
            <PolygonDrainDropdown entry={entry} />
          </div>
        ))}
      </div>

      {/* Drain capacity input */}
      <label className="block border-t border-violet-200 pt-3">
        <span className="mb-1 block text-xs font-semibold text-violet-700">
          Drain Capacity (MLD) <span className="text-red-500">*</span>
        </span>
        <p className="mb-1.5 text-[10px] text-slate-500">
          Total capacity of the drain(s). An alert will show if STP Capacity is set lower.
        </p>
        <div className="relative">
          <input
            type="number"
            min={0}
            step={0.1}
            value={drainCapacityMld ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              setDrainCapacityMld(v !== null && Number.isFinite(v) ? v : null);
              setNextClicked(false);
            }}
            placeholder="e.g. 10"
            className="w-full rounded-xl border border-violet-300 bg-white px-3 py-2 pr-14 text-sm text-slate-700 outline-none transition focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            MLD
          </span>
        </div>
      </label>

      {/* Next button */}
      <button
        type="button"
        disabled={drainCapacityMld === null || drainCapacityMld === undefined || nextClicked}
        onClick={() => { setNextClicked(true); setRightPanelOpen(true); }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
      >
        Next
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function SurfaceRadiusInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(String(value));

  // Keep raw in sync if store value changes externally
  useEffect(() => { setRaw(String(value)); }, [value]);

  const commit = (str: string) => {
    const v = parseFloat(str);
    if (!isNaN(v)) {
      const clamped = parseFloat(Math.min(5, Math.max(0, v)).toFixed(2));
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value));
    }
  };

  const step = (delta: number) => {
    const next = parseFloat(Math.min(5, Math.max(0, value + delta)).toFixed(2));
    onChange(next);
    setRaw(String(next));
  };

  return (
    <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700">Surface Radius (km)</span>
        <span className="text-[10px] text-slate-400">Range: 0 – 5</span>
      </div>
      <p className="mb-1.5 text-[10px] text-slate-500">Buffer zone around the selected area for village and drain search.</p>
      <div className="flex items-center gap-1.5">
        {/* Decrement */}
        <button
          type="button"
          onClick={() => step(-0.5)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300 bg-white text-violet-600 transition hover:bg-violet-100 active:scale-95"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
          </svg>
        </button>
        {/* Input */}
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={5}
            step={0.01}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(raw); }}
            className="w-full rounded-xl border border-violet-300 bg-white px-3 py-2 pr-10 text-center text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">km</span>
        </div>
        {/* Increment */}
        <button
          type="button"
          onClick={() => step(0.5)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300 bg-white text-violet-600 transition hover:bg-violet-100 active:scale-95"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ConstraintViolationModal({
  violations,
  onRedraw,
  onFindDss,
}: {
  violations: string[];
  onRedraw: () => void;
  onFindDss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold text-red-700">Constraint Detected</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The following constraints are present inside your drawn area:
            </p>
          </div>
        </div>

        {/* Violation list */}
        <ul className="mb-4 space-y-1 rounded-xl border border-red-100 bg-red-50 p-3">
          {violations.map((v) => (
            <li key={v} className="flex items-center gap-2 text-xs font-medium text-red-700">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
              {v}
            </li>
          ))}
        </ul>

        <p className="mb-4 text-xs text-slate-500">
          You can redraw the area to avoid these constraints, or proceed using DSS analysis which will account for them automatically.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onRedraw}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Redraw Area
          </button>
          <button
            type="button"
            onClick={onFindDss}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-purple-500"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Find through DSS
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManualAreaSelector() {
  const {
    selectedMethod,
    uploadedFiles,
    drawnPolygon,
    drawnPolygons,
    selectionsLocked,
    isLoading,
    error,
    previewGeojson,
    surfaceRadius,
    setSelectedMethod,
    confirmSelections,
    unlockSelections,
    setLoading,
    setError,
    setPreviewGeojson,
    setSurfaceRadius,
  } = useManualAreaStore();

  const multiSelectionsLocked = useManualMultiStore((s) => s.selectionsLocked);
  const [isUploading, setIsUploading] = useState(false);

  const syncLayersWithLocation = useManualMapStore(
    useCallback((state) => state.resetMapView, []),
  );
  const setRightPanelOpen = useManualUiStore((state) => state.setRightPanelOpen);
  const setShowDssWorkflow = useManualUiStore((state) => state.setShowDssWorkflow);

  // Constraint violation modal state
  const [constraintViolations, setConstraintViolations] = useState<string[]>([]);
  const [showConstraintModal, setShowConstraintModal] = useState(false);
  const [isMultiConstraintModal, setIsMultiConstraintModal] = useState(false);
  // Store pending confirm result so we can proceed after "Find through DSS" (single-file)
  const pendingConfirmRef = useRef<{
    areaResult: {
      vectorLayer: string | null;
      polygonLayer: string | null;
      centroidLat: number;
      centroidLon: number;
      bufferBbox: [number, number, number, number];
      areaHa: number;
      rasterLayers: ClipRasters[];
    };
    polygonGeojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  } | null>(null);
  // Store pending multi entries so we can proceed after constraint modal (multi-file)
  const pendingMultiEntriesRef = useRef<MultiPolygonEntry[] | null>(null);

  const ready = isReadyToConfirm(selectedMethod, uploadedFiles, drawnPolygon, previewGeojson, drawnPolygons);
  const canUpload = (selectedMethod === "shapefile" || selectedMethod === "kml") && uploadedFiles.length > 0 && !selectionsLocked && !multiSelectionsLocked;

  const handleUpload = async () => {
    if (!canUpload) return;
    setIsUploading(true);
    try {
      const geojson = await previewPolygon({ method: selectedMethod as "shapefile" | "kml", files: uploadedFiles });
      setPreviewGeojson(geojson);
      toast.success("Polygon loaded on map — click Confirm Selection to proceed");
    } catch {
      toast.error("Failed to preview polygon");
    } finally {
      setIsUploading(false);
    }
  };

  const _finalizeConfirm = async (
    areaResult: {
      vectorLayer: string | null;
      polygonLayer: string | null;
      centroidLat: number;
      centroidLon: number;
      bufferBbox: [number, number, number, number];
      areaHa: number;
      rasterLayers: ClipRasters[];
    }
  ) => {
    const polygonLayer = areaResult.polygonLayer || areaResult.vectorLayer;
    const centroid: [number, number] = [areaResult.centroidLat, areaResult.centroidLon];

    let displayRasters: ClipRasters[] = [];
    let drainPoints: { Drain_No: number; latitude: number; longitude: number }[] = [];
    let villageGeoJSON: GeoJSON.FeatureCollection | null = null;
    const bbox = areaResult.bufferBbox as [number, number, number, number];

    await Promise.all([
      fetchManualSuitabilityDisplayRaster(areaResult.vectorLayer!)
        .then((r) => { displayRasters = r.rasterLayers ?? []; })
        .catch(() => {}),
      fetchDrainsInBbox(bbox)
        .then((r) => { drainPoints = r; })
        .catch(() => {}),
      fetchVillageGeoJSON(areaResult.vectorLayer!)
        .then((r) => { villageGeoJSON = r; })
        .catch(() => {}),
    ]);

    if (villageGeoJSON && villageGeoJSON.features.length > 0) {
      drainPoints = filterDrainsInsideVillages(drainPoints, villageGeoJSON);
    }

    confirmSelections(
      areaResult.vectorLayer!,
      displayRasters,
      "",
      centroid,
      polygonLayer,
      bbox,
      drainPoints,
      areaResult.areaHa ?? 0,
    );
    toast.success("Area confirmed — proceed to STP Technology Selection");
  };

  const handleConfirm = async () => {
    if (!ready) return;

    // Multi drawn polygon path: 2+ polygons drawn on map
    if (selectedMethod === "polygon" && drawnPolygons.length > 1) {
      setLoading(true);
      setError(null);
      try {
        const multiResult = await confirmMultiDrawnPolygons(drawnPolygons.map((p) => p.geojson), surfaceRadius);
        if (!multiResult.results || multiResult.results.length === 0) {
          throw new Error("Server returned no results for multi drawn polygon");
        }
        const entries: MultiPolygonEntry[] = await Promise.all(
          multiResult.results.map(async (r, i) => {
            let drainPoints: { Drain_No: number; latitude: number; longitude: number }[] = [];
            let villageGeoJSON: GeoJSON.FeatureCollection | null = null;
            let displayRasters: ClipRasters[] = [];
            await Promise.all([
              fetchDrainsInBbox(r.buffer_bbox)
                .then((d) => { drainPoints = d; })
                .catch(() => {}),
              fetchVillageGeoJSON(r.vector_layer)
                .then((g) => { villageGeoJSON = g; })
                .catch(() => {}),
              fetchManualSuitabilityDisplayRaster(r.vector_layer)
                .then((res) => { displayRasters = res.rasterLayers ?? []; })
                .catch(() => {}),
            ]);
            if (villageGeoJSON && villageGeoJSON.features.length > 0) {
              drainPoints = filterDrainsInsideVillages(drainPoints, villageGeoJSON);
            }
            return {
              index: i,
              vectorLayer: r.vector_layer,
              polygonLayer: r.polygon_layer ?? null,
              centroid: [r.centroid_lat, r.centroid_lon] as [number, number],
              bufferBbox: r.buffer_bbox,
              areaHa: r.area_ha,
              drainPoints,
              selectedDrainNos: [],
              displayRasters,
            };
          })
        );

        // Constraint check per polygon — identical to multi-file path
        const perEntryViolations = await Promise.all(
          entries.map(async (entry) => {
            const labels: string[] = [];
            if (!entry.polygonLayer) return labels;
            const uploaded = await fetchVillageGeoJSON(entry.polygonLayer);
            if (!uploaded || uploaded.features.length === 0) return labels;
            const geom = uploaded.features[0].geometry;
            if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return labels;
            const result = await checkManualConstraints({
              polygon_geojson: geom as GeoJSON.Polygon | GeoJSON.MultiPolygon,
            }).catch(() => null);
            if (result && !result.can_proceed && result.constraint_violations.length > 0) {
              for (const v of result.constraint_violations) {
                labels.push(`Polygon ${entry.index + 1}: ${v}`);
              }
            }
            return labels;
          })
        );
        const allViolations = perEntryViolations.flat();

        if (allViolations.length > 0) {
          pendingMultiEntriesRef.current = entries;
          setConstraintViolations(allViolations);
          setIsMultiConstraintModal(true);
          setShowConstraintModal(true);
          setLoading(false);
          return;
        }

        useManualMultiStore.getState().setPolygonEntries(entries);
        useManualMultiStore.getState().lockSelections();
        toast.success(`${entries.length} polygons confirmed — set drain capacity and click Next`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to confirm drawn polygons";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Single-file multi-polygon path: ask backend to split by row; if it returns >1 result treat as multi
    if ((selectedMethod === "shapefile" || selectedMethod === "kml") && uploadedFiles.length === 1) {
      setLoading(true);
      setError(null);
      try {
        const multiResult = await confirmMultiPolygonSingleFile({ method: selectedMethod, file: uploadedFiles[0], bufferRadiusKm: surfaceRadius });

        // Only 1 polygon found — fall through to the normal single-file path below
        if (!multiResult.results || multiResult.results.length <= 1) {
          setLoading(false);
          // fall through intentionally
        } else {
          // Multiple polygons — identical flow to multi-file path from here
          const entries: MultiPolygonEntry[] = await Promise.all(
            multiResult.results.map(async (r, i) => {
              let drainPoints: { Drain_No: number; latitude: number; longitude: number }[] = [];
              let villageGeoJSON: GeoJSON.FeatureCollection | null = null;
              let displayRasters: ClipRasters[] = [];
              await Promise.all([
                fetchDrainsInBbox(r.buffer_bbox)
                  .then((d) => { drainPoints = d; })
                  .catch(() => {}),
                fetchVillageGeoJSON(r.vector_layer)
                  .then((g) => { villageGeoJSON = g; })
                  .catch(() => {}),
                fetchManualSuitabilityDisplayRaster(r.vector_layer)
                  .then((res) => { displayRasters = res.rasterLayers ?? []; })
                  .catch(() => {}),
              ]);
              if (villageGeoJSON && villageGeoJSON.features.length > 0) {
                drainPoints = filterDrainsInsideVillages(drainPoints, villageGeoJSON);
              }
              return {
                index: i,
                vectorLayer: r.vector_layer,
                polygonLayer: r.polygon_layer ?? null,
                centroid: [r.centroid_lat, r.centroid_lon] as [number, number],
                bufferBbox: r.buffer_bbox,
                areaHa: r.area_ha,
                drainPoints,
                selectedDrainNos: [],
                displayRasters,
              };
            })
          );

          // Constraint check — each entry checked independently, results merged after all settle
          const perEntryViolations = await Promise.all(
            entries.map(async (entry) => {
              const labels: string[] = [];
              if (!entry.polygonLayer) return labels;
              const uploaded = await fetchVillageGeoJSON(entry.polygonLayer);
              if (!uploaded || uploaded.features.length === 0) return labels;
              const geom = uploaded.features[0].geometry;
              if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return labels;
              const result = await checkManualConstraints({
                polygon_geojson: geom as GeoJSON.Polygon | GeoJSON.MultiPolygon,
              }).catch(() => null);
              if (result && !result.can_proceed && result.constraint_violations.length > 0) {
                for (const v of result.constraint_violations) {
                  labels.push(`Polygon ${entry.index + 1}: ${v}`);
                }
              }
              return labels;
            })
          );
          const allViolations = perEntryViolations.flat();

          if (allViolations.length > 0) {
            pendingMultiEntriesRef.current = entries;
            setConstraintViolations(allViolations);
            setIsMultiConstraintModal(true);
            setShowConstraintModal(true);
            setLoading(false);
            return;
          }

          useManualMultiStore.getState().setPolygonEntries(entries);
          useManualMultiStore.getState().lockSelections();
          toast.success(`${entries.length} polygons confirmed — set drain capacity and click Next`);
          setLoading(false);
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to confirm area selection";
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }
    }

    // Multi-file path (shapefile/kml with 2+ files)
    // Each file is processed via confirmMultiPolygonSingleFile (row-by-row split),
    // so a file with N polygons inside contributes N independent entries.
    if ((selectedMethod === "shapefile" || selectedMethod === "kml") && uploadedFiles.length > 1) {
      setLoading(true);
      setError(null);
      try {
        // Call stp_multi_polygon_confirm per file sequentially, flatten all results
        const allResults: import("../services/manual_stpSuitabilityTypes").MultiAreaConfirmSingleResult[] = [];
        for (const file of uploadedFiles) {
          const res = await confirmMultiPolygonSingleFile({ method: selectedMethod, file, bufferRadiusKm: surfaceRadius });
          if (res.results) allResults.push(...res.results);
        }
        if (allResults.length === 0) {
          throw new Error("Server returned no results for multi-area upload");
        }
        // Fetch drains + display rasters for each polygon in parallel
        const entries: MultiPolygonEntry[] = await Promise.all(
          allResults.map(async (r, i) => {
            let drainPoints: { Drain_No: number; latitude: number; longitude: number }[] = [];
            let villageGeoJSON: GeoJSON.FeatureCollection | null = null;
            let displayRasters: ClipRasters[] = [];
            await Promise.all([
              fetchDrainsInBbox(r.buffer_bbox)
                .then((d) => { drainPoints = d; })
                .catch(() => {}),
              fetchVillageGeoJSON(r.vector_layer)
                .then((g) => { villageGeoJSON = g; })
                .catch(() => {}),
              fetchManualSuitabilityDisplayRaster(r.vector_layer)
                .then((res) => { displayRasters = res.rasterLayers ?? []; })
                .catch(() => {}),
            ]);
            if (villageGeoJSON && villageGeoJSON.features.length > 0) {
              drainPoints = filterDrainsInsideVillages(drainPoints, villageGeoJSON);
            }
            return {
              index: i,
              vectorLayer: r.vector_layer,
              polygonLayer: r.polygon_layer ?? null,
              centroid: [r.centroid_lat, r.centroid_lon] as [number, number],
              bufferBbox: r.buffer_bbox,
              areaHa: r.area_ha,
              drainPoints,
              selectedDrainNos: [],
              displayRasters,
            };
          })
        );
        // Run constraint check for each polygon (fetch geometry from GeoServer then check)
        const allViolations: string[] = [];
        await Promise.all(
          entries.map(async (entry) => {
            if (!entry.polygonLayer) return;
            const uploaded = await fetchVillageGeoJSON(entry.polygonLayer);
            if (!uploaded || uploaded.features.length === 0) return;
            const geom = uploaded.features[0].geometry;
            if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return;
            const result = await checkManualConstraints({
              polygon_geojson: geom as GeoJSON.Polygon | GeoJSON.MultiPolygon,
            }).catch(() => null);
            if (result && !result.can_proceed && result.constraint_violations.length > 0) {
              for (const v of result.constraint_violations) {
                const label = `Polygon ${entry.index + 1}: ${v}`;
                if (!allViolations.includes(label)) allViolations.push(label);
              }
            }
          })
        );

        if (allViolations.length > 0) {
          pendingMultiEntriesRef.current = entries;
          setConstraintViolations(allViolations);
          setIsMultiConstraintModal(true);
          setShowConstraintModal(true);
          setLoading(false);
          return;
        }

        // No constraint violations — go straight to technology/cluster selection (no DSS categories)
        useManualMultiStore.getState().setPolygonEntries(entries);
        useManualMultiStore.getState().lockSelections();
        toast.success(`${entries.length} areas confirmed — set drain capacity and click Next`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to confirm multi-area selection";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Single-file path (unchanged)
    setLoading(true);
    setError(null);
    try {
      const areaResult = await confirmManualAreaSelection({
        method: selectedMethod,
        file: uploadedFiles[0] ?? undefined,
        polygon: drawnPolygon?.geojson ?? undefined,
        bufferRadiusKm: surfaceRadius,
      });

      if (!areaResult.vectorLayer) {
        throw new Error("Server did not return area layer");
      }

      // Determine geometry for constraint check:
      // - drawn polygon: use geojson directly
      // - shapefile/kml upload: fetch the uploaded polygon layer from GeoServer WFS
      let polygonGeojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null = drawnPolygon?.geojson ?? null;
      if (!polygonGeojson && areaResult.polygonLayer) {
        const uploaded = await fetchVillageGeoJSON(areaResult.polygonLayer);
        if (uploaded && uploaded.features.length > 0) {
          const geom = uploaded.features[0].geometry;
          if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
            polygonGeojson = geom as GeoJSON.Polygon | GeoJSON.MultiPolygon;
          }
        }
      }

      // Run constraint check if we have a polygon geometry
      if (polygonGeojson) {
        const constraintResult = await checkManualConstraints({ polygon_geojson: polygonGeojson });
        if (!constraintResult.can_proceed && constraintResult.constraint_violations.length > 0) {
          // Store result for later and show modal
          pendingConfirmRef.current = { areaResult, polygonGeojson };
          setConstraintViolations(constraintResult.constraint_violations);
          setShowConstraintModal(true);
          setLoading(false);
          return;
        }
      }

      await _finalizeConfirm(areaResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm area selection";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConstraintRedraw = () => {
    setShowConstraintModal(false);
    setConstraintViolations([]);
    pendingConfirmRef.current = null;
    unlockSelections();
    syncLayersWithLocation();
    setRightPanelOpen(false);
    setShowDssWorkflow(false);
  };

  const handleConstraintFindDss = async () => {
    setShowConstraintModal(false);
    setConstraintViolations([]);
    const pending = pendingConfirmRef.current;
    pendingConfirmRef.current = null;
    if (!pending) return;
    setLoading(true);
    try {
      await _finalizeConfirm(pending.areaResult);
      // Mark DSS workflow active — right panel opens when user clicks Next in DrainSelector
      useManualCategoryStore.getState().reset();
      setShowDssWorkflow(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm area selection";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleMultiConstraintRedraw = () => {
    setShowConstraintModal(false);
    setIsMultiConstraintModal(false);
    setConstraintViolations([]);
    pendingMultiEntriesRef.current = null;
    syncLayersWithLocation();
  };

  const handleMultiConstraintFindDss = () => {
    const entries = pendingMultiEntriesRef.current;
    pendingMultiEntriesRef.current = null;
    setShowConstraintModal(false);
    setIsMultiConstraintModal(false);
    setConstraintViolations([]);
    if (!entries) return;
    useManualMultiStore.getState().setPolygonEntries(entries);
    useManualMultiStore.getState().lockSelections();
    // Flag DSS workflow — right panel will show categories → analyze → technology after Next
    useManualCategoryStore.getState().reset();
    setShowDssWorkflow(true);
    toast.success(`${entries.length} areas confirmed — set drain capacity and click Next`);
  };

  const handleEdit = () => {
    if (multiSelectionsLocked) {
      useManualMultiStore.getState().unlockSelections();
    } else {
      unlockSelections();
    }
    syncLayersWithLocation();
    setRightPanelOpen(false);
    setShowDssWorkflow(false);
  };

  return (
    <>
      {showConstraintModal && (
        <ConstraintViolationModal
          violations={constraintViolations}
          onRedraw={isMultiConstraintModal ? handleMultiConstraintRedraw : handleConstraintRedraw}
          onFindDss={isMultiConstraintModal ? handleMultiConstraintFindDss : () => void handleConstraintFindDss()}
        />
      )}

      <div className="rounded-2xl border border-stone-200 border-t-2 border-t-violet-400 bg-[linear-gradient(180deg,#faf8f5_0%,#f3eefb_100%)] p-2.5 shadow-sm sm:p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-700">
          Select Area
        </p>

        {/* Method tabs */}
        <div className="mb-4 flex flex-col gap-1.5">
          {METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={selectionsLocked || isLoading}
              onClick={() => setSelectedMethod(opt.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedMethod === opt.id
                  ? "border-violet-300 bg-violet-100 text-violet-700 shadow-sm"
                  : "border-stone-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
              }`}
            >
              <span className={`${selectedMethod === opt.id ? "text-violet-500" : "text-slate-400"}`}>
                {opt.icon}
              </span>
              {opt.label}
              {selectedMethod === opt.id && (
                <span className="ml-auto h-2 w-2 rounded-full bg-violet-400" />
              )}
            </button>
          ))}
        </div>

        {/* Method content */}
        <div className="mb-4">
          {selectedMethod === "shapefile" && <ShapefileUploader />}
          {selectedMethod === "polygon" && <PolygonDrawer />}
          {selectedMethod === "kml" && <KmlUploader />}
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        {/* Surface Radius input — shown for all methods, disabled once locked */}
        {!selectionsLocked && !multiSelectionsLocked && (
          <SurfaceRadiusInput value={surfaceRadius} onChange={setSurfaceRadius} />
        )}

        {/* Action buttons — Upload | Confirm Selection | Edit all in one row */}
        <div className="flex items-center gap-2">
          {canUpload && (
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={isUploading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60"
            >
              {isUploading ? (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              {isUploading ? "Loading..." : "Upload"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!ready || selectionsLocked || multiSelectionsLocked || isLoading}
            className={`${
              ready && !selectionsLocked && !multiSelectionsLocked && !isLoading
                ? "bg-gradient-to-r from-violet-600 to-purple-600 shadow-md shadow-violet-200 transition duration-200 hover:from-violet-500 hover:to-purple-500 hover:scale-[1.02]"
                : "cursor-not-allowed bg-stone-300"
            } flex-1 rounded-full px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1`}
          >
            {isLoading ? "Processing..." : "Confirm Selection"}
          </button>
          <button
            type="button"
            onClick={handleEdit}
            disabled={!selectionsLocked && !multiSelectionsLocked}
            className="shrink-0 rounded-full bg-slate-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 hover:bg-slate-400 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300 disabled:hover:scale-100"
          >
            Edit
          </button>
        </div>

        {selectionsLocked && (
          <>
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              Area confirmed. Proceed to select analysis categories.
            </p>
            <DrainSelector />
          </>
        )}

        {multiSelectionsLocked && (
          <>
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              Area confirmed. Proceed to select analysis categories.
            </p>
            <MultiDrainSelector />
          </>
        )}
      </div>
    </>
  );
}
