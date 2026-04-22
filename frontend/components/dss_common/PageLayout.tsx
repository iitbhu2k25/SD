"use client";

import React from "react";
import LeftPanelToggle from "@/components/dss_common/LeftPanelToggle";

interface PanelSizeSettings {
  widthOpen: string;
  mobileWidthOpen: string;
  widthClosed: string;
  defaultOpen: boolean;
}

interface RightPanelSettings extends PanelSizeSettings {
  minWidthPercent: number;
  maxWidthPercent: number;
}

interface PanelSettings {
  left: PanelSizeSettings;
  right: RightPanelSettings;
  bottom?: {
    heightOpen: string;
  };
}

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
  bottomPanel?: React.ReactNode;
  isBottomOpen?: boolean;
  bottomPanelOpenHeight?: string;
  bottomPanelClosedHeight?: string;
  isLeftOpen: boolean;
  isMobile?: boolean;
  onToggleLeft: () => void;
  onCloseLeft?: () => void;
  isDark?: boolean;
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
  bottomPanel,
  isBottomOpen = false,
  bottomPanelOpenHeight = "0px",
  bottomPanelClosedHeight = "0px",
  isLeftOpen,
  isMobile = false,
  onToggleLeft,
  onCloseLeft,
  isDark = false,
}: PageLayoutProps) {
  const leftPanelWidth = isLeftOpen
    ? isMobile
      ? config.left.mobileWidthOpen
      : config.left.widthOpen
    : config.left.widthClosed;

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {/* Rail sidebar */}
      <div className={`z-50 flex w-12 shrink-0 flex-col items-center gap-2 border-r py-3 sm:w-14 ${
        isDark
          ? "border-[#1e3a5f]/50 bg-[#050911] text-slate-400"
          : "border-stone-200 bg-gradient-to-b from-emerald-50 via-stone-50 to-teal-50/60 text-slate-700"
      }`}>
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
      </div>

      <div className="relative flex-1 min-w-0 h-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 z-40 transition-[width] duration-300 ease-in-out"
          style={{
            width: leftPanelWidth,
            bottom: bottomPanel
              ? isBottomOpen
                ? bottomPanelOpenHeight
                : bottomPanelClosedHeight
              : "0px",
          }}
        >
          <aside
            className={`relative flex h-full w-full flex-col overflow-hidden ${
              isDark
                ? "bg-[#080e1c]"
                : "bg-[linear-gradient(180deg,#f6f3ee_0%,#f3f5f8_58%,#eef4ef_100%)]"
            } ${
              isLeftOpen
                ? `border-r shadow-[10px_0_18px_rgba(0,0,0,0.25)] ${
                    isDark ? "border-[#1e3a5f]/50" : "border-stone-200"
                  }`
                : "border-r-0 shadow-none"
            }`}
          >
            <div className="h-full w-full overflow-y-auto overflow-x-hidden">
              <div className={`sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-3 py-3 backdrop-blur-sm sm:px-4 ${
                isDark
                  ? "border-[#1e3a5f]/50 bg-[#060c1a]/95"
                  : "border-stone-200 bg-[#f7f4ef]/88"
              }`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h2 className={`text-[15px] font-semibold tracking-[0.02em] ${
                      isDark ? "text-slate-100" : "text-slate-800"
                    }`}>
                      {title}
                    </h2>
                    {onTitleInfoClick && (
                      <button
                        onClick={onTitleInfoClick}
                        className={`inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border text-[10px] font-bold transition ${
                          isDark
                            ? "border-[#1e3a5f] bg-[#0a1628] text-cyan-400/70 hover:border-cyan-500/60 hover:text-cyan-300"
                            : "border-stone-300 bg-white/80 text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                        }`}
                        title={titleInfoTooltip}
                        aria-label={titleInfoTooltip}
                      >
                        i
                      </button>
                    )}
                  </div>
                  {badge && (
                    <span
                      className={`w-fit shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[14px] font-semibold leading-none shadow-sm ${
                        badgeClassName ??
                        "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 sm:p-4">{leftPanel}</div>
            </div>
          </aside>
          <LeftPanelToggle isOpen={isLeftOpen} onToggle={onToggleLeft} isDark={isDark} />
        </div>

        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="relative min-h-0 min-w-0 flex-1">{mapContent}</div>
            {rightPanel}
            {rightPanelToggle}
          </div>
          {bottomPanel}
        </div>
      </div>

      {isLeftOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onCloseLeft ?? onToggleLeft}
        />
      )}
    </div>
  );
}
