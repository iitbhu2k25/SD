import {
  RUPEES_PER_CRORE,
  dprCommercialDiametersMm,
  dprCostConstants,
  dprEffluentPipeRates,
  dprGravityPipeRates,
  dprMiscWorkOptions,
  dprMpsCostRanges,
  dprRisingMainRates,
  dprStpTechnologyRates,
  dprTappingOptions,
} from "../config/dprCostEstimator.config";

export type ElevationInputMode = "direct" | "levels";
export type TappingOptionId = (typeof dprTappingOptions)[number]["id"];
export type StpTechnologyKey = (typeof dprStpTechnologyRates)[number]["key"];
export type EffluentPipeRateId = (typeof dprEffluentPipeRates)[number]["id"];
export type MiscWorkId = (typeof dprMiscWorkOptions)[number]["id"];
export type DprNumericInput = number | null;
export type LandOwnershipType = "government" | "private";
export type TerrainType = "flat" | "undulating" | "custom";

export interface DprCostInputs {
  stpCapacityMld: DprNumericInput;
  drainFlowMld: DprNumericInput;
  tappingPoints: Record<TappingOptionId, DprNumericInput>;
  tappingRatesRupees: Record<TappingOptionId, DprNumericInput>;
  elevationMode: ElevationInputMode;
  deltaE: DprNumericInput;
  tappingElevation: DprNumericInput;
  stpElevation: DprNumericInput;
  pathLength: DprNumericInput;
  stpTechnologyKey: StpTechnologyKey;
  landOwnership: LandOwnershipType;
  landUnitCostRupeesPerHa: DprNumericInput;
  effluentLength: DprNumericInput;
  effluentPipeRateId: EffluentPipeRateId;
  effluentRatesRupees: Record<EffluentPipeRateId, DprNumericInput>;
  ocemsRatePerPointRupees: DprNumericInput;
  selectedMiscWorkIds: MiscWorkId[];
  miscWorkCostsRupees: Record<MiscWorkId, DprNumericInput>;
  terrainType: TerrainType;
  customTdhMeters: DprNumericInput;
  electricityTariffRupeesPerKwh: DprNumericInput;
  pumpEfficiency: DprNumericInput;
  chlorineDoseMgPerL: DprNumericInput;
  chlorineRateRupeesPerKg: DprNumericInput;
  polymerDoseKgPerKgSludge: DprNumericInput;
  polymerRateRupeesPerKg: DprNumericInput;
  otherChemicalsRupeesPerYear: DprNumericInput;
  dieselRateRupeesPerLiter: DprNumericInput;
  dgBackupHoursPerDay: DprNumericInput;
  dieselConsumptionLitersPerKwh: DprNumericInput;
  mobileOilPercentOfDiesel: DprNumericInput;
  mobileOilRateRupeesPerLiter: DprNumericInput;
  sludgeDisposalRateRupeesPerKg: DprNumericInput;
  annualOcemsMaintenanceRateRupeesPerPoint: DprNumericInput;
  miscOmPercentOfManpower: DprNumericInput;
}

export interface DprCostBreakdown {
  idWorks: number;
  gravity: number;
  mps: number;
  risingMain: number;
  stp: number;
  land: number;
  effluent: number;
  ocems: number;
  miscellaneous: number;
}

export interface DprCostResult {
  totalCostRupees: number;
  totalCapexRupees: number;
  totalDrainPoints: number;
  breakdown: DprCostBreakdown;
  capexBreakdown: DprCostBreakdown;
  idWorks: {
    rows: Array<{
      id: TappingOptionId;
      label: string;
      points: number;
      rateRupees: number;
      costRupees: number;
    }>;
  };
  conveyance: {
    deltaE: number;
    slope: number;
    isGravityFeasible: boolean;
    qIniCumecs: number;
    gravityDiameterMm: number;
    gravityCommercialDiameterMm: number;
    gravityRateLabel: string;
    gravityRateRupees: number;
    qPumpCumecs: number;
    mpsRangeLabel: string;
    risingMainDiameterMm: number;
    risingMainCommercialDiameterMm: number;
    risingMainRateLabel: string;
    risingMainRateRupees: number;
  };
  stp: {
    technologyLabel: string;
    technologyName: string;
    rateCrPerMld: number;
    landFactorHaPerMld: number;
  };
  land: {
    ownership: LandOwnershipType;
    requiredAreaHa: number;
    unitCostRupeesPerHa: number;
    costRupees: number;
  };
  effluent: {
    diameterLabel: string;
    rateRupees: number;
  };
  miscellaneous: {
    rows: Array<{
      id: MiscWorkId;
      label: string;
      costRupees: number;
    }>;
  };
}

