import { DataRow, Village_columns } from "@/interface/table";

export const downloadCSV = (tableData: DataRow[], filename: string) => {
  if (!tableData.length) return;

  // 1️⃣ Headers from column names (WITH %)
  const headers = Village_columns
    .map(col => col.name)
    .join(',');

  // 2️⃣ Rows mapped using selector
  const rows = tableData.map(row =>
  Village_columns.map(col => {
    const value = col.selector ? col.selector(row) : undefined;

    if (typeof value === "number") {
      return value.toFixed(2);
    }
    return `"${value}"`; // safe for village names with spaces
  }).join(',')
);

  const csvContent = [headers, ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
