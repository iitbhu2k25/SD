"use client";

import { useState } from "react";
import AdminLeftPanel from "./components/AdminLeftPanel";
import AdminRightPanel from "./components/AdminRightPanel";
import AdminOpenLayersMap from "./components/AdminOpenLayersMap";
import { RIGHT_PANEL_CONFIG } from "../config/panels.config";
import { useAdminUiStore } from "./stores/adminUiStore";

export default function AdminPage() {
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_CONFIG.widthOpen);

  const isRightPanelOpen = useAdminUiStore((s) => s.isRightPanelOpen);
  const setRightPanelOpen = useAdminUiStore((s) => s.setRightPanelOpen);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100">
      <div className="z-20 w-full max-w-[16rem] sm:max-w-[18rem] md:max-w-[20rem] lg:max-w-xs shrink-0 overflow-y-auto border-r border-stone-200 bg-[linear-gradient(180deg,#fcfbf9_0%,#f5f4fb_100%)] p-2.5 sm:p-3 lg:p-4 shadow-xl">
        <AdminLeftPanel />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-row">
          <div className="relative min-w-0 flex-1">
            <AdminOpenLayersMap />
          </div>

          <AdminRightPanel
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
