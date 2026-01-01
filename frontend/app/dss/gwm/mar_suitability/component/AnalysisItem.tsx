"use client";

import { MarValidationItem } from "@/interface/raster_context";

interface AnalysisProps {
  data: MarValidationItem[];
}

export default function AnalysisList({ data }: AnalysisProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((item, index) => {
        const [title, status] = Object.entries(item)[0];
        const reason = item.reason;

        return (
          <div
            key={index}
            className="p-4 rounded-lg shadow-md border border-gray-200"
          >
            <h3 className="text-lg font-semibold mb-2">{title}</h3>

            <span
              className="inline-block px-2 py-1 rounded font-medium text-white"
              style={{ backgroundColor: item.color_code }}   // ✅ FIX
            >
              {status}
            </span>

            <p className="mt-2 text-gray-600">{reason}</p>
          </div>
        );
      })}
    </div>
  );
}