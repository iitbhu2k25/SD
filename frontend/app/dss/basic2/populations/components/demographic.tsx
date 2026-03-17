'use client';

import type { PopulationResult } from '../../shared/types/result.types';
import { formatPopulation } from '../../shared/utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DemographicProps {
  data: PopulationResult[];
}

export default function Demographic({ data }: DemographicProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    year: d.year,
    urban: d.urban,
    rural: d.rural,
  }));

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">Urban vs Rural Split</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => formatPopulation(v)} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v: number) => [formatPopulation(v), '']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="urban" fill="#10b981" name="Urban" radius={[3, 3, 0, 0]} />
          <Bar dataKey="rural" fill="#f59e0b" name="Rural" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}