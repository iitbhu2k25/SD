"use client";

import CloseIcon from "@/components/dss_common/CloseIcon";

interface MapLegendOverlayProps {
  legendUrl: string | null;
  showLegend: boolean;
  hasActiveRaster: boolean;
  onShowLegend: () => void;
  onHideLegend: () => void;
  title?: string;
}

function LegendGlyph({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="2" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="1" y="9" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="8" y="2" width="7" height="2" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="8" y="6" width="5" height="2" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="8" y="9" width="7" height="2" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="8" y="13" width="5" height="2" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export default function MapLegendOverlay({
  legendUrl,
  showLegend,
  hasActiveRaster,
  onShowLegend,
  onHideLegend,
  title = "Legend",
}: MapLegendOverlayProps) {
  if (!legendUrl || !hasActiveRaster) {
    return null;
  }

  if (!showLegend) {
    return (
      <button
        onClick={onShowLegend}
        className="absolute bottom-2 right-10 z-[9] inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200/60 bg-white/92 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-700 shadow-md shadow-indigo-100/50 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/60 hover:bg-indigo-50/90 hover:shadow-lg hover:shadow-indigo-200/50"
        title={`Show ${title.toLowerCase()}`}
      >
        <LegendGlyph className="opacity-80" />
        {title}
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-24 right-2 z-[9] w-[150px] overflow-hidden rounded-2xl border border-indigo-100 bg-white/97 shadow-2xl shadow-indigo-100/40 backdrop-blur-md sm:bottom-10">
      <div className="flex items-center justify-between border-b border-indigo-50 bg-gradient-to-br from-indigo-50/60 to-violet-50/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <LegendGlyph className="text-indigo-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-700">
            {title}
          </span>
        </div>
        <button
          onClick={onHideLegend}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:bg-red-50 hover:text-red-500 cursor-pointer"
          title={`Close ${title.toLowerCase()}`}
        >
          <CloseIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="p-3">
        <img src={legendUrl} alt={title} className="max-h-[40vh] max-w-full rounded-md" />
      </div>
    </div>
  );
}
