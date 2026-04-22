import { Gwpl_Table } from "@/interface/table";
import { pumpingVillageExportColumns } from "../config/villageTableColumns";

export function downloadPumpingCsv(tableData: Gwpl_Table[], filename: string) {
  if (!tableData.length) return;

  const headers = pumpingVillageExportColumns
    .map((column) => column.header)
    .join(",");

  const rows = tableData.map((row) =>
    pumpingVillageExportColumns
      .map((column) => {
        const value = column.selector(row);

        if (typeof value === "number") {
          return value.toFixed(2);
        }

        return `"${value}"`;
      })
      .join(","),
  );

  const csvContent = [headers, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
