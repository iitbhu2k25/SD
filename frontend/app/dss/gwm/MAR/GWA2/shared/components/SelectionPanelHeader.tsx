'use client';

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";

interface SelectionPanelHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onReset: () => void;
}

export default function SelectionPanelHeader({
  icon,
  title,
  subtitle,
  onReset,
}: SelectionPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-red-500"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </button>
    </div>
  );
}
