"use client";

import React from "react";
import UploadPanel from "../../../river/general/components/uploadPanel";
import CsvUploadPanel from "../../../river/general/components/CsvUploadPanel";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import { useUiModeStore } from "../../services/uiModeService";

export default function GeneralLeftPanel() {
  const { upload, handleShapefileUploadSuccess, handleShapefileReset, handleCsvUploadSuccess } = useGeneralViewModel();
  const { layerInfo } = upload;
  const isDark = useUiModeStore((s) => s.isDark);

  return (
    <div className={`space-y-4 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
        <div className={`rounded-2xl border p-2 shadow-sm ${
          isDark
            ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
            : "border border-stone-200 bg-white"
        }`}>
          {/* We import the exact legacy UploadPanel but wrap it in the V2 styled container */}
          <UploadPanel
            onUploadSuccess={handleShapefileUploadSuccess}
            onReset={handleShapefileReset}
          />
        </div>

        {layerInfo && (
          <div className={`rounded-2xl border p-3 shadow-md animate-fadeIn ${
            isDark
              ? "border-[#1e3a5f] bg-[#0c182b] shadow-cyan-900/10"
              : "border border-stone-200 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)]"
          }`}>
             <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-cyan-400' : 'text-blue-700'}`}>Dataset Assignment</h3>
             {/* The legacy CSV Panel expects layerName string */}
             <CsvUploadPanel
               layerName={layerInfo.layerName}
               onUploadSuccess={handleCsvUploadSuccess}
               onReset={handleShapefileReset}
             />
          </div>
        )}
    </div>
  );
}
