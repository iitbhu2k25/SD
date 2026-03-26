/// file: frontend/app/dss/basic2/components/BasicModuleInfo.tsx
'use client';

import Link from 'next/link';
import { useBasicStore } from '../shared/store/basic.store';
import { Users, Droplets, Waves, FlaskConical, Lock } from 'lucide-react';

const MODULES = [
  {
    href: 'populations',
    label: 'Population',
    description: 'Forecast population growth using various methods',
    icon: <Users size={20} />,
    color: 'blue',
  },
  {
    href: 'water_demand',
    label: 'Water Demand',
    description: 'Estimate domestic, industrial & agricultural demand',
    icon: <Droplets size={20} />,
    color: 'cyan',
  },
  {
    href: 'water_supply',
    label: 'Water Supply',
    description: 'Analyse surface and groundwater supply capacity',
    icon: <Waves size={20} />,
    color: 'teal',
  },
  {
    href: 'seawage',
    label: 'Sewage',
    description: 'Calculate sewage generation and treatment needs',
    icon: <FlaskConical size={20} />,
    color: 'violet',
  },
];

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-100',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:border-cyan-400 hover:bg-cyan-100',
  teal: 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-400 hover:bg-teal-100',
  violet: 'bg-violet-50 border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-100',
};

export default function BasicModuleInfo() {
  const { confirmedLocation } = useBasicStore();
  const locked = !confirmedLocation;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Analysis Modules</h2>
        {locked && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <Lock size={11} /> Confirm location to unlock
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MODULES.map((mod) => {
          const classes = COLOR_MAP[mod.color];
          if (locked) {
            return (
              <div
                key={mod.href}
                className="relative flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed select-none"
              >
                <div className="shrink-0 text-slate-300">{mod.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-400">{mod.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mod.description}</p>
                </div>
                <Lock size={12} className="absolute top-3 right-3 text-slate-300" />
              </div>
            );
          }
          return (
            <Link
              key={mod.href}
              href={`/dss/basic2/${mod.href}`}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 ${classes}`}
            >
              <div className="shrink-0">{mod.icon}</div>
              <div>
                <p className="text-sm font-semibold">{mod.label}</p>
                <p className="text-xs mt-0.5 opacity-75">{mod.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}