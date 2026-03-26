"use client";

interface RightPanelToggleProps {
  isOpen: boolean;
  openOffset: string;
  onToggle: () => void;
}

export default function RightPanelToggle({
  isOpen,
  openOffset,
  onToggle,
}: RightPanelToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-1/2 z-40 flex h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-stone-200 bg-white/85 text-slate-600 shadow-lg shadow-slate-300/40 backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-slate-800 sm:h-20 sm:w-7 ${
        isOpen ? "" : "right-0"
      }`}
      style={isOpen ? { right: openOffset } : undefined}
      title={isOpen ? "Hide analysis panel" : "Show analysis panel"}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {isOpen ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        )}
      </svg>
    </button>
  );
}
