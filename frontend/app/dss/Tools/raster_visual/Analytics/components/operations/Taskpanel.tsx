import React from "react";
import { OperationDef } from "@/contexts/raster_operations/registry";
import { TaskState } from "@/interface/raster_operations";

interface Props {
  op: OperationDef;
  taskState: TaskState;
  onBack: () => void;
  onReset: () => void;
  onViewOnMap?: (layerName: string) => void;
  onDownload?: (fileId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitting: "Submitting…",
  pending:    "Queued",
  running:    "Processing",
  completed:  "Completed",
  failed:     "Failed",
};

const TaskPanel: React.FC<Props> = ({
  op, taskState, onBack, onReset, onViewOnMap, onDownload,
}) => {
  const { taskId, status, progress, logs, result, error } = taskState;
  const color = `var(${op.accentColor})`;
  const isDone   = status === "completed";
  const isFailed = status === "failed";
  const isActive = status === "pending" || status === "running" || status === "submitting";

  const dotColor = isDone
    ? "var(--accent)"
    : isFailed
    ? "#ef4444"
    : isActive
    ? color
    : "var(--text-muted)";

  return (
    <div className="terra-fade-in space-y-3">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 py-1 text-[11px] transition-colors"
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Operations
        </button>
        <span style={{ color: "var(--border-muted)" }}>/</span>
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {op.label}
        </span>
      </div>

      {/* ── Status card ──────────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          border: `1px solid ${isDone ? "var(--accent-border)" : isFailed ? "#fca5a5" : "var(--border-subtle)"}`,
          background: isDone ? "var(--accent-bg)" : isFailed ? "rgba(239,68,68,0.06)" : "var(--surface-card)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-3">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              background: dotColor,
              boxShadow: isActive ? `0 0 0 3px ${dotColor}33` : "none",
              animation: isActive ? "terra-pulse 1.2s ease-in-out infinite" : "none",
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: isDone ? "var(--accent)" : "var(--text-primary)" }}>
              {op.label} — {STATUS_LABELS[status] ?? status}
            </p>
            {taskId && (
              <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {taskId}
              </p>
            )}
          </div>
          {isDone && (
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {isFailed && (
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#ef4444" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ padding: "0 12px 12px" }}>
          <div className="flex justify-between mb-1">
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Progress</span>
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{progress}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--border-muted)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 2,
                background: isDone ? "var(--accent)" : isFailed ? "#ef4444" : color,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div
            style={{
              margin: "0 12px 12px",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-muted)",
              maxHeight: 100,
              overflowY: "auto",
            }}
          >
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2" style={{ fontSize: 10, fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>{log.timestamp}</span>
                <span style={{ color: "var(--text-secondary)" }}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Error detail ──────────────────────────────────────────────────── */}
      {isFailed && error && (
        <div
          className="p-3"
          style={{
            borderRadius: "var(--radius-md)",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <p className="text-[10px]" style={{ color: "#b91c1c", fontFamily: "var(--font-mono)" }}>
            {error}
          </p>
        </div>
      )}

      {/* ── Result card ───────────────────────────────────────────────────── */}
      {isDone && result && (
        <div
          className="p-3 space-y-2"
          style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--accent-border)",
            background: "var(--accent-bg)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: "var(--accent)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}
          >
            Output ready
          </p>

          {/* Result rows */}
          {(
            [
              ["file_name",  result.layer_name],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4">
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{k}</span>
              <span
                style={{
                  fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500,
                  color: "var(--text-primary)", maxWidth: 200, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
                title={v}
              >
                {v}
              </span>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            
            {onDownload && (
              <button
                onClick={() => onDownload(result.file_id)}
                className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-medium transition-colors"
                style={{
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                }}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Post-task actions ─────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {isDone && (
          <button
            onClick={onReset}
            className="flex-1 py-2.5 text-[12px] font-semibold transition-colors"
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-card)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}
          >
            Run another
          </button>
        )}
        {isFailed && (
          <button
            onClick={onBack}
            className="flex-1 py-2.5 text-[12px] font-semibold transition-colors"
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-card)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskPanel;