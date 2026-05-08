"use client";

import { useState } from "react";
import DrainLeftPanel from "./components/DrainLeftPanel";
import DrainRightPanel from "./components/DrainRightPanel";
import DrainOpenLayersMap from "./components/DrainOpenLayersMap";
import { RIGHT_PANEL_CONFIG } from "../config/panels.config";
import { useDrainUiStore } from "./stores/drainUiStore";

export default function DrainPage() {
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_CONFIG.widthOpen);

  const isRightPanelOpen = useDrainUiStore((s) => s.isRightPanelOpen);
  const setRightPanelOpen = useDrainUiStore((s) => s.setRightPanelOpen);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100">
      <div className="z-20 w-full max-w-[16rem] sm:max-w-[18rem] md:max-w-[20rem] lg:max-w-xs shrink-0 overflow-y-auto border-r border-stone-200 bg-[linear-gradient(180deg,#fcfbf9_0%,#f5f4fb_100%)] p-2.5 sm:p-3 lg:p-4 shadow-xl">
        <DrainLeftPanel />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-row">
          <div className="relative min-w-0 flex-1">
            <DrainOpenLayersMap />
          </div>

          <DrainRightPanel
            isOpen={isRightPanelOpen}
            width={rightPanelWidth}
            onClose={() => setRightPanelOpen(false)}
            onWidthChange={setRightPanelWidth}
            panelSettings={RIGHT_PANEL_CONFIG}
          />
        </div>

      </div>
    </div>
  );
}
