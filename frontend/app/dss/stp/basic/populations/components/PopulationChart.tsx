"use client";

import Plot from "react-plotly.js";
import { useMemo } from "react";

interface PopulationChartProps {
  results: any;
  intermediateYear?: number | null;
}

const processData = (results: any, intermediateYear?: number | null) => {
  if (!results) return { labels: [], datasets: [] };

  const allYears = new Set<number>();
  const models = Object.keys(results);

  models.forEach((model) => {
    Object.keys(results[model]).forEach((year) => {
      const y = Number(year);
      if (!isNaN(y)) allYears.add(y);
    });
  });

  const sortedYears = Array.from(allYears).sort((a, b) => a - b);
  let yearsToPlot: number[];

  if (sortedYears.length === 1) {
    yearsToPlot = sortedYears;
  } else {
    const first = sortedYears[0];
    yearsToPlot = sortedYears.filter((y) => (y - first) % 5 === 0);

    const last = sortedYears[sortedYears.length - 1];
    if (!yearsToPlot.includes(last)) yearsToPlot.push(last);

    if (
      intermediateYear &&
      !yearsToPlot.includes(intermediateYear)
    ) {
      yearsToPlot.push(intermediateYear);
    }

    yearsToPlot.sort((a, b) => a - b);
  }

  return {
    labels: yearsToPlot,
    datasets: models.map((model) => ({
      name: model,
      values: yearsToPlot.map((y) => results[model][y] ?? null),
    })),
  };
};

const PopulationChart = ({ results, intermediateYear }: PopulationChartProps) => {
  const chartData = useMemo(
    () => processData(results, intermediateYear),
    [results, intermediateYear]
  );

  const isBar = chartData.labels.length <= 2;

  // Colors for each model
  const colors = ["red", "blue", "green", "yellow", "purple", "orange"];

  const traces = chartData.datasets.map((ds, i) => ({
    x: chartData.labels,
    y: ds.values,
    type: isBar ? "bar" : "scatter",
    mode: isBar ? undefined : "lines+markers",
    name: ds.name,
    line: {
      color: colors[i % colors.length],
      width: 3,
    },
    marker: {
      size: 8,
      color: colors[i % colors.length],
    },
  }));

  // Highlight intermediate year grid
  const shapes =
    intermediateYear && chartData.labels.includes(intermediateYear)
      ? [
        {
          type: "line",
          x0: intermediateYear,
          x1: intermediateYear,
          y0: 0,
          y1: 1,
          xref: "x",
          yref: "paper",
          line: {
            color: "red",
            width: 3,
            dash: "dot",
          },
        },
      ]
      : [];

  return (
    <div className="mt-6 w-full">
      <h2 className="text-lg font-semibold mb-1">
        Population {isBar ? "Comparison" : "Projection"}
      </h2>

      <div style={{ width: "100%", height: "460px" }}>
        <Plot
          data={traces as Partial<Plotly.Data>[]}
          layout={{
            autosize: true,
            margin: { l: 40, r: 20, t: 20, b: 40 },
            xaxis: { title: { text: "Year" } },
            yaxis: { title: { text: "Population" } },
            shapes: shapes as Partial<Plotly.Shape>[],
            showlegend: true,
          }}
          config={{ responsive: true }}
          style={{ width: "100%", height: "100%" }}
        />

      </div>

      {intermediateYear &&
        chartData.labels.includes(intermediateYear) && (
          <div className="mt-4 text-center">
            <span className="text-sm font-medium text-white bg-blue-500 px-3 py-1 rounded">
              Intermediate Year: {intermediateYear}
            </span>
          </div>
        )}
    </div>
  );
};

export default PopulationChart;
