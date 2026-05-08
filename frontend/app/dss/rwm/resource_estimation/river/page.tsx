"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import RiverWaterManagementAdmin from "./admin/page";
import RiverWaterManagementDrain from "./drain/page";
import RiverInfoModal from "./components/RiverInfoModal";

type ViewType = "admin" | "user";

interface ModernSwitchProps {
  leftLabel: string;
  rightLabel: string;
  value: ViewType;
  onChange: (value: ViewType) => void;
}

const ModernSwitch: React.FC<ModernSwitchProps> = ({
  leftLabel,
  rightLabel,
  value,
  onChange,
}) => {
  const handleToggle = (): void => {
    onChange(value === "admin" ? "user" : "admin");
  };

  return (
    <div className="flex items-center space-x-4">
      <span
        className={`text-xl font-medium transition-colors ${
          value === "admin" ? "text-blue-600" : "text-gray-500"
        }`}
      >
        {leftLabel}
      </span>

      <div
        className="relative h-10 w-20 cursor-pointer rounded-full bg-gray-200 transition-all duration-300 hover:bg-gray-300"
        onClick={handleToggle}
        role="switch"
        aria-checked={value === "user"}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div
          className={`absolute left-1 top-1 h-8 w-8 transform rounded-full shadow-lg transition-all duration-300 ease-in-out ${
            value === "user" ? "translate-x-10 bg-green-500" : "bg-blue-500"
          }`}
        >
          <div className="flex h-full w-full items-center justify-center">
            {value === "admin" ? (
              <svg
                className="h-4 w-4 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      <span
        className={`text-xl font-medium transition-colors ${
          value === "user" ? "text-green-600" : "text-gray-500"
        }`}
      >
        {rightLabel}
      </span>
    </div>
  );
};

const RiverWaterManagementPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const handleViewChange = (newView: ViewType): void => {
    setActiveView(newView);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="grid w-full grid-cols-1 gap-3 bg-gradient-to-r from-blue-500 to-blue-200 py-4 text-white shadow-lg lg:grid-cols-2">
        <div className="container mx-auto px-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold">
              River Water Quality Assessment
            </h1>
            <button
              type="button"
              onClick={() => setIsInfoModalOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:shadow-md"
              aria-label="Open river module information"
              title="Module information"
            >
              <Info size={16} />
            </button>
          </div>
        </div>
        <div className="flex w-full items-center justify-center font-medium">
          <ModernSwitch
            leftLabel="Admin"
            rightLabel="Drain"
            value={activeView}
            onChange={handleViewChange}
          />
        </div>
      </header>

      <main className="relative flex-1 transition-all duration-500 ease-in-out">
        {activeView === "admin" && <RiverWaterManagementAdmin />}
        {activeView === "user" && <RiverWaterManagementDrain />}
      </main>

      <RiverInfoModal
        isOpen={isInfoModalOpen}
        mode={activeView}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
};

export default RiverWaterManagementPage;
