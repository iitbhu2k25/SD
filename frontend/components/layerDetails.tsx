"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { scaleSequential } from "d3-scale";
import { interpolateTurbo } from "d3-scale-chromatic";
import { useState } from "react";
import { RasterValue } from "@/interface/raster_context";
/* ---------------- TYPES ---------------- */

interface BoreholeProps {
  data: RasterValue[];
  width?: number;
  height?: number;
  radius?: number;
  depthStep?: number;
}

const colorScale = scaleSequential(interpolateTurbo)
  .domain([0, 300]);

/* ---------------- CYLINDER STACK ---------------- */
function BoreholeMesh({
  data,
  radius,
  depthStep,
  onHover,
}: {
  data: RasterValue[];
  radius: number;
  depthStep: number;
  onHover: (info: RasterValue | null) => void;
}) {
  const totalDepth = data.length * depthStep;

  return (
    <>
      {data.map((item, i) => {
        const color = new THREE.Color(colorScale(item.value));

        return (
          <mesh
            key={i}
            position={[
              0,
              totalDepth / 2 - i * depthStep,
              0,
            ]}
            onPointerEnter={(e) => {
              e.stopPropagation();
              onHover(item);
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              onHover(null);
            }}
          >
            <cylinderGeometry args={[radius, radius, depthStep, 32]} />
            <meshStandardMaterial color={color} opacity={0.95} />
          </mesh>
        );
      })}
    </>
  );
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function SubsurfaceBorehole({
  data,
  width = 140,
  height = 160,
  radius = 0.6,
  depthStep = 1,
}: BoreholeProps) {
  const [hovered, setHovered] = useState<RasterValue | null>(null);

  const totalDepth = data.length * depthStep;

  // 🔥 Auto-expand height to fit all layers
  const computedHeight = Math.max(height, data.length * depthStep * 60);

  return (
    <div
      style={{
        width: width+50,
        height: computedHeight+90,
        position: "relative",
      }}
    >
      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(15,23,42,0.95)",
            color: "white",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>{hovered.layer_name}</div>
          <div>Value: {hovered.value}</div>
        </div>
      )}

      <Canvas
        orthographic
        camera={{
          zoom: computedHeight / totalDepth,
          position: [totalDepth * 0.7, totalDepth, totalDepth * 0.7], // offset X, Y, Z for 45° view
          up: [0, 1, 0],                  // Y is up
          near: 0.1,
          far: totalDepth * 3,
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[totalDepth, totalDepth * 1.5, totalDepth]} intensity={1.2} />

        <BoreholeMesh
          data={data}
          radius={radius}
          depthStep={depthStep}
          onHover={setHovered}
        />
      </Canvas>


    </div>
  );
}
