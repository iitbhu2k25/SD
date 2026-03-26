
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
      className={`absolute bottom-4 z-40 flex h-12 w-8 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white/90 text-slate-600 shadow-lg shadow-slate-300/40 backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-slate-800 sm:top-1/2 sm:h-20 sm:w-7 sm:-translate-y-1/2 sm:rounded-l-lg sm:rounded-r-none sm:border-r-0 ${
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
