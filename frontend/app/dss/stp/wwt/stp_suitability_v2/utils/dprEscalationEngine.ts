import {
  dprOmDefaultAssumptions,
  dprOmEscalationRates,
} from "../config/dprOmEstimator.config";
import type { DprOmBreakdown, DprOmResult } from "./dprOmEstimator";

export interface DprOmProjectionYear {
  year: number;
  breakdown: DprOmBreakdown;
  totalRupees: number;
}

const omComponentKeys = [
  "manpower",
  "stpElectricity",
  "mpsElectricity",
  "chemicals",
  "dgFuel",
  "repairsCivil",
  "repairsEM",
  "ocemsMaintenance",
  "sludgeDisposal",
  "miscOM",
] as const;

const escalate = (amount: number, rate: number, yearIndex: number) =>
  amount * Math.pow(1 + rate, yearIndex);

export function calculateDprOmProjection(
  omYear1: DprOmResult,
  years = dprOmDefaultAssumptions.projectionYears,
): DprOmProjectionYear[] {
  return Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    const breakdown = omComponentKeys.reduce((current, key) => {
      current[key] = escalate(omYear1.breakdown[key], dprOmEscalationRates[key], index);
      return current;
    }, {} as DprOmBreakdown);

    return {
      year,
      breakdown,
      totalRupees: Object.values(breakdown).reduce(
        (sum, amount) => sum + amount,
        0,
      ),
    };
  });
}
