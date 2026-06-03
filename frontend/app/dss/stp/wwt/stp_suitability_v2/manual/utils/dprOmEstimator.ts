import {
  dprCapexRepairAllocation,
  dprMpsStaffNorms,
  dprOmDefaultAssumptions,
  dprOmSalaryTable,
  dprOmTechnologyConfig,
  dprStpStaffNorms,
} from "../config/dprOmEstimator.config";
import type { DprOmSalaryKey } from "../config/dprOmEstimator.config";
import type {
  DprCostBreakdown,
  DprCostInputs,
  DprCostResult,
  DprNumericInput,
} from "./dprCostEstimator";

type StaffRow = {
  role: string;
  salaryKey: DprOmSalaryKey;
  count: number;
};

type DprOmTechnologyConfigValue =
  (typeof dprOmTechnologyConfig)[keyof typeof dprOmTechnologyConfig];

export interface DprOmBreakdown {
  manpower: number;
  stpElectricity: number;
  mpsElectricity: number;
  chemicals: number;
  dgFuel: number;
  repairsCivil: number;
  repairsEM: number;
  ocemsMaintenance: number;
  sludgeDisposal: number;
  miscOM: number;
}

export interface DprOmResult {
  totalYear1OmRupees: number;
  breakdown: DprOmBreakdown;
  assumptions: {
    tdhMeters: number;
    electricityTariffRupeesPerKwh: number;
    pumpEfficiency: number;
    stpStaffCount: number;
    mpsStaffCount: number;
    pumpPowerKw: number;
    energyKwhPerMldDay: number;
    sludgeKgPerMldDay: number;
    chlorineCostRupees: number;
    polymerCostRupees: number;
    otherChemicalsRupees: number;
    dgCapacityKw: number;
    annualDieselLiters: number;
    annualMobileOilLiters: number;
  };
}

