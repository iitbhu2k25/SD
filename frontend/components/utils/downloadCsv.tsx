
import DataTable from "react-data-table-component";
import { DataRow, Village_columns } from "@/interface/table";
export const downloadCSV = async (tableData: DataRow[], filename: string) => {
    let tableDataCsv = tableData.map(row => Object.values(row).join(',')).join('\n');
    tableDataCsv = 'Village Name,Very Low,Low,Medium,High,Very High\n' + tableDataCsv;
    const blob = new Blob([tableDataCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
