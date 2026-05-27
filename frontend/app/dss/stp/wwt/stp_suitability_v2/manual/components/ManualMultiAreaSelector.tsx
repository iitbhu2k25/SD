"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { useManualMultiStore } from "../stores/manualMultiStore";
import { useManualUiStore } from "../stores/manualUiStore";
import { confirmMultiAreaSelection, fetchDrainsInBbox } from "../../services/stpSuitabilityApi";
import type { MultiPolygonEntry } from "../../services/stpSuitabilityTypes";

type MultiMethod = "shapefile" | "kml";

function FileList({
  files,
  onRemove,
  disabled,
}: {
  files: File[];
  onRemove: (i: number) => void;
  disabled: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {files.map((f, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          <span className="truncate max-w-[80%]">{f.name}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-2 text-red-400 hover:text-red-600 shrink-0"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ManualMultiAreaSelector() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<MultiMethod>("shapefile");
  const [nextClicked, setNextClicked] = useState(false);

  const uploadedFiles = useManualMultiStore((s) => s.uploadedFiles);
  const addUploadedFile = useManualMultiStore((s) => s.addUploadedFile);
  const removeUploadedFile = useManualMultiStore((s) => s.removeUploadedFile);
  const setPolygonEntries = useManualMultiStore((s) => s.setPolygonEntries);
  const drainCapacityMld = useManualMultiStore((s) => s.drainCapacityMld);
  const setDrainCapacityMld = useManualMultiStore((s) => s.setDrainCapacityMld);
  const isLoading = useManualMultiStore((s) => s.isLoading);
  const setLoading = useManualMultiStore((s) => s.setLoading);
  const setError = useManualMultiStore((s) => s.setError);
  const error = useManualMultiStore((s) => s.error);
  const selectionsLocked = useManualMultiStore((s) => s.selectionsLocked);
  const lockSelections = useManualMultiStore((s) => s.lockSelections);
  const unlockSelections = useManualMultiStore((s) => s.unlockSelections);

  const setRightPanelOpen = useManualUiStore((s) => s.setRightPanelOpen);

  const acceptStr = method === "shapefile" ? ".zip,.shp" : ".kml,.kmz";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    for (const f of picked) {
      addUploadedFile(f);
    }
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirm = async () => {
    if (uploadedFiles.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await confirmMultiAreaSelection({ method, files: uploadedFiles });
      if (response.results.length === 0) {
        throw new Error("No valid polygons found in the uploaded files");
      }

      // Fetch drains for each polygon's buffer bbox in parallel
      const entriesWithDrains = await Promise.all(
        response.results.map(async (r, i): Promise<MultiPolygonEntry> => {
          const drainPoints = await fetchDrainsInBbox(r.buffer_bbox).catch(() => []);
          return {
            index: i,
            vectorLayer: r.vector_layer,
            polygonLayer: r.polygon_layer,
            centroid: [r.centroid_lat, r.centroid_lon],
            bufferBbox: r.buffer_bbox,
            areaHa: r.area_ha,
            drainPoints,
            selectedDrainNos: [],
          };
        }),
      );

      setPolygonEntries(entriesWithDrains);
      lockSelections();
      toast.success(`${entriesWithDrains.length} polygon(s) confirmed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm areas";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    unlockSelections();
    setRightPanelOpen(false);
    setNextClicked(false);
  };

  return (
    <div className="rounded-2xl border border-stone-200 border-t-2 border-t-emerald-400 bg-[linear-gradient(180deg,#f5faf8_0%,#f0f7f4_100%)] p-2.5 shadow-sm sm:p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Multi-Area Upload
      </p>

      {/* Method toggle */}
      <div className="mb-3 flex gap-2">
        {(["shapefile", "kml"] as MultiMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={selectionsLocked || isLoading}
            onClick={() => setMethod(m)}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              method === m
                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                : "border-stone-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            {m === "shapefile" ? "Shapefile (.zip/.shp)" : "KML / KMZ"}
          </button>
        ))}
      </div>

      {/* File picker */}
      {!selectionsLocked && (
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-5 text-center transition hover:border-emerald-500 hover:bg-emerald-100"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="mb-1.5 h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-xs font-medium text-emerald-600">Click to add files</span>
          <span className="mt-0.5 text-[10px] text-slate-400">Multiple files allowed</span>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptStr}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      <FileList files={uploadedFiles} onRemove={removeUploadedFile} disabled={selectionsLocked || isLoading} />

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {/* Confirm / Edit buttons */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={uploadedFiles.length === 0 || selectionsLocked || isLoading}
          className={`flex-1 rounded-full px-3.5 py-2 text-xs font-semibold text-white focus:outline-none ${
            uploadedFiles.length > 0 && !selectionsLocked && !isLoading
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md hover:from-emerald-500 hover:to-teal-500"
              : "cursor-not-allowed bg-stone-300"
          }`}
        >
          {isLoading ? "Processing…" : "Confirm Selection"}
        </button>
        <button
          type="button"
          onClick={handleEdit}
          disabled={!selectionsLocked}
          className="rounded-full bg-slate-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-slate-400 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Edit
        </button>
      </div>

      {/* After confirm: drain capacity + Next */}
      {selectionsLocked && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-1 text-xs font-semibold text-emerald-700">
            {useManualMultiStore.getState().polygonEntries.length} polygon(s) confirmed
          </p>
          <p className="mb-2 text-[10px] text-slate-500">
            Area confirmed. Fill Drain Capacity and click Next to proceed.
          </p>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-emerald-700">
              Drain Capacity (MLD) <span className="text-red-500">*</span>
            </span>
            <p className="mb-1.5 text-[10px] text-slate-500">
              Total capacity shared across all polygons.
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
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 pr-14 text-sm text-slate-700 outline-none transition focus:border-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            Next
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
