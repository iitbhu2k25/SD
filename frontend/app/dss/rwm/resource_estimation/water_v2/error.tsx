"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WaterV2Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[WaterV2] Module error:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-red-700">
          Water Availability failed to load
        </h2>
        <p className="mb-4 text-sm text-red-500">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
