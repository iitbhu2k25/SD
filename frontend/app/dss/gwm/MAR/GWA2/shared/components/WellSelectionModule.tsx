'use client';

import { useRef } from "react";

import { useGwaWorkflow } from "../hooks/useGwaWorkflow";
import { useGwaStore } from "../store/gwa.store";
import { getWellDisplayColumns } from "../utils/helpers";

export default function WellSelectionModule() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    wells,
    setWellSelectionMode,
    setWellsState,
    updateWellCell,
    addWellRow,
    removeWellRow,
    addWellColumn,
    removeWellColumn,
  } = useGwaStore();
  const { loadExistingWells, importCsv, saveWells } = useGwaWorkflow();
  const columns = getWellDisplayColumns(wells.data, wells.customColumns, wells.selectionMode);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Well Selection</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setWellSelectionMode("existing_and_new");
              loadExistingWells();
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              wells.selectionMode === "existing_and_new"
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Existing Wells
          </button>
          <button
            type="button"
            onClick={() => {
              setWellSelectionMode("upload_csv");
              fileInputRef.current?.click();
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              wells.selectionMode === "upload_csv"
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv(file);
            }}
          />
          <button
            type="button"
            onClick={saveWells}
            disabled={!wells.data.length || wells.isUploading}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {wells.isUploading ? "Saving..." : wells.isSaved ? "Saved" : "Save Wells"}
          </button>
        </div>
        {wells.error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{wells.error}</div>}
        {wells.uploadMessage && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              wells.uploadSuccess ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {wells.uploadMessage}
          </div>
        )}
      </div>

      {!!wells.data.length && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={wells.newColumnName}
              onChange={(event) => setWellsState({ newColumnName: event.target.value })}
              placeholder="New column name"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addWellColumn}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Add Column
            </button>
            <button
              type="button"
              onClick={addWellRow}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Add Row
            </button>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    #
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <div className="flex items-center gap-2">
                        <span>{column}</span>
                        {wells.customColumns.includes(column) && (
                          <button type="button" onClick={() => removeWellColumn(column)} className="text-red-500">
                            x
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {wells.data.map((row, rowIndex) => (
                  <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/50">
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-500">{rowIndex + 1}</td>
                    {columns.map((column) => (
                      <td key={`${rowIndex}-${column}`} className="border-b border-slate-100 px-2 py-2">
                        <input
                          type="text"
                          value={String(row[column] ?? "")}
                          onChange={(event) => updateWellCell(rowIndex, column, event.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                        />
                      </td>
                    ))}
                    <td className="border-b border-slate-100 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeWellRow(rowIndex)}
                        className="text-sm font-medium text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
