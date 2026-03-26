"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, FileText, Info, Map, Waves, X } from "lucide-react";

type RiverInfoMode = "admin" | "user";

interface RiverInfoModalProps {
  isOpen: boolean;
  mode: RiverInfoMode;
  onClose: () => void;
}

type RiverInfoContent = {
  title: string;
  subtitle: string;
  summary: string;
  steps: string[];
};

const CONTENT_BY_MODE: Record<RiverInfoMode, RiverInfoContent> = {
  admin: {
    title: "Admin Workflow",
    subtitle: "Sub-district based river water quality assessment",
    summary:
      "Use this module to check river water quality for selected areas, compare seasons, view the results on the map, and generate reports.",
    steps: [
      "Select state, district, sub-district, and season.",
      "Click confirm to load the map and water quality data.",
      "Check the sampling, summary, seasonal, graph, and report sections.",
      "Use the map tools to explore the results.",
    ],
  },
  user: {
    title: "Stretch Workflow",
    subtitle: "River stretch based assessment and visualization",
    summary:
      "Use this module to study river water quality by stretch, compare seasons, view map results, and generate reports.",
    steps: [
      "Select one or more river stretches and choose a season.",
      "Click confirm to load the map and water quality data.",
      "Check the sampling, summary, seasonal, graph, and report sections.",
      "Use the map and interpolation tools to explore the results.",
    ],
  },
};

const RiverInfoModal: React.FC<RiverInfoModalProps> = ({
  isOpen,
  mode,
  onClose,
}) => {
  const [showImageFallback, setShowImageFallback] = useState(false);
  const content = CONTENT_BY_MODE[mode];

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setShowImageFallback(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="river-info-modal-title"
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
          aria-label="Close module information"
        >
          <X size={18} />
        </button>

        <div className="grid max-h-[90vh] grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_1fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-sky-700 via-cyan-700 to-emerald-700 p-6 text-white lg:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_28%)]" />

            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                <Info size={14} />
                Module Overview
              </div>

              <h2
                id="river-info-modal-title"
                className="max-w-lg text-2xl font-bold leading-tight lg:text-3xl"
              >
                River Water Quality Assessment
              </h2>
              <p className="mt-2 max-w-lg text-sm text-cyan-50/90 lg:text-base">
                {content.subtitle}
              </p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-sm">
                {!showImageFallback ? (
                  <img
                    src="/Images/RWM_WQA/WQI_Sampling_points.png"
                    alt="River water quality sampling overview"
                    className="h-[280px] w-full object-cover"
                    onError={() => setShowImageFallback(true)}
                  />
                ) : (
                  <div className="flex h-[280px] flex-col justify-between p-5">
                    <div className="flex items-center gap-3 rounded-2xl bg-white/12 p-4">
                      <div className="rounded-xl bg-white/15 p-3">
                        <Map size={22} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Select Area</p>
                        <p className="text-xs text-cyan-50/80">
                          Choose sub-districts or river stretches.
                        </p>
                      </div>
                    </div>

                    <div className="mx-6 h-10 border-l-2 border-dashed border-white/40" />

                    <div className="flex items-center gap-3 rounded-2xl bg-white/12 p-4">
                      <div className="rounded-xl bg-white/15 p-3">
                        <Waves size={22} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Choose Season</p>
                        <p className="text-xs text-cyan-50/80">
                          Compare seasonal field observations and WQI.
                        </p>
                      </div>
                    </div>

                    <div className="mx-6 h-10 border-l-2 border-dashed border-white/40" />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/12 p-4">
                        <BarChart3 size={20} className="mb-2" />
                        <p className="text-sm font-semibold">Analyze</p>
                        <p className="text-xs text-cyan-50/80">
                          Review charts, map layers, and interpolation outputs.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/12 p-4">
                        <FileText size={20} className="mb-2" />
                        <p className="text-sm font-semibold">Report</p>
                        <p className="text-xs text-cyan-50/80">
                          Generate summaries and export assessment outputs.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="bg-gradient-to-b from-white to-slate-50 p-6 lg:p-8">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">
                What This Module Does
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                {content.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 lg:text-base">
                {content.summary}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Info size={18} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    Suggested Flow
                  </p>
                  <p className="text-sm text-slate-500">
                    Follow these steps to use the module smoothly.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {content.steps.map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-sm">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5">
              <p className="text-sm font-semibold text-emerald-800">
                Assessment Scope
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                The module focuses on field-observed river water quality,
                seasonal interpretation, Water Quality Index tracking, map-based
                visualization, and reporting support for decision making.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiverInfoModal;
