"use client";

import React from "react";
import type { TableColumn } from "react-data-table-component";
import type { DataRow } from "@/interface/table";

interface VillageExportColumn {
  header: string;
  selector: (row: DataRow) => string | number;
}

const COMPOSITION_SEGMENTS = [
  { key: "Very_Low", label: "VL", color: "#3b82f6" },
  { key: "Low", label: "L", color: "#22c55e" },
  { key: "Medium", label: "M", color: "#facc15" },
  { key: "High", label: "H", color: "#fb923c" },
  { key: "Very_High", label: "VH", color: "#ef4444" },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<DataRow, "Village_Name">;
  label: string;
  color: string;
}>;

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function VillageCompositionCell({ row }: { row: DataRow }) {
  const total = COMPOSITION_SEGMENTS.reduce((sum, segment) => sum + row[segment.key], 0);

  return (
    <div className="flex w-full justify-center py-1">
      <div className="w-[16rem] max-w-full overflow-hidden rounded-full border border-stone-200 bg-stone-100">
        <div className="flex h-2 w-full">
          {COMPOSITION_SEGMENTS.map((segment) => {
            const value = Math.max(row[segment.key], 0);
            const width = total > 0 ? `${(value / total) * 100}%` : "0%";

            return (
              <div
                key={segment.key}
                className="h-full transition-[width]"
                style={{ width, backgroundColor: segment.color }}
                title={`${segment.label}: ${formatPercent(value)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const potentialVillageColumns: TableColumn<DataRow>[] = [
  {
    name: "Village Name",
    selector: (row) => row.Village_Name,
    sortable: true,
    style: { minWidth: "180px", maxWidth: "240px" },
    grow: 1,
    wrap: true,
    format: (row) => row.Village_Name,
  },
  {
    name: "Composition",
    sortable: false,
    style: { minWidth: "220px", maxWidth: "280px" },
    grow: 1,
    cell: (row) => <VillageCompositionCell row={row} />,
  },
  {
    name: "Very Low (%)",
    selector: (row) => row.Very_Low,
    sortable: true,
    format: (row) => formatPercent(row.Very_Low),
    style: { minWidth: "110px" },
    grow: 1,
  },
  {
    name: "Low (%)",
    selector: (row) => row.Low,
    sortable: true,
    format: (row) => formatPercent(row.Low),
    style: { minWidth: "110px" },
    grow: 1,
  },
  {
    name: "Medium (%)",
    selector: (row) => row.Medium,
    sortable: true,
    format: (row) => formatPercent(row.Medium),
    style: { minWidth: "110px" },
    grow: 1,
  },
  {
    name: "High (%)",
    selector: (row) => row.High,
    sortable: true,
    format: (row) => formatPercent(row.High),
    style: { minWidth: "110px" },
    grow: 1,
  },
  {
    name: "Very High (%)",
    selector: (row) => row.Very_High,
    sortable: true,
    format: (row) => formatPercent(row.Very_High),
    style: { minWidth: "110px" },
    grow: 1,
  },
];

export const potentialVillageExportColumns: VillageExportColumn[] = [
  {
    header: "Village Name",
    selector: (row) => row.Village_Name,
  },
  {
    header: "Very Low (%)",
    selector: (row) => row.Very_Low,
  },
  {
    header: "Low (%)",
    selector: (row) => row.Low,
  },
  {
    header: "Medium (%)",
    selector: (row) => row.Medium,
  },
  {
    header: "High (%)",
    selector: (row) => row.High,
  },
  {
    header: "Very High (%)",
    selector: (row) => row.Very_High,
  },
];
