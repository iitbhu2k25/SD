"use client";

interface LeftPanelToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  isDark?: boolean;
}

export default function LeftPanelToggle({
  isOpen,
  onToggle,
  isDark = false,
}: LeftPanelToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`absolute left-full top-1/2 z-50 flex h-14 w-8 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 backdrop-blur-sm transition-all duration-300 sm:h-20 sm:w-7 ${
        isDark
          ? "border-[#1e3a5f]/60 bg-[#081224]/88 text-slate-300 shadow-lg shadow-[#020610]/65 hover:bg-[#0b1a31] hover:text-cyan-200"
          : "border-stone-200 bg-white/85 text-slate-600 shadow-lg shadow-slate-300/40 hover:bg-white hover:text-slate-800"
      }`}
      title={isOpen ? "Hide filters panel" : "Show filters panel"}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {isOpen ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        )}
      </svg>
    </button>
  );
}
