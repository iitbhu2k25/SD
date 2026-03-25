"use client";
import { useRaster } from "@/contexts/raster_operations/RasterContext";

import React, { useRef, useState, useCallback } from "react";

const ACCEPTED = [".zip"];
const MAX_MB = 20;
const MAX_SIZE = MAX_MB * 1024 * 1024;

export type VectorLayer = {
  file_name: string;
  file_id: string;
};

type Props = {
  onUploaded: (layer: VectorLayer) => void;
};

const UploadVector: React.FC<Props> = ({ onUploaded }) => {
  const {handleVectorUpload} = useRaster();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<VectorLayer | null>(null);

  const process = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      if (file.size > MAX_SIZE) {
        setError(`File too large. Max ${MAX_MB} MB.`);
        return;
      }
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        setError(`Unsupported format. Use: ${ACCEPTED.join(", ")}`);
        return;
      }
      const result = await handleVectorUpload(file);
      if (result) {
        setLayer(result);
        onUploaded(result);
      }
    },
    [handleVectorUpload, onUploaded]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    process(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    process(e.dataTransfer.files[0]);
  };

  const handleRemove = () => {
    setLayer(null);
    setProgress(0);
  };

  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;

  if (layer) {
    return (
      <div
        className="flex items-center gap-2.5 p-2.5"
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "var(--green-bg, rgba(34,197,94,0.08))",
            border: "1px solid var(--green-border, rgba(34,197,94,0.2))",
          }}
        >
          <svg
            className="w-4 h-4"
            style={{ color: "var(--green)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {layer.file_name}
          </p>
          <p
            className="text-[9px]"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            {layer.file_id}
          </p>
        </div>
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-md flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
          title="Remove vector"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={onInputChange}
        disabled={uploading}
        className="hidden"
      />

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center min-h-[140px] select-none transition-all duration-300 overflow-hidden"
        style={{
          borderRadius: "var(--radius-lg)",
          border: `2px dashed ${uploading ? "var(--border-strong)" : drag ? "var(--green)" : "var(--border-strong)"}`,
          background: uploading ? "var(--surface-card)" : drag ? "rgba(34,197,94,0.06)" : "var(--surface-card)",
          cursor: uploading ? "not-allowed" : "pointer",
          boxShadow: drag ? "0 0 0 4px rgba(34,197,94,0.08)" : "var(--shadow-sm)",
        }}
      >
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "var(--border-subtle)" }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--green), var(--accent))",
                borderRadius: "0 2px 2px 0",
              }}
            />
          </div>
        )}

        {uploading ? (
          <div className="flex flex-col items-center gap-3 py-5">
            <div className="relative w-14 h-14">
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
              </svg>
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={r} fill="none" stroke="var(--green)" strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} className="transition-all duration-300" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold tabular-nums"
                  style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Uploading…</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Processing vector data
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
              style={{
                background: drag ? "rgba(34,197,94,0.12)" : "var(--surface-sunken)",
                transform: drag ? "scale(1.1)" : "scale(1)",
                border: `1px solid ${drag ? "rgba(34,197,94,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              <svg className="w-5 h-5 transition-colors duration-200"
                style={{ color: drag ? "var(--green)" : "var(--text-muted)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold transition-colors"
                style={{ color: drag ? "var(--green)" : "var(--text-primary)" }}>
                {drag ? "Drop to upload" : "Click or drag & drop"}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {ACCEPTED.join(" / ")} — max {MAX_MB} MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex items-start gap-2 px-3 py-2.5"
          style={{
            background: "var(--red-bg)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--red)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed" style={{ color: "#b91c1c" }}>{error}</p>
        </div>
      )}
    </div>
  );
};

export default UploadVector;
