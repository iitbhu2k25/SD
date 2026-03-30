"use client";

import React, { useState } from "react";

import { DRAIN_LAYER_NAMES } from "@/interface/raster_context"
type ViewType = "admin" | "user";

interface ModernSwitchProps {
  leftLabel: string;
  rightLabel: string;
  value: ViewType;
  onChange: (value: ViewType) => void;
}

import PriorityAdmin from "./admin/page";
import SuitabilityDrain from "./users/page";

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
          <h1 className="text-5xl font-bold">STP Site Suitability
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
            </button>
          </h1>
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
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fadeIn "
              onClick={() => setShowInfo(false)}
            />

            {/* Modal Wrapper (Flex Centering – Zoom Safe) */}
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 mt-40">
              {/* Modal Content */}
              <div
                className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-2xl
        w-full max-w-xl max-h-[90vh] overflow-y-auto
        animate-slideIn border border-slate-200"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-3 rounded-t-2xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">
                      STP Suitability System
                    </h3>
                  </div>

                  <button
                    onClick={() => setShowInfo(false)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-4">
                  {/* Image */}
                  <div className="mb-4 rounded-xl overflow-hidden shadow border bg-white">
                    <img
                      src="/Images/modules/image_30.png"
                      alt="STP Suitability Information"
                      className="w-full h-40 object-contain"
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-500">
                      <p className="text-sm text-gray-600">
                        STP Suitability module is intended to identify suitable locations
                        for STP construction in sewage high-priority zones.
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500">
                      <p className="text-sm text-gray-600">
                        Suitable locations are identified using GIS-based conditioning
                        layers (groundwater, land-use, hydrology, soil, etc.) and
                        constraint layers (ASI, roads, railways, flood plains) through a
                        multi-criteria decision-making model.
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-purple-500">
                      <p className="text-sm text-gray-600">
                        The model enables pin-point identification of STP locations for
                        desired capacity and selected technologies (MBR, SBR, ASP, etc.).
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-purple-500">
                      <p className="text-sm text-gray-600">
                        Final output related to sewage site suitability can be generated
                        in PDF format.
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={() =>
                        window.open(
                          "/dss/home/home_grid/home_card/basic_module",
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-full hover:bg-blue-100 transition"
                    >
                      Learn more about STP Suitability
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
        {activeView === "user" && <SuitabilityDrain />}
      </div>
    </div>
  );
};

export default PriorityPage;