"use client";
import React, { useState } from "react";
import type { VectorLayer } from "./UploadVector";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import { useOperationTask } from "@/contexts/raster_operations/Useoperationtask";
import TaskPanel from "./operations/Taskpanel";
import type { OperationDef } from "@/contexts/raster_operations/registry";
import { downloadRaster } from "@/utils/rasterUtils";
import type { MapViewHandle, ExtentResult } from "./Mapview";

const VECTOR_OP_DEFS: OperationDef[] = [
  {
    id: "euclidean_distance",
    label: "Euclidean Distance",
    description: "Calculates the straight-line distance from each cell to the nearest source feature.",
    category: "distance",
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    accentColor: "--blue",
    params: [],
    apiEndpoint: "/tools/ecludian",
  },
  {
    id: "interpolation",
    label: "Interpolation",
    description: "Estimates unknown values between known data points using spatial interpolation methods.",
    category: "distance",
    icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
    accentColor: "--purple",
    params: [],
    apiEndpoint: "/tools/interpolation",
  },
];

type View = "list" | "task";

// Operations that require an extent to be drawn on the map
const EXTENT_OPS = new Set(["euclidean_distance", "interpolation"]);

type Props = {
  layer: VectorLayer | null;
  mapViewRef: React.RefObject<MapViewHandle | null>;
};

const INTERPOLATION_ALGORITHMS = ["nearest", "invdist", "invdistnn", "linear", "average"] as const;

