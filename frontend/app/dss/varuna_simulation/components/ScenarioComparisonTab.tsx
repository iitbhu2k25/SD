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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useVarunaSimStore } from '../shared/store/varunaSim.store';
import { getScenario } from '../shared/services/varunaSim.service';
import type { ScenarioOut } from '../shared/types/varunaSim.types';
import { sectionCard, sectionTitle } from '../shared/ui/styles';
import { DAY_TICKS, niceTicks } from '../shared/ui/chartTicks';

const COLORS = ['#E4575E', '#8E63B0', '#1976D2', '#43A047', '#FB8C00', '#00ACC1'];

const COMPARISON_SECTIONS: Array<{ section: string; graphs: Array<{ title: string; yLabel: string; key: string }> }> = [
  {
    section: 'Total Sewage Discharge to River',
    graphs: [
      { title: 'Total untreated discharge (incl. overflows)', yLabel: 'MLD', key: 'Untreated Load (MLD)' },
      { title: 'Total Treated Discharge', yLabel: 'MLD', key: 'Treated Sewage Discharge to River (MLD)' },
    ],
  },
  {
    section: 'Untreated Overflows to River',
    graphs: [
      { title: 'Overflow - Tapped (Gravity) Drains', yLabel: 'MLD', key: 'Tapped Drain Overflow (Gravity) (MLD)' },
      { title: 'Overflow - Tapped (Non-Gravity) Drains', yLabel: 'MLD', key: 'Tapped Drain Overflow (Non-Gravity) (MLD)' },
      { title: 'Overflow - Pumping Stations', yLabel: 'MLD', key: 'Pumping Station Overflow (MLD)' },
      { title: 'Overflow - STPs', yLabel: 'MLD', key: 'STP Overflow (MLD)' },
    ],
  },
  {
    section: 'Decision Costs',
    graphs: [
      { title: 'Total Investment in Capacity Augmentation', yLabel: 'INR Cr', key: 'Capital Cost (Cr)' },
      { title: 'Total O&M Cost', yLabel: 'INR Cr', key: 'OM Cost (Cr)' },
    ],
  },
];

export default function ScenarioComparisonTab() {
  const scenarios = useVarunaSimStore((s) => s.scenarios);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState<Record<number, ScenarioOut>>({});

  useEffect(() => {
    if (scenarios.length >= 2 && selectedIds.length === 0) {
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

  if (scenarios.length < 2) {
    return (
      <div className={`${sectionCard} p-4 text-sm text-slate-500`}>
        Save at least 2 scenarios to compare them. Go to Scenario Inputs.
      </div>
    );
  }

  const chartData = (key: string) => {
    const maxLen = Math.max(0, ...selectedIds.map((id) => loaded[id]?.rows.length ?? 0));
    const rows: Record<string, number | string>[] = [];
    for (let i = 0; i < maxLen; i++) {
      const point: Record<string, number | string> = { day: loaded[selectedIds[0]]?.rows[i]?.Day ?? i * 30 };
      selectedIds.forEach((id) => {
        const row = loaded[id]?.rows[i];
        if (row) point[loaded[id].name] = Number(row[key] ?? 0);
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

      {COMPARISON_SECTIONS.map((section) => (
        <div key={section.section}>
          <h3 className={`${sectionTitle} mb-3`}>{section.section}</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {section.graphs.map((graph) => {
              const data = chartData(graph.key);
              const activeNames = selectedIds.map((id) => loaded[id]?.name).filter((n): n is string => !!n);
              const values = data.flatMap((row) => activeNames.map((n) => Number(row[n] ?? 0)));
              const yMin = values.length ? Math.min(...values, 0) : 0;
              const yMax = values.length ? Math.max(...values) : 1;
              const { domain: yDomain, ticks: yTicks } = niceTicks(yMin, yMax);
              const maxDay = Math.max(0, ...data.map((row) => Number(row.day ?? 0)));
              const xTicks = DAY_TICKS.filter((t) => t <= maxDay + 1);

              return (
              <div key={graph.title} className={`${sectionCard} p-4 sm:p-5`}>
                <h4 className="mb-3 text-base font-semibold text-[#0D47A1]">{graph.title}</h4>
                <ResponsiveContainer width="100%" height={280}>
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
                      label={{ value: graph.yLabel, angle: -90, position: 'insideLeft', style: { fill: '#1A1A2E', fontSize: 13, textAnchor: 'middle' } }}
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
                    {selectedIds.map((id, i) =>
                      loaded[id] ? (
                        <Line key={id} type="monotone" dataKey={loaded[id].name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                      ) : null,
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className={`${sectionCard} p-4 sm:p-5`}>
        <h3 className={`${sectionTitle} mb-3`}>Summary table</h3>
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50/80">
                <TableHead>Scenario</TableHead>
                <TableHead>Strategies</TableHead>
                <TableHead>Treatment %</TableHead>
                <TableHead>Untreated (MLD)</TableHead>
                <TableHead>Capacity deficit (MLD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-slate-800">{s.name}</TableCell>
                  <TableCell>{s.strategies.length ? s.strategies.join(', ') : 'Baseline'}</TableCell>
                  <TableCell>{s.treatment_pct.toFixed(1)}%</TableCell>
                  <TableCell>{s.untreated.toFixed(1)}</TableCell>
                  <TableCell>{s.capacity_deficit.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
