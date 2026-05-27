"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapseToggleProps {
  isCollapsed: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
  contentPosition?: "below" | "above";
  isDark?: boolean;
  className?: string;
}

export default function CollapseToggle({
  isCollapsed,
  onToggle,
  expandLabel = "Expand",
  collapseLabel = "Minimize",
  contentPosition = "below",
  isDark = false,
  className = "",
}: CollapseToggleProps) {
  const label = isCollapsed ? expandLabel : collapseLabel;
  const Icon =
    contentPosition === "below"
      ? isCollapsed
        ? ChevronDown
        : ChevronUp
      : isCollapsed
        ? ChevronUp
        : ChevronDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border shadow-sm transition ${
        isDark
          ? "border-[#1e3a5f]/60 bg-[#081224]/88 text-slate-300 hover:bg-[#0b1a31] hover:text-cyan-200"
          : "border-stone-200 bg-white/85 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
      } ${className}`}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
