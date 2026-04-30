"use client";

import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getPdfReportSocketUrl,
  startPdfReportJob,
} from "../services/rwmRiverApi";
import {
  CHART_TO_BACKEND_ATTRIBUTE,
  WQ_PARAMETERS,
  attributeLabels,
} from "../utils/chartFormatters";

type DataType = "subdistbased" | "stretchbased";
type ReportStatus = "idle" | "loading" | "success" | "error";

interface PdfReportBuilderProps {
  modeLabel: "Admin" | "Drain";
  dataType: DataType;
  selectedIds: Array<number | string>;
  selectedSeason: string;
  embedded?: boolean;
  showHeader?: boolean;
}

const TOP_TEN_PRIORITY: Record<string, number> = {
  dissolvedOxygen: 1,
  bod: 2,
  faecalColiform: 3,
  ph: 4,
  turbidity: 5,
  ec: 6,
  ts: 7,
  cod: 8,
  temperature: 9,
  nitrate: 10,
};

const reportParameters = WQ_PARAMETERS.filter((param) => param.key !== "wqi");

function buildReportPdf({
  modeLabel,
  selectedSeason,
  selectedParameters,
  result,
}: {
  modeLabel: string;
  selectedSeason: string;
  selectedParameters: string[];
  result: any;
}) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  const addLine = (text: string, size = 10, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.42) + 4;
  };

  addLine("River Water Quality Report", 18, "bold");
  addLine(`${modeLabel} analysis | Season: ${selectedSeason}`, 11);
  addLine(`Generated: ${new Date().toLocaleString("en-IN")}`, 9);
  y += 2;

  addLine("Selected Parameters", 13, "bold");
  addLine(selectedParameters.map((key) => attributeLabels[key] || key).join(", "));

  const summary = result?.summary || result?.data?.summary;
  if (summary) {
    addLine("Backend Job Summary", 13, "bold");
    Object.entries(summary).forEach(([key, value]) => {
      addLine(`${key}: ${String(value)}`, 9);
    });
  }

  const rows = result?.results || result?.data?.results || [];
  if (Array.isArray(rows) && rows.length > 0) {
    addLine("Interpolation Results", 13, "bold");
    rows.slice(0, 30).forEach((row: any, index: number) => {
      const attribute = row.attribute || row.parameter || row.layer_name || `Result ${index + 1}`;
      const status = row.status || row.message || "completed";
      addLine(`${index + 1}. ${attribute}: ${status}`, 9);
      if (row.primary_layer || row.layer_name) {
        addLine(`Layer: ${row.primary_layer || row.layer_name}`, 8);
      }
    });
  }

  addLine(
    "This V2 report is generated from the river_v2 Zustand state and backend PDF/interpolation job results. It intentionally avoids legacy context providers.",
    9,
  );

  const safeMode = modeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const safeSeason = selectedSeason.replace(/[^a-zA-Z0-9._-]+/g, "_");
  doc.save(`river_${safeMode}_${safeSeason}_report.pdf`);
}

