"use client";

import type { ReactNode } from "react";

// This file gives the page a shared left panel and main area layout.
interface ScreenLayoutProps {
  leftPanel: ReactNode;
  mainContent: ReactNode;
  leftPanelWidthClass?: string;
}

export default function ScreenLayout({
  leftPanel,
  mainContent,
  leftPanelWidthClass = "w-[320px]",
}: ScreenLayoutProps) {
  return (
    <div className="flex h-full min-h-0">
      <div
        className={`${leftPanelWidthClass} shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4`}
      >
        {leftPanel}
      </div>
      <div className="flex-1 min-w-0">{mainContent}</div>
    </div>
  );
}
