import type {
  Answer,
  CentralizedTechMap,
  DecentralizedTechMap,
  CentralizedResult,
  DecentralizedResult,
  RouteResult,
  SystemType,
} from '@/interface/stp_suitability/stp'
import { C_WEIGHTS, D_WEIGHTS } from '@/interface/stp_suitability/data'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 10
  return 10 * (max - val) / (max - min)
}

function findAnswer(answers: Answer[], id: string): string | undefined {
  return answers.find(a => a.id === id)?.val
}

// ─── Routing Logic ────────────────────────────────────────────────────────────

export function resolveRoute(answers: Answer[]): RouteResult | null {
  const cat = findAnswer(answers, 'category')
  if (!cat) return null

  if (cat === 'EWS') {
    const hasToilet  = findAnswer(answers, 'ews_toilet')
    const isDry      = findAnswer(answers, 'ews_dry')
    const canConvert = findAnswer(answers, 'ews_convert')
    const afford     = findAnswer(answers, 'ews_afford')

    if (hasToilet === 'NO' && afford === 'NO') {
      return { type: 'community', msg: 'Community Toilet / Ecosan / DEWATS + Twin Drains recommended' }
    }
    if (hasToilet === 'YES' && isDry === 'YES' && canConvert === 'NO') {
      return { type: 'community', msg: 'Community Toilet / Ecosan / DEWATS + Twin Drains recommended' }
    }
    const sewer = findAnswer(answers, 'sewer_feasible')
    if (sewer === 'YES') return { type: 'centralized',   msg: 'Centralized STP — disposal to existing sewer is feasible' }
    if (sewer === 'NO')  return { type: 'decentralized', msg: 'Decentralized System — sewer connection not feasible' }
  }

  if (cat === 'OTHER') {
    const qty = findAnswer(answers, 'sewage_qty')
    if (qty === 'NO') {
      const sewer = findAnswer(answers, 'sewer_feasible')
      if (sewer === 'YES') return { type: 'centralized',   msg: 'Centralized STP — connection to existing sewer' }
      if (sewer === 'NO')  return { type: 'decentralized', msg: 'Decentralized System' }
    }
    if (qty === 'YES') {
      const pay = findAnswer(answers, 'willingness')
      if (pay === 'YES') return { type: 'centralized',   msg: 'Centralized STP — conventional sewerage system' }
      if (pay === 'NO')  return { type: 'decentralized', msg: 'Decentralized System — users unwilling to pay for sewerage' }
    }
  }

  return null
}

// ─── Step Sequence ────────────────────────────────────────────────────────────
// Returns the ordered list of step IDs for the given answer set so far.

export function getStepSequence(answers: Answer[]): string[] {
  const cat = findAnswer(answers, 'category')
  if (!cat) return ['category']

  if (cat === 'EWS') {
    const hasToilet  = findAnswer(answers, 'ews_toilet')
    const isDry      = findAnswer(answers, 'ews_dry')
    const canConvert = findAnswer(answers, 'ews_convert')
    const afford     = findAnswer(answers, 'ews_afford')

    const seq: string[] = ['category', 'ews_toilet']

    if (hasToilet === 'YES') {
      seq.push('ews_dry')
      if (isDry === 'YES') seq.push('ews_convert')
    }
    if (hasToilet === 'NO') seq.push('ews_afford')

    const shouldAskSewer =
      afford === 'YES' ||
      isDry === 'NO' ||
      canConvert === 'YES'

    if (shouldAskSewer) seq.push('sewer_feasible')
    return seq
  }

  if (cat === 'OTHER') {
    const devType = findAnswer(answers, 'dev_type')
    const qty     = findAnswer(answers, 'sewage_qty')
    const seq: string[] = ['category', 'dev_type']

    if (devType === 'EXIST') seq.push('septic_existing')
    seq.push('sewage_qty')
    if (qty === 'NO')  seq.push('sewer_feasible')
    if (qty === 'YES') seq.push('willingness')
    return seq
  }

  return ['category']
}

// ─── Scoring: Centralized ─────────────────────────────────────────────────────

export function scoreCentralized(
  Q: number,
  techs: CentralizedTechMap,
): CentralizedResult[] {
  const keys = Object.keys(techs) as (keyof CentralizedTechMap)[]

  const calcs = keys.map(k => {
    const t = techs[k]
    return {
      key:   k,
      name:  t.name,
      land:  Q * t.land,
      cap:   Q * t.cap,
      om:    (Q * 1000 * t.om * 365) / 1e7, // ₹ Crore/year
      rel:   t.rel,
      ease:  t.ease,
      track: t.track,
    }
  })

  const landArr = calcs.map(c => c.land)
  const capArr  = calcs.map(c => c.cap)
  const omArr   = calcs.map(c => c.om)

  const lMax = Math.max(...landArr), lMin = Math.min(...landArr)
  const cMax = Math.max(...capArr),  cMin = Math.min(...capArr)
  const oMax = Math.max(...omArr),   oMin = Math.min(...omArr)

  return calcs
    .map(c => {
      const sLand = normalize(c.land, lMin, lMax)
      const sCap  = normalize(c.cap,  cMin, cMax)
      const sOM   = normalize(c.om,   oMin, oMax)
      const total =
        C_WEIGHTS.rel   * c.rel   +
        C_WEIGHTS.cap   * sCap    +
        C_WEIGHTS.land  * sLand   +
        C_WEIGHTS.om    * sOM     +
        C_WEIGHTS.ease  * c.ease  +
        C_WEIGHTS.track * c.track
      return { ...c, sLand, sCap, sOM, total: +total.toFixed(1) }
    })
    .sort((a, b) => b.total - a.total)
}

// ─── Scoring: Decentralized ───────────────────────────────────────────────────

export function scoreDecentralized(
  Q: number,
  techs: DecentralizedTechMap,
): DecentralizedResult[] {
  const keys = Object.keys(techs) as (keyof DecentralizedTechMap)[]

  const calcs = keys.map(k => {
    const t = techs[k]
    return {
      key:    k,
      name:   t.name,
      land:   Q * t.land,
      cap:    Q * t.cap,
      om:     (Q * 1000 * t.om * 365) / 1e7,
      energy: Q * 1000 * t.energy, // kWh/day
      rel:    t.rel,
      ease:   t.ease,
    }
  })

  const landArr   = calcs.map(c => c.land)
  const capArr    = calcs.map(c => c.cap)
  const omArr     = calcs.map(c => c.om)
  const energyArr = calcs.map(c => c.energy)

  const lMax = Math.max(...landArr),   lMin = Math.min(...landArr)
  const cMax = Math.max(...capArr),    cMin = Math.min(...capArr)
  const oMax = Math.max(...omArr),     oMin = Math.min(...omArr)
  const eMax = Math.max(...energyArr), eMin = Math.min(...energyArr)

  return calcs
    .map(c => {
      const sLand   = normalize(c.land,   lMin, lMax)
      const sCap    = normalize(c.cap,    cMin, cMax)
      const sOM     = normalize(c.om,     oMin, oMax)
      const sEnergy = normalize(c.energy, eMin, eMax)
      const total =
        D_WEIGHTS.rel    * c.rel    +
        D_WEIGHTS.cap    * sCap     +
        D_WEIGHTS.land   * sLand    +
        D_WEIGHTS.om     * sOM      +
        D_WEIGHTS.energy * sEnergy  +
        D_WEIGHTS.ease   * c.ease
      return { ...c, sLand, sCap, sOM, sEnergy, total: +total.toFixed(1) }
    })
    .sort((a, b) => b.total - a.total)
}