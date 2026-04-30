"use client";

import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import MapRasterSelector from "@/components/dss_common/MapRasterSelector";
import type { ClipRasters } from "@/interface/raster_context";
import { WQ_PARAMETERS, attributeLabels } from "../utils/chartFormatters";

interface MapRasterParameterSelectorProps {
  selectedAttribute: string | null;
  onAttributeChange: (attribute: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  isDark?: boolean;
}

const parameterItems = WQ_PARAMETERS.map((parameter) => ({
  key: parameter.key,
  file_name: attributeLabels[parameter.key] || parameter.label,
  layer_name: parameter.key,
}));

export default function MapRasterParameterSelector({
  selectedAttribute,
  onAttributeChange,
  disabled = false,
  isLoading = false,
  error = null,
  isDark = false,
}: MapRasterParameterSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const layers = useMemo<ClipRasters[]>(
    () => (disabled ? [] : parameterItems),
    [disabled],
  );

  const selectedLayer = selectedAttribute
    ? parameterItems.find((item) => item.key === selectedAttribute)?.file_name || null
    : null;

  const handleSelectLayer = (fileName: string) => {
    if (disabled || isLoading) return;
    const selected = parameterItems.find((item) => item.file_name === fileName);
    if (selected) onAttributeChange(selected.key);
  };

  return (
    <>
      <MapRasterSelector
        isOpen={isOpen}
        layers={layers}
        selectedLayer={selectedLayer}
        onToggle={() => setIsOpen((current) => !current)}
        onSelectLayer={handleSelectLayer}
      />

      {(isLoading || error) && (
        <div
          className={`absolute right-3 top-16 z-10 max-w-[17rem] rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-sm sm:right-4 ${
            isDark
              ? "border-[#1e3a5f]/70 bg-[#080e1c]/95 text-slate-300"
              : "border-stone-200 bg-white/95 text-slate-600"
          }`}
        >
          {isLoading && (
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
              <Loader2 size={12} className="animate-spin" />
              Generating raster...
            </span>
          )}
          {!isLoading && error && (
            <span className={isDark ? "text-rose-300" : "text-rose-600"}>{error}</span>
          )}
        </div>
      )}
    </>
  );
}
