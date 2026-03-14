"use client";

import type { ReactNode } from "react";

// This file gives the main work area a shared map and right panel layout.
interface MainLayoutProps {
  mapContent: ReactNode;
  rightPanel?: ReactNode;
  rightPanelToggle?: ReactNode;
}

export default function MainLayout({
  mapContent,
  rightPanel,
  rightPanelToggle,
}: MainLayoutProps) {
  return (
    <div className="flex-1 flex h-full min-h-0 relative">
      <div className="flex-1 min-w-0 h-full">{mapContent}</div>
      {rightPanel}
      {rightPanelToggle}
    </div>
  );
}
