"use client";

// This shows the raster button on the map and the dropdown for picking a raster layer.
import Image from "next/image";
import type { ClipRasters } from "@/interface/raster_context";
import CloseIcon from "./icons/CloseIcon";

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
  if (layers.length === 0) {
    return null;
  }

  return (
    <>
      <div className="absolute right-3 top-3 z-20 group sm:right-4">
        <button
          onClick={onToggle}
          className="relative rounded-full border border-white/20 bg-white/90 p-1.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:opacity-80 sm:p-2"
        >
          <Image src="/openlayerslogo.svg" alt="Logo" width={28} height={28} className="sm:h-8 sm:w-8" />
          <span className="pointer-events-none absolute -bottom-10 -left-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block">
            Raster Layers
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-3 right-3 top-16 z-20 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-3 sm:top-18 sm:w-80 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-gray-800 sm:text-lg">Select Layer</h3>
            <button
              onClick={onToggle}
              className="text-white bg-slate-300 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
              title="Close layer selector"
              aria-label="Close layer selector"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto sm:max-h-60">
            {layers.map((layer, index) => (
              <div
                key={layer.file_name}
                className="mb-3 flex cursor-pointer items-center rounded-lg p-3 hover:bg-blue-50"
              >
                <input
                  type="radio"
                  id={`map-layer-${index}`}
                  name="mapLayerSelection"
                  value={layer.file_name}
                  checked={selectedLayer === layer.file_name}
                  onChange={() => onSelectLayer(layer.file_name)}
                  className="mr-3 h-4 w-4 text-blue-600"
                />
                <label
                  htmlFor={`map-layer-${index}`}
                  className="cursor-pointer text-sm text-gray-700"
                >
                  {layer.file_name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
