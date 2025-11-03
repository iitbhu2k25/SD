import { DataRow } from '@/interface/table';
export const ADMIN_LAYER_NAMES = {
  INDIA:"STP_State",
  STATE: "STP_district",
  DISTRICT: "STP_subdistrict",
  SUB_DISTRICT: "STP_Village",
};
export const ADMIN_TOWN_LAYER_NAMES = {
  INDIA:"STP_State",
  STATE: "STP_district",
  DISTRICT: "STP_subdistrict",
  SUB_DISTRICT: "Town",
};
export const DRAIN_LAYER_NAMES = {
  INDIA: "Boundary",
  BOUNDARY:"Boundary",
  RIVER: "Rivers",
  DRAIN: "Drain",
  STRETCH: "Stretches",
  CATCHMENT: null as string | null,
};

export interface ClipRasters{
  file_name:string;
  layer_name:string;
  workspace:string;
}

export interface stp_priority_Output{
  workspace:string,                  
  layer_name:string,
  csv_path:string,
  csv_details:DataRow[]
}

export interface stp_sutability_Output{
  workspace:string,                  
  layer_name:string,
  vector_name:string
  clip_villages:number[],
  csv_details:DataRow[]
}


export interface State {
  id: string | number;
  name: string;
}

export interface District {
  id: string | number;
  name: string;
  stateId: string | number;
}

export interface SubDistrict {
  id: string | number;
  name: string;
  districtId: string | number;
}

export interface villages {
  id: string | number;
  name: string;
}

export interface River {
  River_Name: string;
  River_Code: number;
}

export interface Stretch {
  id: number;
  Stretch_ID: number;
  river_code: number;
  name?: string; // Optional name field
}

export interface Drain {
  id: number;
  Drain_No: number;
  stretch_id: number;
  name?: string; // Optional name field
}

export interface Catchment {
  id: number;
  village_name: string
  area: number
  name?: string;
}

export interface Towns {
  id: string | number;
  name: string;
  population: number;
  subdistrictId: string | number;
}

export interface RiverSelectionsData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  totalArea: number;
}
export interface Layer_name{
  layer_name:string
  catchments: Catchment[]
}
export interface Category {
  id: number;
  file_name: string;
  weight: number;
  raster_category: string;
}

// Interface for raster layer selection with added weight field
export interface SelectRasterLayer {
  file_name: string;
  Influence: string;
  weight?: string;
  id: number; 
}

export interface Stp_area{
  tech_name:string;
  tech_value:number;
  id:number
}
export interface RasterLayer{
  workspace: string;
  layer_name: string;
}