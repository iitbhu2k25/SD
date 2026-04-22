"use client";

interface MapCoordinatesOverlayProps {
  targetId: string;
}

export default function MapCoordinatesOverlay({ targetId }: MapCoordinatesOverlayProps) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-20 z-30 max-w-[calc(100vw-11rem)] rounded-2xl border border-white/45 bg-white/35 px-3 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.15)] backdrop-blur-md md:left-62 sm:max-w-[calc(100vw-18rem)] sm:px-3.5">
      <div className="flex items-center gap-2">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-cyan-700/90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <div
          className="flex h-4 items-center truncate text-[11px] leading-none font-mono font-medium text-slate-700"
          id={targetId}
        />
      </div>
    </div>
  );
}
