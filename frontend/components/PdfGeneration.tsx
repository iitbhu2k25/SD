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

  useEffect(() => {
    if (["started", "progress", "downloading"].includes(status)) {
      timerRef.current = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current || undefined);
      if (status === "idle") setTimeElapsed(0);
    }
    return () => clearInterval(timerRef.current || undefined);
  }, [status]);

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
    if (!messages.length || hasDownloadedRef.current || status === "complete" || !activeTaskId) return;
    const lastMessage = messages[messages.length - 1];
    try {
      const parsed = JSON.parse(lastMessage);
      if (!parsed.state) return;
      const state = parsed.state.toUpperCase();
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
          setStatus("failure");
          setDescription(parsed.description || "Failed to generate PDF");
          toast.error(parsed.description || "Failed to generate PDF");
          break;
      }
    } catch {
      console.warn("Non-JSON message:", lastMessage);
    }
  }, [messages, chordId, status, activeTaskId]);

  useEffect(() => {
    if (status === "success" && chordId && enableAutoDownload && !hasDownloadedRef.current) {
      downloadPDF(chordId);
      hasDownloadedRef.current = true;
    }
  }, [status, chordId, enableAutoDownload]);

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
      if (autoClose) closeTimeoutRef.current = setTimeout(handleClose, closeDelay);
    } catch (e) {
      setStatus("failure");
      toast.error("Download failed");
      hasDownloadedRef.current = false;
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

  const statusConfig: Record<
    typeof status,
    { icon: JSX.Element; title: string; gradient: string }
  > = {
    idle: { icon: <FileText />, title: "Idle", gradient: "from-gray-300 to-gray-500" },
    pending: { icon: <Clock />, title: "Pending", gradient: "from-yellow-400 to-yellow-600" },
    started: { icon: <Loader2 className="animate-spin" />, title: "Started", gradient: "from-blue-400 to-blue-600" },
    progress: { icon: <Loader2 className="animate-spin" />, title: "In Progress", gradient: "from-blue-400 to-blue-600" },
    success: { icon: <CheckCircle />, title: "Ready", gradient: "from-green-400 to-green-600" },
    downloading: { icon: <Download />, title: "Downloading", gradient: "from-purple-400 to-purple-600" },
    complete: { icon: <CheckCircle />, title: "Done", gradient: "from-green-500 to-green-700" },
    failure: { icon: <AlertCircle />, title: "Failed", gradient: "from-red-400 to-red-600" },
  };

  if (status === "idle" || !taskId) return null;
  const cfg = statusConfig[status];

  return (
   <div className={className}>
  <div className="relative w-80 p-5 rounded-2xl shadow-2xl bg-gradient-to-br from-blue-800 to-purple-900 text-white flex flex-col items-center gap-4 border border-white/20">
    {(status === "complete" || status === "failure") && (
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 text-white hover:text-gray-300 font-bold text-lg"
      >
        ✕
      </button>
    )}

    <div className="flex flex-col items-center gap-3">
      <div className={`p-4 rounded-full bg-gradient-to-tr from-purple-500 to-blue-400 shadow-lg flex items-center justify-center w-16 h-16`}>
        {cfg.icon}
      </div>
      <p className="text-xl font-bold">{cfg.title}</p>
      <p className="text-sm text-white/80 text-center">{description}</p>
    </div>

    {/* Linear progress bar */}
    {["pending", "started", "progress", "downloading"].includes(status) && (
      <div className="w-full mt-3">
        <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-blue-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-right text-xs mt-1 opacity-80">{progressPercent}%</p>
      </div>
    )}

    {status === "success" && !enableAutoDownload && chordId && (
      <button
        onClick={() => downloadPDF(chordId)}
        className="w-full py-2 font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 mt-2 shadow-lg flex justify-center items-center gap-2"
      >
        <Download className="w-5 h-5" /> Download PDF
      </button>
    )}

    {status === "failure" && (
      <button
        onClick={handleClose}
        className="w-full py-2 font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 mt-2 shadow-lg"
      >
        Dismiss
      </button>
    )}
  </div>
</div>

  );
};

export default PDFGenerationStatus;
