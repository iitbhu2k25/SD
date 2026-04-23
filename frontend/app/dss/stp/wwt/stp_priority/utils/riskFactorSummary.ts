import { DataRow } from "@/interface/table";

export interface PriorityRiskCounts {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
  unknown: number;
  total: number;
}

export const EMPTY_PRIORITY_RISK_COUNTS: PriorityRiskCounts = {
  veryLow: 0,
  low: 0,
  medium: 0,
  high: 0,
  veryHigh: 0,
  unknown: 0,
  total: 0,
};

function normalizeRiskFactor(
  riskFactor: string | undefined,
): keyof Omit<PriorityRiskCounts, "total"> {
  if (!riskFactor) {
    return "unknown";
  }

  const normalized = riskFactor
    .toLowerCase()
    .replace(/[_\-\s]/g, "")
    .trim();

  if (normalized === "verylow") {
    return "veryLow";
  }

  if (normalized === "low") {
    return "low";
  }

  if (normalized === "medium") {
    return "medium";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "veryhigh") {
    return "veryHigh";
  }

  return "unknown";
}

export function buildPriorityRiskCounts(rows: DataRow[]): PriorityRiskCounts {
  return rows.reduce<PriorityRiskCounts>(
    (counts, row) => {
      const bucket = normalizeRiskFactor(row["Risk Factor"]);
      counts[bucket] += 1;
      counts.total += 1;
      return counts;
    },
    { ...EMPTY_PRIORITY_RISK_COUNTS },
  );
}
