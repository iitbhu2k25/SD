"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type {
  CentralizedResult,
  DecentralizedResult,
} from "@/interface/stp_suitability/stp";

type Result = CentralizedResult | DecentralizedResult;

interface ScoreChartProps {
  ranked: Result[];
}

const COLORS = [
  "#1a5c3a",
  "#2e7d52",
  "#43a06c",
  "#66b888",
  "#8ecfaa",
  "#b7e3cc",
];

export function ScoreChart({ ranked }: ScoreChartProps) {
  const data = ranked.map((r) => ({
    name: r.name.length > 18 ? r.name.slice(0, 16) + "…" : r.name,
    score: r.total,
  }));

  const minScore = Math.max(0, Math.min(...data.map((d) => d.score)) - 15);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            angle={-25}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[minScore, "auto"]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [
              typeof value === "number" ? value.toFixed(1) : "—",
              "Score",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i] ?? COLORS[COLORS.length - 1]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
