export interface PopulationResult {
  year: number;
  total: number;
  urban: number;
  rural: number;
  growthRate?: number;
}

export interface WaterDemandResult {
  year: number;
  domestic: number;
  industrial: number;
  agricultural: number;
  total: number;
  unit: string;
}

export interface WaterSupplyResult {
  year: number;
  surfaceWater: number;
  groundWater: number;
  total: number;
  unit: string;
}

export interface SewageResult {
  year: number;
  generatedVolume: number;
  treatedVolume: number;
  untreatedVolume: number;
  treatmentCapacity: number;
  unit: string;
}

export interface ForecastResult {
  population?: PopulationResult[];
  waterDemand?: WaterDemandResult[];
  waterSupply?: WaterSupplyResult[];
  sewage?: SewageResult[];
}