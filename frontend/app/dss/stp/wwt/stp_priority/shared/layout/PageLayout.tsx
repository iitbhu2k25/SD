"use client";

import React from "react";
import { PanelSettings } from "../../config/panels.config";
import CloseIcon from "../ui/icons/CloseIcon";

export interface PageLayoutRailItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
  activeClassName?: string;
}

interface PageLayoutProps {
  title: string;
  badge?: string;
  badgeClassName?: string;
  onTitleInfoClick?: () => void;
  titleInfoTooltip?: string;
  config: PanelSettings;
  railItems: PageLayoutRailItem[];
  leftPanel: React.ReactNode;
  mapContent: React.ReactNode;
  rightPanel?: React.ReactNode;
  rightPanelToggle?: React.ReactNode;
  isLeftOpen: boolean;
  isMobile?: boolean;
  onToggleLeft: () => void;
  onCloseLeft?: () => void;
}

export default function PageLayout({
  title,
  badge,
  badgeClassName,
  onTitleInfoClick,
  titleInfoTooltip = "Module info",
  config,
  railItems,
  leftPanel,
  mapContent,
  rightPanel,
  rightPanelToggle,
  isLeftOpen,
  isMobile = false,
  onToggleLeft,
  onCloseLeft,
}: PageLayoutProps) {
  const handleCloseLeft = onCloseLeft ?? onToggleLeft;

  return (
    <div className="flex h-full min-h-0 overflow-hidden relative">
      <div className="z-30 flex w-12 shrink-0 flex-col items-center gap-2 border-r border-stone-200 bg-gradient-to-b from-emerald-50 via-stone-50 to-teal-50/60 py-3 text-slate-700 sm:w-14">
        {railItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`group relative flex h-10 w-10 flex-col items-center justify-center rounded-xl transition-all duration-200 sm:h-11 sm:w-11 ${
              item.isActive
                ? item.activeClassName ??
                  "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-400 hover:bg-white/80 hover:text-slate-700 hover:shadow-sm"
            }`}
            title={item.tooltip}
          >
            {item.icon}
            <span className="text-[8px] mt-0.5 leading-none hidden sm:block">{item.label}</span>
            <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 lg:block">
              {item.tooltip}
            </span>
          </button>
        ))}

        <div className="my-1 h-px w-7 bg-stone-200 sm:w-8" />

        <button
          onClick={onToggleLeft}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white/80 text-slate-500 transition-all hover:bg-white hover:text-slate-700 hover:shadow-sm sm:h-11 sm:w-11"
          title={isLeftOpen ? "Collapse panel" : "Expand panel"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isLeftOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            )}
          </svg>
        </button>
      </div>

      <aside
        className="absolute bottom-0 left-12 top-0 z-20 flex flex-col overflow-hidden border-r border-stone-200 bg-[linear-gradient(180deg,#f6f3ee_0%,#f3f5f8_58%,#eef4ef_100%)] shadow-xl transition-all duration-300 ease-in-out sm:left-14 lg:relative lg:left-0 lg:shadow-none"
        style={{
          width: isLeftOpen
            ? isMobile
              ? config.left.mobileWidthOpen
              : config.left.widthOpen
            : config.left.widthClosed,
        }}
      >
        <div className="w-full h-full overflow-y-auto overflow-x-hidden">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-[#f7f4ef]/88 px-3 py-3 backdrop-blur-sm sm:px-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="text-[15px] font-semibold tracking-[0.02em] text-slate-800">
                  {title}
                </h2>
                {onTitleInfoClick && (
                  <button
                    onClick={onTitleInfoClick}
                    className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-stone-300 bg-white/80 text-[10px] font-bold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
                    title={titleInfoTooltip}
                    aria-label={titleInfoTooltip}
                  >
                    i
                  </button>
                )}
              </div>
              {badge && (
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${
                    badgeClassName ?? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {badge}
                </span>
              )}
            </div>
            <button
              onClick={handleCloseLeft}
              className="cursor-pointer rounded-full border border-stone-200 bg-white/80 p-1 text-slate-500 transition-all duration-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title="Close filters"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 sm:p-4">{leftPanel}</div>
        </div>
      </aside>

      <div className="relative flex-1 min-w-0 h-full overflow-hidden">
        <div className="relative flex h-full min-h-0 flex-1">
          <div className="h-full min-w-0 flex-1">{mapContent}</div>
          {rightPanel}
          {rightPanelToggle}
        </div>
      </div>

      {isLeftOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-10 lg:hidden"
          onClick={onToggleLeft}
        />
      )}
    </div>
  );
}
