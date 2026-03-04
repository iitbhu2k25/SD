import React, { useRef, useState, useCallback } from "react";
import { useRaster } from "@/contexts/raster_operations/RasterContext";

const ACCEPTED = [".tif", ".tiff", ".png", ".jpg", ".jpeg"];
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

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={[
          "relative flex flex-col items-center justify-center",
          "min-h-[120px] rounded-xl border-2 border-dashed",
          "cursor-pointer select-none transition-all duration-300 overflow-hidden",
          uploading
            ? "border-slate-600/40 bg-slate-800/15 cursor-not-allowed"
            : drag
            ? "border-cyan-400/60 bg-cyan-500/5 shadow-[0_0_24px_rgba(34,211,238,0.1)]"
            : "border-slate-600/35 bg-slate-800/12 hover:border-blue-500/40 hover:bg-slate-800/30",
        ].join(" ")}
      >
        {/* Scan line when dragging */}
        {drag && !uploading && (
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
            <div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70"
              style={{ animation: "scan 1.5s linear infinite" }}
            />
          </div>
        )}

        {/* Bottom progress bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {uploading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative w-14 h-14">
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
              </svg>
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28" cy="28" r={r}
                  fill="none" stroke="#38bdf8" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-cyan-300 tabular-nums">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-200">Uploading…</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Chunked transfer in progress</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 py-7 px-4 text-center">
            <div className={[
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
              drag ? "bg-cyan-500/15 scale-110" : "bg-slate-700/40",
            ].join(" ")}>
              <svg
                className={`w-5 h-5 transition-colors duration-200 ${drag ? "text-cyan-300" : "text-slate-400"}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className={`text-xs font-semibold transition-colors ${drag ? "text-cyan-200" : "text-slate-200"}`}>
                {drag ? "Drop to upload" : "Click or drag & drop"}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {ACCEPTED.join(" / ")} — max {MAX_MB} MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {displayError && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
          <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-red-300 leading-relaxed">{displayError}</p>
        </div>
      )}

      {/* Layer status pill */}
      {layer && !uploading && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/35 rounded-xl border border-slate-700/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span className="text-[11px] text-slate-400 font-medium truncate" title={layer.file_name}>
              {layer.file_name}
            </span>
          </div>
          <span className="text-[10px] text-emerald-300 font-medium">Active</span>
        </div>
      )}
    </div>
  );
};

export default UploadRaster;