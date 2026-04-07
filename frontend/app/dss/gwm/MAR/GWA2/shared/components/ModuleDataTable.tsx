'use client';

import type { TableRow } from "../types/module.types";

interface ModuleDataTableProps {
  rows: TableRow[];
  emptyMessage?: string;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function ModuleDataTable({
  rows,
  emptyMessage = "No data available yet.",
}: ModuleDataTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  return (
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
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${Object.keys(row).join("-")}`} className="odd:bg-white even:bg-slate-50/50">
              <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">{rowIndex + 1}</td>
              {columns.map((column) => (
                <td key={`${rowIndex}-${column}`} className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