const toFiniteNumber = (value: DprNumericInput, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const positiveOrZero = (value: DprNumericInput) => Math.max(0, toFiniteNumber(value));

const findCommercialDiameter = (diameterMm: number, minimumMm: number) => {
  const target = Math.max(positiveOrZero(diameterMm), minimumMm);
  return dprCommercialDiametersMm.find((diameter) => diameter >= target) ?? Math.ceil(target / 100) * 100;
};

const findPipeRate = (
  diameterMm: number,
  rates: ReadonlyArray<{
    minMm: number;
    maxMm: number | null;
    label: string;
    ratePerMeterRupees: number;
  }>,
) =>
  rates.find(
    (range) => diameterMm >= range.minMm && (range.maxMm === null || diameterMm <= range.maxMm),
  ) ?? rates[rates.length - 1];

const findMpsCostRange = (qMld: number) => {
  const flow = positiveOrZero(qMld);
  return (
    dprMpsCostRanges.find((range) => {
      if (range.maxMld === null) {
        return flow > range.minMld;
      }

      return flow <= range.maxMld;
    }) ?? dprMpsCostRanges[dprMpsCostRanges.length - 1]
  );
};

const calculateGravityDiameterMm = (qIniCumecs: number, slope: number) => {
  if (qIniCumecs <= 0 || slope <= 0) {
    return 0;
  }

  const numerator =
    qIniCumecs * dprCostConstants.manningN * Math.pow(4, 5 / 3);
  const denominator = Math.PI * Math.sqrt(slope);
  return Math.pow(numerator / denominator, 3 / 8) * 1000;
};

const calculateRisingMainDiameterMm = (qPumpCumecs: number) => {
  if (qPumpCumecs <= 0) {
    return 0;
  }

  const area = qPumpCumecs / dprCostConstants.risingMainVelocityMps;
  return 2 * Math.sqrt(area / Math.PI) * 1000;
};

export const formatCrore = (amountRupees: number) =>
  `₹ ${(toFiniteNumber(amountRupees) / RUPEES_PER_CRORE).toFixed(2)} Cr`;

export const formatRupees = (amountRupees: number) =>
  `₹ ${Math.round(toFiniteNumber(amountRupees)).toLocaleString("en-IN")}`;

export const resolveDprTechnologyKey = (
  technologyName?: string | null,
): StpTechnologyKey => {
  if (!technologyName) {
    return dprStpTechnologyRates[0].key;
  }

  const normalizedName = technologyName.toLowerCase();
  return (
    dprStpTechnologyRates.find(
      (technology) =>
        technology.key.toLowerCase() === normalizedName ||
        technology.label.toLowerCase() === normalizedName ||
        technology.displayName.toLowerCase() === normalizedName ||
        normalizedName.includes(technology.displayName.toLowerCase()) ||
        normalizedName.includes(technology.label.toLowerCase()),
    )?.key ?? dprStpTechnologyRates[0].key
  );
};

export function calculateDprCost(inputs: DprCostInputs): DprCostResult {
  const stpCapacityMld = positiveOrZero(inputs.stpCapacityMld);
  const drainFlowMld = positiveOrZero(inputs.drainFlowMld);
  const pathLength = positiveOrZero(inputs.pathLength);
  const effluentLength = positiveOrZero(inputs.effluentLength);
  const deltaE =
    inputs.elevationMode === "direct"
      ? toFiniteNumber(inputs.deltaE)
      : toFiniteNumber(inputs.tappingElevation) - toFiniteNumber(inputs.stpElevation);
  const slope = pathLength > 0 ? deltaE / pathLength : 0;
  const isGravityFeasible = slope >= dprCostConstants.minimumGravitySlope;

  const idRows = dprTappingOptions.map((option) => {
    const points = Math.floor(positiveOrZero(inputs.tappingPoints[option.id] ?? 0));
    const rateRupees = positiveOrZero(inputs.tappingRatesRupees[option.id]);
    return {
      id: option.id,
      label: option.label,
      points,
      rateRupees,
      costRupees: points * rateRupees,
    };
  });
  const idWorks = idRows.reduce((sum, row) => sum + row.costRupees, 0);
  const totalDrainPoints = idRows.reduce((sum, row) => sum + row.points, 0);

  const qIniCumecs = ((drainFlowMld * 1000) / 86400) * 2.5;
  const gravityDiameterMm = calculateGravityDiameterMm(qIniCumecs, slope);
  const gravityCommercialDiameterMm = findCommercialDiameter(gravityDiameterMm, 300);
  const gravityRate = findPipeRate(gravityCommercialDiameterMm, dprGravityPipeRates);
  const gravity =
    isGravityFeasible
      ? pathLength * gravityRate.ratePerMeterRupees * dprCostConstants.gravityContingencyFactor
      : 0;

  const mpsRange = findMpsCostRange(stpCapacityMld);
  const qPumpCumecs =
    (drainFlowMld * 1000) / (dprCostConstants.pumpingHoursPerDay * 3600);
  const risingMainDiameterMm = calculateRisingMainDiameterMm(qPumpCumecs);
  const risingMainCommercialDiameterMm = findCommercialDiameter(risingMainDiameterMm, 200);
  const risingMainRate = findPipeRate(risingMainCommercialDiameterMm, dprRisingMainRates);
  const mps = isGravityFeasible ? 0 : mpsRange.costRupees;
  const risingMain = isGravityFeasible
    ? 0
    : pathLength *
      risingMainRate.ratePerMeterRupees *
      dprCostConstants.risingMainContingencyFactor;

  const stpTechnology =
    dprStpTechnologyRates.find((technology) => technology.key === inputs.stpTechnologyKey) ??
    dprStpTechnologyRates[0];
  const stp = stpCapacityMld * stpTechnology.rateCrPerMld * RUPEES_PER_CRORE;
  const landRequiredAreaHa = stpCapacityMld * stpTechnology.landFactorHaPerMld;
  const landUnitCostRupeesPerHa = positiveOrZero(inputs.landUnitCostRupeesPerHa);
  const land =
    inputs.landOwnership === "private"
      ? landRequiredAreaHa * landUnitCostRupeesPerHa
      : 0;

  const effluentRate =
    dprEffluentPipeRates.find((rate) => rate.id === inputs.effluentPipeRateId) ??
    dprEffluentPipeRates[0];
  const effluentRateRupees = positiveOrZero(inputs.effluentRatesRupees[effluentRate.id]);
  const effluent = effluentLength * effluentRateRupees;

  const selectedMiscIds = new Set(inputs.selectedMiscWorkIds);
  const miscRows = dprMiscWorkOptions
    .filter((option) => selectedMiscIds.has(option.id))
    .map((option) => ({
      id: option.id,
      label: option.label,
      costRupees: positiveOrZero(inputs.miscWorkCostsRupees[option.id]),
    }));
  const miscellaneous = miscRows.reduce((sum, row) => sum + row.costRupees, 0);

  const ocemsRatePerPointRupees = positiveOrZero(inputs.ocemsRatePerPointRupees);
  const ocems = totalDrainPoints * ocemsRatePerPointRupees;
  const breakdown = {
    idWorks,
    gravity,
    mps,
    risingMain,
    stp,
    land,
    effluent,
    ocems,
    miscellaneous,
  };
  const totalCostRupees = Object.values(breakdown).reduce((sum, amount) => sum + amount, 0);

  return {
    totalCostRupees,
    totalCapexRupees: totalCostRupees,
    totalDrainPoints,
    breakdown,
    capexBreakdown: breakdown,
    idWorks: {
      rows: idRows,
    },
    conveyance: {
      deltaE,
      slope,
      isGravityFeasible,
      qIniCumecs,
      gravityDiameterMm,
      gravityCommercialDiameterMm,
      gravityRateLabel: gravityRate.label,
      gravityRateRupees: gravityRate.ratePerMeterRupees,
      qPumpCumecs,
      mpsRangeLabel: mpsRange.label,
      risingMainDiameterMm,
      risingMainCommercialDiameterMm,
      risingMainRateLabel: risingMainRate.label,
      risingMainRateRupees: risingMainRate.ratePerMeterRupees,
    },
    stp: {
      technologyLabel: stpTechnology.label,
      technologyName: stpTechnology.displayName,
      rateCrPerMld: stpTechnology.rateCrPerMld,
      landFactorHaPerMld: stpTechnology.landFactorHaPerMld,
    },
    land: {
      ownership: inputs.landOwnership,
      requiredAreaHa: landRequiredAreaHa,
      unitCostRupeesPerHa: landUnitCostRupeesPerHa,
      costRupees: land,
    },
    effluent: {
      diameterLabel: effluentRate.label,
      rateRupees: effluentRateRupees,
    },
    miscellaneous: {
      rows: miscRows,
    },
  };
}
