'use client';

import { useState } from 'react';
import { FORECAST_YEARS } from '../../shared/utils/constants';

interface WaterSupplyFormProps {
  onSubmit: (params: Record<string, any>) => void;
  loading?: boolean;
}

export default function WaterSupplyForm({ onSubmit, loading }: WaterSupplyFormProps) {
  const [targetYear, setTargetYear] = useState(2050);
  const [surfaceRatio, setSurfaceRatio] = useState('0.6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ targetYear, surfaceRatio: Number(surfaceRatio) });
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
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        >
          {FORECAST_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          Surface Water Ratio
        </label>
        <input
          type="number"
          value={surfaceRatio}
          onChange={(e) => setSurfaceRatio(e.target.value)}
          step={0.05}
          min={0}
          max={1}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Calculating...' : 'Calculate Water Supply'}
      </button>
    </form>
  );
}