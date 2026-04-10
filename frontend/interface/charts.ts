import type { WQIInterface } from "@/interface/table";
export interface WellMeta {
  location: string;
  year: number;
  latitude: number;
  longitude: number;
}

export interface IonPercent {
  Ca_pct: number;
  Mg_pct: number;
  Na_pct: number;
  K_pct: number;
  HCO3_pct: number;
  CO3_pct: number;
  Cl_pct: number;
  SO4_pct: number;
}

export interface Coord {
  x: number;
  y: number;
}

/* ─── Piper ──────────────────────────────────────────────── */
export interface PiperPoint extends WellMeta {
  ion_pct: IonPercent;
  cation: Coord;
  anion: Coord;
  diamond: Coord;

  // Optional raw concentrations (mg/L)
  Ca?: number;
  Mg?: number;
  Na?: number;
  K?: number;
  Cl?: number;
  SO4?: number;
  HCO3?: number;
  CO3?: number;
  pH?: number;
  EC?: number;
  TDS?: number;
}

export interface PiperResponse {
  chart: "piper";
  gap_D?: number;
  points: PiperPoint[];
}

/* ─── Durov ──────────────────────────────────────────────── */
export interface DurovPoint extends WellMeta {
  ion_pct: IonPercent;
  cation_tri: Coord;
  anion_tri: Coord;
  square: Coord;

  pH?: number;
  EC?: number;
  TDS?: number;
}

export interface DurovResponse {
  chart: "durov";
  points: DurovPoint[];
}

/* ─── Gibbs ──────────────────────────────────────────────── */
export type GibbsMechanism =
  | "Precipitation dominance"
  | "Rock-water interaction"
  | "Evaporation dominance";

export interface GibbsPoint extends WellMeta {
  tds: number;
  cation_ratio: number; // Na/(Na+Ca)
  anion_ratio: number;  // Cl/(Cl+HCO3)
  mechanism_cation: GibbsMechanism;
  mechanism_anion: GibbsMechanism;
}

export interface GibbsResponse {
  chart: "gibbs";
  points: GibbsPoint[];
}

/* ─── PCA ────────────────────────────────────────────────── */
export interface PCAScore extends WellMeta {
  PC1: number;
  PC2: number;
}

export interface PCALoading {
  feature: string;
  PC1: number;
  PC2: number;
}

export interface PCAResponse {
  chart: "pca";
  n_components?: number;
  explained_variance_pct: number[];
  cumulative_variance_pct: number[];
  eigenvalues?: number[];
  loadings: PCALoading[];
  scores: PCAScore[];
}

/* ─── RDA ────────────────────────────────────────────────── */
export interface RDASiteScore extends WellMeta {
  RDA1: number;
  RDA2: number;
}

export interface RDAResponseLoading {
  ion: string;
  RDA1: number;
  RDA2: number;
}

export interface RDAExplanatoryLoading {
  variable: string;
  RDA1: number;
  RDA2: number;
}

export interface RDAResponse {
  chart: "rda";
  n_components?: number;
  explained_variance_pct: number[];
  response_loadings: RDAResponseLoading[];
  explanatory_loadings: RDAExplanatoryLoading[];
  site_scores: RDASiteScore[];
}

/* ─── Combined API Response ──────────────────────────────── */
export interface AllChartsResponse {
  piper: PiperResponse;
  durov: DurovResponse;
  gibbs: GibbsResponse;
  pca: PCAResponse;
  rda: RDAResponse;
}

/* ─── Water Type Classification ─────────────────────────── */
export interface WaterTypeInfo {
  type: string;
  color: string;
  bg: string;
}

/* ─── WQI Operation Payload ──────────────────────────────── */


export interface WQIOperation {
  data: WQIInterface[];
  params: string[];
  location: number[];
  place: string;
}