"use client";

import { useRef, useState } from "react";
import { Archive, CheckCircle2, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import { useUiModeStore } from "../../services/uiModeService";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function GeneralShapefileUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { upload, uploadShapefile, resetShapefile } = useGeneralViewModel();
  const isDark = useUiModeStore((s) => s.isDark);
  const isUploading = upload.shapefileStatus === "uploading";

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setValidationError("Only ZIP files containing shapefile components are allowed.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setValidationError(null);
  };

  const resetLocal = () => {
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetShapefile();
  };

  return (
    <section
      className={`rounded-lg border p-3 shadow-sm ${
        isDark ? "border-[#1e3a5f]/60 bg-[#06101e]/85" : "border-stone-200 bg-white"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Archive className={isDark ? "h-4 w-4 text-cyan-300" : "h-4 w-4 text-blue-600"} />
          <h3 className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
            Upload Shapefile
          </h3>
        </div>
        {upload.layerInfo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Loaded
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={isUploading}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          handleFileSelect(event.dataTransfer.files?.[0] || null);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex min-h-[7rem] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 text-center transition ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : isDark
              ? "border-[#1e3a5f] bg-[#0a1628] hover:border-cyan-400/70"
              : "border-stone-300 bg-stone-50 hover:border-blue-400"
        } ${isUploading ? "cursor-wait opacity-70" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          disabled={isUploading}
          onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
          className="hidden"
        />
        <UploadCloud className={isDark ? "mb-2 h-7 w-7 text-cyan-300" : "mb-2 h-7 w-7 text-blue-500"} />
        <span className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          {selectedFile ? selectedFile.name : "Drop ZIP here or browse"}
        </span>
        <span className={`mt-1 text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
          River line or 200m buffer shapefile, max {MAX_FILE_SIZE_MB}MB
        </span>
      </button>

      {(validationError || upload.errorMessage || upload.statusMessage) && (
        <p
          className={`mt-2 rounded-md px-2 py-1.5 text-xs ${
            validationError || upload.errorMessage
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {validationError || upload.errorMessage || upload.statusMessage}
        </p>
      )}

      {upload.layerInfo && (
        <div
          className={`mt-3 rounded-md border px-2 py-2 text-[11px] ${
            isDark ? "border-[#1e3a5f] bg-[#0a1628] text-slate-300" : "border-stone-200 bg-stone-50 text-slate-600"
          }`}
        >
          <div className="font-semibold">{upload.layerInfo.layerName}</div>
          <div>{upload.layerInfo.featureCount} feature(s), {upload.layerInfo.geometryType}</div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!selectedFile || isUploading}
          onClick={() => selectedFile && uploadShapefile(selectedFile)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Upload
        </button>
        <button
          type="button"
          disabled={isUploading}
          onClick={resetLocal}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${
            isDark
              ? "border-[#1e3a5f] text-slate-300 hover:bg-[#0a1628]"
              : "border-stone-200 text-slate-600 hover:bg-stone-50"
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </section>
  );
}

