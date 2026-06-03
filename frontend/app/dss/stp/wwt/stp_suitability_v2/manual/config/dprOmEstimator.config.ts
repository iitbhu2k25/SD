import { dprStpTechnologyRates } from "./dprCostEstimator.config";

export type DprOmTechnologyKey = (typeof dprStpTechnologyRates)[number]["key"];

export const dprOmTechnologyConfig: Record<
  DprOmTechnologyKey,
  {
    energyKwhPerMldDay: number;
    sludgeKgPerMldDay: number;
    staffingMultiplier: number;
    stpOperatorMultiplier?: number;
    additionalStpOperators?: number;
    chemicalMultiplier: number;
  }
> = {
  TF: { energyKwhPerMldDay: 130, sludgeKgPerMldDay: 90, staffingMultiplier: 1, chemicalMultiplier: 1 },
  ASP: { energyKwhPerMldDay: 220, sludgeKgPerMldDay: 110, staffingMultiplier: 1, chemicalMultiplier: 1 },
  EA: { energyKwhPerMldDay: 260, sludgeKgPerMldDay: 115, staffingMultiplier: 1, chemicalMultiplier: 1 },
  SBR: { energyKwhPerMldDay: 180, sludgeKgPerMldDay: 100, staffingMultiplier: 1, chemicalMultiplier: 1 },
  BIOFOR: { energyKwhPerMldDay: 170, sludgeKgPerMldDay: 95, staffingMultiplier: 1, chemicalMultiplier: 1 },
  MBR: { energyKwhPerMldDay: 420, sludgeKgPerMldDay: 120, staffingMultiplier: 1, additionalStpOperators: 2, chemicalMultiplier: 1.1 },
  CW: { energyKwhPerMldDay: 25, sludgeKgPerMldDay: 45, staffingMultiplier: 1, stpOperatorMultiplier: 0.5, chemicalMultiplier: 0.4 },
  WSP: { energyKwhPerMldDay: 15, sludgeKgPerMldDay: 40, staffingMultiplier: 1, stpOperatorMultiplier: 0.5, chemicalMultiplier: 0.3 },
  ABR: { energyKwhPerMldDay: 45, sludgeKgPerMldDay: 60, staffingMultiplier: 1, chemicalMultiplier: 0.5 },
  UASB_CW: { energyKwhPerMldDay: 60, sludgeKgPerMldDay: 65, staffingMultiplier: 1, chemicalMultiplier: 0.5 },
  MBBR: { energyKwhPerMldDay: 240, sludgeKgPerMldDay: 105, staffingMultiplier: 1, additionalStpOperators: 2, chemicalMultiplier: 1 },
  PACK: { energyKwhPerMldDay: 280, sludgeKgPerMldDay: 100, staffingMultiplier: 1, chemicalMultiplier: 1 },
};

export const dprOmDefaultAssumptions = {
  electricityTariffRupeesPerKwh: 8,
  pumpEfficiency: 0.75,
  pumpingHoursPerDay: 16,
  terrainTdhMeters: {
    flat: 25,
    undulating: 50,
  },
  chlorineDoseMgPerL: 5,
  chlorineRateRupeesPerKg: 70,
  polymerDoseKgPerKgSludge: 0.008,
  polymerRateRupeesPerKg: 200,
  otherChemicalsRupeesPerYear: 0,
  dieselRateRupeesPerLiter: 95,
  dgBackupHoursPerDay: 0,
  dgCapacitySafetyFactor: 1.1,
  dieselConsumptionLitersPerKwh: 0.28,
  mobileOilPercentOfDiesel: 0.05,
  mobileOilRateRupeesPerLiter: 200,
  sludgeDisposalRateRupeesPerKg: 2,
  annualOcemsMaintenanceRateRupeesPerPoint: 150000,
  miscOmPercentOfManpower: 0.02,
  civilRepairPercent: 0.015,
  emRepairPercent: 0.03,
  projectionYears: 15,
};

export const dprOmSalaryTable = {
  executiveEngineer: {
    label: "Executive Engineer / PM",
    annualCostRupees: 1680000,
  },
  assistantEngineer: {
    label: "Assistant Engineer (AE)",
    annualCostRupees: 1200000,
  },
  juniorEngineer: {
    label: "Junior Engineer (JE)",
    annualCostRupees: 780000,
  },
  chemist: {
    label: "Chemist / Lab Chemist",
    annualCostRupees: 780000,
  },
  fitterElectrician1st: {
    label: "Fitter / Electrician 1st Class",
    annualCostRupees: 660000,
  },
  assistantChemist: {
    label: "Assistant Chemist / Lab Assistant",
    annualCostRupees: 576000,
  },
  operatorElectrician2nd: {
    label: "Operator / Electrician 2nd Class",
    annualCostRupees: 576000,
  },
  pumpMechanicOperator: {
    label: "Pump Mechanic / Pump Operator",
    annualCostRupees: 504000,
  },
  accountantLdc: {
    label: "Accountant / LDC",
    annualCostRupees: 480000,
  },
  labourSweeperWatchman: {
    label: "Labour / Beldar / Sweeper / Watchman",
    annualCostRupees: 420000,
  },
  gardenerDriverPeon: {
    label: "Gardener / Driver / Peon",
    annualCostRupees: 396000,
  },
} as const;

