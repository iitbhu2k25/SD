"use client";

import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useState, useRef } from "react";
import { Text } from "@react-three/drei";
import { MarLayerInfo } from "@/interface/raster_context";
import { Edges } from '@react-three/drei';


/* ---------------- TYPES ---------------- */

interface BoreholeProps {
  data: MarLayerInfo[];
  width?: number;
  height?: number;
  depthStep?: number;
  logWidth?: number;
}

/* ---------------- 2D ANIMATED LAYER ---------------- */

function AnimatedLayer2D({
  item,
  yPos,
  logWidth,
  depthStep,
  gap,
  isLast,
  onHover,
  isHovered,
}: {
  item: MarLayerInfo;
  yPos: number;
  logWidth: number;
  depthStep: number;
  gap: number;
  isLast: boolean;
  onHover: (info: MarLayerInfo | null) => void;
  isHovered: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetScale = isHovered ? 1.05 : 1;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.scale.x = THREE.MathUtils.lerp(
        groupRef.current.scale.x,
        targetScale,
        0.15
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, yPos, 0]}>
      {/* Lithology rectangle */}
      <mesh
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
        {/* Layer rectangle */}
        <planeGeometry args={[logWidth, depthStep - gap]} />
        <meshBasicMaterial
          color={isHovered ? item.color_code : item.color_code}
          side={THREE.DoubleSide}
          transparent
          opacity={isHovered ? 1 : 0.9}
        />

        {/* Black border */}
        <Edges
          geometry={new THREE.PlaneGeometry(logWidth, depthStep - gap)}
          scale={1}
          color="black"
          lineWidth={1}
        />
      </mesh>


      {/* Depth label */}
      <Text
        position={[logWidth / 2 + 0.15, 0, 0]}
        fontSize={0.1}
        anchorX="left"
        anchorY="middle"
        color="#333"
      >
        {item.depth}
      </Text>

      {/* Separator line */}
      {!isLast && (
        <mesh position={[0, -(depthStep / 2), 0]}>
          <planeGeometry args={[logWidth, gap]} />
          <meshBasicMaterial color="#000000ff" />
        </mesh>
      )}
    </group>
  );
}

/* ---------------- 2D LOG STACK ---------------- */

function LithologyLog2D({
  data,
  logWidth,
  depthStep,
  onHover,
  hoveredIndex,
}: {
  data: MarLayerInfo[];
  logWidth: number;
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
          <AnimatedLayer2D
            key={i}
            item={item}
            yPos={yPos-0.3}
            logWidth={logWidth}
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

export default function SubsurfaceBorehole2D({
  data,
  width = 140,
  height = 160,
  depthStep = 1,
  logWidth = 1,
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
        width: width + 80,
        height: computedHeight + 60,
        position: "relative",
      }}
    >
      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: "",
            background: "white",
            padding: "8px 12px",
            borderRadius: 8,
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            border: "1px solid #e5e7eb",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div  className="flex py-1 items-center gap-2">
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
          position: [0, 0, 10],
          near: 0.1,
          far: 100,
        }}
      >
        <LithologyLog2D
          data={data}
          logWidth={logWidth}
          depthStep={depthStep}
          onHover={handleHover}
          hoveredIndex={hoveredIndex}
        />
      </Canvas>
    </div>
  );
}
