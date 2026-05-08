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
        <h2 className="mb-2 text-center text-lg font-bold text-slate-900">
          Pumping Location failed to load
        </h2>
        <p className="mb-6 text-center text-sm text-slate-500">
          There was an error initializing the module.
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

