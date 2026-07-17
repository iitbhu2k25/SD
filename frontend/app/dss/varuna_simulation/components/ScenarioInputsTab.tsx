'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useVarunaSimStore } from '../shared/store/varunaSim.store';
import { fetchSnapshot, saveScenario } from '../shared/services/varunaSim.service';
import {
  CONVEYANCE_LABELS,
  MAINTENANCE_FACTOR_OPTIONS,
  MAINTENANCE_OPTIONS,
  TECHNOLOGY_CHOICE_LABELS,
  type VarunaScenarioParams,
} from '../shared/types/varunaSim.types';
import {
  banner,
  helpText,
  innerCard,
  numberInput,
  pillTabActive,
  pillTabInactive,
  pillTabsWrapper,
  primaryButton,
  secondaryButton,
  sectionCard,
  sectionTitle,
  smallLabel,
} from '../shared/ui/styles';

type NumericParamKey = { [K in keyof VarunaScenarioParams]: VarunaScenarioParams[K] extends number ? K : never }[keyof VarunaScenarioParams];

const PCT_KEYS = [
  'pct_untapped_drains',
  'pct_tapped_non_gravity',
  'pct_tapped_gravity',
  'pct_stp_gravity_sewer',
  'pct_stp_non_gravity_sewer',
  'pct_non_stp_sewer',
  'pct_in_situ',
] as const;

const GROWTH_KEYS = [
  'growth_untapped',
  'growth_tapped_non_gravity',
  'growth_tapped_gravity',
  'growth_stp_gravity',
  'growth_stp_non_gravity',
  'growth_non_stp_sewer',
  'growth_in_situ',
] as const;

function StreamlitSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  className = '',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        {label ? <span className={smallLabel}>{label}</span> : <span />}
        <span className="text-xs font-semibold leading-none text-slate-700">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-emerald-500 transition-colors hover:bg-stone-300
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
          hover:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:scale-110
          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-emerald-500
          [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-150
          hover:[&::-moz-range-thumb]:scale-125 active:[&::-moz-range-thumb]:scale-110"
      />
    </div>
  );
}

const selectWrapperClass = 'relative';
const selectClass =
  'h-9 w-full cursor-pointer appearance-none rounded-lg border border-stone-200 bg-white pl-2.5 pr-8 text-sm text-slate-700 outline-none transition hover:border-stone-300 focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/50';
const selectChevronClass =
  'pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-colors';

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className={selectWrapperClass}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className={selectChevronClass} />
    </div>
  );
}

