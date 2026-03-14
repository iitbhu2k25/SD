"use client";

import React, { useEffect, useState } from "react";
import { ClipRasters } from "@/interface/raster_context";

interface RasterLayerSectionProps {
  title?: string;
  layers: ClipRasters[];
  selectedLayer: string | null;
  onSelectLayer: (layerName: string) => void;
  layerOpacity: number;
  onLayerOpacityChange: (value: number) => void;
  emptyMessage?: string;
}

export default function RasterLayerSection({
  title = "Raster Layers",
  layers,
  selectedLayer,
  onSelectLayer,
  layerOpacity,
  onLayerOpacityChange,
  emptyMessage = "No raster layers available yet.",
}: RasterLayerSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (layers.length > 0) {
      setIsOpen(true);
    }
  }, [layers.length]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7h18M6 12h12M10 17h4"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">
              {layers.length > 0 ? `${layers.length} layers available` : emptyMessage}
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 px-4 py-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
              <span>Raster Opacity</span>
              <span>{layerOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={layerOpacity}
              onChange={(event) => onLayerOpacityChange(parseInt(event.target.value, 10))}
              className="w-full"
            />
          </div>

          <div className="mt-4 space-y-2">
            {layers.length === 0 && (
              <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                {emptyMessage}
              </div>
            )}

            {layers.map((layer) => (
              <label
                key={layer.file_name}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name={title}
                  checked={selectedLayer === layer.file_name}
                  onChange={() => onSelectLayer(layer.file_name)}
                />
                <span className="truncate text-gray-700">{layer.file_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
