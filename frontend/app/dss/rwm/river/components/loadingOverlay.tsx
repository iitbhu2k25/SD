"use client";

import React, { useEffect } from "react";

interface LoadingOverlayProps {
  isGenerating: boolean;
  totalParameters: number;
  completedParameters: number; // how many params done
  onComplete: () => void;
  status: "loading" | "success" | "error" | "cancelled";
  errorMessage?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isGenerating,
  totalParameters,
  completedParameters,
  onComplete,
  status,
  errorMessage,
}) => {
  if (!isGenerating) return null;

  useEffect(() => {
  if (status === "success") {
    const timeout = setTimeout(() => {
      onComplete();
    }, 1500); // close after 1.5 sec (same as your old behavior)

    return () => clearTimeout(timeout);
  }
}, [status, onComplete]);


  const progress =
    totalParameters > 0
      ? Math.min(100, (completedParameters / totalParameters) * 100)
      : 0;

  const progressLabel = `${Math.round(progress)}%`;

  return (
    <div
      className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(107, 114, 128, 0.3)",
      }}
    >
      <div className="bg-white backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-white/30">
        {/* LOADING STATE */}
        {status === "loading" && (
          <>
            {/* Spinner */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 border-8 border-gray-200 rounded-full"></div>
                <div
                  className="w-20 h-20 border-8 border-blue-500 rounded-full absolute top-0 left-0 animate-spin"
                  style={{
                    borderTopColor: "transparent",
                    borderRightColor: "transparent",
                  }}
                ></div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Generating PDF Report
            </h2>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-linear"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
                <span>
                  {completedParameters} / {totalParameters} parameters completed
                </span>
                <span className="font-semibold text-blue-700">
                  {progressLabel}
                </span>
              </div>
            </div>

            {/* Parameters Info */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Completed so far:</span>
                <span className="font-semibold text-blue-700">
                  {completedParameters}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total parameters:</span>
                <span className="font-semibold text-blue-700">
                  {totalParameters}
                </span>
              </div>
            </div>

            {/* Status Message */}
            <p className="text-center text-gray-500 text-sm mt-6">
              Please wait while we process the selected parameters and generate
              your report...
            </p>
          </>
        )}

        {/* SUCCESS STATE */}
        {status === "success" && (
          <>
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Report Generated Successfully!
            </h2>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200 mb-6">
              <p className="text-center text-green-700 text-sm">
                Your PDF report has been generated and downloaded successfully.
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={onComplete}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Close
            </button>
          </>
        )}

        {/* ERROR STATE */}
        {status === "error" && (
          <>
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>

            {/* Error Title */}
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Error Generating Report
            </h2>

            {/* Error Message */}
            <div className="bg-red-50 rounded-lg p-4 border border-red-200 mb-6">
              <p className="text-center text-red-700 text-sm">
                {errorMessage ||
                  "Failed to generate PDF report. Please try again."}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={onComplete}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
