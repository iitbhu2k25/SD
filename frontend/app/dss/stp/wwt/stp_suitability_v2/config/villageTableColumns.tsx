import type { TableColumn } from "react-data-table-component";
import type { DataRow } from "../services/stpSuitabilityTypes";

const COMPOSITION_SEGMENTS = [
  { key: "Very_Low", label: "VL", color: "#14b8a6" },
  { key: "Low", label: "L", color: "#3b82f6" },
  { key: "Medium", label: "M", color: "#facc15" },
  { key: "High", label: "H", color: "#f97316" },
  { key: "Very_High", label: "VH", color: "#e11d48" },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<DataRow, "Very_Low" | "Low" | "Medium" | "High" | "Very_High">;
  label: string;
  color: string;
}>;

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function centeredHeader(label: string) {
  return <div className="w-full text-center">{label}</div>;
}

function VillageCompositionCell({ row }: { row: DataRow }) {
  const total = COMPOSITION_SEGMENTS.reduce((sum, segment) => sum + row[segment.key], 0);

  return (
    <div className="flex w-full justify-center py-1">
      <div className="w-[16rem] max-w-full overflow-hidden rounded-full border border-stone-200 bg-stone-100">
        <div className="flex h-1.5 w-full">
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

export const suitabilityVillageColumns: TableColumn<DataRow>[] = [
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
    name: centeredHeader("Composition"),
    sortable: false,
    style: { minWidth: "220px", maxWidth: "280px", justifyContent: "center" },
    grow: 1,
    cell: (row) => <VillageCompositionCell row={row} />,
  },
  {
    name: centeredHeader("Very Low (%)"),
    selector: (row) => row.Very_Low,
    sortable: true,
    format: (row) => formatPercent(row.Very_Low),
    style: { minWidth: "110px", justifyContent: "center" },
    grow: 1,
  },
  {
    name: centeredHeader("Low (%)"),
    selector: (row) => row.Low,
    sortable: true,
    format: (row) => formatPercent(row.Low),
    style: { minWidth: "110px", justifyContent: "center" },
    grow: 1,
  },
  {
    name: centeredHeader("Medium (%)"),
    selector: (row) => row.Medium,
    sortable: true,
    format: (row) => formatPercent(row.Medium),
    style: { minWidth: "110px", justifyContent: "center" },
    grow: 1,
  },
  {
    name: centeredHeader("High (%)"),
    selector: (row) => row.High,
    sortable: true,
    format: (row) => formatPercent(row.High),
    style: { minWidth: "110px", justifyContent: "center" },
    grow: 1,
  },
  {
    name: centeredHeader("Very High (%)"),
    selector: (row) => row.Very_High,
    sortable: true,
    format: (row) => formatPercent(row.Very_High),
    style: { minWidth: "110px", justifyContent: "center" },
    grow: 1,
  },
];
