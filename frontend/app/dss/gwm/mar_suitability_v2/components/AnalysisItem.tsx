"use client";

import { MarValidationItem } from "@/interface/raster_context";

interface AnalysisProps {
  data: MarValidationItem[];
}

function getValidationTitle(item: MarValidationItem): string {
  const key = Object.keys(item).find(
    (entry) => entry !== "reason" && entry !== "color_code",
  );
  return key ?? "Validation";
}

export default function AnalysisList({ data }: AnalysisProps) {
  return (
    <div className="flex flex-col gap-4">
      {data.map((item) => {
        const title = getValidationTitle(item);
        const status = item[title] ?? "";
        const reason = item.reason;

        return (
          <div
            key={title}
            className="p-4 rounded-lg shadow-md border border-gray-200"
          >
            <div className="flex flex-row items-center justify-between">
            <h3 className="text-lg font-semibold ">{title}</h3>

            <span
              className="inline-block px-2 py-1 rounded font-medium text-white"
              style={{ backgroundColor: item.color_code }}
            >
              {status}
            </span>
            </div>

            <p className="mt-2 text-gray-600">{reason}</p>
          </div>
        );
      })}
    </div>
  );
}
