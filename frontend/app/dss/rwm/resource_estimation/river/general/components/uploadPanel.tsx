"use client";

import { useState, useRef } from "react";
import { ClipboardList, UploadCloud, Archive, FileText, AlertTriangle, Loader2 } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

interface UploadPanelProps {
  onUploadSuccess: (layerInfo: LayerInfo) => void;
  onReset?: () => void; // Callback when reset is clicked
}

interface LayerInfo {
  layerName: string;
  wmsUrl: string;
  wfsUrl: string;
  geometryType: string;
  bufferCreated: boolean;
  featureCount: number;
  bbox: [number, number, number, number] | null;
}

const API_BASE_URL =
  `${process.env.NEXT_PUBLIC_DJANGO_URL}`;

// File size limit: 10MB
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const UploadPanel: React.FC<UploadPanelProps> = ({
  onUploadSuccess,
  onReset,
}) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setStatus("error");
      setMessage("Only ZIP files containing shapefiles are allowed.");
      setSelectedFile(null);
      return;
    }

    // 10MB limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatus("error");
      setMessage(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setStatus("idle");
    setMessage("");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelect(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatus("error");
      setMessage("Please select a file to upload.");
      return;
    }

    setStatus("uploading");
    setMessage("Uploading file...");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Simulate progress for UX (actual progress would require XHR)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(
        `${API_BASE_URL}/rwm/general/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus("error");
        setMessage(data.error || "Upload failed. Please try again.");
        return;
      }

      // Success
      setStatus("success");
      setMessage(data.message || "Upload successful!");

      // Notify parent with layer info
      onUploadSuccess({
        layerName: data.layer_name,
        wmsUrl: data.wms_url,
        wfsUrl: data.wfs_url,
        geometryType: data.geometry_type,
        bufferCreated: data.buffer_created,
        featureCount: data.feature_count,
        bbox: data.bbox || null,
      });
    } catch (error) {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
      console.error("Upload error:", error);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setStatus("idle");
    setMessage("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Notify parent to clear layerInfo and reset map
    if (onReset) {
      onReset();
    }
  };

  const isUploading = status === "uploading" || status === "processing";

  return (
    <div className="w-full px-5 pt-5 flex flex-col">

      {/* Instructions Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5 transition-shadow hover:shadow-md">
        <h3 className="text-xl font-bold tracking-tight text-gray-800 mb-4 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-500" /> Instructions
        </h3>
        <ul className="space-y-3 text-sm text-gray-600 font-medium">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span>
              Upload a <strong>river shapefile</strong> (LineString) or a{" "}
              <strong>buffer shapefile</strong> (Polygon).
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span>
              If a river is uploaded, a <strong>200m buffer</strong> will be
              created automatically.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              3
            </span>
            <span>
              Files must be in <strong>ZIP format</strong> containing all
              shapefile components (.shp, .shx, .dbf, .prj)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
            <span>
              Maximum file size: <strong>{MAX_FILE_SIZE_MB}MB</strong>
            </span>
          </li>
        </ul>

        {/* Warning for buffer uploads */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Note:</strong> If uploading a buffer, please ensure it is a
          200m buffer shapefile. Buffers that deviate significantly from 200m
          may be rejected.
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col transition-shadow hover:shadow-md">
        <h3 className="text-xl font-bold tracking-tight text-gray-800 mb-4 flex items-center gap-2">
          <Archive className="w-6 h-6 text-green-500" /> Upload Shapefile (ZIP)
        </h3>

        {/* Drop + Actions Row */}
        <div className="flex flex-col h-[120px] md:flex-row gap-4 mt-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`md:w-1/2 w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300 ${isDragActive
              ? "border-blue-500 bg-blue-50 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[1.02]"
              : selectedFile
                ? "border-green-400 bg-green-50 shadow-sm"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 hover:shadow-sm"
              } ${isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              disabled={isUploading}
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              className="hidden"
            />

            {selectedFile ? (
              <div className="text-center flex flex-col items-center">
                <FileText className="w-10 h-10 mb-2 text-green-600 drop-shadow-sm" />
                <p className="text-green-800 font-bold tracking-tight">
                  {selectedFile.name}
                </p>
                <p className="text-sm font-medium text-green-600/70 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="text-center flex flex-col items-center">
                <UploadCloud className="w-10 h-10 mb-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <p className="text-gray-700 font-bold tracking-tight">
                  Drag & drop your ZIP file here
                </p>
                <p className="text-sm font-medium text-gray-500 mt-1">
                  or click to browse files (max {MAX_FILE_SIZE_MB}MB)
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="md:w-1/2 w-full h-full flex flex-col gap-3 justify-center">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className={`py-3 px-6 rounded-lg font-bold tracking-tight transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${!selectedFile || isUploading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed border-none"
                : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" /> Upload & Process
                </>
              )}
            </button>

            <button
              onClick={resetUpload}
              disabled={isUploading}
              className="py-3 px-6 rounded-lg font-semibold border-2 border-gray-300 text-gray-600 hover:bg-gray-100 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1 text-center">
              {uploadProgress < 100 ? "Uploading..." : "Processing..."}
            </p>
          </div>
        )}

        {/* Status Message */}
        {message && (
          <div
            className={`mt-4 p-2 rounded-lg ${status === "success"
              ? "bg-green-100 text-green-800 border border-green-200"
              : status === "error"
                ? "bg-red-100 text-red-800 border border-red-200"
                : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPanel;
