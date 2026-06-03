export const RUPEES_PER_CRORE = 10000000;

export const dprTappingOptions = [
  {
    id: "civil",
    label: "I&D Civil Works",
    rateRupees: 3500000,
  },
  {
    id: "em",
    label: "I&D E&M Works",
    rateRupees: 1500000,
  },
  {
    id: "composite",
    label: "Composite Tapping Structure",
    rateRupees: 4000000,
  },
] as const;

export const dprCommercialDiametersMm = [
  200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200,
  1400, 1600, 1800, 2000,
];

export const dprGravityPipeRates = [
  { minMm: 300, maxMm: 400, label: "300-400 mm", ratePerMeterRupees: 4000 },
  { minMm: 450, maxMm: 600, label: "450-600 mm", ratePerMeterRupees: 7000 },
  { minMm: 700, maxMm: 800, label: "700-800 mm", ratePerMeterRupees: 11000 },
  { minMm: 900, maxMm: 1000, label: "900-1000 mm", ratePerMeterRupees: 17000 },
  { minMm: 1100, maxMm: 1200, label: "1100-1200 mm", ratePerMeterRupees: 23000 },
  { minMm: 1201, maxMm: null, label: ">1200 mm", ratePerMeterRupees: 28000 },
] as const;

export const dprRisingMainRates = [
  { minMm: 200, maxMm: 300, label: "200-300 mm", ratePerMeterRupees: 3000 },
  { minMm: 350, maxMm: 500, label: "350-500 mm", ratePerMeterRupees: 5000 },
  { minMm: 600, maxMm: 700, label: "600-700 mm", ratePerMeterRupees: 9000 },
  { minMm: 800, maxMm: 900, label: "800-900 mm", ratePerMeterRupees: 14000 },
  { minMm: 1000, maxMm: 1200, label: "1000-1200 mm", ratePerMeterRupees: 20000 },
] as const;
                                                                                                    
export const dprMpsCostRanges = [
  { minMld: 0, maxMld: 5, label: "Up to 5 MLD", costRupees: 1.4 * RUPEES_PER_CRORE },
  { minMld: 5, maxMld: 15, label: "5-15 MLD", costRupees: 2.1 * RUPEES_PER_CRORE },
  { minMld: 15, maxMld: 40, label: "15-40 MLD", costRupees: 3.5 * RUPEES_PER_CRORE },
  { minMld: 40, maxMld: 80, label: "40-80 MLD", costRupees: 7 * RUPEES_PER_CRORE },
  { minMld: 80, maxMld: null, label: ">80 MLD", costRupees: 12 * RUPEES_PER_CRORE },
] as const;

export const dprStpTechnologyRates = [
  { key: "TF", label: "TF", displayName: "Trickling Filter", rateCrPerMld: 1.5, landFactorHaPerMld: 0.25 },
  { key: "ASP", label: "ASP", displayName: "Activated Sludge Process", rateCrPerMld: 1.8, landFactorHaPerMld: 0.15 },
  { key: "EA", label: "EA", displayName: "Extended Aeration", rateCrPerMld: 2, landFactorHaPerMld: 0.15 },
  { key: "SBR", label: "SBR", displayName: "Sequential Batch Reactor", rateCrPerMld: 2.2, landFactorHaPerMld: 0.1 },
  { key: "BIOFOR", label: "BIOFOR", displayName: "BIOFOR-F", rateCrPerMld: 2.3, landFactorHaPerMld: 0.08 },
  { key: "MBR", label: "MBR", displayName: "Membrane Bioreactor", rateCrPerMld: 3.5, landFactorHaPerMld: 0.05 },
  { key: "CW", label: "CW", displayName: "Constructed Wetland", rateCrPerMld: 1, landFactorHaPerMld: 0.3 },
  { key: "WSP", label: "WSP", displayName: "Waste Stabilization Pond", rateCrPerMld: 0.8, landFactorHaPerMld: 0.4 },
  { key: "ABR", label: "ABR", displayName: "Anaerobic Baffled Reactor", rateCrPerMld: 1.2, landFactorHaPerMld: 0.08 },
  {
    key: "UASB_CW",
    label: "UASB + CW",
    displayName: "UASB + Constructed Wetland",
    rateCrPerMld: 1.5,
    landFactorHaPerMld: 0.15,
  },
  { key: "MBBR", label: "Compact MBBR", displayName: "Compact MBBR", rateCrPerMld: 1.8, landFactorHaPerMld: 0.06 },
  { key: "PACK", label: "PACK", displayName: "Packaged Modular STP", rateCrPerMld: 2, landFactorHaPerMld: 0.05 },
] as const;

export const dprEffluentPipeRates = [
  { id: "600_900", label: "600-900 mm", ratePerMeterRupees: 6000 },
  { id: "1000_1400", label: "1000-1400 mm", ratePerMeterRupees: 12000 },
  { id: "above_1400", label: ">1400 mm", ratePerMeterRupees: 22000 },
] as const;                                                                                                                                                                                                                                                                         

export const dprMiscWorkOptions = [
  { id: "boundaryWall", label: "Boundary Wall", costRupees: 1500000 },
  { id: "adminBlock", label: "Admin Block + Laboratory", costRupees: 2000000 },
  { id: "staffQuarters", label: "Staff Quarters", costRupees: 2500000 },
  { id: "siteDevelopment", label: "Site Development", costRupees: 2000000 },
  { id: "dgSet", label: "DG Set", costRupees: 800000 },
  { id: "htPanel", label: "HT Panel + Transformer + Cables", costRupees: 1500000 },
  { id: "mepBuilding", label: "MEP Building", costRupees: 1000000 },
] as const;

export const dprCostConstants = {
  manningN: 0.013,
  minimumGravitySlope: 1 / 500,
  gravityContingencyFactor: 1.1,
  risingMainContingencyFactor: 1.1,
  pumpingHoursPerDay: 16,
  risingMainVelocityMps: 1.2,
  ocemsRatePerPointRupees: 800000,
};
