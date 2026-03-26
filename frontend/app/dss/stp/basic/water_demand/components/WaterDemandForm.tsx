'use client';

import { useState } from 'react';
import { FORECAST_YEARS } from '../../shared/utils/constants';

interface WaterDemandFormProps {
  onSubmit: (params: Record<string, any>) => void;
  loading?: boolean;
}

export default function WaterDemandForm({ onSubmit, loading }: WaterDemandFormProps) {
  const [targetYear, setTargetYear] = useState(2050);
  const [percapitaDomestic, setPercapitaDomestic] = useState('135');
  const [industrialFactor, setIndustrialFactor] = useState('0.2');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ targetYear, percapitaDomestic: Number(percapitaDomestic), industrialFactor: Number(industrialFactor) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          Forecast Year
        </label>
        <select
          value={targetYear}
          onChange={(e) => setTargetYear(Number(e.target.value))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
        >
          {FORECAST_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          Per Capita Domestic (LPCD)
        </label>
        <input
          type="number"
          value={percapitaDomestic}
          onChange={(e) => setPercapitaDomestic(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500"
          min={50}
          max={500}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          Industrial Factor (fraction)
        </label>
        <input
          type="number"
          value={industrialFactor}
          onChange={(e) => setIndustrialFactor(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500"
          step={0.05}
          min={0}
          max={2}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Calculating...' : 'Calculate Water Demand'}
      </button>
    </form>
  );
}