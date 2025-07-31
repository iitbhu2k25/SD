"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/stp_priority/admin/LocationContext";
import { CategoryProvider } from "@/contexts/stp_priority/admin/CategoryContext";
import { MapProvider } from "@/contexts/stp_priority/admin/MapContext";
import LocationSelector from "@/app/dss/RWM/WWT/stp_priority/admin/components/locations";

import CategorySelector from "@/app/dss/RWM/WWT/stp_priority/admin/components/Category";
import { useLocation } from "@/contexts/stp_priority/admin/LocationContext";
import { useCategory } from "@/contexts/stp_priority/admin/CategoryContext";
import MapView from "@/app/dss/RWM/WWT/stp_priority/admin/components/openlayer";
import { useMap } from "@/contexts/stp_priority/admin/MapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast, ToastContainer } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";

import "react-toastify/dist/ReactToastify.css";

const MainContent = () => {
  const [showRankings, setShowRankings] = useState(false);
  const [showTier, setShowTier] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const {
    selectedCategories,
    selectAllCategories,
    stpProcess,
    tableData,
  } = useCategory();

  const { selectionsLocked, confirmSelections, resetSelections } =
    useLocation();

  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleConfirm = () => {
    const result = confirmSelections();
  };

  const handleReset = () => {
    resetSelections();
  };

  const handleSubmit = () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one categories", {
        position: "top-center",
      });
    } else {
      //here club
      setstpOperation(true);
    }
  };

  const toggleSelectorView = () => {
    setShowTier(!showTier);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes bounce {
          0%,
          20%,
          50%,
          80%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
        .loading-backdrop {
          backdrop-filter: blur(8px);
          background: rgba(0, 0, 0, 0.3);
        }
        .loading-container {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .progress-ring {
          transition: stroke-dasharray 0.35s;
          transform-origin: 50% 50%;
        }
      `}</style>

      {/* Header */}

      {/* Improved Loading Component */}
      {(loading || isMapLoading || stpOperation) && (
        <div className="fixed inset-0 loading-backdrop z-50 flex items-center justify-center transition-all duration-300">
          <div className="loading-container bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 animate-slideIn">
            {/* Animated Loading Spinner */}
            <div className="flex flex-col items-center space-y-6">
              <div className="relative w-20 h-20">
                {/* Outer ring */}
                <svg
                  className="w-20 h-20 transform -rotate-90"
                  viewBox="0 0 80 80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="220"
                    strokeDashoffset="60"
                    className="text-blue-500 progress-ring animate-spin"
                    style={{ animationDuration: "2s" }}
                  />
                </svg>

                {/* Inner pulsing circle */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Loading Text */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {stpOperation ? "Processing Analysis" : "Loading Resources"}
                </h3>
                <p className="text-gray-600 text-sm">
                  {stpOperation
                    ? "Analyzing site priorities and generating results..."
                    : "Fetching map data and initializing components..."}
                </p>
              </div>

              {/* Progress Dots */}
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="px-4 py-8">
        {/* Changed from grid-cols-2 to grid-cols-3 to create a 2:1 ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Main content area - Now spans 8/12 columns on large screens */}
          <div className="lg:col-span-4 space-y-4">
            {/* Selection Components Section */}
            <section className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Selection Criteria
                </h2>
              </div>

              <div className="p-6">
                {/* Selection Components with improved styling */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <LocationSelector />
                </div>

                {/* Categories Section - Only shown after confirmation */}
                {showCategories && (
                  <div className="animate-fadeIn">
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <CategorySelector />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-start mt-8">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={stpProcess}
                        className={`px-8 py-3 rounded-full font-medium shadow-md ${
                          stpProcess
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600 text-white transform hover:scale-105"
                        } flex items-center transition duration-200`}
                      >
                        {!stpProcess && (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 mr-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Submit Analysis
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
             {tableData && <div className="p-6 bg-white rounded-2xl shadow-md">
                <h2 className="text-xl font-semibold mb-4">
                  Village Analysis Information
                </h2>
                <DataTable
                  columns={Village_columns}
                  data={tableData}
                  pagination
                  responsive
                  paginationPerPage={10}
                  paginationRowsPerPageOptions={[5, 10, 20, 50]}
                />
              </div>}
            </section>
          </div>
          {/* Map and Slider area - Now spans 4/12 columns on large screens */}
          <div className="lg:col-span-4 space-y-4">
            {/* Map Section with Larger Height */}
            <section className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Larger Map Component */}
              <div className="w-full p-4  md:min-h-[500px]">
                <MapView />
              </div>
            </section>

            {/* Category Influence Sliders in a separate box below the map */}
            {showCategories && selectedCategories.length > 0 && (
              <section className="bg-white rounded-xl shadow-md overflow-hidden animate-fadeIn">
                <CategorySlider />
              </section>
            )}
          </div>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};

// Main App component that provides the context
const PriorityAdmin = () => {
  return (
    <LocationProvider>
      <CategoryProvider>
        <MapProvider>
          <MainContent />
        </MapProvider>
      </CategoryProvider>
    </LocationProvider>
  );
};

export default PriorityAdmin;