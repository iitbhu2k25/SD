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


export interface WQIInterface {
  Hardness: number;
  Latitude: number;
  Longitude: number;
  Location: string;
  arsenic: number;
  bicarbonate: number;
  calcium: number;
  carbonate: number;
  chloride: number;
  electrical_conductivity: number;
  fluoride: number;
  iron: number;
  magnesium: number;
  nitrate: number;
  ph_level: number;
  phosphate: number;
  potassium: number;
  sodium: number;
  sulfate: number;
  uranium: number;
  year: number;
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
    name: 'Year',
    selector: row => row.year,
    sortable: true,
    width: '100px',
  },
  {
    name: 'pH Level',
    selector: row => row.ph_level,
    sortable: true,
    format: row => row.ph_level.toFixed(2),
    width: '120px',
  },
  {
    name: 'Electrical Conductivity',
    selector: row => row.electrical_conductivity,
    sortable: true,
    format: row => row.electrical_conductivity.toFixed(2),
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
    selector: row => row.calcium,
    sortable: true,
    format: row => row.calcium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Magnesium',
    selector: row => row.magnesium,
    sortable: true,
    format: row => row.magnesium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Sodium',
    selector: row => row.sodium,
    sortable: true,
    format: row => row.sodium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Potassium',
    selector: row => row.potassium,
    sortable: true,
    format: row => row.potassium.toFixed(2),
    width: '120px',
  },
  {
    name: 'Carbonate',
    selector: row => row.carbonate,
    sortable: true,
    format: row => row.carbonate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Bicarbonate',
    selector: row => row.bicarbonate,
    sortable: true,
    format: row => row.bicarbonate.toFixed(2),
    width: '140px',
  },
  {
    name: 'Chloride',
    selector: row => row.chloride,
    sortable: true,
    format: row => row.chloride.toFixed(2),
    width: '120px',
  },
  {
    name: 'Nitrate',
    selector: row => row.nitrate,
    sortable: true,
    format: row => row.nitrate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Phosphate',
    selector: row => row.phosphate,
    sortable: true,
    format: row => row.phosphate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Sulfate',
    selector: row => row.sulfate,
    sortable: true,
    format: row => row.sulfate.toFixed(2),
    width: '120px',
  },
  {
    name: 'Fluoride',
    selector: row => row.fluoride,
    sortable: true,
    format: row => row.fluoride.toFixed(2),
    width: '120px',
  },
  {
    name: 'Arsenic',
    selector: row => row.arsenic,
    sortable: true,
    format: row => row.arsenic.toFixed(2),
    width: '120px',
  },
  {
    name: 'Iron',
    selector: row => row.iron,
    sortable: true,
    format: row => row.iron.toFixed(2),
    width: '120px',
  },
  {
    name: 'Uranium',
    selector: row => row.uranium,
    sortable: true,
    format: row => row.uranium.toFixed(2),
    width: '120px',
  },
];