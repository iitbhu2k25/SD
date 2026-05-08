"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface GeneralWqiComparisonChartProps {
  data: Array<{
    name: string;
    profile: Array<{ distance_m: number; wqi: number | null }>;
  }>;
  isDark?: boolean;
}

export default function GeneralWqiComparisonChart({ data, isDark = false }: GeneralWqiComparisonChartProps) {
  const traces = useMemo(
    () =>
      data.map((item) => ({
        x: item.profile.map((point) => point.distance_m),
        y: item.profile.map((point) => point.wqi),
        type: "scatter",
        mode: "lines+markers",
        name: item.name,
        line: { width: 2 },
        marker: { size: 5 },
      })),
    [data],
  );

  if (!data.length) return null;

  return (
    <div
      id="general-wqi-comparison-chart"
      className={`overflow-hidden rounded-xl border ${
        isDark ? "border-[#1e3a5f]/70 bg-[#080e1c]" : "border-stone-200 bg-white"
      }`}
    >
      <Plot
        data={traces as any}
        layout={{
          autosize: true,
          height: 320,
          margin: { l: 45, r: 18, t: 18, b: 45 },
          paper_bgcolor: isDark ? "#080e1c" : "white",
          plot_bgcolor: isDark ? "#080e1c" : "white",
          font: { color: isDark ? "#cbd5e1" : "#334155" },
          xaxis: {
            title: { text: "Distance (m)" },
            gridcolor: isDark ? "#1e3a5f" : "#e5e7eb",
            zerolinecolor: isDark ? "#1e3a5f" : "#e5e7eb",
          },
          yaxis: {
            title: { text: "WQI" },
            gridcolor: isDark ? "#1e3a5f" : "#e5e7eb",
            zerolinecolor: isDark ? "#1e3a5f" : "#e5e7eb",
          },
          legend: { orientation: "h", y: -0.28 },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
