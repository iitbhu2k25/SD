"use client";
import { DRAIN_LAYER_NAMES } from "@/interface/raster_context"
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
  DRAIN_LAYER_NAMES.CATCHMENT = null
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
          className={`absolute top-1 left-1 w-8 h-8  rounded-full shadow-lg transition-all duration-300 ease-in-out transform ${value === "user" ? "translate-x-10 bg-green-500" : "bg-blue-500"
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

const PriorityPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");
  const [showInfo, setShowInfo] = useState<boolean>(false);

  const handleViewChange = (newView: ViewType): void => {
    setActiveView(newView);
  };

  return (
    <div className="flex flex-col">
      <header className="grid grid-cols-2 w-full bg-gradient-to-r from-blue-500 to-blue-200 text-white py-6 shadow-lg relative">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold">STP Site Priority {/* Info Icon */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="relative p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Information"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </button></h1>

        </div>
        <div className="flex justify-center w-full items-center font-medium gap-4">
          <ModernSwitch
            leftLabel="Admin"
            rightLabel="Drain"
            value={activeView}
            onChange={handleViewChange}
          />


        </div>

        {/* Info Modal */}
        {showInfo && (
          <>
            {/* Backdrop with animation */}
            <div
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fadeIn"
              onClick={() => setShowInfo(false)}
            />

            {/* Modal Content */}
           <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-2xl z-500 max-w-4xl w-[90vw] mx-auto
 animate-slideIn border border-slate-200 mt-16">
              {/* Header with industrial accent */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">STP Priority System</h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* Image with enhanced styling */}
                <div className="mb-6 rounded-xl overflow-hidden shadow-lg border-4 border-white bg-white">
                  <img
                    src="/Images/modules/image_25.png"
                    alt="STP Priority Information"
                    className="w-full h-auto"
                  />
                </div>

                {/* Content with industrial styling */}
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg mt-0.5">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                        </svg>
                      </div>
                      <div className="flex-1">

                        <p className="text-sm text-gray-600 leading-relaxed">
                          STP Priority module is intended to identify the sewage priority risk hot-spot areas.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 p-2 rounded-lg mt-0.5">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">

                        <p className="text-sm text-gray-600 leading-relaxed">
                          In this module several GIS-based layers related to sewerage, demography, land-use and groundwater are used for the identification of sewage priority risk areas.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg mt-0.5">
                        <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">Quick Toggle Navigation</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          Final output related to the sewage risk could be generated in the pdf format.

                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer badge */}
                <div className="mt-6 flex justify-center">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-2 rounded-full border border-blue-200">
                    <button
                      onClick={() => {
                        window.open("/dss/home/home_grid/home_card/basic_module", "_blank", "noopener,noreferrer");
                      }}
                      className="text-xs text-blue-700 font-medium"
                    >
                      Learn more about STP Priority
                    </button>


                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <div className="transition-all duration-500 ease-in-out">
        {activeView === "admin" && <PriorityAdmin />}
        {activeView === "user" && <PriorityDrain />}
      </div>
    </div>
  );
};

export default PriorityPage;