"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Download, FileText } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "@/services/api";
import { useWebSocket } from "@/services/websocket";

interface PDFGenerationStatusProps {
  taskId: string | null;
  className?: string;
  autoClose?: boolean;
  closeDelay?: number;
  enableAutoDownload?: boolean;
  onComplete?: () => void;
  onFailure?: () => void;
}

type PdfStatus =
  | "idle"
  | "pending"
  | "started"
  | "progress"
  | "success"
  | "downloading"
  | "complete"
  | "failure";

const PDFGenerationStatus: React.FC<PDFGenerationStatusProps> = ({
  taskId,
  className = "",
  autoClose = true,
  closeDelay = 3000,
  enableAutoDownload = true,
  onComplete,
  onFailure,
}) => {
  const [status, setStatus] = useState<PdfStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(100);
  const [chordId, setChordId] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasDownloadedRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);

  const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;
  const clampedProgress = Math.max(0, Math.min(100, progressPercent));

  const formatDuration = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60).toString().padStart(2, "0");
    const secs = (safe % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const getPhaseDescription = () => {
    if (status === "downloading") return "Preparing download...";
    if (status === "success" || status === "complete") return "Report ready";
    if (status === "failure") return "Generation failed";
    if (status === "pending" || status === "started") return "Initialising...";
    if (clampedProgress < 20) return "Gathering data...";
    if (clampedProgress < 55) return "Computing indicators...";
    if (clampedProgress < 85) return "Composing pages...";
    return "Final checks...";
  };

  // ── WebSocket & state management (logic unchanged) ──────────────────────────

  useEffect(() => {
    if (taskId && taskId !== currentTaskIdRef.current) {
      currentTaskIdRef.current = taskId;
      hasDownloadedRef.current = false;
      setStatus("idle");
      setProgress(0);
      setTotal(100);
      setChordId(null);
      setTimeElapsed(0);
      startTimeRef.current = null;
      setWsUrl(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/stp_operation/ws/${taskId}`);
    } else if (!taskId) {
      currentTaskIdRef.current = null;
      setWsUrl(null);
    }
  }, [taskId]);

  const shouldConnect = Boolean(wsUrl && !["complete", "failure"].includes(status));
  const { messages, isConnected, disconnect } = useWebSocket(
    shouldConnect && wsUrl ? wsUrl : "",
    { reconnect: false },
  );

  useEffect(() => {
    if (["started", "progress", "downloading"].includes(status)) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current)
          setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  useEffect(() => {
    if (!taskId || !wsUrl) return;
    if (isConnected && status === "idle") setStatus("pending");
  }, [isConnected, taskId, wsUrl, status]);

  useEffect(() => {
    if (!messages.length || hasDownloadedRef.current || status === "complete" || !wsUrl) return;
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
          break;
        case "STARTED":
          setStatus("started");
          break;
        case "PROGRESS":
          setStatus("progress");
          setProgress(parsed.progress || 0);
          setTotal(parsed.total || 100);
          break;
        case "SUCCESS":
          setStatus("success");
          setProgress(parsed.total || 100);
          setTotal(parsed.total || 100);
          setChordId(parsed.result);
          break;
        case "FAILURE":
        case "ERROR":
          setStatus("failure");
          toast.error(parsed.description || "Failed to generate PDF");
          disconnect();
          if (onFailure) onFailure();
          break;
      }
    } catch {
      console.warn("Non-JSON message:", lastMessage);
    }
  }, [messages, chordId, status, wsUrl, disconnect, onFailure]);

  const reset = useCallback(() => {
    currentTaskIdRef.current = null;
    setWsUrl(null);
    setStatus("idle");
    setProgress(0);
    setTotal(100);
    setChordId(null);
    setTimeElapsed(0);
    startTimeRef.current = null;
    hasDownloadedRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    disconnect();
    reset();
  }, [disconnect, reset]);

  const downloadPDF = useCallback(
    async (downloadChordId: string) => {
      try {
        setStatus("downloading");
        const response = await api.get<Blob>(`/stp_operation/get_report`, {
          params: { chord_id: downloadChordId },
          responseType: "blob",
        });
        const blob = response.message;
        if (!blob) throw new Error("No blob data received");
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `report_${downloadChordId}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setStatus("complete");
        toast.success("PDF downloaded successfully");
        disconnect();
        if (onComplete) onComplete();
        if (autoClose) closeTimeoutRef.current = setTimeout(handleClose, closeDelay);
      } catch {
        setStatus("failure");
        toast.error("Download failed");
        hasDownloadedRef.current = false;
        if (onFailure) onFailure();
      }
    },
    [autoClose, closeDelay, disconnect, handleClose, onComplete, onFailure],
  );

  useEffect(() => {
    if (status === "success" && chordId && enableAutoDownload && !hasDownloadedRef.current) {
      hasDownloadedRef.current = true;
      downloadPDF(chordId);
    }
  }, [status, chordId, enableAutoDownload, downloadPDF]);

  // ── Early exit ───────────────────────────────────────────────────────────────
  if (status === "idle" || !taskId) return null;

  // ── Ring geometry ────────────────────────────────────────────────────────────
  const R = 36;
  const circumference = 2 * Math.PI * R;
  const strokeOffset = circumference * (1 - clampedProgress / 100);
  const gradientId = `ring-grad-${taskId}`;

  const isComplete = status === "complete" || status === "success";
  const isFailure = status === "failure";
  const isWorking = ["pending", "started", "progress", "downloading"].includes(status);

  // Ring stroke colour
  const ringStroke = isFailure
    ? "url(#ring-fail)"
    : isComplete
      ? "url(#ring-ok)"
      : `url(#${gradientId})`;

  return (
    <div className={className}>
      <div
        className="relative w-72 overflow-hidden rounded-xl border border-slate-200 bg-white font-mono shadow-lg"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
      >
        {/* Teal top accent stripe */}
        <div
          className={`h-[3px] w-full transition-colors duration-500 ${
            isFailure
              ? "bg-rose-400"
              : isComplete
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-teal-500 to-teal-400"
          }`}
        />

        {/* Card body */}
        <div className="px-4 py-3">

          {/* Row 1 — title + elapsed */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {isFailure
                ? "Generation failed"
                : isComplete
                  ? "Report ready"
                  : "Generating PDF"}
            </span>
            <span className="rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400">
              {formatDuration(timeElapsed)}
            </span>
          </div>

          {/* Row 2 — ring + right column */}
          <div className="flex items-center gap-4">

            {/* Progress ring */}
            <div className="relative h-20 w-20 shrink-0">
              <svg className="-rotate-90" viewBox="0 0 88 88" width="80" height="80">
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                  <linearGradient id="ring-ok" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <linearGradient id="ring-fail" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>

                {/* Track */}
                <circle
                  cx="44" cy="44" r={R}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="7"
                />
                {/* Progress arc */}
                <circle
                  cx="44" cy="44" r={R}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
              </svg>

              {/* Centre icon / percent */}
              <div className="absolute inset-0 flex items-center justify-center">
                {isFailure ? (
                  <AlertCircle className="h-6 w-6 text-rose-400" />
                ) : isComplete ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                ) : (
                  <span className="text-[15px] font-semibold text-teal-700">
                    {clampedProgress}
                    <span className="text-[9px] text-slate-400">%</span>
                  </span>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-1 flex-col gap-2">
              {/* Phase */}
              <p className="text-[11px] font-medium leading-tight text-slate-500">
                {getPhaseDescription()}
              </p>

              {/* Download button (manual) */}
              {status === "success" && !enableAutoDownload && chordId && (
                <button
                  onClick={() => downloadPDF(chordId)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal-700 transition-colors hover:bg-teal-100"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              )}

              {/* Close / Dismiss */}
              {(isComplete || isFailure) && (
                <button
                  onClick={handleClose}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    isFailure
                      ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {isFailure ? "Dismiss" : "Close"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFGenerationStatus;