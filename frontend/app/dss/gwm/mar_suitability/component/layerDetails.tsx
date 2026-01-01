"use client";

import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useState, useRef } from "react";
import { MarLayerInfo } from "@/interface/raster_context";
import { Text, Billboard } from "@react-three/drei";

/* ---------------- TYPES ---------------- */

interface BoreholeProps {
  data: MarLayerInfo[];
  width?: number;
  height?: number;
  radius?: number;
  depthStep?: number;
}

/* ---------------- ANIMATED LAYER ---------------- */

function AnimatedLayer({
  item,
  yPos,
  radius,
  depthStep,
  gap,
  isLast,
  onHover,
  isHovered,
}: {
  item: MarLayerInfo;
  yPos: number;
  radius: number;
  depthStep: number;
  gap: number;
  isLast: boolean;
  onHover: (info: MarLayerInfo | null) => void;
  isHovered: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetScale = isHovered ? 1.15 : 1;

  useFrame(() => {
    if (groupRef.current) {
      // Smooth interpolation for the entire group
      groupRef.current.scale.x = THREE.MathUtils.lerp(
        groupRef.current.scale.x,
        targetScale,
        0.15
      );
      groupRef.current.scale.z = THREE.MathUtils.lerp(
        groupRef.current.scale.z,
        targetScale,
        0.15
      );
    }
  });

  const baseColor = new THREE.Color(item.color_code);
  const separatorColor = baseColor.clone().multiplyScalar(0.75);

  return (
    <group>
      {/* Animated group containing mesh and label */}
      <group ref={groupRef} position={[0, yPos, 0]}>
        {/* Main Layer */}
        <mesh
          position={[0, 0, 0]}
          onPointerEnter={(e) => {
            e.stopPropagation();
            onHover(item);
            document.body.style.cursor = "pointer";
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            onHover(null);
            document.body.style.cursor = "default";
          }}
        >
          <cylinderGeometry args={[radius, radius, depthStep - gap, 32]} />
          <meshStandardMaterial
            color={baseColor}
            transparent
            opacity={isHovered ? 1 : 0.95}
            emissive={baseColor}
            emissiveIntensity={isHovered ? 0.2 : 0}
          />
        </mesh>

        {/* Depth Label - Outside on Right - Now inside the scaled group */}
        <Billboard position={[0.8, 0.62, 1.01]}>
          <Text
            fontSize={0.1}
            color={isHovered ? "#000" : "#555"}
            anchorX="left"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="white"
            fontWeight="bold"
          >
            {item.depth}
          </Text>
        </Billboard>
      </group>

      {/* Separator - Outside the scaled group */}
      {!isLast && (
        <mesh position={[0, yPos - depthStep / 2 + gap / 2, 0]}>
          <cylinderGeometry args={[radius * 1.01, radius * 1.01, gap, 32]} />
          <meshStandardMaterial color={separatorColor} />
        </mesh>
      )}
    </group>
  );
}

/* ---------------- CYLINDER STACK ---------------- */

function BoreholeMesh({
  data,
  radius,
  depthStep,
  onHover,
  hoveredIndex,
}: {
  data: MarLayerInfo[];
  radius: number;
  depthStep: number;
  onHover: (info: MarLayerInfo | null, index: number | null) => void;
  hoveredIndex: number | null;
}) {
  const totalDepth = data.length * depthStep;
  const gap = depthStep * 0.08;

  return (
    <>
      {data.map((item, i) => {
        const yPos = totalDepth / 2 - i * depthStep - depthStep / 2;

        return (
          <AnimatedLayer
            key={i}
            item={item}
            yPos={yPos}
            radius={radius}
            depthStep={depthStep}
            gap={gap}
            isLast={i === data.length - 1}
            onHover={(info) => onHover(info, info ? i : null)}
            isHovered={hoveredIndex === i}
          />
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const totalDepth = data.length * depthStep;
  const computedHeight = Math.max(height, data.length * depthStep * 60);

  const handleHover = (info: MarLayerInfo | null, index: number | null) => {
    setHovered(info);
    setHoveredIndex(index);
  };

  return (
    <div
      style={{
        width: width + 50,
        height: computedHeight + 90,
        position: "relative",
      }}
    >
      {/* Tooltip with layer name */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: hovered.color_code,
                border: "1px solid #ccc",
              }}
            />
            <span style={{ fontWeight: 500 }}>{hovered.layer_name}</span>
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
          onHover={handleHover}
          hoveredIndex={hoveredIndex}
        />
      </Canvas>
    </div>
  );
}