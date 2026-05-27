"use client";

import { Calculator, CheckCircle2, IndianRupee, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import {
  dprCostConstants,
  dprEffluentPipeRates,
  dprMiscWorkOptions,
  dprStpTechnologyRates,
  dprTappingOptions,
} from "../config/dprCostEstimator.config";
import { dprOmDefaultAssumptions } from "../config/dprOmEstimator.config";
import { calculateDprOmProjection } from "../utils/dprEscalationEngine";
import {
  calculateDprCost,
  formatCrore,
  formatRupees,
  resolveDprTechnologyKey,
  type DprCostInputs,
  type DprNumericInput,
  type EffluentPipeRateId,
  type ElevationInputMode,
  type LandOwnershipType,
  type MiscWorkId,
  type StpTechnologyKey,
  type TappingOptionId,
  type TerrainType,
} from "../utils/dprCostEstimator";
import { calculateDprLifecycleTotals } from "../utils/dprLifecycleEstimator";
import { calculateDprOmYear1 } from "../utils/dprOmEstimator";

interface DprCostEstimatorModalProps {
  isOpen: boolean;
  initialQMLD: number;
  initialTechnologyKey?: string;
  initialTechnologyName?: string;
  onClose: () => void;
}

const defaultTappingPoints: Record<TappingOptionId, DprNumericInput> = {
  civil: null,
  em: null,
  composite: null,
};

const createDefaultTappingRates = (): Record<TappingOptionId, DprNumericInput> =>
  Object.fromEntries(
    dprTappingOptions.map((option) => [option.id, option.rateRupees]),
  ) as Record<TappingOptionId, DprNumericInput>;

const createDefaultEffluentRates = (): Record<EffluentPipeRateId, DprNumericInput> =>
  Object.fromEntries(
    dprEffluentPipeRates.map((rate) => [rate.id, rate.ratePerMeterRupees]),
  ) as Record<EffluentPipeRateId, DprNumericInput>;

const createDefaultMiscCosts = (): Record<MiscWorkId, DprNumericInput> =>
  Object.fromEntries(
    dprMiscWorkOptions.map((option) => [option.id, option.costRupees]),
  ) as Record<MiscWorkId, DprNumericInput>;

const dprSteps = [
  { id: "global", label: "Flow & STP" },
  { id: "tapping", label: "I&D Works" },
  { id: "ocems", label: "OCEMS" },
  { id: "land", label: "Land" },
  { id: "conveyance", label: "Conveyance" },
  { id: "effluent", label: "Effluent" },
  { id: "misc", label: "Miscellaneous" },
  { id: "om", label: "Annual O&M" },
  { id: "projection", label: "15-Year Projection" },
  { id: "review", label: "Review" },
] as const;

type DprStepId = (typeof dprSteps)[number]["id"];

const createInitialInputs = (
  initialQMLD: number,
  initialTechnologyKey?: string,
  initialTechnologyName?: string,
): DprCostInputs => ({
  stpCapacityMld: Number.isFinite(initialQMLD) && initialQMLD > 0 ? initialQMLD : null,
  drainFlowMld: null,
  tappingPoints: defaultTappingPoints,
  tappingRatesRupees: createDefaultTappingRates(),
  elevationMode: "direct",
  deltaE: null,
  tappingElevation: null,
  stpElevation: null,
  pathLength: null,
  stpTechnologyKey: resolveDprTechnologyKey(initialTechnologyKey ?? initialTechnologyName),
  landOwnership: "government",
  landUnitCostRupeesPerHa: null,
  effluentLength: null,
  effluentPipeRateId: dprEffluentPipeRates[0].id,
  effluentRatesRupees: createDefaultEffluentRates(),
  ocemsRatePerPointRupees: dprCostConstants.ocemsRatePerPointRupees,
  selectedMiscWorkIds: [],
  miscWorkCostsRupees: createDefaultMiscCosts(),
  terrainType: "flat",
  customTdhMeters: null,
  electricityTariffRupeesPerKwh: dprOmDefaultAssumptions.electricityTariffRupeesPerKwh,
  pumpEfficiency: dprOmDefaultAssumptions.pumpEfficiency,
  chlorineDoseMgPerL: dprOmDefaultAssumptions.chlorineDoseMgPerL,
  chlorineRateRupeesPerKg: dprOmDefaultAssumptions.chlorineRateRupeesPerKg,
  polymerDoseKgPerKgSludge: dprOmDefaultAssumptions.polymerDoseKgPerKgSludge,
  polymerRateRupeesPerKg: dprOmDefaultAssumptions.polymerRateRupeesPerKg,
  otherChemicalsRupeesPerYear: dprOmDefaultAssumptions.otherChemicalsRupeesPerYear,
  dieselRateRupeesPerLiter: dprOmDefaultAssumptions.dieselRateRupeesPerLiter,
  dgBackupHoursPerDay: dprOmDefaultAssumptions.dgBackupHoursPerDay,
  dieselConsumptionLitersPerKwh:
    dprOmDefaultAssumptions.dieselConsumptionLitersPerKwh,
  mobileOilPercentOfDiesel: dprOmDefaultAssumptions.mobileOilPercentOfDiesel,
  mobileOilRateRupeesPerLiter:
    dprOmDefaultAssumptions.mobileOilRateRupeesPerLiter,
  sludgeDisposalRateRupeesPerKg: dprOmDefaultAssumptions.sludgeDisposalRateRupeesPerKg,
  annualOcemsMaintenanceRateRupeesPerPoint:
    dprOmDefaultAssumptions.annualOcemsMaintenanceRateRupeesPerPoint,
  miscOmPercentOfManpower: dprOmDefaultAssumptions.miscOmPercentOfManpower,
});

function NumberInput({
  label,
  value,
  min,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: DprNumericInput;
  min?: number;
  step?: number;
  unit?: string;
  onChange: (value: DprNumericInput) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm">
        {label}:
      </span>
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={value ?? ""}
          onChange={(event) => {
            const rawValue = event.target.value;
            if (rawValue === "" || rawValue === "0") {
              onChange(null);
              return;
            }

            const nextValue = Number(rawValue);
            onChange(Number.isFinite(nextValue) ? nextValue : null);
          }}
          className="w-full rounded-lg border border-stone-300 bg-[#fdfcfa] px-2.5 py-2 pr-14 text-xs text-slate-700 outline-none transition [appearance:textfield] hover:border-stone-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:px-3 sm:py-2.5 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function CostRow({
  label,
  value,
  isActive = false,
}: {
  label: string;
  value: number;
  isActive?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b py-2 last:border-b-0 ${
        isActive
          ? "rounded-md border-cyan-100 bg-cyan-50 px-2"
          : "border-stone-100"
      }`}
    >
      <span className={`text-xs ${isActive ? "font-semibold text-cyan-800" : "text-slate-500"}`}>
        {label}
      </span>
      <span
        className={`shrink-0 font-mono text-xs font-semibold ${
          isActive ? "text-cyan-900" : "text-slate-800"
        }`}
      >
        {formatCrore(value)}
      </span>
    </div>
  );
}

export default function DprCostEstimatorModal({
  isOpen,
  initialQMLD,
  initialTechnologyKey,
  initialTechnologyName,
  onClose,
}: DprCostEstimatorModalProps) {
  const [inputs, setInputs] = useState<DprCostInputs>(() =>
    createInitialInputs(initialQMLD, initialTechnologyKey, initialTechnologyName),
  );
  const [mounted, setMounted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setInputs(createInitialInputs(initialQMLD, initialTechnologyKey, initialTechnologyName));
      setCurrentStepIndex(0);
    }
  }, [initialQMLD, initialTechnologyKey, initialTechnologyName, isOpen]);

  const result = useMemo(() => calculateDprCost(inputs), [inputs]);
  const omResult = useMemo(() => calculateDprOmYear1(inputs, result), [inputs, result]);
  const omProjection = useMemo(() => calculateDprOmProjection(omResult), [omResult]);
  const lifecycleResult = useMemo(
    () =>
      calculateDprLifecycleTotals({
        capexResult: result,
        omYear1: omResult,
        projection: omProjection,
      }),
    [omProjection, omResult, result],
  );
  const stpTechnologyItems = useMemo(
    () =>
      dprStpTechnologyRates.map((technology) => ({
        id: technology.key,
        name: `${technology.label} - ₹ ${technology.rateCrPerMld.toFixed(2)} Cr/MLD`,
      })),
    [],
  );
  const effluentPipeItems = useMemo(
    () =>
      dprEffluentPipeRates.map((rate) => ({
        id: rate.id,
        name: `${rate.label} - ${formatRupees(rate.ratePerMeterRupees)}/m`,
      })),
    [],
  );

  if (!mounted || !isOpen) {
    return null;
  }

  const currentStep = dprSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === dprSteps.length - 1;

  const updateInput = <Key extends keyof DprCostInputs>(
    key: Key,
    value: DprCostInputs[Key],
  ) => {
    setInputs((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateTappingPoint = (id: TappingOptionId, value: DprNumericInput) => {
    const nextValue =
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : null;
    setInputs((current) => ({
      ...current,
      tappingPoints: {
        ...current.tappingPoints,
        [id]: nextValue,
      },
    }));
  };

  const updateTappingRate = (id: TappingOptionId, value: DprNumericInput) => {
    setInputs((current) => ({
      ...current,
      tappingRatesRupees: {
        ...current.tappingRatesRupees,
        [id]: value,
      },
    }));
  };

  const updateEffluentRate = (id: EffluentPipeRateId, value: DprNumericInput) => {
    setInputs((current) => ({
      ...current,
      effluentRatesRupees: {
        ...current.effluentRatesRupees,
        [id]: value,
      },
    }));
  };

  const updateMiscWorkCost = (id: MiscWorkId, value: DprNumericInput) => {
    setInputs((current) => ({
      ...current,
      miscWorkCostsRupees: {
        ...current.miscWorkCostsRupees,
        [id]: value,
      },
    }));
  };

  const toggleMiscWork = (id: MiscWorkId) => {
    setInputs((current) => {
      const selected = new Set(current.selectedMiscWorkIds);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }

      return {
        ...current,
        selectedMiscWorkIds: Array.from(selected),
      };
    });
  };

  const renderStepContent = (stepId: DprStepId) => {
    if (stepId === "global") {
      return (
        <div className="space-y-4">
          <SectionCard title="Global Flow">
            <div className="grid gap-3 lg:grid-cols-3">
              <NumberInput
                label="STP Capacity"
                value={inputs.stpCapacityMld}
                min={0}
                step={0.1}
                unit="MLD"
                onChange={(value) => updateInput("stpCapacityMld", value)}
              />
              <NumberInput
                label="Total Drain Flow"
                value={inputs.drainFlowMld}
                min={0}
                step={0.1}
                unit="MLD"
                onChange={(value) => updateInput("drainFlowMld", value)}
              />
              <SingleSelect
                items={stpTechnologyItems}
                selectedValue={inputs.stpTechnologyKey}
                onValueChange={(value) => {
                  if (value !== null) {
                    updateInput("stpTechnologyKey", value as StpTechnologyKey);
                  }
                }}
                label="STP Technology"
                placeholder="Select STP technology"
              />
            </div>
          </SectionCard>

          <SectionCard title="STP Cost">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
              Selected technology:{" "}
              <span className="font-semibold text-slate-800">
                {result.stp.technologyLabel} ({result.stp.technologyName})
              </span>
              <span className="mx-2 text-stone-300">|</span>
              Rate:{" "}
              <span className="font-semibold text-slate-800">
                ₹ {result.stp.rateCrPerMld.toFixed(2)} Cr/MLD
              </span>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (stepId === "tapping") {
      return (
        <SectionCard title="Drain Tapping / I&D Works">
          <div className="grid gap-3 md:grid-cols-3">
            {dprTappingOptions.map((option) => {
              const selected = (inputs.tappingPoints[option.id] ?? 0) > 0;
              return (
                <div
                  key={option.id}
                  className={`rounded-lg border p-3 transition ${
                    selected ? "border-cyan-200 bg-cyan-50" : "border-stone-200 bg-stone-50"
                  }`}
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        updateTappingPoint(option.id, event.target.checked ? 1 : 0)
                      }
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-cyan-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-700">
                        {option.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatRupees(option.rateRupees)} / point
                      </span>
                    </span>
                  </label>
                  <div className="mt-3 space-y-3">
                    <NumberInput
                      label="Rate"
                      value={inputs.tappingRatesRupees[option.id]}
                      min={0}
                      step={100000}
                      unit="₹/point"
                      onChange={(value) => updateTappingRate(option.id, value)}
                    />
                    {selected && (
                      <NumberInput
                        label="Tapping Points"
                        value={inputs.tappingPoints[option.id]}
                        min={0}
                        step={1}
                        onChange={(value) => updateTappingPoint(option.id, value)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-slate-600">
            Total drain points for OCEMS:{" "}
            <span className="font-semibold text-slate-800">{result.totalDrainPoints}</span>
          </div>
        </SectionCard>
      );
    }

    if (stepId === "land") {
      return (
        <SectionCard title="Land Cost">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-xs font-semibold">
                {(["government", "private"] as LandOwnershipType[]).map((ownership) => (
                  <button
                    key={ownership}
                    type="button"
                    onClick={() => updateInput("landOwnership", ownership)}
                    className={`rounded-md px-3 py-2 capitalize transition ${
                      inputs.landOwnership === ownership
                        ? "bg-cyan-600 text-white"
                        : "text-slate-500 hover:bg-stone-50"
                    }`}
                  >
                    {ownership} Land
                  </button>
                ))}
              </div>

              {inputs.landOwnership === "private" && (
                <NumberInput
                  label="Land Unit Cost"
                  value={inputs.landUnitCostRupeesPerHa}
                  min={0}
                  step={100000}
                  unit="₹/ha"
                  onChange={(value) => updateInput("landUnitCostRupeesPerHa", value)}
                />
              )}
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-800">
                Land Requirement
              </h4>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-slate-500">STP Capacity</dt>
                <dd className="text-right font-mono text-slate-800">
                  {(inputs.stpCapacityMld ?? 0).toFixed(2)} MLD
                </dd>
                <dt className="text-slate-500">Land Factor</dt>
                <dd className="text-right font-mono text-slate-800">
                  {result.stp.landFactorHaPerMld.toFixed(2)} ha/MLD
                </dd>
                <dt className="text-slate-500">Required Land</dt>
                <dd className="text-right font-mono text-slate-800">
                  {result.land.requiredAreaHa.toFixed(2)} ha
                </dd>
                <dt className="text-slate-500">Land Cost</dt>
                <dd className="text-right font-mono font-bold text-slate-900">
                  {formatCrore(result.land.costRupees)}
                </dd>
              </dl>
            </div>
          </div>
        </SectionCard>
      );
    }

    if (stepId === "conveyance") {
      return (
        <SectionCard title="Conveyance Decision + Hydraulic Calculation">
          <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-xs font-semibold">
            {(["direct", "levels"] as ElevationInputMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateInput("elevationMode", mode)}
                className={`rounded-md px-3 py-2 transition ${
                  inputs.elevationMode === mode
                    ? "bg-cyan-600 text-white"
                    : "text-slate-500 hover:bg-stone-50"
                }`}
              >
                {mode === "direct" ? "Direct Delta E" : "From Elevations"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {inputs.elevationMode === "direct" ? (
              <NumberInput
                label="Elevation Difference"
                value={inputs.deltaE}
                step={0.01}
                unit="m"
                onChange={(value) => updateInput("deltaE", value)}
              />
            ) : (
              <>
                <NumberInput
                  label="Tapping Elevation"
                  value={inputs.tappingElevation}
                  step={0.01}
                  unit="m"
                  onChange={(value) => updateInput("tappingElevation", value)}
                />
                <NumberInput
                  label="STP Elevation"
                  value={inputs.stpElevation}
                  step={0.01}
                  unit="m"
                  onChange={(value) => updateInput("stpElevation", value)}
                />
              </>
            )}
            <NumberInput
              label="Path Length"
              value={inputs.pathLength}
              min={0}
              step={1}
              unit="m"
              onChange={(value) => updateInput("pathLength", value)}
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                Conveyance Status
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-slate-500">Slope</dt>
                <dd className="text-right font-mono text-slate-800">
                  {result.conveyance.slope.toFixed(5)}
                </dd>
                <dt className="text-slate-500">Threshold</dt>
                <dd className="text-right font-mono text-slate-800">1 / 500</dd>
                <dt className="text-slate-500">Type</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {result.conveyance.isGravityFeasible ? "Gravity Sewer" : "Pumped Conveyance"}
                </dd>
              </dl>
            </div>

            {result.conveyance.isGravityFeasible ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="mb-2 text-sm font-semibold text-emerald-800">
                  Gravity Sewer Outputs
                </p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-emerald-700">Calculated diameter</dt>
                  <dd className="text-right font-mono text-emerald-950">
                    {result.conveyance.gravityDiameterMm.toFixed(0)} mm
                  </dd>
                  <dt className="text-emerald-700">Available market size</dt>
                  <dd className="text-right font-mono text-emerald-950">
                    {result.conveyance.gravityCommercialDiameterMm} mm
                  </dd>
                  <dt className="text-emerald-700">DPR rate</dt>
                  <dd className="text-right font-mono text-emerald-950">
                    {formatRupees(result.conveyance.gravityRateRupees)}/m
                  </dd>
                </dl>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-800">
                  Pumped Conveyance Outputs
                </p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-amber-700">MPS range</dt>
                  <dd className="text-right font-mono text-amber-950">
                    {result.conveyance.mpsRangeLabel}
                  </dd>
                  <dt className="text-amber-700">Calculated diameter</dt>
                  <dd className="text-right font-mono text-amber-950">
                    {result.conveyance.risingMainDiameterMm.toFixed(0)} mm
                  </dd>
                  <dt className="text-amber-700">Available market size</dt>
                  <dd className="text-right font-mono text-amber-950">
                    {result.conveyance.risingMainCommercialDiameterMm} mm
                  </dd>
                  <dt className="text-amber-700">RM rate</dt>
                  <dd className="text-right font-mono text-amber-950">
                    {formatRupees(result.conveyance.risingMainRateRupees)}/m
                  </dd>
                </dl>
              </div>
            )}
          </div>
        </SectionCard>
      );
    }

    if (stepId === "effluent") {
      return (
        <SectionCard title="Effluent Disposal Pipe">
          <div className="grid gap-3 lg:grid-cols-3">
            <NumberInput
              label="Effluent Pipe Length"
              value={inputs.effluentLength}
              min={0}
              step={1}
              unit="m"
              onChange={(value) => updateInput("effluentLength", value)}
            />
            <SingleSelect
              items={effluentPipeItems}
              selectedValue={inputs.effluentPipeRateId}
              onValueChange={(value) => {
                if (value !== null) {
                  updateInput("effluentPipeRateId", value as EffluentPipeRateId);
                }
              }}
              label="Diameter Category"
              placeholder="Select diameter category"
            />
            <NumberInput
              label="Rate"
              value={inputs.effluentRatesRupees[inputs.effluentPipeRateId]}
              min={0}
              step={1000}
              unit="₹/m"
              onChange={(value) => updateEffluentRate(inputs.effluentPipeRateId, value)}
            />
          </div>
        </SectionCard>
      );
    }

    if (stepId === "ocems") {
      return (
        <SectionCard title="OCEMS">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
              Drain tapping points from I&D Works:{" "}
              <span className="font-semibold text-slate-800">
                {result.totalDrainPoints}
              </span>
            </div>
            <NumberInput
              label="OCEMS Rate"
              value={inputs.ocemsRatePerPointRupees}
              min={0}
              step={100000}
              unit="₹/point"
              onChange={(value) => updateInput("ocemsRatePerPointRupees", value)}
            />
          </div>
        </SectionCard>
      );
    }

    if (stepId === "misc") {
      return (
        <SectionCard title="Miscellaneous Works">
          <div className="grid gap-2 sm:grid-cols-2">
            {dprMiscWorkOptions.map((option) => {
              const selected = inputs.selectedMiscWorkIds.includes(option.id);
              return (
                <div
                  key={option.id}
                  className={`rounded-lg border p-3 text-sm transition ${
                    selected ? "border-cyan-200 bg-cyan-50" : "border-stone-200 bg-stone-50"
                  }`}
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleMiscWork(option.id)}
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-cyan-600"
                    />
                    <span>
                      <span className="block font-semibold text-slate-700">{option.label}</span>
                    </span>
                  </label>
                  <div className="mt-3">
                    <NumberInput
                      label="Cost"
                      value={inputs.miscWorkCostsRupees[option.id]}
                      min={0}
                      step={100000}
                      unit="₹"
                      onChange={(value) => updateMiscWorkCost(option.id, value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      );
    }

    if (stepId === "om") {
      const omRows = [
        ["Staff Cost", omResult.breakdown.manpower],
        ["STP Electricity", omResult.breakdown.stpElectricity],
        ["MPS Electricity", omResult.breakdown.mpsElectricity],
        ["Chemicals", omResult.breakdown.chemicals],
        ["DG Set Operation", omResult.breakdown.dgFuel],
        ["Civil Repairs", omResult.breakdown.repairsCivil],
        ["E&M Repairs", omResult.breakdown.repairsEM],
        ["OCEMS Maintenance", omResult.breakdown.ocemsMaintenance],
        ["Sludge Disposal", omResult.breakdown.sludgeDisposal],
        ["Miscellaneous O&M", omResult.breakdown.miscOM],
      ] as const;

      return (
        <div className="space-y-4">
          <SectionCard title="Annual O&M Assumptions">
            <div className="grid gap-3 lg:grid-cols-3">
              <NumberInput
                label="Electricity Tariff"
                value={inputs.electricityTariffRupeesPerKwh}
                min={0}
                step={0.1}
                unit="₹/kWh"
                onChange={(value) => updateInput("electricityTariffRupeesPerKwh", value)}
              />
              <NumberInput
                label="Pump Efficiency"
                value={inputs.pumpEfficiency}
                min={0}
                step={0.01}
                onChange={(value) => updateInput("pumpEfficiency", value)}
              />
              <NumberInput
                label="Chlorine Dose"
                value={inputs.chlorineDoseMgPerL}
                min={0}
                step={0.1}
                unit="mg/L"
                onChange={(value) => updateInput("chlorineDoseMgPerL", value)}
              />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm">
                  TDH:
                </span>
                <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 text-xs font-semibold">
                  {(["flat", "undulating", "custom"] as TerrainType[]).map((terrain) => (
                    <button
                      key={terrain}
                      type="button"
                      onClick={() => updateInput("terrainType", terrain)}
                      className={`rounded-md px-3 py-2 capitalize transition ${
                        inputs.terrainType === terrain
                          ? "bg-cyan-600 text-white"
                          : "text-slate-500 hover:bg-stone-50"
                      }`}
                    >
                      {terrain}
                    </button>
                  ))}
                </div>
              </div>
              <NumberInput
                label="Custom TDH"
                value={inputs.customTdhMeters}
                min={0}
                step={1}
                unit="m"
                onChange={(value) => updateInput("customTdhMeters", value)}
              />
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                Active TDH:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {omResult.assumptions.tdhMeters.toFixed(2)} m
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-5">
              <NumberInput
                label="Chlorine Rate"
                value={inputs.chlorineRateRupeesPerKg}
                min={0}
                step={1}
                unit="₹/kg"
                onChange={(value) => updateInput("chlorineRateRupeesPerKg", value)}
              />
              <NumberInput
                label="Polymer Dose"
                value={inputs.polymerDoseKgPerKgSludge}
                min={0}
                step={0.001}
                unit="kg/kg"
                onChange={(value) => updateInput("polymerDoseKgPerKgSludge", value)}
              />
              <NumberInput
                label="Polymer Rate"
                value={inputs.polymerRateRupeesPerKg}
                min={0}
                step={1}
                unit="₹/kg"
                onChange={(value) => updateInput("polymerRateRupeesPerKg", value)}
              />
              <NumberInput
                label="Other Chemicals"
                value={inputs.otherChemicalsRupeesPerYear}
                min={0}
                step={10000}
                unit="₹/yr"
                onChange={(value) => updateInput("otherChemicalsRupeesPerYear", value)}
              />
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                Chemical cost:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {formatCrore(omResult.breakdown.chemicals)}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                STP staff norm count:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {omResult.assumptions.stpStaffCount.toFixed(1)}
                </span>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                MPS staff norm count:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {omResult.assumptions.mpsStaffCount.toFixed(1)}
                </span>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                Estimated pump power:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {omResult.assumptions.pumpPowerKw.toFixed(1)} kW
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <NumberInput
                label="Diesel Rate"
                value={inputs.dieselRateRupeesPerLiter}
                min={0}
                step={1}
                unit="₹/L"
                onChange={(value) => updateInput("dieselRateRupeesPerLiter", value)}
              />
              <NumberInput
                label="DG Backup Hours"
                value={inputs.dgBackupHoursPerDay}
                min={0}
                step={0.5}
                unit="hr/day"
                onChange={(value) => updateInput("dgBackupHoursPerDay", value)}
              />
              <NumberInput
                label="Diesel Use"
                value={inputs.dieselConsumptionLitersPerKwh}
                min={0}
                step={0.01}
                unit="L/kWh"
                onChange={(value) => updateInput("dieselConsumptionLitersPerKwh", value)}
              />
              <NumberInput
                label="Mobile Oil"
                value={inputs.mobileOilPercentOfDiesel}
                min={0}
                step={0.01}
                onChange={(value) => updateInput("mobileOilPercentOfDiesel", value)}
              />
              <NumberInput
                label="Mobile Oil Rate"
                value={inputs.mobileOilRateRupeesPerLiter}
                min={0}
                step={1}
                unit="₹/L"
                onChange={(value) => updateInput("mobileOilRateRupeesPerLiter", value)}
              />
              <NumberInput
                label="Sludge Disposal Rate"
                value={inputs.sludgeDisposalRateRupeesPerKg}
                min={0}
                step={0.1}
                unit="₹/kg"
                onChange={(value) => updateInput("sludgeDisposalRateRupeesPerKg", value)}
              />
              <NumberInput
                label="OCEMS Maintenance"
                value={inputs.annualOcemsMaintenanceRateRupeesPerPoint}
                min={0}
                step={10000}
                unit="₹/point/yr"
                onChange={(value) =>
                  updateInput("annualOcemsMaintenanceRateRupeesPerPoint", value)
                }
              />
              <NumberInput
                label="Misc O&M Factor"
                value={inputs.miscOmPercentOfManpower}
                min={0}
                step={0.01}
                onChange={(value) => updateInput("miscOmPercentOfManpower", value)}
              />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                Chlorine / polymer / other:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {formatCrore(omResult.assumptions.chlorineCostRupees)} /{" "}
                  {formatCrore(omResult.assumptions.polymerCostRupees)} /{" "}
                  {formatCrore(omResult.assumptions.otherChemicalsRupees)}
                </span>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                DG capacity:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {omResult.assumptions.dgCapacityKw.toFixed(1)} kW
                </span>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-slate-600">
                Diesel / mobile oil:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {omResult.assumptions.annualDieselLiters.toFixed(0)} L /{" "}
                  {omResult.assumptions.annualMobileOilLiters.toFixed(0)} L
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Year-1 O&M Cost">
            <div className="rounded-lg border border-stone-200 p-3">
              {omRows.map(([label, value]) => (
                <CostRow key={label} label={label} value={value} />
              ))}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-cyan-50 px-3 py-2">
                <span className="text-sm font-semibold text-cyan-900">TOTAL YEAR-1 O&M</span>
                <span className="font-mono text-sm font-bold text-cyan-950">
                  {formatCrore(omResult.totalYear1OmRupees)}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (stepId === "projection") {
      return (
        <SectionCard title="15-Year Lifecycle Projection">
          <div className="max-h-80 overflow-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[24rem] bg-white text-left text-xs text-slate-600">
              <thead className="sticky top-0 bg-stone-50 text-[11px] uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Year</th>
                  <th className="px-3 py-2 text-right font-semibold">O&M Cost</th>
                </tr>
              </thead>
              <tbody>
                {omProjection.map((year) => (
                  <tr key={year.year} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-mono">{year.year}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                      {formatCrore(year.totalRupees)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Total 15-Year O&M
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                {formatCrore(lifecycleResult.total15YearOmRupees)}
              </p>
            </div>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700">
                Total Lifecycle Cost
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-cyan-950">
                {formatCrore(lifecycleResult.totalLifecycleRupees)}
              </p>
            </div>
          </div>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="Final Review">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Project Inputs</h4>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-slate-500">STP Capacity</dt>
              <dd className="text-right font-mono text-slate-800">
                {(inputs.stpCapacityMld ?? 0).toFixed(2)} MLD
              </dd>
              <dt className="text-slate-500">Drain Flow</dt>
              <dd className="text-right font-mono text-slate-800">
                {(inputs.drainFlowMld ?? 0).toFixed(2)} MLD
              </dd>
              <dt className="text-slate-500">STP Technology</dt>
              <dd className="text-right font-semibold text-slate-800">
                {result.stp.technologyLabel}
              </dd>
              <dt className="text-slate-500">Land</dt>
              <dd className="text-right font-semibold text-slate-800 capitalize">
                {result.land.ownership}
              </dd>
              <dt className="text-slate-500">Land Area</dt>
              <dd className="text-right font-mono text-slate-800">
                {result.land.requiredAreaHa.toFixed(2)} ha
              </dd>
              <dt className="text-slate-500">Drain Points</dt>
              <dd className="text-right font-mono text-slate-800">{result.totalDrainPoints}</dd>
              <dt className="text-slate-500">Conveyance</dt>
              <dd className="text-right font-semibold text-slate-800">
                {result.conveyance.isGravityFeasible ? "Gravity" : "Pumping"}
              </dd>
            </dl>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Hydraulic Outputs</h4>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-slate-500">Slope</dt>
              <dd className="text-right font-mono text-slate-800">
                {result.conveyance.slope.toFixed(5)}
              </dd>
              {result.conveyance.isGravityFeasible ? (
                <>
                  <dt className="text-slate-500">Calculated Diameter</dt>
                  <dd className="text-right font-mono text-slate-800">
                    {result.conveyance.gravityDiameterMm.toFixed(0)} mm
                  </dd>
                  <dt className="text-slate-500">Available Market Size</dt>
                  <dd className="text-right font-mono text-slate-800">
                    {result.conveyance.gravityCommercialDiameterMm} mm
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-slate-500">Calculated RM Diameter</dt>
                  <dd className="text-right font-mono text-slate-800">
                    {result.conveyance.risingMainDiameterMm.toFixed(0)} mm
                  </dd>
                  <dt className="text-slate-500">Available RM Market Size</dt>
                  <dd className="text-right font-mono text-slate-800">
                    {result.conveyance.risingMainCommercialDiameterMm} mm
                  </dd>
                </>
              )}
              <dt className="text-slate-500">Total CAPEX</dt>
              <dd className="text-right font-mono font-bold text-slate-900">
                {formatCrore(lifecycleResult.totalCapexRupees)}
              </dd>
            </dl>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              Year-1 O&M
            </p>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">
              {formatCrore(lifecycleResult.totalYear1OmRupees)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              15-Year O&M
            </p>
            <p className="mt-1 font-mono text-base font-bold text-slate-900">
              {formatCrore(lifecycleResult.total15YearOmRupees)}
            </p>
          </div>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700">
              Lifecycle Cost
            </p>
            <p className="mt-1 font-mono text-base font-bold text-cyan-950">
              {formatCrore(lifecycleResult.totalLifecycleRupees)}
            </p>
          </div>
        </div>
      </SectionCard>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="DPR cost estimation engine"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
              <Calculator className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">
                DPR Cost Estimation Engine
              </h2>
              <p className="truncate text-xs text-slate-500">
                Step-by-step sewerage and STP project costing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-slate-500 transition hover:bg-stone-50 hover:text-slate-800"
            aria-label="Close DPR cost estimator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-stone-200 bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
              Step {currentStepIndex + 1} of {dprSteps.length}
            </p>
            <p className="font-mono text-sm font-bold text-slate-900">
              {formatCrore(lifecycleResult.totalLifecycleRupees)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-9">
            {dprSteps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isDone = index < currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(index)}
                  className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold transition ${
                    isActive
                      ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 bg-stone-50 text-slate-500 hover:border-stone-300"
                  }`}
                >
                  <span className="block font-mono">{index + 1}</span>
                  <span className="block truncate">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_320px]">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4">
            {renderStepContent(currentStep.id)}

            <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
              <button
                type="button"
                onClick={() => setCurrentStepIndex((current) => Math.max(0, current - 1))}
                disabled={isFirstStep}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  isFirstStep
                    ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                    : "border-stone-200 bg-white text-slate-600 hover:bg-stone-50"
                }`}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentStepIndex((current) => Math.min(dprSteps.length - 1, current + 1))
                }
                disabled={isLastStep}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isLastStep
                    ? "cursor-not-allowed bg-stone-200 text-stone-400"
                    : "bg-cyan-600 text-white hover:bg-cyan-500"
                }`}
              >
                {isLastStep ? "Review Complete" : "Next"}
              </button>
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-stone-200 bg-white p-4 lg:border-l lg:border-t-0">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-stone-200 bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                <IndianRupee className="h-3.5 w-3.5" />
                Lifecycle Summary
              </div>
              <div className="mt-3 space-y-2">
                <CostRow
                  label="Total CAPEX"
                  value={lifecycleResult.totalCapexRupees}
                  isActive={!["om", "projection"].includes(currentStep.id)}
                />
                <CostRow
                  label="Year-1 O&M"
                  value={lifecycleResult.totalYear1OmRupees}
                  isActive={currentStep.id === "om"}
                />
                <CostRow
                  label="15-Year O&M"
                  value={lifecycleResult.total15YearOmRupees}
                  isActive={currentStep.id === "projection"}
                />
                <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2">
                  <span className="text-xs font-semibold text-white">Lifecycle Cost</span>
                  <span className="font-mono text-xs font-bold text-white">
                    {formatCrore(lifecycleResult.totalLifecycleRupees)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-stone-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                CAPEX Section-wise Cost
              </h3>
              <CostRow
                label="STP"
                value={result.breakdown.stp}
                isActive={currentStep.id === "global"}
              />
              <CostRow
                label="Drain Tapping / I&D"
                value={result.breakdown.idWorks}
                isActive={currentStep.id === "tapping"}
              />
              <CostRow
                label="OCEMS"
                value={result.breakdown.ocems}
                isActive={currentStep.id === "ocems"}
              />
              <CostRow
                label="Land"
                value={result.breakdown.land}
                isActive={currentStep.id === "land"}
              />
              <CostRow
                label="Gravity Sewer"
                value={result.breakdown.gravity}
                isActive={currentStep.id === "conveyance"}
              />
              <CostRow
                label="MPS"
                value={result.breakdown.mps}
                isActive={currentStep.id === "conveyance"}
              />
              <CostRow
                label="Rising Main"
                value={result.breakdown.risingMain}
                isActive={currentStep.id === "conveyance"}
              />
              <CostRow
                label="Effluent Disposal"
                value={result.breakdown.effluent}
                isActive={currentStep.id === "effluent"}
              />
              <CostRow
                label="Miscellaneous"
                value={result.breakdown.miscellaneous}
                isActive={currentStep.id === "misc"}
              />
            </div>

            <div className="mt-4 rounded-lg border border-stone-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                O&M Section-wise Cost
              </h3>
              <CostRow
                label="Staff Cost"
                value={omResult.breakdown.manpower}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="STP Electricity"
                value={omResult.breakdown.stpElectricity}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="MPS Electricity"
                value={omResult.breakdown.mpsElectricity}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="Chemicals"
                value={omResult.breakdown.chemicals}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="DG Operation"
                value={omResult.breakdown.dgFuel}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="Repairs"
                value={omResult.breakdown.repairsCivil + omResult.breakdown.repairsEM}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="OCEMS Maintenance"
                value={omResult.breakdown.ocemsMaintenance}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="Sludge Disposal"
                value={omResult.breakdown.sludgeDisposal}
                isActive={currentStep.id === "om"}
              />
              <CostRow
                label="Misc O&M"
                value={omResult.breakdown.miscOM}
                isActive={currentStep.id === "om"}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
