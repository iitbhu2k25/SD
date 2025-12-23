import React, { useState, useEffect, useRef, useCallback, JSX } from "react";
import {
  FileText,
  Download,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "@/services/api";
import { useWebSocket } from "@/services/websocket";
import { on } from "node:events";

interface PDFGenerationStatusProps {
  taskId: string | null;
  className?: string;
  autoClose?: boolean;
  closeDelay?: number;
  enableAutoDownload?: boolean;
  onComplete?: () => void; // Add this prop
  onFailure?: () => void;
}

const PDFGenerationStatus: React.FC<PDFGenerationStatusProps> = ({
  taskId,
  className = "",
  autoClose = true,
  closeDelay = 3000,
  enableAutoDownload = true,
  onComplete, // Add this
  onFailure,
}) => {
  const [status, setStatus] = useState<
    "idle" | "pending" | "started" | "progress" | "success" | "downloading" | "complete" | "failure"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(100);
  const [description, setDescription] = useState("");
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [chordId, setChordId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasDownloadedRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);

  // Store taskId in ref to keep WebSocket URL stable
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // Only update wsUrl when taskId actually changes and is valid
  useEffect(() => {
    if (taskId && taskId !== currentTaskIdRef.current) {
      currentTaskIdRef.current = taskId;
      hasDownloadedRef.current = false;
      setStatus("idle");
      setProgress(0);
      setTotal(100);
      setDescription("");
      setTimeElapsed(0);
      setChordId(null);
      setWsUrl(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/stp_operation/ws/${taskId}`);
    } else if (!taskId) {
      currentTaskIdRef.current = null;
      setWsUrl(null);
    }
  }, [taskId]);

  // Only connect when we have a valid URL and not in terminal state
  const shouldConnect = Boolean(wsUrl && !["complete", "failure"].includes(status));

  // Use empty string when not connecting - your hook should handle this
  const { messages, isConnected, disconnect } = useWebSocket(
    shouldConnect && wsUrl ? wsUrl : "",
    { reconnect: false }
  );

  // Timer effect
  useEffect(() => {
    if (["started", "progress", "downloading"].includes(status)) {
      timerRef.current = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (status === "idle") setTimeElapsed(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // Connection status effect
  useEffect(() => {
    if (!taskId || !wsUrl) {
      return;
    }
    if (isConnected && status === "idle") {
      setStatus("pending");
      setDescription("Connecting...");
    }
  }, [isConnected, taskId, wsUrl, status]);

  // Message processing effect
  useEffect(() => {
    if (!messages.length || hasDownloadedRef.current || status === "complete" || !wsUrl) {
      return;
    }

    const lastMessage = messages[messages.length - 1];

    try {
      const parsed = JSON.parse(lastMessage);
      console.log("WebSocket message received:", parsed);

      if (!parsed.state) return;

      const state = parsed.state.toUpperCase();

      // Skip if this is a duplicate SUCCESS message
      if (state === "SUCCESS" && chordId === parsed.result) return;

      switch (state) {
        case "PENDING":
          setStatus("pending");
          setProgress(parsed.progress || 0);
          setTotal(parsed.total || 100);
          setDescription(parsed.description || "Pending...");
          break;
        case "STARTED":
          setStatus("started");
          setDescription("Starting PDF generation...");
          toast.info("PDF generation started");
          break;
        case "PROGRESS":
          setStatus("progress");
          setProgress(parsed.progress || 0);
          setTotal(parsed.total || 100);
          setDescription(parsed.description || "Generating...");
          break;
        case "SUCCESS":
          console.log("SUCCESS state received, chord_id:", parsed.result);
          setStatus("success");
          setProgress(parsed.total || 100);
          setTotal(parsed.total || 100);
          setDescription("PDF ready!");
          setChordId(parsed.result);
          break;
        case "FAILURE":
        case "ERROR":
          setStatus("failure");
          setDescription(parsed.description || "Failed to generate PDF");
          toast.error(parsed.description || "Failed to generate PDF");
          disconnect();
          if (onFailure) {
            onFailure();
          }
          break;
      }
    } catch {
      console.warn("Non-JSON message:", lastMessage);
    }
  }, [messages, chordId, status, wsUrl, disconnect, onFailure]);

  // Reset helper function
  const reset = useCallback(() => {
    currentTaskIdRef.current = null;
    setWsUrl(null);
    setStatus("idle");
    setProgress(0);
    setTotal(100);
    setDescription("");
    setTimeElapsed(0);
    setChordId(null);
    hasDownloadedRef.current = false;
  }, []);

  // handleClose - defined BEFORE downloadPDF
  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    disconnect();
    reset();
  }, [disconnect, reset]);

  // Download PDF function - now handleClose is available
  const downloadPDF = useCallback(async (chord_id: string) => {
    try {
      setStatus("downloading");
      setDescription("Downloading...");

      const response = await api.get<Blob>(`/stp_operation/get_report`, {
        params: { chord_id },
        responseType: "blob",
      });

      console.log("API response:", response);

      const blob = response.message;
      if (!blob) {
        throw new Error("No blob data received");
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report_${chord_id}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus("complete");
      setDescription("Download complete!");
      toast.success("PDF downloaded successfully");
      disconnect();
      if (onComplete) {
        onComplete();
      }
      if (autoClose) {
        closeTimeoutRef.current = setTimeout(handleClose, closeDelay);
      }
    } catch (e) {
      setStatus("failure");
      setDescription("Download failed. Please try again.");
      toast.error("Download failed");
      hasDownloadedRef.current = false;

      // Call onFailure callback when download fails
      if (onFailure) {
        onFailure();
      }
    }
  }, [autoClose, closeDelay, disconnect, handleClose, onFailure, onComplete]);

  // Auto-download effect - THIS IS THE KEY FIX
  useEffect(() => {
    if (status === "success" && chordId && enableAutoDownload && !hasDownloadedRef.current) {
      console.log("Starting auto-download...");
      hasDownloadedRef.current = true;
      downloadPDF(chordId);
    }
  }, [status, chordId, enableAutoDownload, downloadPDF]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progressPercent = total ? Math.round((progress / total) * 100) : 0;

  const statusConfig: Record<
    typeof status,
    { icon: JSX.Element; title: string; gradient: string }
  > = {
    idle: { icon: <FileText />, title: "Idle", gradient: "from-gray-300 to-gray-500" },
    pending: { icon: <Clock className="animate-pulse" />, title: "Pending", gradient: "from-yellow-400 to-yellow-600" },
    started: { icon: <Loader2 className="animate-spin" />, title: "Started", gradient: "from-blue-400 to-blue-600" },
    progress: { icon: <Loader2 className="animate-spin" />, title: "In Progress", gradient: "from-blue-400 to-blue-600" },
    success: { icon: <CheckCircle />, title: "Ready", gradient: "from-green-400 to-green-600" },
    downloading: { icon: <Download className="animate-bounce" />, title: "Downloading", gradient: "from-purple-400 to-purple-600" },
    complete: { icon: <CheckCircle />, title: "Done", gradient: "from-green-500 to-green-700" },
    failure: { icon: <AlertCircle />, title: "Failed", gradient: "from-red-400 to-red-600" },
  };

  // Don't render if idle or no taskId
  if (status === "idle" || !taskId) return null;

  const cfg = statusConfig[status];

  return (
    <div className={className}>
      <div className="relative w-80 p-5 rounded-2xl shadow-2xl bg-gradient-to-br from-blue-800 to-purple-900 text-white flex flex-col items-center gap-4 border border-white/20">
        {(status === "complete" || status === "failure") && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 text-white hover:text-gray-300 font-bold text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="p-4 rounded-full bg-gradient-to-tr from-purple-500 to-blue-400 shadow-lg flex items-center justify-center w-16 h-16">
            {cfg.icon}
          </div>
          <p className="text-xl font-bold">{cfg.title}</p>
          <p className="text-sm text-white/80 text-center">{description}</p>

          {/* Show elapsed time during processing */}
          {["started", "progress", "downloading"].includes(status) && (
            <p className="text-xs text-white/60">
              Time elapsed: {formatTime(timeElapsed)}
            </p>
          )}
        </div>

        {/* Linear progress bar */}
        {["pending", "started", "progress", "downloading"].includes(status) && (
          <div className="w-full mt-3">
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-right text-xs mt-1 opacity-80">{progressPercent}%</p>
          </div>
        )}

        {/* Manual download button when auto-download is disabled */}
        {status === "success" && !enableAutoDownload && chordId && (
          <button
            onClick={() => downloadPDF(chordId)}
            className="w-full py-2 font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 mt-2 shadow-lg flex justify-center items-center gap-2 transition-colors"
          >
            <Download className="w-5 h-5" /> Download PDF
          </button>
        )}

        {/* Failure dismiss button */}
        {status === "failure" && (
          <button
            onClick={handleClose}
            className="w-full py-2 font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 mt-2 shadow-lg transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default PDFGenerationStatus;