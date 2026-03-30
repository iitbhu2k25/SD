"use client";

// This file shows the floating arrow button for opening and closing the right panel.
interface AdminRightPanelToggleProps {
  isOpen: boolean;
  openOffsetClass: string;
  onToggle: () => void;
}

export default function AdminRightPanelToggle({
  isOpen,
  openOffsetClass,
  onToggle,
}: AdminRightPanelToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-1/2 -translate-y-1/2 z-40 h-20 w-7 rounded-l-lg border border-r-0 border-slate-700 bg-[#1f2937]/95 text-white flex items-center justify-center shadow-xl hover:bg-slate-700 transition-all duration-300 ${
        isOpen ? openOffsetClass : "right-0"
      }`}
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
