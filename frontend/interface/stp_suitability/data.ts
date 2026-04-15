
import type {
  CentralizedTechMap,
  DecentralizedTechMap,
  WizardStep,
} from '@/interface/stp_suitability/stp'

// ─── Centralized Technology Data ─────────────────────────────────────────────

export const CENTRALIZED_TECH: CentralizedTechMap = {
  TF:     { name: 'Trickling Filter',          land: 0.25, cap: 1.5, om: 2.0, rel: 6,  ease: 7, track: 8  },
  ASP:    { name: 'Activated Sludge Process',  land: 0.15, cap: 1.8, om: 2.8, rel: 7,  ease: 6, track: 9  },
  EA:     { name: 'Extended Aeration',         land: 0.15, cap: 2.0, om: 3.0, rel: 7,  ease: 7, track: 8  },
  SBR:    { name: 'Sequential Batch Reactor',  land: 0.10, cap: 2.2, om: 3.2, rel: 9,  ease: 9, track: 10 },
  BIOFOR: { name: 'BIOFOR-F',                  land: 0.08, cap: 2.3, om: 3.0, rel: 8,  ease: 8, track: 7  },
  MBR:    { name: 'Membrane Bioreactor',       land: 0.05, cap: 3.5, om: 5.5, rel: 10, ease: 4, track: 6  },
}

// ─── Decentralized Technology Data ───────────────────────────────────────────

export const DECENTRALIZED_TECH: DecentralizedTechMap = {
  CW:      { name: 'Constructed Wetland',        land: 0.30, cap: 1.0, om: 0.8, energy: 0.05, rel: 7, ease: 9  },
  WSP:     { name: 'Waste Stabilization Pond',   land: 0.40, cap: 0.8, om: 0.6, energy: 0.02, rel: 6, ease: 10 },
  ABR:     { name: 'Anaerobic Baffled Reactor',  land: 0.08, cap: 1.2, om: 1.0, energy: 0.10, rel: 7, ease: 8  },
  UASB_CW: { name: 'UASB + Constructed Wetland', land: 0.15, cap: 1.5, om: 1.2, energy: 0.12, rel: 8, ease: 7  },
  MBBR:    { name: 'Compact MBBR',               land: 0.06, cap: 1.8, om: 2.5, energy: 0.40, rel: 9, ease: 6  },
  PACK:    { name: 'Packaged Modular STP',        land: 0.05, cap: 2.0, om: 3.0, energy: 0.50, rel: 9, ease: 6  },
}

// ─── DPR Weight Factors ───────────────────────────────────────────────────────

export const C_WEIGHTS = { rel: 2, cap: 2, land: 2, om: 1.5, ease: 1.5, track: 1, effluent: 2 }
export const D_WEIGHTS = { rel: 2, cap: 2, land: 2, om: 1.5, energy: 1, ease: 1.5, effluent: 2 }

type SewageScoreMap = Record<string, [number, number, number, number]>

// ─── Centralized BOD / COD / Coliform Scores ─────────────────────────────────

export const BOD_SCORES: SewageScoreMap = {
  // Centralized
  TF:     [8,  7,  5,  3],
  ASP:    [8,  8,  7,  5],
  EA:     [7,  8,  7,  6],
  SBR:    [9,  9,  9,  8],
  BIOFOR: [8,  8,  9,  8],
  MBR:    [10, 10, 10, 10],
  // Decentralized  (<150 | 150–300 | 300–500 | >500)
  CW:      [9, 8, 6, 4],
  WSP:     [9, 8, 6, 4],
  ABR:     [7, 8, 8, 7],
  UASB_CW: [7, 8, 9, 8],
  MBBR:    [8, 9, 9, 9],
  PACK:    [8, 9, 9, 9],
}

export const COD_SCORES: SewageScoreMap = {
  // Centralized
  TF:     [7,  6,  5,  3],
  ASP:    [7,  7,  6,  5],
  EA:     [7,  7,  6,  5],
  SBR:    [9,  9,  8,  7],
  BIOFOR: [8,  9,  9,  8],
  MBR:    [10, 10, 10, 10],
  // Decentralized  (<300 | 300–600 | 600–1000 | >1000)
  CW:      [8, 7, 5, 3],
  WSP:     [8, 7, 5, 3],
  ABR:     [7, 8, 7, 6],
  UASB_CW: [7, 8, 8, 7],
  MBBR:    [9, 9, 9, 8],
  PACK:    [9, 9, 9, 8],
}

