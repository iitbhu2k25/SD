"use client";

import { useState } from "react";
import GeneralLeftPanel from "./components/GeneralLeftPanel";
import GeneralRightPanel from "./components/GeneralRightPanel";
import GeneralOpenLayersMap from "./components/GeneralOpenLayersMap";
import { GENERAL_RIGHT_PANEL_CONFIG } from "../config/panels.config";
import { useGeneralUiStore } from "./stores/generalUiStore";

export default function GeneralPage() {
  const [rightPanelWidth, setRightPanelWidth] = useState(GENERAL_RIGHT_PANEL_CONFIG.widthOpen);

  const isRightPanelOpen = useGeneralUiStore((s) => s.isRightPanelOpen);
  const setRightPanelOpen = useGeneralUiStore((s) => s.setRightPanelOpen);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100">
      {/* Uploads are wide, so we expand the left panel for General mode */}
      <div className="z-20 w-full max-w-[24rem] shrink-0 overflow-y-auto border-r border-stone-200 bg-[linear-gradient(180deg,#fcfbf9_0%,#f5f4fb_100%)] p-2.5 sm:p-3 lg:p-4 shadow-xl">
        <GeneralLeftPanel />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-row">
          <div className="relative min-w-0 flex-1">
            <GeneralOpenLayersMap />
          </div>

          <GeneralRightPanel
            isOpen={isRightPanelOpen}
            width={rightPanelWidth}
            onClose={() => setRightPanelOpen(false)}
            onWidthChange={setRightPanelWidth}
            panelSettings={GENERAL_RIGHT_PANEL_CONFIG}
          />
        </div>
      </div>
    </div>
  );
}
