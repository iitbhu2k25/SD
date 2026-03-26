"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-red-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-red-700">Admin mode failed to load</h2>
        <p className="mb-4 break-words text-xs text-red-600">
          {error.message || "Unexpected error"}
        </p>
        <button
          onClick={() => reset()}
          className="cursor-pointer rounded bg-red-600 px-3 py-1.5 text-xs text-white transition hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
