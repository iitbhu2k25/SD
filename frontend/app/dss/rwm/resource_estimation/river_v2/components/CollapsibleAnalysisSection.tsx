"use client";

import React, { ReactNode, useState } from "react";

interface CollapsibleAnalysisSectionProps {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  isDark?: boolean;
  defaultMinimized?: boolean;
  accentClassName?: string;
  badgeClassName?: string;
}

export default function CollapsibleAnalysisSection({
  title,
  description,
  badge,
  children,
  isDark = false,
  defaultMinimized = true,
  accentClassName = "border-l-cyan-400",
  badgeClassName = "bg-amber-100 text-amber-700",
}: CollapsibleAnalysisSectionProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);

  return (
    <section
      className={`rounded-3xl border transition-all ${
        isDark ? "border-[#1e3a5f]/50 bg-[#0d1629]/80" : "border-stone-200 bg-white/72"
      } ${isMinimized ? "p-2.5 sm:p-3" : "p-3 sm:p-4"}`}
    >
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`flex min-w-0 items-center gap-2 border-l-2 ${accentClassName} pl-2`}>
            <h3
              className={`truncate text-xs font-semibold sm:text-sm ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              {title}
            </h3>
            {badge && (
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeClassName}`}>
                {badge}
              </span>
            )}
          </div>
          {description && !isMinimized && (
            <p className={`mt-1 text-[11px] sm:text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
              {description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized((current) => !current)}
          className={`inline-flex cursor-pointer items-center justify-center rounded-full border p-1.5 shadow-sm transition ${
            isMinimized
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
          }`}
          title={isMinimized ? `Expand ${title}` : `Minimize ${title}`}
          aria-label={isMinimized ? `Expand ${title}` : `Minimize ${title}`}
        >
          <svg
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d={isMinimized ? "M5 10l7 7 7-7" : "M19 14l-7-7-7 7"}
            />
          </svg>
        </button>
      </div>

      {!isMinimized && <div className="mt-3">{children}</div>}
    </section>
  );
}
