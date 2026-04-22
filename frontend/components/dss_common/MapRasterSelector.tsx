"use client";

import Image from "next/image";
import type { ClipRasters } from "@/interface/raster_context";

interface MapRasterSelectorProps {
  isOpen: boolean;
  layers: ClipRasters[];
  selectedLayer: string | null;
  onToggle: () => void;
  onSelectLayer: (layerName: string) => void;
}

export default function MapRasterSelector({
  isOpen,
  layers,
  selectedLayer,
  onToggle,
  onSelectLayer,
}: MapRasterSelectorProps) {
  if (layers.length === 0) return null;

  return (
    <>
      {/* Trigger button — original OpenLayers icon preserved */}
      <div className="absolute right-3 top-3 z-10 group sm:right-4">
        <button
          onClick={onToggle}
          className="relative rounded-full border border-white/20 bg-red/90 p-1.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:opacity-80 sm:p-2"
          aria-label="Toggle layer selector"
        >
          <Image
            src="/openlayerslogo.svg"
            alt="Logo"
            width={28}
            height={28}
            className="sm:h-8 sm:w-8"
          />
          <span className="pointer-events-none absolute -bottom-10 -left-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block">
            Raster Layers
          </span>
        </button>
      </div>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute right-20 top-4 z-9 w-56 overflow-hidden rounded-lg border border-r-0 border-slate-200 bg-white font-mono shadow-lg sm:top-4 sm:w-60"
          style={{ boxShadow: "-3px 0 16px rgba(0,0,0,0.07)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-teal-600 bg-slate-50 px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-teal-700">
              Layers
            </span>
            <button
              onClick={onToggle}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] text-slate-400 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-500 cursor-pointer"
              aria-label="Close layer selector"
            >
              X
            </button>
          </div>

          {/* Scrollable layer list — shows ~4.5 rows, rest scrollable */}
          <div className="overflow-y-auto py-0.5" style={{ maxHeight: "220px" }}>
            {layers.map((layer, index) => {
              const isActive = selectedLayer === layer.file_name;
              const num = String(index + 1).padStart(2, "0");

              return (
                <div
                  key={layer.file_name}
                  onClick={() => onSelectLayer(layer.file_name)}
                  className={`flex cursor-pointer items-center gap-2 border-l-2 px-3 py-[7px] transition-colors duration-100 ${
                    isActive
                      ? "border-teal-600 bg-teal-50"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  {/* Row number */}
                  <span
                    className={`min-w-[16px] text-[10px] tracking-tight transition-colors duration-150 ${
                      isActive ? "text-teal-600" : "text-slate-500"
                    }`}
                  >
                    {num}
                  </span>

                  {/* Square indicator */}
                  <div
                    className={`h-2 w-2 flex-shrink-0 rounded-[1px] border-[1.5px] transition-colors duration-150 ${
                      isActive
                        ? "border-teal-600 bg-teal-600"
                        : "border-slate-500 bg-transparent"
                    }`}
                  />

                  {/* Layer name */}
                  <span
                    className={`truncate text-[12px] uppercase tracking-wide transition-colors duration-150 ${
                      isActive
                        ? "font-semibold text-teal-700"
                        : "font-normal text-slate-600"
                    }`}
                  >
                    {layer.file_name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}