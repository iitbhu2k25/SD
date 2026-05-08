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

type RiskBucket = keyof Omit<PriorityRiskCounts, "total">;

export const EMPTY_PRIORITY_RISK_COUNTS: PriorityRiskCounts = {
  veryLow: 0,
  low: 0,
  medium: 0,
  high: 0,
  veryHigh: 0,
  unknown: 0,
  total: 0,
};

function normalizeRiskFactor(riskFactor: string | undefined): RiskBucket {
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

function resolveDominantRiskFromPercentages(row: DataRow): RiskBucket {
  const candidates: Array<{ bucket: RiskBucket; value: number }> = [
    { bucket: "veryLow", value: Number(row.Very_Low ?? 0) },
    { bucket: "low", value: Number(row.Low ?? 0) },
    { bucket: "medium", value: Number(row.Medium ?? 0) },
    { bucket: "high", value: Number(row.High ?? 0) },
    { bucket: "veryHigh", value: Number(row.Very_High ?? 0) },
  ];

  const validCandidates = candidates.filter((candidate) =>
    Number.isFinite(candidate.value),
  );

  if (validCandidates.length === 0) {
    return "unknown";
  }

  const dominant = validCandidates.reduce((best, current) =>
    current.value > best.value ? current : best,
  );

  if (dominant.value <= 0) {
    return "unknown";
  }

  return dominant.bucket;
}

export function buildPriorityRiskCounts(rows: DataRow[]): PriorityRiskCounts {
  return rows.reduce<PriorityRiskCounts>(
    (counts, row) => {
      const normalizedRisk = normalizeRiskFactor(row["Risk Factor"]);
      const bucket =
        normalizedRisk !== "unknown"
          ? normalizedRisk
          : resolveDominantRiskFromPercentages(row);

      counts[bucket] += 1;
      counts.total += 1;
      return counts;
    },
    { ...EMPTY_PRIORITY_RISK_COUNTS },
  );
}