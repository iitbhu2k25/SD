import { downloadCSV } from "@/components/utils/downloadCsv";
import { DataRow } from "@/interface/table";

export function downloadMarCsv(tableData: DataRow[], filename: string = "MAR_Suitability.csv") {
  downloadCSV(tableData, filename);
}
