import DataTable, { TableColumn } from 'react-data-table-component';
export interface CsvRow {
  Well_id: string;
  Longitude: string;
  Latitude: string;
}
export interface DataRow {
  Village_Name: string;
  Very_Low: number;
  Low: number;
  Medium: number;
  High: number;
  Very_High: number;
}

export interface Gwpl_Table{
  Well_id:number;
  Rank:number;
  "Groundwater table":number;
  "Rainfall": number;
  "Sand thickness": number;
  "Temperature": number;
  "Top clay thickness":number;
  "Merit Score": number;
}
export const Gwpl_columns: TableColumn<Gwpl_Table>[] = [
  {
    name: 'Well Id',
    selector: row => row.Well_id,
    sortable: true,
    width: '100px',
    wrap: true,
    format: row => row.Well_id,
  },
  {
    name: 'Rank',
    selector: row => row.Rank,
    sortable: true,
    format: row => row.Rank,
    width: '120px',
  }
  ,
   {
    name: 'Merit Score',
    selector: row => row["Merit Score"],
    sortable: true,
    format: row => `${row["Merit Score"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Groundwater table',
    selector: row => row["Groundwater table"],
    sortable: true,
    format: row => `${row["Groundwater table"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Rainfall',
    selector: row => row["Rainfall"],
    sortable: true,
    format: row => `${row["Rainfall"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Sand thickness',
    selector: row => row["Sand thickness"],
    sortable: true,
    format: row => `${row["Sand thickness"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Temperature',
    selector: row => row["Temperature"],
    sortable: true,
    format: row => `${row["Temperature"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Top clay thickness',
    selector: row => row["Top clay thickness"],
    sortable: true,
    format: row => `${row["Top clay thickness"].toFixed(2)}`,
    width: '120px',
  }
]
// Props interface for the component
interface VillageDataTableProps {
  data?: DataRow[];
  loading?: boolean;
  onRowSelect?: (selectedRows: DataRow[]) => void;
  title?: string;
}

// Column configuration
export const Village_columns: TableColumn<DataRow>[] = [
  {
    name: 'Village Name',
    selector: row => row.Village_Name,
    sortable: true,
    width: '200px',
    wrap: true,
    format: row => row.Village_Name,
  },
  {
    name: 'Very Low (%)',
    selector: row => row.Very_Low,
    sortable: true,
    format: row => `${row.Very_Low.toFixed(2)}%`,
    width: '120px',

  },
  {
    name: 'Low (%)',
    selector: row => row.Low,
    sortable: true,
    format: row => `${row.Low.toFixed(2)}%`,
    width: '120px',

  },
  {
    name: 'Medium (%)',
    selector: row => row.Medium,
    sortable: true,
    format: row => `${row.Medium.toFixed(2)}%`,
    width: '120px',
 
  },
  {
    name: 'High (%)',
    selector: row => row.High,
    sortable: true,
    format: row => `${row.High.toFixed(2)}%`,
    width: '120px',

  },
  {
    name: 'Very High (%)',
    selector: row => row.Very_High,
    sortable: true,
    format: row => `${row.Very_High.toFixed(2)}%`,
    width: '120px',
  
  }
];
