"use client";

import React from "react";
import { PanelSettings } from "../../config/panels.config";

export interface PageLayoutRailItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
}

interface PageLayoutProps {
  title: string;
  badge?: string;
  badgeClassName?: string;
  config: PanelSettings;
  railItems: PageLayoutRailItem[];
  leftPanel: React.ReactNode;
  center: React.ReactNode;
  rightPanel?: React.ReactNode;
  isLeftOpen: boolean;
  onToggleLeft: () => void;
  onCloseLeft?: () => void;
  isRightOpen?: boolean;
}

export default function PageLayout({
  title,
  badge,
  badgeClassName,
  config,
  railItems,
  leftPanel,
  center,
  rightPanel,
  isLeftOpen,
  onToggleLeft,
  onCloseLeft,
  isRightOpen = false,
}: PageLayoutProps) {
  const showRightPanel = config.right.enabled && !!rightPanel;
  const handleCloseLeft = onCloseLeft ?? onToggleLeft;

  return (
    <div className="flex h-full min-h-0 overflow-hidden relative">
      <div className="flex flex-col items-center bg-[#0a1628] text-white w-12 sm:w-14 shrink-0 py-3 gap-2 z-30">
        {railItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`group relative flex flex-col items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-200 ${
              item.isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title={item.tooltip}
          >
            {item.icon}
            <span className="text-[8px] mt-0.5 leading-none hidden sm:block">{item.label}</span>
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {item.tooltip}
            </span>
          </button>
        ))}

        <div className="mt-auto">
          <button
            onClick={onToggleLeft}
            className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-white bg-gray-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer "
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
      </div>

      <aside
        className="bg-white border-r border-gray-200 overflow-hidden transition-all duration-300 ease-in-out z-20 flex flex-col absolute lg:relative top-0 bottom-0 left-12 sm:left-14 lg:left-0"
        style={{ width: isLeftOpen ? config.left.widthOpen : config.left.widthClosed }}
      >
        <div className="w-full h-full overflow-y-auto overflow-x-hidden">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                {title}
              </h2>
              {badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    badgeClassName ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {badge}
                </span>
              )}
            </div>
            <button
              onClick={handleCloseLeft}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors sm:hidden"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="p-4">{leftPanel}</div>
        </div>
      </aside>

      <div className="relative flex-1 min-w-0 h-full overflow-hidden">{center}</div>

      {showRightPanel && (
        <aside
          className="absolute top-0 bottom-0 right-0 border-l border-gray-200 bg-white z-20 transition-all duration-300 ease-in-out"
          style={{ width: isRightOpen ? config.right.widthOpen : config.right.widthClosed }}
        >
          {rightPanel}
        </aside>
      )}

      {isLeftOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-10 lg:hidden"
          onClick={onToggleLeft}
        />
      )}
    </div>
  );
}
