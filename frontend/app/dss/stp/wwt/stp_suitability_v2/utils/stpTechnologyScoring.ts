import type {
  Answer,
  CentralizedResult,
  CentralizedTechMap,
  DecentralizedResult,
  DecentralizedTechMap,
  RouteResult,
} from "@/interface/stp_suitability/stp";
import {
  BOD_SCORES,
  C_WEIGHTS,
  COD_SCORES,
  COLIFORM_SCORES,
  D_WEIGHTS,
  getBODIndex,
  getCODIndex,
  getColiformIndex,
} from "@/interface/stp_suitability/data";

export type SewageScoreMap = Record<string, [number, number, number, number]>;

export interface CompatibilityScoreMaps {
  bod: SewageScoreMap;
  cod: SewageScoreMap;
  coliform: SewageScoreMap;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 10;
  }

  return (10 * (max - value)) / (max - min);
}

function findAnswer(answers: Answer[], id: string): string | undefined {
  return answers.find((answer) => answer.id === id)?.val;
}

export function resolveRoute(answers: Answer[]): RouteResult | null {
  const category = findAnswer(answers, "category");
  if (!category) {
    return null;
  }

  if (category === "EWS") {
    const hasToilet = findAnswer(answers, "ews_toilet");
    const isDry = findAnswer(answers, "ews_dry");
    const canConvert = findAnswer(answers, "ews_convert");
    const afford = findAnswer(answers, "ews_afford");

    if (hasToilet === "NO" && afford === "NO") {
      return {
        type: "community",
        msg: "Community toilet, Ecosan, or DEWATS with twin drains is recommended.",
      };
    }

    if (hasToilet === "YES" && isDry === "YES" && canConvert === "NO") {
      return {
        type: "community",
        msg: "Community toilet, Ecosan, or DEWATS with twin drains is recommended.",
      };
    }

    const sewer = findAnswer(answers, "sewer_feasible");
    if (sewer === "YES") {
      return { type: "centralized", msg: "Centralized STP is suitable because sewer disposal is feasible." };
    }
    if (sewer === "NO") {
      return { type: "decentralized", msg: "Decentralized treatment is suitable because sewer connection is not feasible." };
    }
  }

  if (category === "OTHER") {
    const quantity = findAnswer(answers, "sewage_qty");
    if (quantity === "NO") {
      const sewer = findAnswer(answers, "sewer_feasible");
      if (sewer === "YES") {
        return { type: "centralized", msg: "Centralized STP with connection to existing sewer is suitable." };
      }
      if (sewer === "NO") {
        return { type: "decentralized", msg: "Decentralized treatment is suitable." };
      }
    }

    if (quantity === "YES") {
      const pay = findAnswer(answers, "willingness");
      if (pay === "YES") {
        return { type: "centralized", msg: "Centralized STP with conventional sewerage is suitable." };
      }
      if (pay === "NO") {
        return { type: "decentralized", msg: "Decentralized treatment is suitable because users are unwilling to pay for sewerage." };
      }
    }
  }

  return null;
}

export function getStepSequence(answers: Answer[]): string[] {
  const category = findAnswer(answers, "category");
  if (!category) {
    return ["category"];
  }

  if (category === "EWS") {
    const hasToilet = findAnswer(answers, "ews_toilet");
    const isDry = findAnswer(answers, "ews_dry");
    const canConvert = findAnswer(answers, "ews_convert");
    const afford = findAnswer(answers, "ews_afford");
    const sequence = ["category", "ews_toilet"];

    if (hasToilet === "YES") {
      sequence.push("ews_dry");
      if (isDry === "YES") {
        sequence.push("ews_convert");
      }
    }

    if (hasToilet === "NO") {
      sequence.push("ews_afford");
    }

    if (afford === "YES" || isDry === "NO" || canConvert === "YES") {
      sequence.push("sewer_feasible");
    }

    return sequence;
  }

  if (category === "OTHER") {
    const developmentType = findAnswer(answers, "dev_type");
    const quantity = findAnswer(answers, "sewage_qty");
    const sequence = ["category", "dev_type"];

    if (developmentType === "EXIST") {
      sequence.push("septic_existing");
    }

    sequence.push("sewage_qty");
    if (quantity === "NO") {
      sequence.push("sewer_feasible");
    }
    if (quantity === "YES") {
      sequence.push("willingness");
    }

    return sequence;
  }

  return ["category"];
}

