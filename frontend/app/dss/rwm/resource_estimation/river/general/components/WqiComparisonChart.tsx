import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import type Plotly from "plotly.js-dist-min";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface WqiComparisonChartProps {
  data: Array<{
    name: string;
    profile: Array<{
      distance_m: number;
      wqi: number | null;
    }>;
  }>;
}

const LINE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
];

const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace("#", "");
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const WqiComparisonChart: React.FC<WqiComparisonChartProps> = ({ data }) => {
  const validDatasets = useMemo(
    () => data.filter((d) => Array.isArray(d.profile) && d.profile.length > 0),
    [data],
  );

  const traces = useMemo(() => {
    return validDatasets.map((dataset, index) => {
      const color = LINE_COLORS[index % LINE_COLORS.length];
      return {
        type: "scatter",
        mode: "lines",
        name: dataset.name,
        x: dataset.profile.map((p) => p.distance_m),
        y: dataset.profile.map((p) => p.wqi),
        connectgaps: true,
        line: {
          color,
          width: 2,
          shape: "linear",
        },
        fill: "tozeroy",
        fillcolor: hexToRgba(color, 0.2),
        hovertemplate:
          "Length: %{x:.2f} m<br>WQI Value: %{y:.2f}<extra>%{fullData.name}</extra>",
      } as Partial<Plotly.Data>;
    });
  }, [validDatasets]);

  const layout = useMemo<Partial<Plotly.Layout>>(
    () => ({
      autosize: true,
      margin: { t: 12, r: 24, b: 56, l: 48 },
      plot_bgcolor: "#f8fafc",
      paper_bgcolor: "#ffffff",
      font: {
        family: "Cambria, Georgia, serif",
      },
      hovermode: "x unified",
      legend: {
        orientation: "h",
        y: -0.22,
        x: 0,
      },
      xaxis: {
        title: { text: "Length (m)" },
        showgrid: true,
        gridcolor: "#e5e7eb",
        zeroline: false,
      },
      yaxis: {
        title: { text: "WQI Value" },
        showgrid: true,
        gridcolor: "#e5e7eb",
        zeroline: false,
      },
    }),
    [],
  );

  if (validDatasets.length < 1 || traces.length === 0) return null;

  return (
    <div
      id="general-wqi-comparison-chart"
      data-report-chart="wqi-comparison"
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold tracking-tight text-gray-800">
          Water Quality Index (WQI) Profile
        </h3>
        <p className="text-xs text-gray-400">
          (Longitudinal profile along the river length)
        </p>
      </div>

      <div className="h-[340px] w-full">
        <Plot
          data={traces}
          layout={layout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
          }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
        />
      </div>
    </div>
  );
};

export default WqiComparisonChart;