export const COLIFORM_SCORES: SewageScoreMap = {
  // Centralized
  TF:     [6,  5,  4,  3],
  ASP:    [7,  6,  5,  4],
  EA:     [7,  6,  5,  4],
  SBR:    [8,  8,  7,  6],
  BIOFOR: [8,  7,  6,  5],
  MBR:    [10, 10, 9,  9],
  // Decentralized  (<1 000 | 1 000–10⁴ | 10⁴–10⁶ | >10⁶)
  CW:      [6, 5, 4, 3],
  WSP:     [6, 5, 4, 3],
  ABR:     [6, 5, 4, 3],
  UASB_CW: [7, 6, 5, 4],
  MBBR:    [8, 7, 6, 5],
  PACK:    [8, 7, 6, 5],
}

/** Returns 0-based range index for BOD (mg/L) */
export function getBODIndex(bod: number): number {
  if (bod < 150)  return 0
  if (bod <= 300) return 1
  if (bod <= 500) return 2
  return 3
}

/** Returns 0-based range index for COD (mg/L) */
export function getCODIndex(cod: number): number {
  if (cod < 300)  return 0
  if (cod <= 600) return 1
  if (cod <= 1000) return 2
  return 3
}

/** Returns 0-based range index for Coliform (MPN/100mL) */
export function getColiformIndex(col: number): number {
  if (col < 1000)      return 0
  if (col <= 10000)    return 1
  if (col <= 1000000)  return 2
  return 3
}

// ─── Wizard Steps ─────────────────────────────────────────────────────────────

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'category',
    label: 'Step 1 — Sanitation Category',
    question: 'What type of area is the sanitation system being planned for?',
    opts: [
      { label: 'Economically Weaker Section (EWS)', icon: '⌂', val: 'EWS' },
      { label: 'General Urban Development',          icon: '⊞', val: 'OTHER' },
    ],
  },
  {
    id: 'ews_toilet',
    label: 'Step 2 — Toilet Availability',
    question: 'Are toilets available in the household?',
    opts: [
      { label: 'Yes', icon: '✓', val: 'YES' },
      { label: 'No',  icon: '✗', val: 'NO'  },
    ],
  },
  {
    id: 'ews_dry',
    label: 'Step 3 — Toilet Type',
    question: 'Is the toilet a Dry Toilet / Bahao Toilet?',
    opts: [
      { label: 'Yes — Dry/Bahao', icon: '⊘', val: 'YES' },
      { label: 'No',              icon: '✓', val: 'NO'  },
    ],
  },
  {
    id: 'ews_convert',
    label: 'Step 3.1 — Conversion Possibility',
    question: 'Can the dry toilet be converted into a septic tank system?',
    opts: [
      { label: 'Yes', icon: '↻', val: 'YES' },
      { label: 'No',  icon: '✗', val: 'NO'  },
    ],
  },
  {
    id: 'ews_afford',
    label: 'Step 4 — Construction Feasibility',
    question: 'Can the user afford a toilet with septic tank?',
    opts: [
      { label: 'Yes', icon: '₹', val: 'YES' },
      { label: 'No',  icon: '✗', val: 'NO'  },
    ],
  },
  {
    id: 'sewer_feasible',
    label: 'Step 5 — Sewer Feasibility',
    question: 'Is collection and disposal to an existing sewer system economically feasible?',
    opts: [
      { label: 'Yes', icon: '≡', val: 'YES' },
      { label: 'No',  icon: '✗', val: 'NO'  },
    ],
  },
  {
    id: 'dev_type',
    label: 'Step 6 — Development Type',
    question: 'Is this a new or existing development?',
    opts: [
      { label: 'New Development',      icon: '▲', val: 'NEW'   },
      { label: 'Existing Development', icon: '◉', val: 'EXIST' },
    ],
  },
  {
    id: 'septic_existing',
    label: 'Step 7 — Existing Septic Tank',
    question: 'Is there an onsite septic tank system?',
    opts: [
      { label: 'Yes', icon: '✓', val: 'YES' },
      { label: 'No',  icon: '✗', val: 'NO'  },
    ],
  },
  {
    id: 'sewage_qty',
    label: 'Step 8 — Wastewater Quantity',
    question: 'Is sewage generation greater than 100 LPCD?',
    opts: [
      { label: 'Yes (> 100 LPCD)', icon: '▲', val: 'YES' },
      { label: 'No (≤ 100 LPCD)',  icon: '▼', val: 'NO'  },
    ],
  },
  {
    id: 'willingness',
    label: 'Step 9 — Financial Willingness',
    question: 'Are users willing to pay for sewerage services?',
    opts: [
      { label: 'Yes', icon: '₹', val: 'YES' },
      { label: 'No',  icon: '✗', val: 'NO'  },
    ],
  },
]