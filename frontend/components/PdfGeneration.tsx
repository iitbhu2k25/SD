import React, { useState, useEffect, useRef, JSX } from "react";
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

interface PDFGenerationStatusProps {
  taskId: string | null;
  className?: string;
  autoClose?: boolean;
  closeDelay?: number;
  enableAutoDownload?: boolean;
}

const PDFGenerationStatus: React.FC<PDFGenerationStatusProps> = ({
  taskId,
  className = "",
  autoClose = true,
  closeDelay = 3000,
  enableAutoDownload = true,
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


  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId);
  const wsUrl = activeTaskId
    ? `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/stp_operation/ws/${activeTaskId}`
    : "";
  const { messages, isConnected, disconnect } = useWebSocket(wsUrl, { reconnect: false });

  // Track elapsed time
  useEffect(() => {
    if (["started", "progress", "downloading"].includes(status)) {
      timerRef.current = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current || undefined);
      if (status === "idle") setTimeElapsed(0);
    }
    return () => clearInterval(timerRef.current || undefined);
  }, [status]);

  // Handle connection
  useEffect(() => {
    if (!taskId || !activeTaskId) {
      setStatus("idle");
      return;
    }
    if (isConnected && status === "idle") {
      setStatus("pending");
      setDescription("Connecting...");
    }
  }, [isConnected, taskId, activeTaskId, status]);

  
  useEffect(() => {
    if (!messages.length || hasDownloadedRef.current || status === "complete" || !activeTaskId) {
      return;
    }
    const lastMessage = messages[messages.length - 1];

    try {
      const parsed = JSON.parse(lastMessage);
      if (!parsed.state) return;
      const state = parsed.state.toUpperCase();
      if (state === "SUCCESS" && chordId === parsed.result) {

        return;
      }
      switch (state) {
        case "PENDING":
          setStatus("pending");
          setProgress(parsed.progress || 0);
          setTotal(parsed.total || 100);
          setDescription(parsed.description || "Pending...");
          break;
        case "STARTED":
          setStatus("started");
          toast.info("PDF generation started");
          break;
        case "PROGRESS":
          setStatus("progress");
          setProgress(parsed.progress || 0);
          setTotal(parsed.total || 100);
          setDescription(parsed.description || "Generating...");
          break;
        case "SUCCESS":
          setStatus("success");
          setProgress(parsed.total || 100);
          setTotal(parsed.total || 100);
          setDescription("PDF ready!");
          setChordId(parsed.result);
          break;
        case "FAILURE":
        case "ERROR":
          const errorMsg = parsed.description || "Failed to generate PDF";
          setStatus("failure");
          setDescription(errorMsg);
          toast.error(errorMsg);
          break;
      }
    } catch {
      console.warn("Non-JSON message:", lastMessage);
    }
  }, [messages, chordId, status, activeTaskId]);

  // Trigger download only once
  useEffect(() => {
    if (
      status === "success" &&
      chordId &&
      enableAutoDownload &&
      !hasDownloadedRef.current
    ) {
   
      downloadPDF(chordId);
      hasDownloadedRef.current = true;
    }
  }, [status, chordId, enableAutoDownload]);

  // Download PDF and close WebSocket
  const downloadPDF = async (chord_id: string) => {
    try {
      setStatus("downloading");
      setDescription("Downloading...");

      const response = await api.get<Blob>(`/stp_operation/get_report`, {
        params: { chord_id },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(response.message);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report_${chord_id}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus("complete");
      toast.success("PDF downloaded");
      disconnect();
   

      if (autoClose) {
        closeTimeoutRef.current = setTimeout(() => handleClose(), closeDelay);
      }
    } catch (e) {
      setStatus("failure");
      toast.error("Download failed");
      hasDownloadedRef.current = false; // Allow retry
    }
  };

  const handleClose = () => {
    clearTimeout(closeTimeoutRef.current || undefined);
    disconnect();
    reset();
  };

  const reset = () => {
    setStatus("idle");
    setProgress(0);
    setTotal(100);
    setDescription("");
    setTimeElapsed(0);
    setChordId(null);
    hasDownloadedRef.current = false;
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progressPercent = total ? Math.round((progress / total) * 100) : 0;

  const statusConfig: Record<typeof status, { icon: JSX.Element; title: string; color: string }> = {
    idle: { icon: <FileText className="text-gray-400" />, title: "Idle", color: "gray" },
    pending: { icon: <Clock className="text-yellow-500" />, title: "Pending", color: "yellow" },
    started: { icon: <Loader2 className="animate-spin text-blue-500" />, title: "Started", color: "blue" },
    progress: { icon: <Loader2 className="animate-spin text-blue-500" />, title: "In Progress", color: "blue" },
    success: { icon: <FileText className="text-green-500" />, title: "Ready", color: "green" },
    downloading: { icon: <Download className="text-purple-500" />, title: "Downloading", color: "purple" },
    complete: { icon: <CheckCircle className="text-green-600" />, title: "Done", color: "green" },
    failure: { icon: <AlertCircle className="text-red-500" />, title: "Failed", color: "red" },
  };

  if (status === "idle" || !taskId) return null;
  const cfg = statusConfig[status];

  return (
    <div className={className}>
      <div className="relative border rounded-lg p-4 shadow-sm bg-white space-y-3 transition">
        {(status === "complete" || status === "failure") && (
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        <div className="flex items-center gap-3">
          {cfg.icon}
          <div>
            <p className="font-medium text-gray-800">{cfg.title}</p>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          {["started", "progress", "downloading"].includes(status) && (
            <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-4 h-4" />
              {formatTime(timeElapsed)}
            </div>
          )}
        </div>
        {["pending", "started", "progress", "downloading"].includes(status) && (
          <div>
            <div className="w-full h-2 bg-gray-200 rounded">
              <div
                className={`h-full rounded bg-${cfg.color}-500 transition-all`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              {progressPercent}%
            </p>
          </div>
        )}
        {status === "success" && !enableAutoDownload && chordId && (
          <button
            onClick={() => downloadPDF(chordId)}
            className="w-full py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
          >
            <Download className="w-4 h-4 inline-block mr-1" /> Download PDF
          </button>
        )}
        {status === "failure" && (
          <button
            onClick={handleClose}
            className="w-full py-2 text-sm font-medium text-white bg-gray-600 rounded hover:bg-gray-700"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default PDFGenerationStatus;