const VectorOperationsPanel: React.FC<Props> = ({ layer, mapViewRef }) => {
  const { taskState, setTaskState, vectorDetails } = useRaster();
  const [selected, setSelected] = useState<OperationDef | null>(null);
  const [view, setView] = useState<View>("list");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [extent, setExtent] = useState<ExtentResult | null>(null);
  const [drawingExtent, setDrawingExtent] = useState(false);
  const [zField, setZField] = useState<string>("");
  const [algorithm, setAlgorithm] = useState<string>("nearest");

  const { execute, reset } = useOperationTask(
    layer?.file_id ?? "",
    "0",
    setTaskState,
  );

  const hasLayer = !!layer;
  const needsExtent = selected ? EXTENT_OPS.has(selected.id) : false;

  // Interpolation only valid for 3D Point geometry
  const geomType = vectorDetails?.geometry_type ?? "";
  const is3DPoint = /3d\s*point|point\s*z/i.test(geomType);
  // Euclidean distance valid for 3D Point or 3D LineString geometry
  const is3DPointOrLine = /3d\s*point|point\s*z|3d\s*line|linestring\s*z/i.test(geomType);

  // Only numeric fields can be used as Z
  const numericFields = (vectorDetails?.attribute_schema ?? []).filter((f) =>
    /int|float|double|real|numeric|decimal/i.test(f.type)
  );

  const handleSelectOp = (op: OperationDef) => {
    const wasSelected = selected?.id === op.id;
    // Cancel any active draw if switching ops
    if (!wasSelected && drawingExtent) {
      mapViewRef.current?.disableExtentDraw();
      setDrawingExtent(false);
    }
    setExtent(null);
    setZField("");
    setAlgorithm("nearest");
    setSelected(wasSelected ? null : op);
  };

  const handleDrawExtent = () => {
    setDrawingExtent(true);
    mapViewRef.current?.enableExtentDraw((ext) => {
      setExtent(ext);
      setDrawingExtent(false);
    });
  };

  const handleClearExtent = () => {
    mapViewRef.current?.disableExtentDraw();
    setExtent(null);
    setDrawingExtent(false);
  };

  const handleRun = async () => {
    if (!selected || !layer) return;
    setView("task");
    const extraParams: Record<string, unknown> = extent ? { ...extent } : {};
    if (selected.id === "interpolation") {
      extraParams.z_field = zField;
      extraParams.algorithm = algorithm;
    }
    await execute(selected, extraParams);
  };

  const handleReset = () => {
    mapViewRef.current?.disableExtentDraw();
    reset();
    setView("list");
    setSelected(null);
    setExtent(null);
    setDrawingExtent(false);
  };

  const handleDownload = async (fileId: string) => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      await downloadRaster(fileId, `${fileId}raster.tif`, setDownloadProgress);
    } catch (error) {
      console.error("Download failed", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Task view ───────────────────────────────────────────────────────────────
  if (view === "task" && selected) {
    return (
      <TaskPanel
        op={selected}
        taskState={taskState}
        onBack={() => setView("list")}
        onReset={handleReset}
        onDownload={handleDownload}
        downloadProgress={downloadProgress}
        isDownloading={isDownloading}
      />
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 terra-fade-in">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: "var(--green-bg, rgba(34,197,94,0.08))", border: "1px solid var(--green-border, rgba(34,197,94,0.2))" }}
        >
          <svg className="w-3 h-3" style={{ color: "var(--green)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-[11px] font-bold uppercase"
          style={{ color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
          Vector Operations
        </span>
        <span className="terra-badge terra-badge--ready ml-auto" style={{ fontSize: 9 }}>
          {VECTOR_OP_DEFS.length} tools
        </span>
      </div>

      {/* No-layer warning */}
      {!hasLayer && (
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{
            background: "var(--amber-bg)",
            border: "1px solid var(--amber-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--amber)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-[10px] font-medium" style={{ color: "#92400e" }}>
            Upload a vector file first to enable operations
          </p>
        </div>
      )}

      {/* Operation cards */}
      <div className="space-y-2">
        {VECTOR_OP_DEFS.map((op) => {
          const isInterp = op.id === "interpolation";
          const isEuclid = op.id === "euclidean_distance";
          const opDisabled = !hasLayer || (isInterp && !is3DPoint) || (isEuclid && !is3DPointOrLine);
          const isSelected = selected?.id === op.id;
          const color = `var(${op.accentColor})`;
          const bg = `var(${op.accentColor}-bg)`;
          const border = `var(${op.accentColor}-border)`;
          return (
            <div key={op.id}>
              <button
                disabled={opDisabled}
                onClick={() => handleSelectOp(op)}
                className="w-full text-left transition-all duration-150"
                style={{
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${isSelected ? border : "var(--border-subtle)"}`,
                  background: isSelected ? bg : "var(--surface-card)",
                  padding: "10px 12px",
                  opacity: opDisabled ? 0.5 : 1,
                  cursor: opDisabled ? "not-allowed" : "pointer",
                  boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: isSelected ? bg : "var(--surface-sunken)",
                      border: `1px solid ${isSelected ? border : "var(--border-subtle)"}`,
                    }}
                  >
                    <svg className="w-3.5 h-3.5" style={{ color: isSelected ? color : "var(--text-muted)" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={op.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold"
                      style={{ color: isSelected ? color : "var(--text-primary)" }}>
                      {op.label}
                    </p>
                    <p className="text-[10px] mt-0.5 leading-relaxed"
                      style={{ color: "var(--text-muted)" }}>
                      {op.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: color }}
                    >
                      <svg className="w-2.5 h-2.5" style={{ color: "#fff" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
              {/* Hint shown when a vector is loaded but geometry is not 3D Point */}
              {isInterp && hasLayer && !is3DPoint && (
                <p className="text-[9px] px-1 pt-0.5" style={{ color: "var(--text-muted)" }}>
                  Requires 3D Point geometry (current: {geomType || "unknown"})
                </p>
              )}
              {/* Hint shown when a vector is loaded but geometry is not 3D Point or 3D LineString */}
              {isEuclid && hasLayer && !is3DPointOrLine && (
                <p className="text-[9px] px-1 pt-0.5" style={{ color: "var(--text-muted)" }}>
                  Requires 3D Point or 3D LineString geometry (current: {geomType || "unknown"})
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Extent draw UI — shown when euclidean_distance or interpolation is selected */}
      {selected && hasLayer && needsExtent && (
        <div
          className="space-y-2 p-3"
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border-strong)",
            background: "var(--surface-sunken)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
            Extent (optional)
          </p>

          {/* No extent yet */}
          {!extent && !drawingExtent && (
            <button
              onClick={handleDrawExtent}
              className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-semibold transition-all"
              style={{
                borderRadius: "var(--radius-md)",
                background: "var(--blue-bg)",
                color: "var(--blue)",
                border: "1px solid var(--blue-border)",
                cursor: "pointer",
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Draw Extent on Map
            </button>
          )}

          {/* Drawing in progress */}
          {drawingExtent && (
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{
                borderRadius: "var(--radius-md)",
                background: "var(--amber-bg)",
                border: "1px solid var(--amber-border)",
              }}
            >
              <span className="text-[11px] font-medium" style={{ color: "#92400e" }}>
                Drag on map to draw extent…
              </span>
              <button onClick={handleClearExtent} className="text-[10px]" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}

          {/* Extent drawn */}
          {extent && (
            <div
              className="space-y-1.5 px-3 py-2"
              style={{
                borderRadius: "var(--radius-md)",
                background: "var(--surface-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(["xmin", "xmax", "ymin", "ymax"] as const).map((k) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[9px] font-bold uppercase" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{k}</span>
                    <span className="text-[9px]" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {extent[k].toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleClearExtent}
                className="w-full text-[10px] py-1 transition-all"
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                Clear extent
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interpolation params — z_field & algorithm */}
      {selected?.id === "interpolation" && hasLayer && (
        <div
          className="space-y-2 p-3"
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border-strong)",
            background: "var(--surface-sunken)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
            Interpolation Parameters
          </p>

          {/* Z Field selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Z Field</label>
            <select
              value={zField}
              onChange={(e) => setZField(e.target.value)}
              className="w-full text-[11px] px-2 py-1.5"
              style={{
                borderRadius: "var(--radius-md)",
                border: `1px solid ${zField ? "var(--purple-border, rgba(83,74,183,0.4))" : "var(--border-subtle)"}`,
                background: "var(--surface-card)",
                color: zField ? "var(--text-primary)" : "var(--text-muted)",
                outline: "none",
              }}
            >
              <option value="">Select numeric field…</option>
              {numericFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({f.type})
                </option>
              ))}
            </select>
          </div>

          {/* Algorithm selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Algorithm</label>
            <div className="flex flex-wrap gap-1.5">
              {INTERPOLATION_ALGORITHMS.map((alg) => (
                <button
                  key={alg}
                  onClick={() => setAlgorithm(alg)}
                  className="px-2 py-1 text-[10px] font-semibold transition-all"
                  style={{
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${algorithm === alg ? "var(--purple-border, rgba(83,74,183,0.4))" : "var(--border-subtle)"}`,
                    background: algorithm === alg ? "var(--purple-bg, rgba(83,74,183,0.08))" : "var(--surface-card)",
                    color: algorithm === alg ? "var(--purple, #534AB7)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {alg}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Run button */}
      {selected && hasLayer && (
        <button
          onClick={handleRun}
          disabled={drawingExtent || (selected.id === "interpolation" && !zField)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-semibold transition-all"
          style={{
            borderRadius: "var(--radius-md)",
            background: (drawingExtent || (selected.id === "interpolation" && !zField)) ? "var(--surface-sunken)" : "var(--accent)",
            color: (drawingExtent || (selected.id === "interpolation" && !zField)) ? "var(--text-muted)" : "#fff",
            border: "none",
            cursor: (drawingExtent || (selected.id === "interpolation" && !zField)) ? "not-allowed" : "pointer",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Run {selected.label}
        </button>
      )}
    </div>
  );
};

export default VectorOperationsPanel;
