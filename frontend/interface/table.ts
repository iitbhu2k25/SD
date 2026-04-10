import DataTable, { TableColumn } from 'react-data-table-component';
export interface CsvRow {
  Name?: string;
  Well_id: string;
  Longitude: string;
  Latitude: string;
  Distance?: string;
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
  Name:string;
  "Groundwater table":number;
  "Groundwater trends": number;
  "Slope": number;
  "Specific yield": number;
  "slope per year":number;
 
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
    name: 'Name',
    selector: row => row.Name,
    sortable: true,
    format: row => row.Name,
    width: '120px',
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
    name: 'Groundwater table',
    selector: row => row["Groundwater table"],
    sortable: true,
    format: row => `${row["Groundwater table"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Groundwater trends',
    selector: row => row["Groundwater trends"],
    sortable: true,
    format: row => `${row["Groundwater trends"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Slope',
    selector: row => row["Slope"],
    sortable: true,
    format: row => `${row["Slope"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'Specific yield',
    selector: row => row["Specific yield"],
    sortable: true,
    format: row => `${row["Specific yield"].toFixed(2)}`,
    width: '120px',
  },
  {
    name: 'slope per year',
    selector: row => row["slope per year"],
    sortable: true,
    format: row => `${row["slope per year"].toFixed(2)}`,
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
    name: 'Village Name ',
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



export interface WQIInterface {
  Hardness: number;
  Latitude: number;
  Longitude: number;
  Location: string;
  Arsenic: number;
  Bicarbonate: number;
  Calcium: number;
  Carbonate: number;
  Chloride: number;
  Electrical_Conductivity: number;
  Fluoride: number;
  Iron: number;
  Magnesium: number;
  Nitrate: number;
  pH_Level: number;
  Potassium: number;
  Sodium: number;
  Sulfate: number;
  Uranium: number;
}

export const WQI_columns: TableColumn<WQIInterface>[] = [
  {
    name: 'Location',
    selector: row => row.Location,
    sortable: true,
    wrap: true,
    width: '180px',
  },
  {
    name: 'Latitude',
    selector: row => row.Latitude,
    sortable: true,
    format: row => row.Latitude.toFixed(4),
    width: '120px',
  },
  {
    name: 'Longitude',
    selector: row => row.Longitude,
    sortable: true,
    format: row => row.Longitude.toFixed(4),
    width: '120px',
  },
  
  {
    name: 'pH Level',
    selector: row => row.pH_Level,
    sortable: true,
    format: row => row.pH_Level.toFixed(2),
    width: '120px',
  },
  {
    name: 'Electrical Conductivity',
    selector: row => row.Electrical_Conductivity,
    sortable: true,
    format: row => row.Electrical_Conductivity.toFixed(2),
    width: '180px',
  },
  {
    name: 'Hardness',
    selector: row => row.Hardness,
    sortable: true,
    format: row => row.Hardness.toFixed(2),
    width: '120px',
  },
  {
    name: 'Calcium',
    selector: row => row.Calcium,
    sortable: true,
    format: row => row.Calcium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Magnesium',
    selector: row => row.Magnesium,
    sortable: true,
    format: row => row.Magnesium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Sodium',
    selector: row => row.Sodium,
    sortable: true,
    format: row => row.Sodium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Potassium',
    selector: row => row.Potassium,
    sortable: true,
    format: row => row.Potassium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Carbonate',
    selector: row => row.Carbonate,
    sortable: true,
    format: row => row.Carbonate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Bicarbonate',
    selector: row => row.Bicarbonate,
    sortable: true,
    format: row => row.Bicarbonate.toFixed(2),
    width: '140px',
  },
  {
    name: 'Chloride',
    selector: row => row.Chloride,
    sortable: true,
    format: row => row.Chloride.toFixed(2),
    width: '120px',
  },
  {
    name: 'Nitrate',
    selector: row => row.Nitrate,
    sortable: true,
    format: row => row.Nitrate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Sulfate',
    selector: row => row.Sulfate,
    sortable: true,
    format: row => row.Sulfate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Fluoride',
    selector: row => row.Fluoride,
    sortable: true,
    format: row => row.Fluoride.toFixed(2),
    width: '120px',
  },
  {
    name: 'Arsenic',
    selector: row => row.Arsenic,
    sortable: true,
    format: row => row.Arsenic.toFixed(2),
    width: '120px',
  },
  {
    name: 'Iron',
    selector: row => row.Iron,
    sortable: true,
    format: row => row.Iron.toFixed(2),
    width: '120px',
  },
  {
    name: 'Uranium',
    selector: row => row.Uranium,
    sortable: true,
    format: row => row.Uranium.toFixed(2),
    width: '120px',
  },
];