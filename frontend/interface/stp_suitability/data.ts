
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

export const C_WEIGHTS = { rel: 2, cap: 2, land: 2, om: 1.5, ease: 1.5, track: 1 }
export const D_WEIGHTS = { rel: 2, cap: 2, land: 2, om: 1.5, energy: 1, ease: 1.5 }

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