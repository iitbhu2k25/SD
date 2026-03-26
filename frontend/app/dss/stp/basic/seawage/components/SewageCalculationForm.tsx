'use client';

import { useState } from 'react';
import { FORECAST_YEARS } from '../../shared/utils/constants';

interface SewageFormProps {
  onSubmit: (params: Record<string, any>) => void;
  loading?: boolean;
}

export default function SewageCalculationForm({ onSubmit, loading }: SewageFormProps) {
  const [targetYear, setTargetYear] = useState(2050);
  const [sewageFactor, setSewageFactor] = useState('0.8');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ targetYear, sewageFactor: Number(sewageFactor) });
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
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        >
          {FORECAST_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          Sewage Generation Factor (fraction of water supply)
        </label>
        <input
          type="number"
          value={sewageFactor}
          onChange={(e) => setSewageFactor(e.target.value)}
          step={0.05}
          min={0.5}
          max={1}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Calculating...' : 'Calculate Sewage'}
      </button>
    </form>
  );
}