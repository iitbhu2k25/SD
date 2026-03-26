"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import RiverWaterManagementAdmin from "./admin/page";
import RiverWaterManagementDrain from "./drain/page";
import GeneralRiverWaterManagement from "./general/page";
import RiverInfoModal from "./components/RiverInfoModal";

type ViewType = "admin" | "user";
type BasinType = "varuna" | "general" | null;

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

const LandingRiverVisual: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_#ddecfb_0%,_#edf6fd_24%,_#f7fbff_56%,_#ffffff_100%)]" />
      <div className="absolute inset-x-0 top-0 h-[56vh] bg-[radial-gradient(circle_at_20%_15%,_rgba(125,211,252,0.3),_transparent_30%),radial-gradient(circle_at_82%_18%,_rgba(59,130,246,0.18),_transparent_26%),linear-gradient(180deg,_rgba(191,219,254,0.45)_0%,_rgba(255,255,255,0)_100%)]" />

      <div className="absolute left-[6%] top-[18%] h-72 w-72 rounded-full bg-cyan-100/55 blur-3xl" />
      <div className="absolute right-[10%] top-[12%] h-80 w-80 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="absolute bottom-[18%] left-[22%] h-64 w-64 rounded-full bg-blue-100/50 blur-3xl" />

      <div className="absolute inset-x-[5%] top-[14%] hidden h-[54vh] rounded-[3rem] border border-white/50 bg-white/18 shadow-[0_28px_90px_rgba(20,89,143,0.12)] backdrop-blur-[2px] lg:block" />

      <svg
        className="absolute inset-0 h-full w-full opacity-95"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M-120 92C94 34 304 57 515 148C690 224 867 282 1047 254C1216 228 1331 175 1548 213V-20H-120Z"
          fill="rgba(255,255,255,0.42)"
        />
        <path
          d="M-140 288C66 216 249 214 428 290C623 372 804 442 1000 410C1176 382 1307 289 1538 324V946H-140Z"
          fill="rgba(255,255,255,0.52)"
        />
        <path
          d="M-120 170C77 84 253 108 433 183C615 260 797 311 992 281C1166 255 1300 159 1548 215"
          fill="none"
          stroke="rgba(34,91,142,0.12)"
          strokeWidth="104"
          strokeLinecap="round"
        />
        <path
          d="M-112 176C86 98 258 122 435 194C621 270 802 322 997 293C1172 267 1309 173 1555 228"
          fill="none"
          stroke="rgba(103,194,230,0.24)"
          strokeWidth="58"
          strokeLinecap="round"
        />
        <path
          d="M-106 182C92 106 262 129 438 201C625 276 807 330 1001 302C1177 276 1315 182 1560 238"
          fill="none"
          stroke="rgba(204,244,255,0.95)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray="28 26"
          className="river-flow river-flow-slow"
        />
        <path
          d="M-94 182C99 114 267 138 441 208C627 282 811 339 1005 311C1179 286 1321 191 1564 247"
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="8 24"
          className="river-flow river-flow-fast"
        />
      </svg>
    </div>
  );
};

const RiverWaterManagementPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");
  const [selectedBasin, setSelectedBasin] = useState<BasinType>(null);
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
            {selectedBasin === "varuna" && (
              <button
                type="button"
                onClick={() => setIsInfoModalOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:shadow-md"
                aria-label="Open river module information"
                title="Module information"
              >
                <Info size={16} />
              </button>
            )}
          </div>
        </div>
        {selectedBasin === "varuna" && (
          <div className="flex w-full items-center justify-center font-medium">
            <ModernSwitch
              leftLabel="Admin"
              rightLabel="Stretch"
              value={activeView}
              onChange={handleViewChange}
            />
          </div>
        )}
      </header>

      <main className="relative flex-1 transition-all duration-500 ease-in-out">
        {selectedBasin === null && (
          <div className="absolute inset-0 overflow-hidden">
            <LandingRiverVisual />

            <div className="relative z-10 flex min-h-full items-center justify-center px-6 py-8 sm:px-10">
              <div className="w-full max-w-4xl">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
                    River Water Quality Assessment Workspace
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                    Select a basin to continue to the appropriate workflow.
                  </p>
                </div>

                <div className="mx-auto mt-8 w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white/60 p-4 shadow-[0_24px_80px_rgba(15,76,129,0.14)] backdrop-blur-xl sm:p-5">
                  <div className="relative mb-5 h-36 overflow-hidden rounded-[1.5rem] border border-white/60 bg-[linear-gradient(180deg,_rgba(223,242,252,0.9)_0%,_rgba(239,246,255,0.85)_100%)] sm:h-40">
                    <div className="absolute inset-x-[-10%] top-6 h-16 rounded-[999px] bg-sky-100/70 blur-2xl" />
                    <div className="absolute inset-x-[-10%] bottom-4 h-16 rounded-[999px] bg-cyan-100/60 blur-2xl" />
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 900 240"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M-50 122C73 82 195 86 314 126C425 163 531 214 644 202C739 192 819 145 952 165"
                        fill="none"
                        stroke="rgba(23,84,136,0.12)"
                        strokeWidth="56"
                        strokeLinecap="round"
                      />
                      <path
                        d="M-42 126C78 90 198 94 316 132C428 169 534 220 646 209C742 199 822 152 958 171"
                        fill="none"
                        stroke="rgba(56,189,248,0.22)"
                        strokeWidth="26"
                        strokeLinecap="round"
                      />
                      <path
                        d="M-36 130C82 97 202 101 319 137C431 173 538 225 649 214C746 205 827 158 963 177"
                        fill="none"
                        stroke="rgba(248,252,255,0.98)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="18 14"
                        className="river-flow river-flow-slow"
                      />
                    </svg>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      onClick={() => setSelectedBasin("varuna")}
                      className="group w-full cursor-pointer overflow-hidden rounded-[1.4rem] border border-sky-200/80 bg-[linear-gradient(135deg,_rgba(9,76,130,0.96)_0%,_rgba(29,120,187,0.92)_60%,_rgba(111,204,232,0.88)_100%)] px-5 py-5 text-left text-white shadow-[0_16px_34px_rgba(23,84,136,0.2)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(23,84,136,0.24)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold">Varuna Basin</p>
                          <p className="mt-2 text-sm leading-6 text-blue-50/90">
                            Dedicated river assessment workflow.
                          </p>
                        </div>
                        <span className="text-xl text-white/80 transition-transform duration-300 group-hover:translate-x-1">
                          {"->"}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedBasin("general");
                        setIsInfoModalOpen(false);
                      }}
                      className="group w-full cursor-pointer overflow-hidden rounded-[1.4rem] border border-cyan-200/80 bg-[linear-gradient(135deg,_rgba(7,104,117,0.94)_0%,_rgba(18,145,158,0.9)_54%,_rgba(126,227,214,0.86)_100%)] px-5 py-5 text-left text-white shadow-[0_16px_34px_rgba(8,117,128,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(8,117,128,0.22)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold">Other Basins</p>
                          <p className="mt-2 text-sm leading-6 text-cyan-50/90">
                            Flexible workflow for other river systems.
                          </p>
                        </div>
                        <span className="text-xl text-white/80 transition-transform duration-300 group-hover:translate-x-1">
                          {"->"}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedBasin === "varuna" && (
          <>
            {activeView === "admin" && <RiverWaterManagementAdmin />}
            {activeView === "user" && <RiverWaterManagementDrain />}
          </>
        )}

        {selectedBasin === "general" && <GeneralRiverWaterManagement />}
      </main>

      <RiverInfoModal
        isOpen={selectedBasin === "varuna" && isInfoModalOpen}
        mode={activeView}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <style jsx>{`
        .river-flow {
          animation: riverDrift 9s linear infinite;
        }

        .river-flow-slow {
          animation-duration: 12s;
        }

        .river-flow-fast {
          animation-duration: 6s;
        }

        @keyframes riverDrift {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -240;
          }
        }
      `}</style>
    </div>
  );
};

export default RiverWaterManagementPage;
