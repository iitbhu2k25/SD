"use client";
import React from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6 bg-slate-50 text-slate-800">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl text-center">
        <h2 className="mb-2 text-xl font-bold text-red-600">Application Error</h2>
        <p className="mb-6 text-sm text-slate-500">
          The module encountered a fatal error. 
          {error.message && <span className="block mt-2 italic">Details: {error.message}</span>}
        </p>
        <button
          onClick={() => reset()}
          className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
