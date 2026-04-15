// ─── Technology Data ─────────────────────────────────────────────────────────

export interface CentralizedTech {
  name: string
  land: number   // ha/MLD
  cap: number    // ₹ Crore/MLD
  om: number     // ₹/m³
  rel: number    // reliability score 0-10
  ease: number   // ease of operation 0-10
  track: number  // track record 0-10
}

export interface DecentralizedTech {
  name: string
  land: number   // ha/MLD
  cap: number    // ₹ Crore/MLD
  om: number     // ₹/m³
  energy: number // kWh/m³
  rel: number
  ease: number
}

export type CentralizedTechKey = 'TF' | 'ASP' | 'EA' | 'SBR' | 'BIOFOR' | 'MBR'
export type DecentralizedTechKey = 'CW' | 'WSP' | 'ABR' | 'UASB_CW' | 'MBBR' | 'PACK'

export type CentralizedTechMap = Record<CentralizedTechKey, CentralizedTech>
export type DecentralizedTechMap = Record<DecentralizedTechKey, DecentralizedTech>

// ─── Scoring Results ──────────────────────────────────────────────────────────

export interface CentralizedResult {
  key: string
  name: string
  land: number
  cap: number
  om: number
  rel: number
  ease: number
  track: number
  sCompatibility: number
  sLand: number
  sCap: number
  sOM: number
  total: number
}

export interface DecentralizedResult {
  key: string
  name: string
  land: number
  cap: number
  om: number
  energy: number
  rel: number
  ease: number
  sCompatibility: number
  sLand: number
  sCap: number
  sOM: number
  sEnergy: number
  total: number
}

export type RankedResult = CentralizedResult | DecentralizedResult

// ─── Wizard ───────────────────────────────────────────────────────────────────

export type StepId =
  | 'category'
  | 'ews_toilet'
  | 'ews_dry'
  | 'ews_convert'
  | 'ews_afford'
  | 'sewer_feasible'
  | 'dev_type'
  | 'septic_existing'
  | 'sewage_qty'
  | 'willingness'

export interface Answer {
  id: StepId
  val: string
  label: string
}

export interface WizardStep {
  id: StepId
  label: string
  question: string
  opts: { label: string; icon: string; val: string }[]
}

export type SystemType = 'centralized' | 'decentralized' | 'community'

export interface RouteResult {
  type: SystemType
  msg: string
}

// ─── App State ────────────────────────────────────────────────────────────────

export type Screen = 'wizard' | 'tech_select' | 'inputs' | 'perf_table' | 'results'

export interface ProjectParams {
  Q: number        // MLD
  Ce: number       // ₹/kWh
  AL: number       // ha available
  BOD: number      // mg/L  (1–1000)
  COD: number      // mg/L  (1–10000)
  Coliform: number // MPN/100mL (1–1000)
}