export default function PdfReportBuilder({
  modeLabel,
  dataType,
  selectedIds,
  selectedSeason,
  embedded = false,
  showHeader = true,
}: PdfReportBuilderProps) {
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [message, setMessage] = useState("");
  const [completedParameters, setCompletedParameters] = useState(0);
  const [totalParameters, setTotalParameters] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  const sortedReportParameters = useMemo(
    () =>
      reportParameters
        .slice()
        .sort((a, b) => (TOP_TEN_PRIORITY[a.key] || 999) - (TOP_TEN_PRIORITY[b.key] || 999)),
    [],
  );

  const topTenKeys = useMemo(
    () =>
      reportParameters
        .map((param) => param.key)
        .filter((key) => TOP_TEN_PRIORITY[key] !== undefined)
        .sort((a, b) => TOP_TEN_PRIORITY[a] - TOP_TEN_PRIORITY[b]),
    [],
  );

  const allTopTenSelected = topTenKeys.every((key) => selectedParameters.includes(key));

  const handleParameterToggle = (paramKey: string) => {
    setSelectedParameters((prev) =>
      prev.includes(paramKey)
        ? prev.filter((key) => key !== paramKey)
        : [...prev, paramKey],
    );
  };

  const handleSelectAllParameters = () => {
    setSelectedParameters((prev) =>
      prev.length === reportParameters.length ? [] : reportParameters.map((param) => param.key),
    );
  };

  const handleToggleTopTen = () => {
    setSelectedParameters((prev) =>
      allTopTenSelected
        ? prev.filter((key) => !topTenKeys.includes(key))
        : Array.from(new Set([...prev, ...topTenKeys])),
    );
  };

  const handleGenerateReport = async () => {
    if (selectedIds.length === 0) {
      toast.error(`Confirm ${modeLabel.toLowerCase()} selections before generating a report.`);
      return;
    }

    if (!selectedSeason) {
      toast.error("Select season before generating a report.");
      return;
    }

    if (selectedParameters.length === 0) {
      toast.error("Select at least one parameter.");
      return;
    }

    socketRef.current?.close();
    setStatus("loading");
    setMessage("Starting report job...");
    setCompletedParameters(0);
    setTotalParameters(selectedParameters.length + 1);

    try {
      const backendAttributes = selectedParameters.map(
        (param) => CHART_TO_BACKEND_ATTRIBUTE[param] || param,
      );
      backendAttributes.push("WQI");
      const totalCount = backendAttributes.length;

      const job = await startPdfReportJob({
        attributes: backendAttributes,
        season: selectedSeason,
        dataType,
        subDistrictCodes: dataType === "subdistbased" ? selectedIds.map(Number) : undefined,
        stretchIds: dataType === "stretchbased" ? selectedIds.map(String) : undefined,
      });

      if (!job.job_id) {
        throw new Error("Backend did not return a report job id.");
      }

      setMessage("Report job started. Waiting for backend progress...");
      const socket = new WebSocket(getPdfReportSocketUrl(job.job_id));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.status === "processing") {
          setMessage(payload.message || `Processing ${payload.attribute || "parameter"}...`);
        } else if (payload.status === "completed" && payload.attribute) {
          setCompletedParameters((prev) => prev + 1);
          setMessage(`${payload.attribute} completed.`);
        } else if (payload.status === "completed" && payload.summary) {
          socket.close();
          setCompletedParameters(totalCount);
          setStatus("success");
          setMessage("Report data ready. Downloading PDF...");
          buildReportPdf({
            modeLabel,
            selectedSeason,
            selectedParameters,
            result: payload,
          });
          toast.success("PDF report generated.");
        } else if (payload.status === "error") {
          socket.close();
          setStatus("error");
          setMessage(payload.message || "Report generation failed.");
          toast.error(payload.message || "Report generation failed.");
        }
      };

      socket.onerror = () => {
        setStatus("error");
        setMessage("WebSocket connection failed. Please try again.");
        toast.error("Report progress connection failed.");
      };

      socket.onclose = () => {
        socketRef.current = null;
      };
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.message || "Failed to generate report.");
      toast.error(error?.message || "Failed to generate report.");
    }
  };

  return (
    <div className={embedded ? "" : "mb-2 rounded-2xl border-l-4 border-l-pink-400 bg-white/80 shadow-lg backdrop-blur-sm"}>
      <div className={embedded ? "" : "p-5"}>
        {showHeader && <div className="mb-5 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-pink-500 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">Generate PDF Report</h3>
        </div>}

        <div className="mb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-gray-700">Select Water Quality Parameters</label>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {selectedParameters.length} / {reportParameters.length}
              </div>
              <button type="button" onClick={handleToggleTopTen} className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500 hover:text-white">
                {allTopTenSelected ? "Deselect Top 10" : "Select Top 10"}
              </button>
              <button type="button" onClick={handleSelectAllParameters} className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500 hover:text-white">
                {selectedParameters.length === reportParameters.length ? "Deselect All" : "Select All"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {sortedReportParameters.map((param) => {
              const topTenPriority = TOP_TEN_PRIORITY[param.key];
              const isSelected = selectedParameters.includes(param.key);
              return (
                <button
                  key={param.key}
                  type="button"
                  onClick={() => handleParameterToggle(param.key)}
                  className={`flex items-center justify-between rounded-xl border-2 p-2.5 text-left transition ${
                    isSelected
                      ? "border-blue-400 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white opacity-85 hover:border-gray-300"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-xs font-semibold ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                      {param.label}
                    </span>
                    {param.unit && <span className="block truncate text-[10px] text-gray-400">{param.unit}</span>}
                  </span>
                  {topTenPriority && (
                    <span className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {topTenPriority}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateReport}
          disabled={status === "loading" || selectedParameters.length === 0}
          className={`relative flex w-full items-center justify-center gap-3 rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition ${
            status === "loading" || selectedParameters.length === 0
              ? "cursor-not-allowed bg-gray-400 opacity-70"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {status === "loading" ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          Generate PDF Report
          {selectedParameters.length > 0 && (
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs">
              {selectedParameters.length} item{selectedParameters.length === 1 ? "" : "s"}
            </span>
          )}
        </button>

        {status !== "idle" && (
          <div className={`mt-3 rounded-lg border p-3 text-xs ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}>
            <div className="font-semibold">{message}</div>
            {totalParameters > 0 && status === "loading" && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, (completedParameters / totalParameters) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
