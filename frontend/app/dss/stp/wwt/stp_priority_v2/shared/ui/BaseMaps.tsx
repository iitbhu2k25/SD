"use client";

import React from "react";
import type { BaseMapDefinition } from "@/components/MapComponents";
import CloseIcon from "./icons/CloseIcon";

interface BaseMapDockProps {
  baseMaps: Record<string, BaseMapDefinition>;
  selectedBaseMap: string;
  onChangeBaseMap: (baseMapKey: string) => void;
  onClose?: () => void;
}

function getMapPreviewImage(baseMapKey: string): string {
  if (baseMapKey.includes("satellite")) {
    return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/5";
  }
  if (baseMapKey.includes("dark")) {
    return "https://a.basemaps.cartocdn.com/dark_all/3/5/3.png";
  }
  if (baseMapKey.includes("terrain") || baseMapKey.includes("topo")) {
    return "https://c.tile.opentopomap.org/3/5/3.png";
  }
  if (baseMapKey.includes("gray") || baseMapKey.includes("light")) {
    return "https://a.basemaps.cartocdn.com/light_all/3/5/3.png";
  }
  return "https://c.tile.openstreetmap.org/3/5/3.png";
}

export default function BaseMaps({
  baseMaps,
  selectedBaseMap,
  onChangeBaseMap,
  onClose,
}: BaseMapDockProps) {
  return (
    <div className="absolute top-20 left-1/2 z-10 w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-in fade-in zoom-in-95 px-4 duration-300">
      <div className="relative mx-auto w-fit">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -right-2 -top-2 z-10 text-white bg-slate-300 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
            title="Close base maps"
            aria-label="Close base maps"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 rounded-full border border-white/10 bg-gray-500/20 px-5 py-3 shadow-2xl backdrop-blur-md transition-colors duration-300 hover:bg-gray-500/40">
          {Object.entries(baseMaps).map(([key, baseMap]) => {
            const isSelected = selectedBaseMap === key;

            return (
              <div key={key} className="group relative flex flex-col items-center">
                <button
                  onClick={() => onChangeBaseMap(key)}
                  style={{
                    backgroundImage: `url(${getMapPreviewImage(key)})`,
                    backgroundSize: "120%",
                    backgroundPosition: "85% 40%",
                    backgroundRepeat: "no-repeat",
                  }}
                  className={`relative h-10 w-10 cursor-pointer rounded-full shadow-lg transition-all duration-300 ease-out ${
                    isSelected
                      ? "z-10 scale-110 ring-4 ring-white shadow-blue-500/50"
                      : "grayscale opacity-80 hover:scale-105 hover:opacity-100 hover:ring-2 hover:ring-white/50 hover:grayscale-0"
                  }`}
                  aria-label={baseMap.name}
                  title={baseMap.name}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/30 to-transparent" />
                </button>

                <div className="pointer-events-none absolute -top-10 translate-y-2 whitespace-nowrap rounded-full border border-white/10 bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  {baseMap.name}
                </div>

                {isSelected && (
                  <div className="absolute -bottom-3 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
