import { Gwpl_Table } from "@/interface/table";

export interface PumpingRiskCounts {
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  unknown: number;
  total: number;
}

export const EMPTY_PUMPING_RISK_COUNTS: PumpingRiskCounts = {
  lowRisk: 0,
  mediumRisk: 0,
  highRisk: 0,
  unknown: 0,
  total: 0,
};

export function buildPumpingRiskCounts(rows: Gwpl_Table[]): PumpingRiskCounts {
  return rows.reduce<PumpingRiskCounts>(
    (counts, row) => {
      // Pumping well points currently do not have a defined risk level returned 
      // from the backend. They are grouped into unknown until an algorithm decides.
      counts.unknown += 1;
      counts.total += 1;
      return counts;
    },
    { ...EMPTY_PUMPING_RISK_COUNTS },
  );
}
