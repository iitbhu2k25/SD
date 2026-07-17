'use client';

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useVarunaSimStore } from '../shared/store/varunaSim.store';
import { getScenario } from '../shared/services/varunaSim.service';
import type { ScenarioOut } from '../shared/types/varunaSim.types';
import { banner, innerCard, sectionCard, sectionTitle, smallLabel } from '../shared/ui/styles';
import { DAY_TICKS, niceTicks } from '../shared/ui/chartTicks';

const COLORS = ['#1976D2', '#E53935', '#43A047', '#FB8C00', '#8E24AA'];

const CHART_GROUPS: Array<{ title: string; yLabel: string; series: Array<{ key: string; label: string }> }> = [
  {
    title: 'Sewage',
    yLabel: 'MLD',
    series: [
      { key: 'Total Sewage (MLD)', label: 'Generation' },
      { key: 'Untreated Load (MLD)', label: 'Untreated' },
      { key: 'Treated (MLD)', label: 'Treated' },
    ],
  },
  {
    title: 'Untreated Overflows',
    yLabel: 'MLD',
    series: [
      { key: 'Tapped Drain Overflow (Gravity) (MLD)', label: 'Tapped drain (gravity)' },
      { key: 'Tapped Drain Overflow (Non-Gravity) (MLD)', label: 'Tapped drain (non-gravity)' },
      { key: 'STP Overflow (MLD)', label: 'STP' },
      { key: 'Pumping Station Overflow (MLD)', label: 'Pumping Station' },
    ],
  },
  {
    title: 'Investment in new Infrastructure',
    yLabel: 'INR (Cr.)',
    series: [{ key: 'Capital Cost (Cr)', label: 'Investment' }],
  },
  {
    title: 'O&M cost',
    yLabel: 'INR (Cr.)',
    series: [{ key: 'OM Cost (Cr)', label: 'O&M cost' }],
  },
];

