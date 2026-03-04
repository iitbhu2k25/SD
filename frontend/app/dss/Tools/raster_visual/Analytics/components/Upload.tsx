import React, { useRef, useState, useCallback } from "react";
import { useRaster } from "@/contexts/raster_operations/RasterContext";

const ACCEPTED = [".tif", ".tiff"];
const MAX_MB = 500;
const MAX_SIZE = MAX_MB * 1024 * 1024;



const UploadRaster: React.FC = () => {
  const { uploading, uploadProgress, layer, error, handleUpload } = useRaster();

  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const process = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setLocalError(null);
      if (file.size > MAX_SIZE) {
        setLocalError(`File too large. Max ${MAX_MB} MB.`);
        return;
      }
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        setLocalError(`Unsupported format. Use: ${ACCEPTED.join(", ")}`);
        return;
      }
      handleUpload(file);
    },
    [handleUpload]
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

  const displayError = localError ?? error;

  // ── Circular SVG progress ─────────────────────────────────────────────────
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (uploadProgress / 100) * circ;

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

      {/* ── Drop zone ────────────────────────────────────────────────────── */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center min-h-[140px] select-none transition-all duration-300 overflow-hidden"
        style={{
          borderRadius: 'var(--radius-lg)',
          border: `2px dashed ${
            uploading
              ? 'var(--border-strong)'
              : drag
              ? 'var(--accent)'
              : 'var(--border-strong)'
          }`,
          background: uploading
            ? 'var(--surface-card)'
            : drag
            ? 'var(--accent-bg)'
            : 'var(--surface-card)',
          cursor: uploading ? 'not-allowed' : 'pointer',
          boxShadow: drag ? '0 0 0 4px rgba(13, 155, 122, 0.08)' : 'var(--shadow-sm)',
        }}
      >
        {/* Scan line when dragging */}
        {drag && !uploading && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div
              className="absolute left-0 right-0 h-px opacity-60"
              style={{
                background: 'linear-gradient(to right, transparent, var(--accent), transparent)',
                animation: 'scan 1.5s linear infinite',
              }}
            />
          </div>
        )}

        {/* Bottom progress bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'var(--border-subtle)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${uploadProgress}%`,
                background: `linear-gradient(90deg, var(--accent), var(--blue))`,
                borderRadius: '0 2px 2px 0',
              }}
            />
          </div>
        )}

        {uploading ? (
          /* ── Upload progress state ─────────────────────────────────────── */
          <div className="flex flex-col items-center gap-3 py-5">
            <div className="relative w-14 h-14">
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
              </svg>
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28" cy="28" r={r}
                  fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                >
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Uploading…</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Chunked transfer in progress
              </p>
            </div>
          </div>
        ) : (
          /* ── Idle / drag state ─────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
              style={{
                background: drag ? 'rgba(13, 155, 122, 0.12)' : 'var(--surface-sunken)',
                transform: drag ? 'scale(1.1)' : 'scale(1)',
                border: `1px solid ${drag ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
              }}
            >
              <svg
                className="w-5 h-5 transition-colors duration-200"
                style={{ color: drag ? 'var(--accent)' : 'var(--text-muted)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p
                className="text-[13px] font-semibold transition-colors"
                style={{ color: drag ? 'var(--accent)' : 'var(--text-primary)' }}
              >
                {drag ? "Drop to upload" : "Click or drag & drop"}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {ACCEPTED.join(" / ")} — max {MAX_MB} MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {displayError && (
        <div
          className="flex items-start gap-2 px-3 py-2.5"
          style={{
            background: 'var(--red-bg)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--red)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed" style={{ color: '#b91c1c' }}>{displayError}</p>
        </div>
      )}

      {/* ── Active layer pill ────────────────────────────────────────────── */}
      {layer && !uploading && (
        <div
          className="flex items-center justify-between px-3 py-2.5"
          style={{
            background: 'var(--surface-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-[6px] h-[6px] rounded-full terra-pulse-dot"
              style={{ background: 'var(--green)', boxShadow: '0 0 6px rgba(34,197,94,0.4)' }}
            />
            <span
              className="text-[11px] font-medium truncate"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', maxWidth: '200px' }}
              title={layer.file_name}
            >
              {layer.file_name}
            </span>
          </div>
          <span className="terra-badge terra-badge--success">Active</span>
        </div>
      )}
    </div>
  );
};

export default UploadRaster;