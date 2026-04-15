"use client";
import { DRAIN_LAYER_NAMES } from "@/interface/raster_context";
import React, { useState } from "react";
import PriorityAdmin from "./admin/page";
import PriorityDrain from "./users/page";

type ViewType = "admin" | "user";

interface ModernSwitchProps {
  leftLabel: string;
  rightLabel: string;
  value: ViewType;
  onChange: (value: ViewType) => void;
}

const ModernSwitch: React.FC<ModernSwitchProps> = ({ leftLabel, rightLabel, value, onChange }) => {
  DRAIN_LAYER_NAMES.CATCHMENT = null;
  const handleToggle = () => onChange(value === "admin" ? "user" : "admin");

  return (
    <div className="flex items-center space-x-4">
      <span className={`text-sm font-medium transition-colors ${value === "admin" ? "text-white" : "text-slate-400"}`}>
        {leftLabel}
      </span>
      <div
        className="relative w-20 h-10 bg-slate-700 rounded-full cursor-pointer transition-all duration-300 hover:bg-slate-600"
        onClick={handleToggle}
        role="switch"
        aria-checked={value === "user"}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle(); }
        }}
      >
        <div className={`absolute top-1 left-1 w-8 h-8 rounded-full shadow-lg transition-all duration-300 ease-in-out transform ${
          value === "user" ? "translate-x-10 bg-emerald-500" : "bg-blue-500"
        }`}>
          <div className="flex items-center justify-center w-full h-full">
            {value === "admin" ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </div>
      <span className={`text-sm font-medium transition-colors ${value === "user" ? "text-emerald-400" : "text-slate-400"}`}>
        {rightLabel}
      </span>
    </div>
  );
};

const PriorityPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");

  return (
    <div className="flex flex-col h-[800px] overflow-hidden bg-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between bg-slate-900 px-6 shrink-0" style={{ height: "56px" }}>
        <div className="flex items-center gap-3">
          {/* GIS icon */}
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
  Water Quality Assessment
</h1>
           
          </div>
        </div>

        <ModernSwitch leftLabel="Admin" rightLabel="Drain" value={activeView} onChange={setActiveView} />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === "admin" && <PriorityAdmin />}
        {activeView === "user" && <PriorityDrain />}
      </div>
    </div>
  );
};

export default PriorityPage;