export type DprOmSalaryKey = keyof typeof dprOmSalaryTable;

export const dprStpStaffNorms = [
  {
    maxMld: 10,
    staff: [
      { role: "Asst. Engineer (E&M)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Asst. Engineer (Civil)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Junior Engineer (E&M)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Chemist (Lab)", salaryKey: "chemist", count: 1 },
      { role: "Operators (x3 shifts)", salaryKey: "operatorElectrician2nd", count: 4 },
      { role: "Labour / Beldars", salaryKey: "labourSweeperWatchman", count: 2 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 2 },
      { role: "Gardener / Driver / Cleaner", salaryKey: "gardenerDriverPeon", count: 1 },
    ],
  },
  {
    maxMld: 20,
    staff: [
      { role: "Asst. Engineer (E&M)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Asst. Engineer (Civil)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Junior Engineer (E&M)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Fitter / Mech. 1st Class", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Electrician 1st Class", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "LDC / Peon", salaryKey: "accountantLdc", count: 1 },
      { role: "Chemist (Lab)", salaryKey: "chemist", count: 1 },
      { role: "Operators (x3 shifts)", salaryKey: "operatorElectrician2nd", count: 4 },
      { role: "Labour / Beldars", salaryKey: "labourSweeperWatchman", count: 2 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 2 },
      { role: "Gardener / Driver / Cleaner", salaryKey: "gardenerDriverPeon", count: 1 },
    ],
  },
  {
    maxMld: 40,
    staff: [
      { role: "Executive Engineer / Project Manager", salaryKey: "executiveEngineer", count: 1 },
      { role: "Asst. Engineer (E&M)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Asst. Engineer (Civil)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Junior Engineer (E&M)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Junior Engineer (Civil)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Fitter / Mech. 1st Class", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Electrician 1st Class", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Fitter / Mech. 2nd Class", salaryKey: "operatorElectrician2nd", count: 1 },
      { role: "Electrician 2nd Class", salaryKey: "operatorElectrician2nd", count: 1 },
      { role: "Jr. Accountant / UDC", salaryKey: "accountantLdc", count: 1 },
      { role: "LDC / Peon", salaryKey: "accountantLdc", count: 1 },
      { role: "Chemist (Lab)", salaryKey: "chemist", count: 1 },
      { role: "Asst. Chemist / Lab Asst.", salaryKey: "assistantChemist", count: 1 },
      { role: "Lab Attendant", salaryKey: "labourSweeperWatchman", count: 1 },
      { role: "Operators (x3 shifts)", salaryKey: "operatorElectrician2nd", count: 6 },
      { role: "Labour / Beldars", salaryKey: "labourSweeperWatchman", count: 4 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 4 },
      { role: "Gardener / Driver / Cleaner", salaryKey: "gardenerDriverPeon", count: 2 },
    ],
  },
  {
    maxMld: 80,
    staff: [
      { role: "Executive Engineer / Project Manager", salaryKey: "executiveEngineer", count: 1 },
      { role: "Asst. Engineer (E&M)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Asst. Engineer (Civil)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Junior Engineer (E&M)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Junior Engineer (Civil)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Fitter / Mech. 1st Class", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Electrician 1st Class", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Fitter / Mech. 2nd Class", salaryKey: "operatorElectrician2nd", count: 2 },
      { role: "Electrician 2nd Class", salaryKey: "operatorElectrician2nd", count: 2 },
      { role: "Jr. Accountant / UDC", salaryKey: "accountantLdc", count: 1 },
      { role: "LDC / Peon", salaryKey: "accountantLdc", count: 1 },
      { role: "Chemist (Lab)", salaryKey: "chemist", count: 1 },
      { role: "Asst. Chemist / Lab Asst.", salaryKey: "assistantChemist", count: 1 },
      { role: "Lab Attendant", salaryKey: "labourSweeperWatchman", count: 1 },
      { role: "Operators (x3 shifts)", salaryKey: "operatorElectrician2nd", count: 6 },
      { role: "Labour / Beldars", salaryKey: "labourSweeperWatchman", count: 4 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 4 },
      { role: "Gardener / Driver / Cleaner", salaryKey: "gardenerDriverPeon", count: 2 },
    ],
  },
  {
    maxMld: null,
    staff: [
      { role: "Executive Engineer / Project Manager", salaryKey: "executiveEngineer", count: 1 },
      { role: "Asst. Engineer (E&M)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Asst. Engineer (Civil)", salaryKey: "assistantEngineer", count: 1 },
      { role: "Junior Engineer (E&M)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Junior Engineer (Civil)", salaryKey: "juniorEngineer", count: 1 },
      { role: "Fitter / Mech. 1st Class", salaryKey: "fitterElectrician1st", count: 2 },
      { role: "Electrician 1st Class", salaryKey: "fitterElectrician1st", count: 2 },
      { role: "Fitter / Mech. 2nd Class", salaryKey: "operatorElectrician2nd", count: 2 },
      { role: "Electrician 2nd Class", salaryKey: "operatorElectrician2nd", count: 2 },
      { role: "Jr. Accountant / UDC", salaryKey: "accountantLdc", count: 1 },
      { role: "LDC / Peon", salaryKey: "accountantLdc", count: 2 },
      { role: "Chemist (Lab)", salaryKey: "chemist", count: 1 },
      { role: "Asst. Chemist / Lab Asst.", salaryKey: "assistantChemist", count: 2 },
      { role: "Lab Attendant", salaryKey: "labourSweeperWatchman", count: 1 },
      { role: "Operators (x3 shifts)", salaryKey: "operatorElectrician2nd", count: 9 },
      { role: "Labour / Beldars", salaryKey: "labourSweeperWatchman", count: 6 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 6 },
      { role: "Gardener / Driver / Cleaner", salaryKey: "gardenerDriverPeon", count: 3 },
    ],
  },
] as const;

export const dprMpsStaffNorms = [
  {
    maxKw: 112,
    staff: [
      { role: "Junior Engineer", salaryKey: "juniorEngineer", count: 0.5 },
      { role: "Pump Mechanics", salaryKey: "pumpMechanicOperator", count: 1 },
      { role: "Electricians", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Pump Operators (x3 shifts)", salaryKey: "pumpMechanicOperator", count: 3 },
      { role: "Beldars", salaryKey: "labourSweeperWatchman", count: 2 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 1 },
    ],
  },
  {
    maxKw: 224,
    staff: [
      { role: "Junior Engineer", salaryKey: "juniorEngineer", count: 0.5 },
      { role: "Pump Mechanics", salaryKey: "pumpMechanicOperator", count: 1 },
      { role: "Electricians", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Pump Operators (x3 shifts)", salaryKey: "pumpMechanicOperator", count: 3 },
      { role: "Beldars", salaryKey: "labourSweeperWatchman", count: 2 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 1 },
    ],
  },
  {
    maxKw: 373,
    staff: [
      { role: "Junior Engineer", salaryKey: "juniorEngineer", count: 1 },
      { role: "Pump Mechanics", salaryKey: "pumpMechanicOperator", count: 1.5 },
      { role: "Electricians", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Pump Operators (x3 shifts)", salaryKey: "pumpMechanicOperator", count: 3 },
      { role: "Beldars", salaryKey: "labourSweeperWatchman", count: 3 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 1 },
    ],
  },
  {
    maxKw: null,
    staff: [
      { role: "Junior Engineer", salaryKey: "juniorEngineer", count: 1 },
      { role: "Pump Mechanics", salaryKey: "pumpMechanicOperator", count: 1.5 },
      { role: "Electricians", salaryKey: "fitterElectrician1st", count: 1 },
      { role: "Pump Operators (x3 shifts)", salaryKey: "pumpMechanicOperator", count: 3 },
      { role: "Beldars", salaryKey: "labourSweeperWatchman", count: 6 },
      { role: "Sweepers", salaryKey: "labourSweeperWatchman", count: 1 },
    ],
  },
] as const;

export const dprCapexRepairAllocation = {
  idWorks: { civilShare: 0.7, emShare: 0.3 },
  gravity: { civilShare: 1, emShare: 0 },
  mps: { civilShare: 0.4, emShare: 0.6 },
  risingMain: { civilShare: 1, emShare: 0 },
  stp: { civilShare: 0.5, emShare: 0.5 },
  land: { civilShare: 0, emShare: 0 },
  effluent: { civilShare: 1, emShare: 0 },
  ocems: { civilShare: 0, emShare: 1 },
  miscellaneous: { civilShare: 0.5, emShare: 0.5 },
} as const;

export const dprOmEscalationRates = {
  manpower: 0.05,
  stpElectricity: 0,
  mpsElectricity: 0,
  chemicals: 0.02,
  dgFuel: 0,
  repairsCivil: 0,
  repairsEM: 0,
  ocemsMaintenance: 0.05,
  sludgeDisposal: 0.02,
  miscOM: 0.02,
} as const;