export function getCompatibilityScore(
  techKey: string,
  bod: number,
  cod: number,
  coliform: number,
  scoreMaps: CompatibilityScoreMaps = {
    bod: BOD_SCORES,
    cod: COD_SCORES,
    coliform: COLIFORM_SCORES,
  },
): number {
  const bodScore = (scoreMaps.bod[techKey] ?? [5, 5, 5, 5])[getBODIndex(bod)];
  const codScore = (scoreMaps.cod[techKey] ?? [5, 5, 5, 5])[getCODIndex(cod)];
  const coliformScore =
    (scoreMaps.coliform[techKey] ?? [5, 5, 5, 5])[getColiformIndex(coliform)];

  return (bodScore + codScore + coliformScore) / 3;
}

export function scoreCentralized(
  capacityMld: number,
  techs: CentralizedTechMap,
  bod: number,
  cod: number,
  coliform: number,
  selectedKeys?: string[],
  compatibilityScoreMaps?: CompatibilityScoreMaps,
): CentralizedResult[] {
  const allKeys = Object.keys(techs) as (keyof CentralizedTechMap)[];
  const keys =
    selectedKeys && selectedKeys.length > 0
      ? allKeys.filter((key) => selectedKeys.includes(key))
      : allKeys;

  const calculations = keys.map((key) => {
    const tech = techs[key];
    return {
      key,
      name: tech.name,
      land: capacityMld * tech.land,
      cap: capacityMld * tech.cap,
      om: (capacityMld * 1000 * tech.om * 365) / 10000000, // ₹ Crore/year
      rel: tech.rel,
      ease: tech.ease,
      track: tech.track,
      sCompatibility: getCompatibilityScore(key, bod, cod, coliform, compatibilityScoreMaps),
    };
  });

  const landValues = calculations.map((item) => item.land);
  const capValues = calculations.map((item) => item.cap);
  const omValues = calculations.map((item) => item.om);

  return calculations
    .map((item) => {
      const sLand = normalize(item.land, Math.min(...landValues), Math.max(...landValues));
      const sCap = normalize(item.cap, Math.min(...capValues), Math.max(...capValues));
      const sOM = normalize(item.om, Math.min(...omValues), Math.max(...omValues));
      const total =
        C_WEIGHTS.rel * item.rel +
        C_WEIGHTS.cap * sCap +
        C_WEIGHTS.land * sLand +
        C_WEIGHTS.om * sOM +
        C_WEIGHTS.ease * item.ease +
        C_WEIGHTS.track * item.track +
        C_WEIGHTS.effluent * item.sCompatibility;

      return { ...item, sLand, sCap, sOM, total: Number(total.toFixed(1)) };
    })
    .sort((a, b) => b.total - a.total);
}

export function scoreDecentralized(
  capacityMld: number,
  techs: DecentralizedTechMap,
  bod: number,
  cod: number,
  coliform: number,
  selectedKeys?: string[],
  compatibilityScoreMaps?: CompatibilityScoreMaps,
): DecentralizedResult[] {
  const allKeys = Object.keys(techs) as (keyof DecentralizedTechMap)[];
  const keys =
    selectedKeys && selectedKeys.length > 0
      ? allKeys.filter((key) => selectedKeys.includes(key))
      : allKeys;

  const calculations = keys.map((key) => {
    const tech = techs[key];
    return {
      key,
      name: tech.name,
      land: capacityMld * tech.land,
      cap: capacityMld * tech.cap,
      om: (capacityMld * 1000 * tech.om * 365) / 10000000,
      energy: capacityMld * 1000 * tech.energy,
      rel: tech.rel,
      ease: tech.ease,
      sCompatibility: getCompatibilityScore(key, bod, cod, coliform, compatibilityScoreMaps),
    };
  });

  const landValues = calculations.map((item) => item.land);
  const capValues = calculations.map((item) => item.cap);
  const omValues = calculations.map((item) => item.om);
  const energyValues = calculations.map((item) => item.energy);

  return calculations
    .map((item) => {
      const sLand = normalize(item.land, Math.min(...landValues), Math.max(...landValues));
      const sCap = normalize(item.cap, Math.min(...capValues), Math.max(...capValues));
      const sOM = normalize(item.om, Math.min(...omValues), Math.max(...omValues));
      const sEnergy = normalize(
        item.energy,
        Math.min(...energyValues),
        Math.max(...energyValues),
      );
      const total =
        D_WEIGHTS.rel * item.rel +
        D_WEIGHTS.cap * sCap +
        D_WEIGHTS.land * sLand +
        D_WEIGHTS.om * sOM +
        D_WEIGHTS.energy * sEnergy +
        D_WEIGHTS.ease * item.ease +
        D_WEIGHTS.effluent * item.sCompatibility;

      return { ...item, sLand, sCap, sOM, sEnergy, total: Number(total.toFixed(1)) };
    })
    .sort((a, b) => b.total - a.total);
}
