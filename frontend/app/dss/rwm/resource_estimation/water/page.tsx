"use client";
import React, { useState } from "react";

// Types
type ViewType = "admin" | "user";

interface ModernSwitchProps {
  leftLabel: string;
  rightLabel: string;
  value: ViewType;
  onChange: (value: ViewType) => void;
}

import PriorityAdmin from "./admin/page";
import PriorityDrain from "./users/page";



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
          className={`absolute top-1 left-1 w-8 h-8  rounded-full shadow-lg transition-all duration-300 ease-in-out transform ${
            value === "user" ? "translate-x-10 bg-green-500" : "bg-blue-500"
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
        className={`text-xl font-medium transition-colors ${
          value === "user" ? "text-green-600" : "text-gray-500"
        }`}
      >
        {rightLabel}
      </span>
    </div>
  );
};

const PriorityPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");
  const [showInfo, setShowInfo] = useState(false);

  const handleViewChange = (newView: ViewType): void => {
    setActiveView(newView);
  };

  return (
    <div className=" flex flex-col max-h-screen">
      <header className=" grid grid-cols-2 w-full bg-gradient-to-r from-blue-500 to-blue-200 text-white py-4 shadow-lg">
        <div className="container mx-auto px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-bold">Water Availability</h1>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowInfo((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white shadow-md transition hover:bg-white/25 cursor-pointer"
                title="Product Type Information"
                aria-label="Product Type Information"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </button>

              {showInfo && (
                <div className="absolute left-0 top-14 z-50 w-[420px] rounded-2xl border border-blue-100 bg-white p-5 text-gray-800 shadow-2xl">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-blue-700">Product Type</h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Shows the output layer selected from the water availability
                        module. The report defines 4 primary products: Water Budget,
                        Surplus, Deficit, and Index Class.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInfo(false)}
                      className="rounded-full p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500 cursor-pointer"
                      aria-label="Close product type information"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-3 text-sm leading-6">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <h3 className="font-semibold text-blue-700">Water Budget</h3>
                      <p className="mt-1 text-gray-700">
                        Represents the daily water balance computed from
                        precipitation minus evapotranspiration minus runoff. Unit
                        is MLD (Million Liters per Day). In the report, this is the
                        main quantitative output for water availability.
                      </p>
                    </div>

                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <h3 className="font-semibold text-red-700">Deficit</h3>
                      <p className="mt-1 text-gray-700">
                        Shows areas with negative water balance, meaning water
                        stress / shortage. It is provided as a binary mask.
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <h3 className="font-semibold text-emerald-700">Surplus</h3>
                      <p className="mt-1 text-gray-700">
                        Shows areas with positive water balance, meaning water
                        availability / excess water. It is also provided as a
                        binary mask.
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                      <h3 className="font-semibold text-amber-700">Index</h3>
                      <p className="mt-1 text-gray-700">
                        This is the SWCI (Soil Water Content Index) based
                        classification layer. It standardizes daily water balance
                        using a z-score and groups conditions into classes from dry
                        to surplus. The report uses 10 classes, from Extremely Dry
                        to Extreme Surplus.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-center w-full items-center font-medium ">
          <ModernSwitch
            leftLabel="Admin"
            rightLabel="Basin"
            value={activeView}  
            onChange={handleViewChange}
          />
        </div>
      </header>

      <div className="transition-all duration-500 ease-in-out">
        {activeView === "admin" && <PriorityAdmin />}
        {activeView === "user" && <PriorityDrain />}
      </div>
    </div>
  );
};

export default PriorityPage;
