"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function UserError({ error, reset }: ErrorProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-red-50 p-6">
      <div className="max-w-md w-full border border-red-200 bg-white rounded-lg p-4">
        <h2 className="text-sm font-semibold text-red-700 mb-2">
          River System view failed to load
        </h2>
        <p className="text-xs text-red-600 break-words mb-4">
          {error.message || "Unexpected error"}
        </p>
        <button
          onClick={() => reset()}
          className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
