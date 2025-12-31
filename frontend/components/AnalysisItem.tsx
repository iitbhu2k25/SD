"use client";

import {MarValidationItem} from "@/interface/raster_context";

interface AnalysisProps {
  data: MarValidationItem[];
}

export default function AnalysisList({ data }: AnalysisProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((item, index) => {
        const [title, status] = Object.entries(item)[0]; // Get first key/value
        const reason = item.reason;

        // Choose color based on status
        let statusColor = "text-gray-700 bg-gray-100";
        if (status.toLowerCase().includes("feasible")) statusColor = "text-green-700 bg-green-100";
        else if (status.toLowerCase().includes("conditional")) statusColor = "text-yellow-700 bg-yellow-100";
        else statusColor = "text-red-700 bg-red-100";

        return (
          <div key={index} className="p-4 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <span className={`inline-block px-2 py-1 rounded ${statusColor} font-medium`}>
              {status}
            </span>
            <p className="mt-2 text-gray-600">{reason}</p>
          </div>
        );
      })}
    </div>
  );
}
