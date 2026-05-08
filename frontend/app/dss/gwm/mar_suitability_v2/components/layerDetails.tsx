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

  const layerHeight = 40;
  const barWidth = 80;
  const labelOffset = 10;
  const depthLabelWidth = 70; // approx width of "25 - 30m" text
  const svgWidth = barWidth + labelOffset + depthLabelWidth;
  const svgHeight = data.length * layerHeight;
  const containerWidth = Math.max(svgWidth + 20, 220);


  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: containerWidth, position: "relative" }}>
      {/* Tooltip — anchored right of the container, never over the labels */}
      {hovered && hoveredIndex !== null && (
        <div
          style={{
            position: "absolute",
            top: hoveredIndex * layerHeight + 2,
            right: 4,
            background: "white",
            padding: "7px 10px",
            borderRadius: 9,
            boxShadow: "0 6px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: 150,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            lineHeight: 1.35,
          }}
        >
          {/* Left-pointing arrow */}
          <div
            style={{
              position: "absolute",
              left: -6,
              top: 12,
              width: 0,
              height: 0,
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderRight: "6px solid white",
              filter: "drop-shadow(-1px 0 0 #e5e7eb)",
            }}
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: hovered.color_code,
                border: "1.5px solid rgba(0,0,0,0.12)",
                display: "inline-block",
                marginTop: 2,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 500, color: "#1f2937" }}>
              {hovered.layer_name}
            </span>
          </div>
        </div>
      )}

      <svg width={svgWidth} height={svgHeight} style={{ display: "block", overflow: "visible" }}>
        {/* Vertical depth ruler */}
        <line
          x1={barWidth / 2}
          y1={0}
          x2={barWidth / 2}
          y2={svgHeight}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {data.map((item, i) => {
          const y = i * layerHeight;
          const isHovering = hoveredIndex === i;

          return (
            <g
              key={i}
            >
              {/* Hover glow */}
              {isHovering && (
                <rect
                  x={-4}
                  y={y + 2}
                  width={barWidth + 8}
                  height={layerHeight - 4}
                  rx={8}
                  fill={item.color_code}
                  fillOpacity={0.12}
                />
              )}

              {/* Layer bar */}
              <rect
                x={2}
                y={y + 4}
                width={barWidth - 4}
                height={layerHeight - 8}
                rx={6}
                fill={item.color_code}
                fillOpacity={isHovering ? 1 : 0.88}
                stroke={item.color_code}
                strokeWidth={isHovering ? 1.5 : 0.5}
                strokeOpacity={isHovering ? 0.6 : 0.3}
                onMouseEnter={() => {
                  setHovered(item);
                  setHoveredIndex(i);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  setHoveredIndex(null);
                }}
                style={{ transition: "all 0.15s ease", cursor: "pointer" }}
              />

              {/* Inner highlight shimmer */}
              <rect
                x={4}
                y={y + 6}
                width={barWidth - 8}
                height={7}
                rx={3}
                fill="white"
                fillOpacity={0.18}
                style={{ pointerEvents: "none" }}
              />

              {/* Active dot on ruler — drawn as SVG circle, not text */}
              {isHovering && (
                <circle
                  cx={barWidth / 2}
                  cy={y + layerHeight / 2}
                  r={3.5}
                  fill={item.color_code}
                  stroke="white"
                  strokeWidth={1.5}
                />
              )}

              {/* Dashed connector from bar to depth label */}
              <line
                x1={barWidth + 2}
                y1={y + layerHeight / 2}
                x2={barWidth + labelOffset - 2}
                y2={y + layerHeight / 2}
                stroke="#d1d5db"
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />

              {/* Depth label */}
              <text
                x={barWidth + labelOffset}
                y={y + layerHeight / 2 + 4}
                fontSize={10.5}
                fill={isHovering ? "#111827" : "#6b7280"}
                fontFamily="inherit"
                fontWeight={isHovering ? "600" : "400"}
                pointerEvents="none"
                style={{ transition: "fill 0.15s ease" }}
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
