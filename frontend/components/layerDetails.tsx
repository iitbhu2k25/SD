"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { MarLayerInfo } from "@/interface/raster_context";

/* ---------------- TYPES ---------------- */

interface BoreholeProps {
  data: MarLayerInfo[];
  width?: number;
  height?: number;
  radius?: number;
  depthStep?: number;
}

/* ---------------- CYLINDER STACK ---------------- */
function BoreholeMesh({
  data,
  radius,
  depthStep,
  onHover,
}: {
  data: MarLayerInfo[];
  radius: number;
  depthStep: number;
  onHover: (info: MarLayerInfo | null) => void;
}) {
  const totalDepth = data.length * depthStep;
  const gap = depthStep * 0.08; // 👈 visible layer separation

  return (
    <>
      {data.map((item, i) => {
        const baseColor = new THREE.Color(item.color_code);
        const separatorColor = baseColor.clone().multiplyScalar(0.75);

        const yPos = totalDepth / 2 - i * depthStep;

        return (
          <group key={i}>
            {/* Main Layer */}
            <mesh
              position={[0, yPos, 0]}
              onPointerEnter={(e) => {
                e.stopPropagation();
                onHover(item);
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                onHover(null);
              }}
            >
              <cylinderGeometry
                args={[radius, radius, depthStep - gap, 32]}
              />
              <meshStandardMaterial
                color={baseColor}
                transparent
                opacity={0.95}
              />
            </mesh>

            {/* Separator Ring */}
            <mesh position={[0, yPos - depthStep / 2 + gap / 2, 0]}>
              <cylinderGeometry
                args={[radius * 1.01, radius * 1.01, gap, 32]}
              />
              <meshStandardMaterial color={separatorColor} />
            </mesh>
          </group>
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
  const [hovered, setHovered] = useState<MarLayerInfo | null>(null);

  const totalDepth = data.length * depthStep;
  const computedHeight = Math.max(height, data.length * depthStep * 60);

  return (
    <div
      style={{
        width: width + 50,
        height: computedHeight + 90,
        position: "relative",
      }}
    >
      {/* ✅ Tooltip with layer name */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: 0,
            transform: "translateY(-50%)",
            background: "white",
            padding: "8px 12px",
            borderRadius: 10,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "1px solid #e5e7eb",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: hovered.color_code,
                border: "1px solid #ccc",
              }}
            />
            {hovered ? hovered.layer_name : "Hover a layer"}
          </div>
        </div>
      )}



      <Canvas
        orthographic
        camera={{
          zoom: computedHeight / totalDepth,
          position: [totalDepth * 0.7, totalDepth, totalDepth * 0.7],
          up: [0, 1, 0],
          near: 0.1,
          far: totalDepth * 3,
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[totalDepth, totalDepth * 1.5, totalDepth]}
          intensity={1.2}
        />

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
