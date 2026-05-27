import { downloadCSV } from "@/components/utils/downloadCsv";
import type { DataRow } from "@/interface/table";

export function downloadSuitabilityCsv(
  tableData: DataRow[],
  filename = "STP_Suitability.csv",
) {
  downloadCSV(tableData, filename);
}
