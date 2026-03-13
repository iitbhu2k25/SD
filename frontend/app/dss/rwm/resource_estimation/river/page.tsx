"use client";

import React, { useState } from "react";

// Types remain the same
type ViewType = "admin" | "user";
type BasinType = "varuna" | "general" | null;

interface ModernSwitchProps {
  leftLabel: string;
  rightLabel: string;
  value: ViewType;
  onChange: (value: ViewType) => void;
}

// Import corresponding river water management components
import RiverWaterManagementAdmin from "./admin/page"; // update relative path if different
import RiverWaterManagementDrain from "./drain/page";
import GeneralRiverWaterManagement from "./general/page";

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
        className={`text-xl font-medium transition-colors ${value === "admin" ? "text-blue-600" : "text-gray-500"
          }`}
      >
        {leftLabel}
      </span>

      <div
        className="relative w-20 h-10 bg-gray-200 rounded-full cursor-pointer transition-all duration-300 hover:bg-gray-300"
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
          className={`absolute top-1 left-1 w-8 h-8 rounded-full shadow-lg transition-all duration-300 ease-in-out transform ${value === "user" ? "translate-x-10 bg-green-500" : "bg-blue-500"
            }`}
        >
          <div className="flex items-center justify-center w-full h-full">
            {value === "admin" ? (
              <svg
                className="w-4 h-4 text-white"
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
                className="w-4 h-4 text-white"
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
        className={`text-xl font-medium transition-colors ${value === "user" ? "text-green-600" : "text-gray-500"
          }`}
      >
        {rightLabel}
      </span>
    </div>
  );
};

const RiverWaterManagementPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");
  const [selectedBasin, setSelectedBasin] = useState<BasinType>(null);

  const handleViewChange = (newView: ViewType): void => {
    setActiveView(newView);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="grid grid-cols-2 w-full bg-gradient-to-r from-blue-500 to-blue-200 text-white py-4 shadow-lg">
        <div className="container mx-auto px-8">
          <h1 className="text-4xl font-bold">River Water Quality Assessment</h1>
        </div>
        {selectedBasin === "varuna" && (
          <div className="flex justify-center w-full items-center font-medium">
            <ModernSwitch
              leftLabel="Admin"
              rightLabel="Stretch"
              value={activeView}
              onChange={setActiveView}
            />
          </div>
        )}
      </header>

      <main className="flex-1 relative transition-all duration-500 ease-in-out">
        {/* 1️⃣ BASIN QUESTION */}
        {selectedBasin === null && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center space-y-8">
              <h2 className="text-2xl font-semibold text-gray-800 text-center">
                What do you want to work on?
              </h2>

              <div className="flex justify-center gap-6">
                <button
                  onClick={() => setSelectedBasin("varuna")}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition cursor-pointer"
                >
                  Varuna Basin
                </button>

                <button
                  onClick={() => setSelectedBasin("general")}
                  className="px-8 py-4 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition cursor-pointer"
                >
                  Other Basins
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2️⃣ VARUNA FLOW */}
        {selectedBasin === "varuna" && (
          <>
            {activeView === "admin" && <RiverWaterManagementAdmin />}
            {activeView === "user" && <RiverWaterManagementDrain />}
          </>
        )}

        {/* 3️⃣ GENERAL FLOW */}
        {selectedBasin === "general" && <GeneralRiverWaterManagement />}
      </main>
    </div>
  );
};

export default RiverWaterManagementPage;
