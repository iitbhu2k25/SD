"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Plus, RotateCcw, UploadCloud, X } from "lucide-react";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import type { GeneralCsvFileInput } from "../types";
import { useUiModeStore } from "../../services/uiModeService";

interface LocalCsvEntry {
  id: string;
  file: File | null;
  label: string;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function GeneralCsvUploadPanel() {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [entries, setEntries] = useState<LocalCsvEntry[]>([
    { id: makeId(), file: null, label: "" },
  ]);
  const { upload, uploadCsvFiles, resetCsvWorkflow } = useGeneralViewModel();
  const isDark = useUiModeStore((s) => s.isDark);
  const isProcessing =
    upload.csvBatchStatus === "uploading" || upload.csvBatchStatus === "generating_raster";

  const entryStatusById = useMemo(
    () => Object.fromEntries(upload.csvEntries.map((entry) => [entry.id, entry])),
    [upload.csvEntries],
  );

  const setEntry = (id: string, patch: Partial<LocalCsvEntry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const addEntry = () => {
    setEntries((current) => [...current, { id: makeId(), file: null, label: "" }]);
  };

  const removeEntry = (id: string) => {
    setEntries((current) =>
      current.length === 1
        ? [{ id: makeId(), file: null, label: "" }]
        : current.filter((entry) => entry.id !== id),
    );
  };

  const resetLocal = () => {
    setEntries([{ id: makeId(), file: null, label: "" }]);
    resetCsvWorkflow();
  };

  const startUpload = () => {
    const payload: GeneralCsvFileInput[] = entries
      .filter((entry): entry is LocalCsvEntry & { file: File } => Boolean(entry.file))
      .map((entry) => ({
        id: entry.id,
        file: entry.file,
        label: entry.label || entry.file.name,
      }));
    uploadCsvFiles(payload);
  };

  return (
    <section
      className={`rounded-lg border p-3 shadow-sm ${
        isDark ? "border-[#1e3a5f]/60 bg-[#06101e]/85" : "border-stone-200 bg-white"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className={isDark ? "h-4 w-4 text-cyan-300" : "h-4 w-4 text-emerald-600"} />
          <h3 className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
            CSV Datasets
          </h3>
        </div>
        <button
          type="button"
          onClick={addEntry}
          disabled={isProcessing}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
            isDark
              ? "border-[#1e3a5f] text-cyan-300 hover:bg-[#0a1628]"
              : "border-stone-200 text-emerald-700 hover:bg-emerald-50"
          }`}
          title="Add CSV"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((entry, index) => {
          const status = entryStatusById[entry.id];
          const isBusy = status?.status === "uploading" || status?.status === "generating_raster";
          return (
            <div
              key={entry.id}
              className={`rounded-lg border p-2 ${
                isDark ? "border-[#1e3a5f] bg-[#0a1628]" : "border-stone-200 bg-stone-50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Dataset {index + 1}
                </span>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => removeEntry(entry.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  title="Remove CSV"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                ref={(node) => {
                  fileInputRefs.current[entry.id] = node;
                }}
                type="file"
                accept=".csv"
                disabled={isProcessing}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setEntry(entry.id, {
                    file,
                    label: entry.label || file?.name.replace(/\.csv$/i, "") || "",
                  });
                }}
                className="hidden"
              />
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRefs.current[entry.id]?.click()}
                className={`mb-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed px-2 text-xs font-semibold transition ${
                  isDark
                    ? "border-[#1e3a5f] text-slate-300 hover:border-cyan-400"
                    : "border-stone-300 text-slate-600 hover:border-emerald-400"
                }`}
              >
                <UploadCloud className="h-4 w-4" />
                {entry.file ? entry.file.name : "Choose CSV file"}
              </button>
              <input
                value={entry.label}
                disabled={isProcessing}
                onChange={(event) => setEntry(entry.id, { label: event.target.value })}
                placeholder="Dataset label"
                className={`h-8 w-full rounded-md border px-2 text-xs outline-none ${
                  isDark
                    ? "border-[#1e3a5f] bg-[#050911] text-slate-200 placeholder:text-slate-500"
                    : "border-stone-200 bg-white text-slate-700 placeholder:text-slate-400"
                }`}
              />
              {status && (
                <p
                  className={`mt-1.5 text-[11px] ${
                    status.status === "error"
                      ? "text-red-500"
                      : status.status === "success"
                        ? "text-emerald-600"
                        : isDark
                          ? "text-cyan-300"
                          : "text-blue-600"
                  }`}
                >
                  {isBusy ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {status.status === "uploading" ? "Uploading CSV..." : "Generating raster..."}
                    </span>
                  ) : status.error || status.status}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isProcessing || !upload.layerInfo}
          onClick={startUpload}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Process
        </button>
        <button
          type="button"
          disabled={isProcessing}
          onClick={resetLocal}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${
            isDark
              ? "border-[#1e3a5f] text-slate-300 hover:bg-[#0a1628]"
              : "border-stone-200 text-slate-600 hover:bg-stone-50"
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </section>
  );
}

