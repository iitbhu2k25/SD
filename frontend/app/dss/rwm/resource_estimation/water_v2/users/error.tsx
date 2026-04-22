"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function UsersError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[WaterV2/Users] Error:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
      <p className="text-sm font-medium text-red-600">Basin mode failed to load</p>
      <p className="text-xs text-slate-400">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
      >
        Retry
      </button>
    </div>
  );
}
