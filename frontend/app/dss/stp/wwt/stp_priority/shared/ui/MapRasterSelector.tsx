"use client";

// This shows the raster button on the map and the dropdown for picking a raster layer.
import Image from "next/image";
import type { ClipRasters } from "@/interface/raster_context";

interface MapRasterSelectorProps {
  isOpen: boolean;
  layers: ClipRasters[];
  selectedLayer: string | null;
  layerOpacity: number;
  onToggle: () => void;
  onSelectLayer: (layerName: string) => void;
  onOpacityChange: (value: number) => void;
}

export default function MapRasterSelector({
  isOpen,
  layers,
  selectedLayer,
  layerOpacity,
  onToggle,
  onSelectLayer,
  onOpacityChange,
}: MapRasterSelectorProps) {
  if (layers.length === 0) {
    return null;
  }

  return (
    <>
      <div className="absolute right-4 top-3 z-40 group">
        <button
          onClick={onToggle}
          className="relative rounded-full border border-white/20 bg-white/90 p-2 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:opacity-80"
        >
          <Image src="/openlayerslogo.svg" alt="Logo" width={32} height={32} />
          <span className="pointer-events-none absolute -bottom-10 -left-1 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Raster Layers
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-4 top-20 z-50 w-80 rounded-xl border border-gray-200 bg-white/95 p-6 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">Select Layer</h3>
            <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
              x
            </button>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex justify-between text-xs text-gray-700">
              <span>Opacity</span>
              <span>{layerOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={layerOpacity}
              onChange={(event) => onOpacityChange(parseInt(event.target.value, 10))}
              className="w-full"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
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
