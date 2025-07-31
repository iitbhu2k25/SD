import DataTable, { TableColumn } from 'react-data-table-component';

export interface DataRow {
  Village_Name: string;
  Very_Low: number;
  Low: number;
  Medium: number;
  High: number;
  Very_High: number;
}

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
