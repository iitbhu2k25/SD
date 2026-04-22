"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { CsvRow } from "@/interface/table";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useUiModeService } from "../../services/uiModeService";

const REQUIRED_HEADERS = ["Well_id", "Longitude", "Latitude"];

function isSamePoint(a: CsvRow, b: CsvRow) {
  return a.Well_id === b.Well_id;
}

function areWellPointListsEqual(a: CsvRow[], b: CsvRow[]) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];

    if (
      left.Well_id !== right.Well_id ||
      left.Longitude !== right.Longitude ||
      left.Latitude !== right.Latitude
    ) {
      return false;
    }
  }

  return true;
}

export default function AdminWellPointsInput() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [mode, setMode] = useState<"manual" | "csv">("manual");

  const wellPoints = useAdminLocationStore((state) => state.wellPoints);
  const setWellPoints = useAdminLocationStore((state) => state.setWellPoints);
  const setValidateTable = useAdminLocationStore((state) => state.setValidateTable);
  const isDark = useUiModeService((state) => state.isDark);

  const manualPoints = useMemo(
    () =>
      wellPoints.filter(
        (point) => !csvData.some((csvPoint) => isSamePoint(csvPoint, point)),
      ),
    [csvData, wellPoints],
  );

  useEffect(() => {
    const selectedCsvPoints = csvData.filter((_, index) => selectedRows.has(index));
    const merged = [...manualPoints, ...selectedCsvPoints];
    if (!areWellPointListsEqual(wellPoints, merged)) {
      setWellPoints(merged);
    }
  }, [csvData, manualPoints, selectedRows, setWellPoints, wellPoints]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setFileName(file.name);
    setSelectedRows(new Set());

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || [];
        const isValid = REQUIRED_HEADERS.every((key) => headers.includes(key));
        if (!isValid) {
          setCsvData([]);
          setError(`Invalid CSV. Required columns: ${REQUIRED_HEADERS.join(", ")}`);
          return;
        }

        setCsvData(result.data);
      },
      error: () => setError("Error parsing CSV file."),
    });
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const removeManualPoint = (wellId: string) => {
    setWellPoints(wellPoints.filter((point) => point.Well_id !== wellId));
  };

  return (
    <section
      className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${
        isDark ? "border-[#1e3a5f]/50 bg-[#0d1629]/80" : "border-stone-200 bg-white/75"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={`text-sm font-semibold sm:text-base ${
            isDark ? "text-slate-100" : "text-slate-900"
          }`}>
            Input Method
          </h3>
          <p className={`text-[11px] sm:text-xs ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Add well points manually from the map or upload via CSV.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded-full px-3 py-1 transition ${
              mode === "manual" ? "bg-blue-600 text-white" : "text-slate-600"
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setMode("csv")}
            className={`rounded-full px-3 py-1 transition ${
              mode === "csv" ? "bg-blue-600 text-white" : "text-slate-600"
            }`}
          >
            CSV
          </button>
        </div>
      </div>

      {mode === "manual" && (
        <p className={`rounded-xl border p-2 text-xs ${
          isDark ? "border-[#1e3a5f]/50 bg-[#0a1628] text-slate-300" : "border-stone-200 bg-stone-50 text-slate-600"
        }`}>
          Use map tools and click <span className="font-semibold">Add Well</span> to place
          pumping points manually.
        </p>
      )}

      {mode === "csv" && (
        <div className="space-y-3">
          <label className="inline-flex cursor-pointer items-center rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
            Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          {fileName && (
            <p className={`text-[11px] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Selected file: {fileName}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
              {error}
            </p>
          )}
          {csvData.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <button
                  className="rounded-full bg-slate-100 px-2 py-1 font-semibold hover:bg-slate-200"
                  onClick={() => setSelectedRows(new Set(csvData.map((_, i) => i)))}
                >
                  Select All
                </button>
                <button
                  className="rounded-full bg-slate-100 px-2 py-1 font-semibold hover:bg-slate-200"
                  onClick={() => setSelectedRows(new Set())}
                >
                  Clear
                </button>
                <span className="text-slate-500">
                  {selectedRows.size}/{csvData.length} selected
                </span>
              </div>
              <div className="max-h-56 overflow-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-2 py-1">Use</th>
                      <th className="px-2 py-1">Well_id</th>
                      <th className="px-2 py-1">Longitude</th>
                      <th className="px-2 py-1">Latitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.map((row, index) => (
                      <tr key={`${row.Well_id}-${index}`} className="border-t border-stone-100">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(index)}
                            onChange={() => toggleRowSelection(index)}
                          />
                        </td>
                        <td className="px-2 py-1">{row.Well_id}</td>
                        <td className="px-2 py-1">{row.Longitude}</td>
                        <td className="px-2 py-1">{row.Latitude}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className={`text-xs font-semibold ${
            isDark ? "text-slate-200" : "text-slate-700"
          }`}>
            Active Well Points: {wellPoints.length}
          </p>
          {wellPoints.length > 0 && (
            <button
              onClick={() => void setValidateTable(true)}
              className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Validate
            </button>
          )}
        </div>
        {manualPoints.length > 0 && (
          <div className="max-h-36 overflow-auto rounded-xl border border-stone-200 p-2 text-xs">
            {manualPoints.map((point) => (
              <div key={point.Well_id} className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate">{point.Well_id}</span>
                <button
                  className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 hover:bg-rose-200"
                  onClick={() => removeManualPoint(point.Well_id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