function NumberSelect({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (v: number) => void;
  options: { label: string; value: number }[];
}) {
  return (
    <div className={selectWrapperClass}>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={selectClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className={selectChevronClass} />
    </div>
  );
}

function MaintenanceTriplet({
  monitoringKey,
  coordinationKey,
  skillKey,
  params,
  setParam,
}: {
  monitoringKey: NumericParamKey;
  coordinationKey: NumericParamKey;
  skillKey: NumericParamKey;
  params: VarunaScenarioParams;
  setParam: (key: NumericParamKey, value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label>Adequacy of monitoring performance</Label>
        <NumberSelect value={params[monitoringKey]} onChange={(v) => setParam(monitoringKey, v)} options={MAINTENANCE_FACTOR_OPTIONS} />
      </div>
      <div>
        <Label>Availability of appropriate skills</Label>
        <NumberSelect value={params[skillKey]} onChange={(v) => setParam(skillKey, v)} options={MAINTENANCE_FACTOR_OPTIONS} />
      </div>
      <div>
        <Label>Coordination between agencies</Label>
        <NumberSelect value={params[coordinationKey]} onChange={(v) => setParam(coordinationKey, v)} options={MAINTENANCE_FACTOR_OPTIONS} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${sectionCard} p-4 sm:p-5`}>
      <h3 className={`${sectionTitle} mb-3`}>{title}</h3>
      {children}
    </div>
  );
}

function ContextualParametersPanel({ onNext }: { onNext: () => void }) {
  const { params, setParam, resetToDefaults } = useVarunaSimStore();
  const setNumericParam = setParam as (key: NumericParamKey, value: number) => void;
  const totalSewage = ((params.population * params.per_capita_sewage) / 1_000_000).toFixed(1);
  const pctSum = PCT_KEYS.reduce((acc, k) => acc + Number(params[k] || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm leading-relaxed text-slate-600">
        <p>
          Contextual parameters help initialize the model for a specific small river system. Their values can
          be set based on the reference year from which you want to start the simulation, thereby defining
          the state of the system in that year. These parameter values may vary across different river
          systems, making the model replicable for multiple small river systems. These parameters include:
        </p>
        <ol className="my-2 list-decimal space-y-0.5 pl-5">
          <li>Population and Sewage generation</li>
          <li>Sewage conveyance distribution</li>
          <li>Current treatment and pumping infrastructure</li>
          <li>Quality of maintenance and associated costs</li>
        </ol>
        <p>
          Some default values have been initialised, which are taken from field visits and literature review,
          for Varuna catchment in Varanasi city for the year 2025. You are supposed to confirm these values
          and change wherever you feel the need. You can keep default values if unsure and focus on testing
          different decisions to see how outcomes change.
        </p>
        <p className="mt-2 italic text-slate-500">
          Note: Scroll to see all the contextual parameters and their values. If you change the default
          values and again want to restore them, click on the button below to reset.
        </p>
      </div>

      <div>
        <button type="button" className={secondaryButton} onClick={resetToDefaults}>Reset to defaults</button>
      </div>

      <Section title="Population & Sewage Generation">
        <p className={`${helpText} mb-3`}>
          Population represents the total number of people living in the catchment area of the river. A
          larger population leads to higher sewage generation. Default population value represents the
          portion of Varanasi&apos;s population contributing to the Varuna catchment, estimated using total
          sewage generation. You may adjust this based on your chosen reference year. Current population
          multiplied by per capita sewage generation gives total sewage generated in the catchment.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`${innerCard} flex flex-col justify-center gap-2`}>
            <Label>Current population</Label>
            <Input
              type="number"
              className={numberInput}
              value={params.population}
              min={100000}
              max={50000000}
              step={10000}
              onChange={(e) => setParam('population', Number(e.target.value))}
            />
          </div>
          <div className={`${innerCard} flex flex-col justify-center gap-2`}>
            <StreamlitSlider
              label="Per capita sewage (L/person/day)"
              value={params.per_capita_sewage}
              min={50}
              max={250}
              onChange={(v) => setParam('per_capita_sewage', v)}
            />
          </div>
          <div className={`${innerCard} flex flex-col justify-center gap-2`}>
            <Label>Total sewage generated (calculated)</Label>
            <div className="text-lg font-semibold text-emerald-700">{totalSewage} MLD</div>
          </div>
        </div>
      </Section>

      <Section title="Current Sewage Conveyance Distribution">
        <p className={`${helpText} mb-3`}>
          The model distributes the catchment population across 7 categories based on how their sewage is
          conveyed and treated - from gravity-based sewer networks linked to STPs, to untapped drains with
          no treatment at all. Percentages must sum to 100.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className={innerCard}>
            <Label className="mb-2 block">Discharge mode (percentage)</Label>
            <div className="flex flex-col gap-3">
              {PCT_KEYS.map((key) => (
                <div key={key} className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600">{CONVEYANCE_LABELS[key]}</span>
                  <StreamlitSlider
                    value={params[key]}
                    min={0}
                    max={100}
                    onChange={(v) => setParam(key, v)}
                  />
                </div>
              ))}
            </div>
            {pctSum !== 100 ? (
              <p className={`${banner.warning} mt-3`}>Percentages sum to {pctSum} - must equal 100</p>
            ) : (
              <p className={`${banner.success} mt-3`}>Percentages sum to 100</p>
            )}
          </div>
          <div className={innerCard}>
            <Label className="mb-2 block">Annual discharge growth (%)</Label>
            <div className="flex flex-col gap-3">
              {GROWTH_KEYS.map((key, i) => (
                <div key={key} className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600">{CONVEYANCE_LABELS[PCT_KEYS[i]]}</span>
                  <StreamlitSlider
                    value={params[key]}
                    min={0}
                    max={10}
                    step={0.1}
                    onChange={(v) => setParam(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Current Treatment and Pumping Infrastructure">
        <p className={`${helpText} mb-3`}>
          The total installed capacity of Sewage Treatment Plants (STPs) and pumping stations currently
          serving the catchment. These limits determine how much of the generated sewage can actually be
          treated or conveyed before it overflows to the river untreated.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <StreamlitSlider label="STP capacity (MLD)" value={params.stp_capacity} min={0} max={1000}
              onChange={(v) => setParam('stp_capacity', v)} />
          </div>
          <div>
            <StreamlitSlider label="Pumping capacity (MLD)" value={params.pump_capacity} min={0} max={1000}
              onChange={(v) => setParam('pump_capacity', v)} />
          </div>
        </div>
      </Section>

      <Section title="Quality of Maintenance and Associated Costs">
        <p className={`${helpText} mb-3`}>
          The current level of upkeep for each infrastructure category is defined by three factors -
          adequacy of monitoring, availability of appropriate skills, and coordination between agencies
          (each low/medium/high) - which together determine how efficiently that infrastructure performs.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${innerCard} flex flex-col gap-2`}>
            <Label className="normal-case tracking-normal text-slate-700">STPs</Label>
            <MaintenanceTriplet
              monitoringKey="maint_stp_monitoring"
              coordinationKey="maint_stp_coordination"
              skillKey="maint_stp_skill"
              params={params}
              setParam={setNumericParam}
            />
          </div>
          <div className={`${innerCard} flex flex-col gap-2`}>
            <Label className="normal-case tracking-normal text-slate-700">Pumping stations</Label>
            <MaintenanceTriplet
              monitoringKey="maint_pump_monitoring"
              coordinationKey="maint_pump_coordination"
              skillKey="maint_pump_skill"
              params={params}
              setParam={setNumericParam}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`${innerCard} flex flex-col gap-2`}>
            <Label className="normal-case tracking-normal text-slate-700">Tapped (nongravity)</Label>
            <MaintenanceTriplet
              monitoringKey="maint_tapped_nongravity_monitoring"
              coordinationKey="maint_tapped_nongravity_coordination"
              skillKey="maint_tapped_nongravity_skill"
              params={params}
              setParam={setNumericParam}
            />
          </div>
          <div className={`${innerCard} flex flex-col gap-2`}>
            <Label className="normal-case tracking-normal text-slate-700">Tapped (gravity)</Label>
            <MaintenanceTriplet
              monitoringKey="maint_tapped_gravity_monitoring"
              coordinationKey="maint_tapped_gravity_coordination"
              skillKey="maint_tapped_gravity_skill"
              params={params}
              setParam={setNumericParam}
            />
          </div>
          <div className={`${innerCard} flex flex-col gap-2`}>
            <Label className="normal-case tracking-normal text-slate-700">Sewer (nongravity)</Label>
            <MaintenanceTriplet
              monitoringKey="maint_sewer_nongravity_monitoring"
              coordinationKey="maint_sewer_nongravity_coordination"
              skillKey="maint_sewer_nongravity_skill"
              params={params}
              setParam={setNumericParam}
            />
          </div>
          <div className={`${innerCard} flex flex-col gap-2`}>
            <Label className="normal-case tracking-normal text-slate-700">Sewer (gravity)</Label>
            <MaintenanceTriplet
              monitoringKey="maint_sewer_gravity_monitoring"
              coordinationKey="maint_sewer_gravity_coordination"
              skillKey="maint_sewer_gravity_skill"
              params={params}
              setParam={setNumericParam}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Label className="normal-case tracking-normal text-slate-700">Annual O&amp;M cost (Cr.) for current maintenance</Label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="max-w-[220px]">
              <Label>For total installed STPs capacity</Label>
              <Input type="number" className={numberInput} step={0.01} value={params.om_stp} onChange={(e) => setParam('om_stp', Number(e.target.value))} />
            </div>
            <div className="max-w-[220px]">
              <Label>For total installed pumping capacity</Label>
              <Input type="number" className={numberInput} step={0.1} value={params.om_pump} onChange={(e) => setParam('om_pump', Number(e.target.value))} />
            </div>
            <div className="max-w-[220px]">
              <Label>For whole tapped (gravity and non-gravity) network</Label>
              <Input type="number" className={numberInput} step={0.1} value={params.om_tapped}
                onChange={(e) => setParam('om_tapped', Number(e.target.value))} />
            </div>
            <div className="max-w-[220px]">
              <Label>For whole sewer (gravity and non-gravity) network</Label>
              <Input type="number" className={numberInput} step={0.1} value={params.om_sewer_network}
                onChange={(e) => setParam('om_sewer_network', Number(e.target.value))} />
            </div>
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <button type="button" className={primaryButton} onClick={onNext}>Next: Decisions</button>
      </div>
    </div>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <label className={`${smallLabel} mb-1 block normal-case tracking-normal text-slate-500 ${className}`}>{children}</label>;
}

function DecisionsPanel({ onNext }: { onNext: () => void }) {
  const { params, strategies, setStrategies, snapshot, setSnapshot, setParam } = useVarunaSimStore();
  const setNumericParam = setParam as (key: NumericParamKey, value: number) => void;
  const [loading, setLoading] = useState(!snapshot);

  useEffect(() => {
    let cancelled = false;
    const isFirstLoad = !snapshot;
    if (isFirstLoad) setLoading(true);

    const timeoutId = setTimeout(() => {
      fetchSnapshot(params)
        .then((res) => { if (!cancelled) setSnapshot(res); })
        .catch(() => { if (!cancelled) setSnapshot(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, isFirstLoad ? 0 : 400);

    return () => { cancelled = true; clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  const toggleStrategy = (name: string) => {
    setStrategies(
      strategies.includes(name) ? strategies.filter((s) => s !== name) : [...strategies, name],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm leading-relaxed text-slate-600">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Current Snapshot</h2>
        <p>
          Based on the contextual parameters, following are the current situation of sewage treatment and
          untreated sewage. If you don&apos;t agree with the value given below then change the contextual
          parameters. Consider these situations to make your decisions.
        </p>

        {loading && !snapshot ? (
          <p className="mt-3 text-slate-500">Computing...</p>
        ) : snapshot ? (
          <div className={`mt-3 flex flex-col gap-1.5 text-[15px] transition-opacity duration-150 ${loading ? 'opacity-60' : 'opacity-100'}`}>
            <p><strong className="font-bold text-slate-900">Current sewage generation</strong> = <strong className="font-bold text-emerald-700">{snapshot.total_sewage} MLD</strong></p>
            <p><strong className="font-bold text-slate-900">STP installed capacity</strong> = <strong className="font-bold text-emerald-700">{snapshot.stp_installed_capacity} MLD</strong></p>
            <p><strong className="font-bold text-slate-900">Capacity deficit</strong> = <strong className="font-bold text-emerald-700">{snapshot.capacity_deficit} MLD</strong></p>
            <p><strong className="font-bold text-slate-900">STP unutilised capacity</strong> = <strong className="font-bold text-emerald-700">{snapshot.stp_unutilised_capacity} MLD</strong></p>
            <p><strong className="font-bold text-slate-900">Treatment deficit</strong> = <strong className="font-bold text-emerald-700">{snapshot.treatment_deficit} MLD</strong></p>
            <p><strong className="font-bold text-slate-900">Untreated flow from untapped drains</strong> = <strong className="font-bold text-emerald-700">{snapshot.untreated_untapped} MLD</strong></p>
            <p><strong className="font-bold text-slate-900">Overflows from tapped drains</strong> = <strong className="font-bold text-emerald-700">{snapshot.overflow_tapped} MLD</strong></p>
          </div>
        ) : (
          <p className="mt-3 text-slate-500">Snapshot unavailable.</p>
        )}

        <p className="mt-3">Consider the current snapshot to make your sewage management strategies.</p>
      </div>

      <div className="text-sm leading-relaxed text-slate-600">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Sewage Management Strategies</h2>
        <p>
          You can explore different approaches to improve the river system by selecting one or more of the
          following strategies. Each option represents a key intervention area in sewage management.
        </p>

        <p className="mt-3">
          <strong className="text-slate-900">1. Treatment Capacity Augmentation:</strong> focuses on increasing
          sewage treatment capacity. You can choose between:
        </p>
        <ul className="my-1 list-disc space-y-0.5 pl-6">
          <li><strong className="text-slate-800">Centralized planning:</strong> Expanding large, centralized treatment plants</li>
          <li><strong className="text-slate-800">Decentralized planning:</strong> Adding smaller, distributed treatment units</li>
        </ul>

        <p className="mt-3">
          <strong className="text-slate-900">2. Conveyance Augmentation:</strong> focuses on improving how
          sewage is transported to treatment facilities. It includes:
        </p>
        <ul className="my-1 list-disc space-y-0.5 pl-6">
          <li><strong className="text-slate-800">Drain tapping:</strong> Diverting sewage from drains to treatment systems</li>
          <li><strong className="text-slate-800">Pumping capacity addition:</strong> Ensuring adequate pumping where gravity-based flow is not feasible</li>
        </ul>

        <p className="mt-3">
          <strong className="text-slate-900">3. Change Quality of Maintenance:</strong> This strategy focuses
          on improving the performance of existing infrastructure by enhancing the quality of maintenance.
          It applies to both:
        </p>
        <ul className="my-1 list-disc space-y-0.5 pl-6">
          <li>Conveyance systems (drains, sewers, pumping stations)</li>
          <li>Treatment infrastructure (STPs)</li>
        </ul>

        <p className="mt-3">Select the strategies you want to test below.</p>
      </div>

      <Section title="Sewage Management Strategies">
        <div className="grid gap-3 sm:grid-cols-3">
          {['Treatment Capacity Augmentation', 'Conveyance Augmentation', 'Change Quality of Maintenance'].map((s) => (
            <label key={s} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/65 px-3 py-2 text-sm text-slate-700 transition hover:border-stone-300 hover:bg-white/90">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600" checked={strategies.includes(s)} onChange={() => toggleStrategy(s)} />
              {s}
            </label>
          ))}
        </div>
      </Section>

      {strategies.includes('Treatment Capacity Augmentation') && (
        <Section title="Treatment Capacity Augmentation">
          <div className="flex flex-wrap items-start gap-4">
            <div className={`${innerCard} flex min-w-[260px] flex-1 flex-col gap-3`}>
              <div>
                <Label>Choose planning type</Label>
                <div className="flex gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="planning_choice" className="h-4 w-4 text-emerald-600" checked={params.planning_choice === 1} onChange={() => setParam('planning_choice', 1)} />
                    Centralised
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="planning_choice" className="h-4 w-4 text-emerald-600" checked={params.planning_choice === 2} onChange={() => setParam('planning_choice', 2)} />
                    Decentralised
                  </label>
                </div>
              </div>
              {params.planning_choice === 2 && (
                <div>
                  <StreamlitSlider label="Addition number of STPs required" value={params.num_stp_required} min={0} max={20}
                    onChange={(v) => setParam('num_stp_required', v)} />
                </div>
              )}
              <div className="max-w-[220px]">
                <Label>Unit size of additional STPs (MLD)</Label>
                <Input type="number" className={numberInput} min={0} step={5} value={params.unit_stp_size}
                  onChange={(e) => setParam('unit_stp_size', Number(e.target.value))} />
              </div>
              <div>
                <Label>Total STP capacity augmented (calculated)</Label>
                <div className="text-sm font-semibold text-emerald-700">
                  {(params.unit_stp_size * (params.planning_choice === 2 ? Math.max(params.num_stp_required, 1) : 1)).toFixed(1)} MLD
                </div>
              </div>
              <div className="max-w-[280px]">
                <Label>Treatment Technology</Label>
                <NumberSelect
                  value={params.technology_choice}
                  onChange={(v) => setParam('technology_choice', v)}
                  options={Object.entries(TECHNOLOGY_CHOICE_LABELS).map(([value, label]) => ({ value: Number(value), label }))}
                />
              </div>
            </div>
            <div className={`${innerCard} flex min-w-[260px] flex-1 flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">STP Time Delays</Label>
              <div>
                <StreamlitSlider label="Proposal to approval basetime (yrs)" value={params.proposal_approval_time} min={0} max={5}
                  onChange={(v) => setParam('proposal_approval_time', v)} />
              </div>
              <div>
                <StreamlitSlider label="Approval to under-construction basetime (yrs)" value={params.approval_construction_time} min={0} max={5}
                  onChange={(v) => setParam('approval_construction_time', v)} />
              </div>
              <div>
                <StreamlitSlider label="Under-construction basetime (yrs)" value={params.underconstruction_time} min={0} max={5}
                  onChange={(v) => setParam('underconstruction_time', v)} />
              </div>
              <p className={`${helpText} mt-1`}>Further delays can occur due to administrative reasons:</p>
              <div>
                <StreamlitSlider label="Budget allocation delay (yrs)" value={params.budget_allocation_delay} min={0} max={3} step={0.25}
                  onChange={(v) => setParam('budget_allocation_delay', v)} />
              </div>
              <div>
                <StreamlitSlider label="Land acquisition delay (yrs)" value={params.land_acquisition_delay} min={0} max={3} step={0.25}
                  onChange={(v) => setParam('land_acquisition_delay', v)} />
              </div>
              <div>
                <StreamlitSlider label="Operational clearance delay (yrs)" value={params.operational_clearance_time} min={0} max={3} step={0.25}
                  onChange={(v) => setParam('operational_clearance_time', v)} />
              </div>
            </div>
          </div>
        </Section>
      )}

      {strategies.includes('Conveyance Augmentation') && (
        <Section title="Conveyance Augmentation">
          <p className={`${helpText} mb-3`}>
            Drain tapping, Sewer network addition and pumping capacity are considered the primary
            conveyance interventions. If tapping and sewer network addition is done using non-gravity-based
            systems, additional pumping may be required.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`${innerCard} flex flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">Drain Tapping (non gravity)</Label>
              <Label>Sewage to be tapped using non gravity based infra (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={5} value={params.drain_tap_nongravity}
                onChange={(e) => setParam('drain_tap_nongravity', Number(e.target.value))} />
              <StreamlitSlider label="Time (yrs) to complete tapping (non gravity)" value={params.drain_tap_nongravity_time} min={0} max={5}
                onChange={(v) => setParam('drain_tap_nongravity_time', v)} />
            </div>
            <div className={`${innerCard} flex flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">Drain Tapping (gravity)</Label>
              <Label>Sewage to be tapped using gravity based infra (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={5} value={params.drain_tap_gravity}
                onChange={(e) => setParam('drain_tap_gravity', Number(e.target.value))} />
              <StreamlitSlider label="Time (yrs) to complete tapping (gravity)" value={params.drain_tap_gravity_time} min={0} max={5}
                onChange={(v) => setParam('drain_tap_gravity_time', v)} />
            </div>
          </div>

          <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
            <div className={`${innerCard} flex flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">Sewer Network (non gravity)</Label>
              <Label>Untapped flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_untapped_nongravity}
                onChange={(e) => setParam('sewer_flow_untapped_nongravity', Number(e.target.value))} />
              <Label>Tapped (nongravity) flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_tapped_nongravity_nongravity}
                onChange={(e) => setParam('sewer_flow_tapped_nongravity_nongravity', Number(e.target.value))} />
              <Label>Tapped (gravity) flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_tapped_gravity_nongravity}
                onChange={(e) => setParam('sewer_flow_tapped_gravity_nongravity', Number(e.target.value))} />
              <Label>In-situ flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_insitu_nongravity}
                onChange={(e) => setParam('sewer_flow_insitu_nongravity', Number(e.target.value))} />
              <Label>Non-STP sewer flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_nonstp_nongravity}
                onChange={(e) => setParam('sewer_flow_nonstp_nongravity', Number(e.target.value))} />
              <p className="text-sm font-semibold text-emerald-700">
                Total non-gravity sewer flow added = {(
                  params.sewer_flow_untapped_nongravity + params.sewer_flow_tapped_nongravity_nongravity
                  + params.sewer_flow_tapped_gravity_nongravity + params.sewer_flow_insitu_nongravity
                  + params.sewer_flow_nonstp_nongravity
                ).toFixed(1)} MLD
              </p>
              <StreamlitSlider label="Time (yrs) to complete sewer (non gravity) network" value={params.sewer_time_nongravity} min={0} max={10} step={0.25}
                onChange={(v) => setParam('sewer_time_nongravity', v)} />
            </div>
            <div className={`${innerCard} flex flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">Sewer Network (gravity)</Label>
              <Label>Untapped flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_untapped_gravity}
                onChange={(e) => setParam('sewer_flow_untapped_gravity', Number(e.target.value))} />
              <Label>Tapped (nongravity) flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_tapped_nongravity_gravity}
                onChange={(e) => setParam('sewer_flow_tapped_nongravity_gravity', Number(e.target.value))} />
              <Label>Tapped (gravity) flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_tapped_gravity_gravity}
                onChange={(e) => setParam('sewer_flow_tapped_gravity_gravity', Number(e.target.value))} />
              <Label>In-situ flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_insitu_gravity}
                onChange={(e) => setParam('sewer_flow_insitu_gravity', Number(e.target.value))} />
              <Label>Non-STP sewer flow to be connected (MLD)</Label>
              <Input type="number" className={numberInput} min={0} step={1} value={params.sewer_flow_nonstp_gravity}
                onChange={(e) => setParam('sewer_flow_nonstp_gravity', Number(e.target.value))} />
              <p className="text-sm font-semibold text-emerald-700">
                Total gravity sewer flow added = {(
                  params.sewer_flow_untapped_gravity + params.sewer_flow_tapped_nongravity_gravity
                  + params.sewer_flow_tapped_gravity_gravity + params.sewer_flow_insitu_gravity
                  + params.sewer_flow_nonstp_gravity
                ).toFixed(1)} MLD
              </p>
              <StreamlitSlider label="Time (yrs) to complete sewer (gravity) network" value={params.sewer_time_gravity} min={0} max={10} step={0.25}
                onChange={(v) => setParam('sewer_time_gravity', v)} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className={`${innerCard} flex flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">Total Sewer Network Length Addition</Label>
              <p className={helpText}>
                Based on the total wastewater flow to be connected with sewer network above, a default value of
                required sewer network length is estimated by the model. If you don&apos;t agree with the default
                value then enter below:
              </p>
              <div className="max-w-[220px]">
                <Label>Sewer network (gravity + nongravity) required (Km)</Label>
                <Input type="number" className={numberInput} min={0} step={1} value={params.user_input_sewer_network_length}
                  onChange={(e) => setParam('user_input_sewer_network_length', Number(e.target.value))} />
              </div>
            </div>

            <div className={`${innerCard} flex flex-col gap-3`}>
              <Label className="normal-case tracking-normal text-slate-700">Pumping Capacity</Label>
              <p className={helpText}>
                If you need more pumping capacity based on added gravity based conveyance infrastructure,
                please enter below.
              </p>
              <div className="max-w-[220px]">
                <Label>Additional Pumping Capacity Required (MLD)</Label>
                <Input type="number" className={numberInput} min={0} step={5} value={params.additional_pumping}
                  onChange={(e) => setParam('additional_pumping', Number(e.target.value))} />
              </div>
              {params.drain_tap_nongravity === 0 && params.sewer_flow_untapped_nongravity + params.sewer_flow_tapped_nongravity_nongravity
                + params.sewer_flow_tapped_gravity_nongravity + params.sewer_flow_insitu_nongravity + params.sewer_flow_nonstp_nongravity === 0 && (
                <div className="max-w-[280px]">
                  <StreamlitSlider label="Time (yrs) to add pumping station" value={params.pumping_station_time} min={0} max={5}
                    onChange={(v) => setParam('pumping_station_time', v)} />
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {strategies.includes('Change Quality of Maintenance') && (
        <Section title="Maintenance Efforts Inputs">
          <p className={`${helpText} mb-3`}>
            Specify the infrastructure components where you want to adjust maintenance levels. Before making
            changes, review the current maintenance effort under Contextual Parameters to understand the
            existing baseline and decide the level you want to achieve.
          </p>

          <Label className="mb-2 block normal-case tracking-normal text-slate-700">Select the infrastructures</Label>
          <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {([
              { key: 'change_maint_stp', label: 'STPs' },
              { key: 'change_maint_pump', label: 'Pumps' },
              { key: 'change_maint_tapped_nongravity', label: 'Tapped (nongravity)' },
              { key: 'change_maint_tapped_gravity', label: 'Tapped (gravity)' },
              { key: 'change_maint_sewer_nongravity', label: 'Sewer (nongravity)' },
              { key: 'change_maint_sewer_gravity', label: 'Sewer (gravity)' },
            ] as const).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/65 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-stone-300 hover:bg-white/90">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  checked={params[key]}
                  onChange={() => setParam(key, !params[key])}
                />
                {label}
              </label>
            ))}
          </div>

          {(params.change_maint_stp || params.change_maint_pump) && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              {params.change_maint_stp && (
                <div className={`${innerCard} flex flex-col gap-2`}>
                  <Label className="normal-case tracking-normal text-slate-700">STP</Label>
                  <MaintenanceTriplet
                    monitoringKey="new_maint_stp_monitoring"
                    coordinationKey="new_maint_stp_coordination"
                    skillKey="new_maint_stp_skill"
                    params={params}
                    setParam={setNumericParam}
                  />
                  <StreamlitSlider className="mt-2" label="Time (yrs) for change" value={params.maint_time_stp} min={0} max={3} step={0.25}
                    onChange={(v) => setParam('maint_time_stp', v)} />
                </div>
              )}
              {params.change_maint_pump && (
                <div className={`${innerCard} flex flex-col gap-2`}>
                  <Label className="normal-case tracking-normal text-slate-700">Pumping station</Label>
                  <MaintenanceTriplet
                    monitoringKey="new_maint_pump_monitoring"
                    coordinationKey="new_maint_pump_coordination"
                    skillKey="new_maint_pump_skill"
                    params={params}
                    setParam={setNumericParam}
                  />
                  <StreamlitSlider className="mt-2" label="Time (yrs) for change in quality of efforts" value={params.maint_time_pump} min={0} max={3} step={0.25}
                    onChange={(v) => setParam('maint_time_pump', v)} />
                </div>
              )}
            </div>
          )}

          {(params.change_maint_tapped_nongravity || params.change_maint_tapped_gravity
            || params.change_maint_sewer_nongravity || params.change_maint_sewer_gravity) && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {params.change_maint_tapped_nongravity && (
                <div className={`${innerCard} flex flex-col gap-2`}>
                  <Label className="normal-case tracking-normal text-slate-700">Tapped (nongravity)</Label>
                  <MaintenanceTriplet
                    monitoringKey="new_maint_tapped_ng_monitoring"
                    coordinationKey="new_maint_tapped_ng_coordination"
                    skillKey="new_maint_tapped_ng_skill"
                    params={params}
                    setParam={setNumericParam}
                  />
                  <StreamlitSlider className="mt-2" label="Time (yrs) for change" value={params.maint_time_tapped_ng} min={0} max={3} step={0.25}
                    onChange={(v) => setParam('maint_time_tapped_ng', v)} />
                </div>
              )}
              {params.change_maint_tapped_gravity && (
                <div className={`${innerCard} flex flex-col gap-2`}>
                  <Label className="normal-case tracking-normal text-slate-700">Tapped (gravity)</Label>
                  <MaintenanceTriplet
                    monitoringKey="new_maint_tapped_g_monitoring"
                    coordinationKey="new_maint_tapped_g_coordination"
                    skillKey="new_maint_tapped_g_skill"
                    params={params}
                    setParam={setNumericParam}
                  />
                  <StreamlitSlider className="mt-2" label="Time (yrs) for change" value={params.maint_time_tapped_g} min={0} max={3} step={0.25}
                    onChange={(v) => setParam('maint_time_tapped_g', v)} />
                </div>
              )}
              {params.change_maint_sewer_nongravity && (
                <div className={`${innerCard} flex flex-col gap-2`}>
                  <Label className="normal-case tracking-normal text-slate-700">Sewer (nongravity)</Label>
                  <MaintenanceTriplet
                    monitoringKey="new_maint_sewer_nongravity_monitoring"
                    coordinationKey="new_maint_sewer_nongravity_coordination"
                    skillKey="new_maint_sewer_nongravity_skill"
                    params={params}
                    setParam={setNumericParam}
                  />
                  <StreamlitSlider className="mt-2" label="Time (yrs) for change" value={params.maint_time_sewer_nongravity} min={0} max={3} step={0.25}
                    onChange={(v) => setParam('maint_time_sewer_nongravity', v)} />
                </div>
              )}
              {params.change_maint_sewer_gravity && (
                <div className={`${innerCard} flex flex-col gap-2`}>
                  <Label className="normal-case tracking-normal text-slate-700">Sewer (gravity)</Label>
                  <MaintenanceTriplet
                    monitoringKey="new_maint_sewer_gravity_monitoring"
                    coordinationKey="new_maint_sewer_gravity_coordination"
                    skillKey="new_maint_sewer_gravity_skill"
                    params={params}
                    setParam={setNumericParam}
                  />
                  <StreamlitSlider className="mt-2" label="Time (yrs) for change" value={params.maint_time_sewer_gravity} min={0} max={3} step={0.25}
                    onChange={(v) => setParam('maint_time_sewer_gravity', v)} />
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      <div className="flex justify-end">
        <button type="button" className={primaryButton} onClick={onNext}>Next: Implementation Costs</button>
      </div>
    </div>
  );
}

function ImplementationCostsPanel() {
  const { params, setParam, strategies, resetToDefaults } = useVarunaSimStore();
  const [scenarioName, setScenarioName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    if (!scenarioName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a scenario name.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveScenario(scenarioName.trim(), params, strategies);
      setMessage({ type: 'success', text: `Scenario "${scenarioName}" saved! Go to Scenario Results tab.` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save scenario.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Section title="Implementation Costs">
        <p className={`${helpText} mb-3`}>
          Please enter the capital and O&amp;M cost for the corresponding strategies chosen in the last step.
          Costs are in INR Crores (Cr.) for unit MLD of the corresponding infrastructure. For sewer network
          the cost inputs are in INR Crores (Cr.) for unit Kilometer (Km.) length.
        </p>

        <div className={`${innerCard} mb-4 flex flex-col gap-3`}>
          <Label className="normal-case tracking-normal text-slate-700">STP unit MLD costs</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="max-w-[220px]">
              <Label>STP construction (Cr.)</Label>
              <Input type="number" className={numberInput} step={0.5} value={params.stp_construction}
                onChange={(e) => setParam('stp_construction', Number(e.target.value))} />
            </div>
            <div className="max-w-[220px]">
              <Label>STP annual O&amp;M (Cr.)</Label>
              <Input type="number" className={numberInput} step={0.1} value={params.stp_om_cost}
                onChange={(e) => setParam('stp_om_cost', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`${innerCard} flex flex-col gap-3`}>
            <Label className="normal-case tracking-normal text-slate-700">Tapping unit MLD costs</Label>
            <Label>Tapped network construction (Cr.)</Label>
            <Input type="number" className={numberInput} step={0.5} value={params.tap_construction}
              onChange={(e) => setParam('tap_construction', Number(e.target.value))} />
            <Label>Tapped network annual O&amp;M (Cr.)</Label>
            <Input type="number" className={numberInput} step={0.1} value={params.tap_om_cost}
              onChange={(e) => setParam('tap_om_cost', Number(e.target.value))} />
          </div>
          <div className={`${innerCard} flex flex-col gap-3`}>
            <Label className="normal-case tracking-normal text-slate-700">Sewer Network Unit KM Cost</Label>
            <Label>Network construction cost (Cr.)</Label>
            <Input type="number" className={numberInput} step={0.1} value={params.sewer_network_construction_per_km}
              onChange={(e) => setParam('sewer_network_construction_per_km', Number(e.target.value))} />
            <Label>Network annual O&amp;M (Cr.)</Label>
            <Input type="number" className={numberInput} step={0.01} value={params.sewer_network_om_per_km}
              onChange={(e) => setParam('sewer_network_om_per_km', Number(e.target.value))} />
          </div>
          <div className={`${innerCard} flex flex-col gap-3`}>
            <Label className="normal-case tracking-normal text-slate-700">Pumping unit MLD costs</Label>
            <Label>Pumping Station construction (Cr.)</Label>
            <Input type="number" className={numberInput} step={0.5} value={params.pump_construction}
              onChange={(e) => setParam('pump_construction', Number(e.target.value))} />
            <Label>Pumping station annual O&amp;M (Cr.)</Label>
            <Input type="number" className={numberInput} step={0.1} value={params.pump_om_cost}
              onChange={(e) => setParam('pump_om_cost', Number(e.target.value))} />
          </div>
        </div>
      </Section>

      <div className={`${sectionCard} flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5`}>
        <div className="flex-1">
          <Label>Scenario name</Label>
          <Input className={numberInput} value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="e.g. Baseline 2025" />
        </div>
        <button type="button" className={primaryButton} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Simulate'}
        </button>
        <button type="button" className={secondaryButton} onClick={resetToDefaults}>Reset</button>
      </div>

      {message && (
        <p className={message.type === 'success' ? banner.success : banner.error}>
          {message.text}
        </p>
      )}
    </div>
  );
}

const SUB_TABS = [
  { value: 'contextual', label: '2.1 Contextual Parameters' },
  { value: 'decisions', label: '2.2 Decisions' },
  { value: 'costs', label: '2.3 Implementation Costs' },
] as const;

export default function ScenarioInputsTab() {
  const [active, setActive] = useState<(typeof SUB_TABS)[number]['value']>('contextual');

  return (
    <div className="flex flex-col gap-4">
      <div className={`${pillTabsWrapper} w-fit max-w-full flex-wrap`}>
        {SUB_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActive(tab.value)}
            className={active === tab.value ? pillTabActive : pillTabInactive}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'contextual' && <ContextualParametersPanel onNext={() => setActive('decisions')} />}
      {active === 'decisions' && <DecisionsPanel onNext={() => setActive('costs')} />}
      {active === 'costs' && <ImplementationCostsPanel />}
    </div>
  );
}