export default function ScenarioResultsTab() {
  const scenarios = useVarunaSimStore((s) => s.scenarios);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState<Record<number, ScenarioOut>>({});

  useEffect(() => {
    if (scenarios.length && selectedIds.length === 0) {
      setSelectedIds(scenarios.map((s) => s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios.length]);

  useEffect(() => {
    selectedIds.forEach((id) => {
      if (!loaded[id]) {
        getScenario(id).then((full) => setLoaded((prev) => ({ ...prev, [id]: full }))).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')]);

  if (!scenarios.length) {
    return (
      <div className={`${sectionCard} p-4 text-sm text-slate-500`}>
        No scenarios saved yet. Go to Scenario Inputs -&gt; 2.3 Implementation Costs and click Save &amp; Simulate.
      </div>
    );
  }

  // One line per (series x scenario) combination, matching the original app.
  const lineKey = (label: string, scenarioName: string) =>
    selectedIds.length > 1 ? `${label} (${scenarioName})` : label;

  const chartData = (seriesKeys: Array<{ key: string; label: string }>) => {
    const rows: Record<string, number | string>[] = [];
    const maxLen = Math.max(0, ...selectedIds.map((id) => loaded[id]?.rows.length ?? 0));
    for (let i = 0; i < maxLen; i++) {
      const point: Record<string, number | string> = {
        day: loaded[selectedIds[0]]?.rows[i]?.Day ?? i * 30,
      };
      selectedIds.forEach((id) => {
        const scenario = loaded[id];
        const row = scenario?.rows[i];
        if (!row) return;
        seriesKeys.forEach(({ key, label }) => {
          point[lineKey(label, scenario.name)] = Number(row[key] ?? 0);
        });
      });
      rows.push(point);
    }
    return rows;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={`${sectionCard} p-4 sm:p-5`}>
        <h3 className={`${sectionTitle} mb-3`}>Scenarios</h3>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50/65 px-3 py-1.5 text-sm text-slate-700 transition hover:border-stone-300 hover:bg-white/90">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                checked={selectedIds.includes(s.id)}
                onChange={() =>
                  setSelectedIds((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                  )
                }
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {CHART_GROUPS.map((group) => {
          const data = chartData(group.series);
          const allLineKeys = selectedIds.flatMap((id) => {
            const scenario = loaded[id];
            return scenario ? group.series.map(({ label }) => lineKey(label, scenario.name)) : [];
          });
          const values = data.flatMap((row) => allLineKeys.map((k) => Number(row[k] ?? 0)));
          const yMin = values.length ? Math.min(...values, 0) : 0;
          const yMax = values.length ? Math.max(...values) : 1;
          const { domain: yDomain, ticks: yTicks } = niceTicks(yMin, yMax);
          const maxDay = Math.max(0, ...data.map((row) => Number(row.day ?? 0)));
          const xTicks = DAY_TICKS.filter((t) => t <= maxDay + 1);

          return (
          <div key={group.title} className={`${sectionCard} p-4 sm:p-5`}>
            <h3 className="mb-3 text-base font-semibold text-[#0D47A1]">{group.title}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data} style={{ fontFamily: 'Inter, sans-serif' }}>
                <CartesianGrid stroke="#E0E6ED" />
                <XAxis
                  dataKey="day"
                  type="number"
                  domain={[0, xTicks[xTicks.length - 1] ?? maxDay]}
                  ticks={xTicks}
                  label={{ value: 'Days', position: 'insideBottom', offset: -5, style: { fill: '#1A1A2E', fontSize: 13 } }}
                  tick={{ fill: '#1A1A2E', fontSize: 12 }}
                  axisLine={{ stroke: '#B0BEC5' }}
                  tickLine={{ stroke: '#B0BEC5' }}
                />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  label={{ value: group.yLabel, angle: -90, position: 'insideLeft', style: { fill: '#1A1A2E', fontSize: 13, textAnchor: 'middle' } }}
                  tick={{ fill: '#1A1A2E', fontSize: 12 }}
                  axisLine={{ stroke: '#B0BEC5' }}
                  tickLine={{ stroke: '#B0BEC5' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D47A1', border: 'none', borderRadius: 6, fontFamily: 'Inter, sans-serif', fontSize: 13 }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: 'white' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter, sans-serif' }} />
                {selectedIds.flatMap((id, scenarioIdx) => {
                  const scenario = loaded[id];
                  if (!scenario) return [];
                  return group.series.map(({ label }, seriesIdx) => (
                    <Line
                      key={`${id}-${label}`}
                      type="monotone"
                      dataKey={lineKey(label, scenario.name)}
                      stroke={COLORS[(scenarioIdx + seriesIdx) % COLORS.length]}
                      strokeWidth={2}
                      strokeDasharray={scenarioIdx === 0 ? undefined : '4 3'}
                      dot={false}
                    />
                  ));
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          );
        })}
      </div>

      <div className={`${sectionCard} p-4 sm:p-5`}>
        <h3 className={`${sectionTitle} mb-3`}>Summary metrics (end of simulation)</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {selectedIds.map((id) => {
            const s = loaded[id];
            if (!s) return null;
            const last = s.rows[s.rows.length - 1] ?? {};
            return (
              <div key={id} className={innerCard}>
                <p className="mb-2 text-sm font-semibold text-slate-800">{s.name}</p>
                <p className={smallLabel}>Treatment %: <span className="font-mono text-sm normal-case tracking-normal text-slate-700">{s.treatment_pct.toFixed(1)}%</span></p>
                <p className={`${smallLabel} mt-1`}>Untreated load: <span className="font-mono text-sm normal-case tracking-normal text-slate-700">{s.untreated.toFixed(1)} MLD</span></p>
                <p className={`${smallLabel} mt-1`}>Cumul. O&amp;M (Cr.): <span className="font-mono text-sm normal-case tracking-normal text-slate-700">Rs.{Number(last['OM Cost (Cr)'] ?? 0).toFixed(1)}</span></p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
