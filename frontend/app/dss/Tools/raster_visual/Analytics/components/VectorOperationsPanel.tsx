"use client";
import React, { useState } from "react";
import type { VectorLayer } from "./UploadVector";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import { useOperationTask } from "@/contexts/raster_operations/Useoperationtask";
import TaskPanel from "./operations/Taskpanel";
import type { OperationDef } from "@/contexts/raster_operations/registry";
import { api } from "@/services/api";

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

type Props = {
  layer: VectorLayer | null;
};

const VectorOperationsPanel: React.FC<Props> = ({ layer }) => {
  const { taskState, setTaskState } = useRaster();
  const [selected, setSelected] = useState<OperationDef | null>(null);
  const [view, setView] = useState<View>("list");

  const { execute, reset } = useOperationTask(
    layer?.file_id ?? "",
    "0",
    setTaskState,
  );

  const hasLayer = !!layer;

  const handleRun = async () => {
    if (!selected || !layer) return;
    setView("task");
    await execute(selected, {});
  };

  const handleReset = () => {
    reset();
    setView("list");
    setSelected(null);
  };

  const handleDownload = async (fileId: string) => {
    try {
      const res = await api.get<Blob>(`/tools/raster/download/${fileId}`, {
        responseType: "blob",
      });
      if (!res.message) return;
      const url = window.URL.createObjectURL(res.message);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileId}raster.tif`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed", error);
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
          const isSelected = selected?.id === op.id;
          const color = `var(${op.accentColor})`;
          const bg = `var(${op.accentColor}-bg)`;
          const border = `var(${op.accentColor}-border)`;
          return (
            <button
              key={op.id}
              disabled={!hasLayer}
              onClick={() => setSelected(isSelected ? null : op)}
              className="w-full text-left transition-all duration-150"
              style={{
                borderRadius: "var(--radius-md)",
                border: `1px solid ${isSelected ? border : "var(--border-subtle)"}`,
                background: isSelected ? bg : "var(--surface-card)",
                padding: "10px 12px",
                opacity: !hasLayer ? 0.5 : 1,
                cursor: !hasLayer ? "not-allowed" : "pointer",
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
          );
        })}
      </div>

      {/* Run button */}
      {selected && hasLayer && (
        <button
          onClick={handleRun}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-semibold transition-all"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
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