const toFiniteNumber = (value: DprNumericInput, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const positiveOrZero = (value: DprNumericInput) => Math.max(0, toFiniteNumber(value));

const getStpStaffNorm = (stpCapacityMld: number) =>
  dprStpStaffNorms.find(
    (norm) => norm.maxMld === null || stpCapacityMld <= norm.maxMld,
  ) ?? dprStpStaffNorms[dprStpStaffNorms.length - 1];

const getMpsStaffNorm = (pumpPowerKw: number) =>
  dprMpsStaffNorms.find(
    (norm) => norm.maxKw === null || pumpPowerKw <= norm.maxKw,
  ) ?? dprMpsStaffNorms[dprMpsStaffNorms.length - 1];

const calculateStaffCost = (
  staffRows: ReadonlyArray<StaffRow>,
) =>
  staffRows.reduce(
    (sum, staff) =>
      sum + staff.count * dprOmSalaryTable[staff.salaryKey].annualCostRupees,
    0,
  );

const calculateStaffCount = (staffRows: ReadonlyArray<StaffRow>) =>
  staffRows.reduce((sum, staff) => sum + staff.count, 0);

const isOperatorRole = (role: string) =>
  role.toLowerCase().includes("operators");

const getAdjustedStpStaffRows = (
  staffRows: ReadonlyArray<StaffRow>,
  technologyConfig: DprOmTechnologyConfigValue,
): StaffRow[] => {
  const operatorMultiplier = technologyConfig.stpOperatorMultiplier ?? 1;
  const adjustedRows = staffRows.map((staff) => ({
    ...staff,
    count: isOperatorRole(staff.role)
      ? staff.count * operatorMultiplier
      : staff.count,
  }));

  const additionalStpOperators = technologyConfig.additionalStpOperators ?? 0;
  if (additionalStpOperators > 0) {
    adjustedRows.push({
      role: "Additional qualified operators",
      salaryKey: "operatorElectrician2nd",
      count: additionalStpOperators,
    });
  }

  return adjustedRows;
};

const getTdhMeters = (inputs: DprCostInputs) => {
  if (inputs.terrainType === "custom") {
    return positiveOrZero(inputs.customTdhMeters);
  }

  return dprOmDefaultAssumptions.terrainTdhMeters[inputs.terrainType];
};

const getAllocatedCapex = (breakdown: DprCostBreakdown) =>
  Object.entries(breakdown).reduce(
    (allocation, [key, value]) => {
      const shares =
        dprCapexRepairAllocation[key as keyof typeof dprCapexRepairAllocation];
      if (!shares) {
        return allocation;
      }

      return {
        civil: allocation.civil + value * shares.civilShare,
        em: allocation.em + value * shares.emShare,
      };
    },
    { civil: 0, em: 0 },
  );

export function calculateDprOmYear1(
  inputs: DprCostInputs,
  capexResult: DprCostResult,
): DprOmResult {
  const stpCapacityMld = positiveOrZero(inputs.stpCapacityMld);
  const drainFlowMld = positiveOrZero(inputs.drainFlowMld);
  const technologyConfig =
    dprOmTechnologyConfig[inputs.stpTechnologyKey] ??
    dprOmTechnologyConfig.TF;
  const electricityTariffRupeesPerKwh = positiveOrZero(
    inputs.electricityTariffRupeesPerKwh,
  );
  const pumpEfficiency = positiveOrZero(inputs.pumpEfficiency);
  const tdhMeters = getTdhMeters(inputs);

  const stpElectricity =
    technologyConfig.energyKwhPerMldDay *
    stpCapacityMld *
    365 *
    electricityTariffRupeesPerKwh;

  const mpsDailyKwh =
    !capexResult.conveyance.isGravityFeasible && pumpEfficiency > 0
      ? ((drainFlowMld * 1000) * tdhMeters) / (367 * pumpEfficiency)
      : 0;
  const mpsElectricity = mpsDailyKwh * 365 * electricityTariffRupeesPerKwh;
  const pumpPowerKw =
    !capexResult.conveyance.isGravityFeasible &&
    dprOmDefaultAssumptions.pumpingHoursPerDay > 0
      ? mpsDailyKwh / dprOmDefaultAssumptions.pumpingHoursPerDay
      : 0;

  const stpStaffNorm = getStpStaffNorm(stpCapacityMld);
  const mpsStaffNorm = getMpsStaffNorm(pumpPowerKw);
  const stpStaffRows = getAdjustedStpStaffRows(
    stpStaffNorm.staff,
    technologyConfig,
  );
  const stpManpower =
    calculateStaffCost(stpStaffRows) * technologyConfig.staffingMultiplier;
  const mpsManpower = capexResult.conveyance.isGravityFeasible
    ? 0
    : calculateStaffCost(mpsStaffNorm.staff);
  const manpower = stpManpower + mpsManpower;

  const annualFlowLiters = stpCapacityMld * 1_000_000 * 365;
  const chlorineCost =
    ((annualFlowLiters * positiveOrZero(inputs.chlorineDoseMgPerL)) /
      1_000_000) *
    positiveOrZero(inputs.chlorineRateRupeesPerKg);
  const sludgeKgPerDay = technologyConfig.sludgeKgPerMldDay * stpCapacityMld;
  const polymerCost =
    sludgeKgPerDay *
    positiveOrZero(inputs.polymerDoseKgPerKgSludge) *
    365 *
    positiveOrZero(inputs.polymerRateRupeesPerKg);
  const otherChemicals = positiveOrZero(inputs.otherChemicalsRupeesPerYear);
  const chemicals =
    (chlorineCost + polymerCost) * technologyConfig.chemicalMultiplier +
    otherChemicals;

  const hasDgSet = inputs.selectedMiscWorkIds.includes("dgSet");
  const stpLoadKw = (technologyConfig.energyKwhPerMldDay * stpCapacityMld) / 24;
  const dgCapacityKw = hasDgSet
    ? (stpLoadKw + pumpPowerKw) * dprOmDefaultAssumptions.dgCapacitySafetyFactor
    : 0;
  const annualDgGeneratedKwh =
    dgCapacityKw * positiveOrZero(inputs.dgBackupHoursPerDay) * 365;
  const annualDieselLiters =
    annualDgGeneratedKwh *
    positiveOrZero(inputs.dieselConsumptionLitersPerKwh);
  const annualMobileOilLiters =
    annualDieselLiters *
    positiveOrZero(inputs.mobileOilPercentOfDiesel);
  const dgFuel = hasDgSet
    ? annualDieselLiters * positiveOrZero(inputs.dieselRateRupeesPerLiter) +
      annualMobileOilLiters * positiveOrZero(inputs.mobileOilRateRupeesPerLiter)
    : 0;

  const allocatedCapex = getAllocatedCapex(capexResult.capexBreakdown);
  const repairsCivil =
    allocatedCapex.civil * dprOmDefaultAssumptions.civilRepairPercent;
  const repairsEM =
    allocatedCapex.em * dprOmDefaultAssumptions.emRepairPercent;

  const ocemsMaintenance =
    capexResult.totalDrainPoints *
    positiveOrZero(inputs.annualOcemsMaintenanceRateRupeesPerPoint);

  const sludgeDisposal =
    technologyConfig.sludgeKgPerMldDay *
    stpCapacityMld *
    365 *
    positiveOrZero(inputs.sludgeDisposalRateRupeesPerKg);

  const miscOM = manpower * positiveOrZero(inputs.miscOmPercentOfManpower);

  const breakdown = {
    manpower,
    stpElectricity,
    mpsElectricity,
    chemicals,
    dgFuel,
    repairsCivil,
    repairsEM,
    ocemsMaintenance,
    sludgeDisposal,
    miscOM,
  };

  return {
    totalYear1OmRupees: Object.values(breakdown).reduce(
      (sum, amount) => sum + amount,
      0,
    ),
    breakdown,
    assumptions: {
      tdhMeters,
      electricityTariffRupeesPerKwh,
      pumpEfficiency,
      stpStaffCount:
        calculateStaffCount(stpStaffRows) * technologyConfig.staffingMultiplier,
      mpsStaffCount: capexResult.conveyance.isGravityFeasible
        ? 0
        : calculateStaffCount(mpsStaffNorm.staff),
      pumpPowerKw,
      energyKwhPerMldDay: technologyConfig.energyKwhPerMldDay,
      sludgeKgPerMldDay: technologyConfig.sludgeKgPerMldDay,
      chlorineCostRupees: chlorineCost * technologyConfig.chemicalMultiplier,
      polymerCostRupees: polymerCost * technologyConfig.chemicalMultiplier,
      otherChemicalsRupees: otherChemicals,
      dgCapacityKw,
      annualDieselLiters,
      annualMobileOilLiters,
    },
  };
}
