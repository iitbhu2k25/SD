"use client";

import GeneralCsvUploadPanel from "./GeneralCsvUploadPanel";
import GeneralShapefileUploadPanel from "./GeneralShapefileUploadPanel";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import { useUiModeStore } from "../../services/uiModeService";

export default function GeneralLeftPanel() {
  const { upload } = useGeneralViewModel();
  const isDark = useUiModeStore((s) => s.isDark);

  return (
    <div className={`space-y-3 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
      <GeneralShapefileUploadPanel />

      {upload.layerInfo && <GeneralCsvUploadPanel />}
    </div>
  );
}

