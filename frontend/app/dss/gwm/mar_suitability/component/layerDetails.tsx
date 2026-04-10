"use client";

import { useState } from "react";
import { MarLayerInfo } from "@/interface/raster_context";

interface BoreholeProps {
  data: MarLayerInfo[];
  width?: number;
  height?: number;
  depthStep?: number;
  logWidth?: number;
}

export default function SubsurfaceBorehole2D({
  data,
  width: _width = 140,
  height: _height = 160,
  depthStep: _depthStep = 1,
  logWidth: _logWidth = 1,
}: BoreholeProps) {
  const [hovered, setHovered] = useState<MarLayerInfo | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const layerHeight = 40; // px per layer
  const barWidth = 80;    // px width of the colored bar
  const labelOffset = 10; // px gap between bar and label
  const svgWidth = barWidth + labelOffset + 80;
  const svgHeight = data.length * layerHeight;

  return (
    <div style={{ width: svgWidth + 20, position: "relative" }}>
      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: svgWidth + 8,
            background: "white",
            padding: "8px 12px",
            borderRadius: 8,
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            border: "1px solid #e5e7eb",
            pointerEvents: "none",
            zIndex: 10,
            whiteSpace: "nowrap",
          }}
        >
          <div className="flex py-1 items-center gap-2">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: hovered.color_code,
                border: "1px solid #ccc",
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 500 }}>{hovered.layer_name}</span>
          </div>
        </div>
      )}

      <svg width={svgWidth} height={svgHeight} style={{ display: "block" }}>
        {data.map((item, i) => {
          const y = i * layerHeight;
          const isHovering = hoveredIndex === i;

          return (
            <g
              key={i}
              onMouseEnter={() => {
                setHovered(item);
                setHoveredIndex(i);
              }}
              onMouseLeave={() => {
                setHovered(null);
                setHoveredIndex(null);
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Colored layer bar */}
              <rect
                x={isHovering ? -2 : 0}
                y={y + 1}
                width={isHovering ? barWidth + 4 : barWidth}
                height={layerHeight - 2}
                fill={item.color_code}
                fillOpacity={isHovering ? 1 : 0.9}
                stroke="black"
                strokeWidth={1}
                style={{ transition: "all 0.1s ease" }}
              />

              {/* Depth label */}
              <text
                x={barWidth + labelOffset}
                y={y + layerHeight / 2 + 4}
                fontSize={11}
                fill="#333"
                fontFamily="sans-serif"
              >
                {item.depth}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
