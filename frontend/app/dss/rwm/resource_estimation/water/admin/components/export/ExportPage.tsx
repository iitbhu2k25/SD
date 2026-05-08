"use client";

import React from "react";
import PDFExportButton from "./components/PDFExportButton";

interface PageProps {
  exportData: any;
  rasterResponse: any;
  subdistrictCodes?: number[];
  onExportStart?: () => void;
  onExportComplete?: () => void;
}

export default function ExportPage({
  exportData,
  rasterResponse,
  subdistrictCodes = [],
  onExportStart,
  onExportComplete,
}: PageProps) {
  return (
    <div className="w-full flex justify-center py-1">
      <PDFExportButton
        exportData={exportData}
        rasterResponse={rasterResponse}
        subdistrictCodes={subdistrictCodes}
        onExportStart={onExportStart}
        onExportComplete={onExportComplete}
      />
    </div>
  );
}