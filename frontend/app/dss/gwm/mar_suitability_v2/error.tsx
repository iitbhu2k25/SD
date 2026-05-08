"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 px-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-4 flex items-center justify-center">
          <div className="rounded-full bg-red-100 p-3">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        <h2 className="mb-2 text-center text-lg font-bold text-slate-900">
          MAR Suitability failed to load
        </h2>
        <p className="mb-6 text-center text-sm text-slate-500">
          There was an error initializing the application.
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => reset()}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
