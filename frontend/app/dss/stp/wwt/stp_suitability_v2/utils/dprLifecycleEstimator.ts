import type { DprCostResult } from "./dprCostEstimator";
import type { DprOmProjectionYear } from "./dprEscalationEngine";
import type { DprOmResult } from "./dprOmEstimator";

export interface DprLifecycleResult {
  totalCapexRupees: number;
  totalYear1OmRupees: number;
  total15YearOmRupees: number;
  totalLifecycleRupees: number;
}

export function calculateDprLifecycleTotals({
  capexResult,
  omYear1,
  projection,
}: {
  capexResult: DprCostResult;
  omYear1: DprOmResult;
  projection: DprOmProjectionYear[];
}): DprLifecycleResult {
  const total15YearOmRupees = projection.reduce(
    (sum, year) => sum + year.totalRupees,
    0,
  );

  return {
    totalCapexRupees: capexResult.totalCapexRupees,
    totalYear1OmRupees: omYear1.totalYear1OmRupees,
    total15YearOmRupees,
    totalLifecycleRupees: capexResult.totalCapexRupees + total15YearOmRupees,
  };
}
