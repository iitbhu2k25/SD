"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/mar_suitability/admin/LocationContext";
import { CategoryProvider } from "@/contexts/mar_suitability/admin/CategoryContext";
import { MapProvider } from "@/contexts/mar_suitability/admin/MapContext";
import LocationSelector from "@/app/dss/gwm/mar_suitability/admin/components/locations";
import CategorySelector from "@/app/dss/gwm/mar_suitability/admin/components/Category";
import { useLocation } from "@/contexts/mar_suitability/admin/LocationContext";
import { useCategory } from "@/contexts/mar_suitability/admin/CategoryContext";
import MapView from "@/app/dss/gwm/mar_suitability/admin/components/openlayer";
import { useMap } from "@/contexts/mar_suitability/admin/MapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast, } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import WholeLoading from "@/components/app_layout/newLoading";
import { downloadCSV } from "@/components/utils/downloadCsv";

const MainContent = () => {

  const [submitting, setSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<"condition" | "constraint">(
    "condition"
  );

  const {
    selectedCondition,
    selectedConstraint,
    setSelectedCategory,
    tableData,

  } = useCategory();

  const { selectionsLocked, confirmSelections, resetSelections } =
    useLocation();

  const { setstpOperation, isMapLoading, loading, stpOperation } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const formatName = (fileName: string): string => {
    return fileName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const handleReset = () => {
    resetSelections();
  };

  const handleSubmit = () => {
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", {
        position: "top-center",
      });
    } else {
      setSubmitting(true);

      const selectedData = [
        ...selectedCondition,
        ...selectedConstraint,
      ]
      setSelectedCategory(selectedData);
      setstpOperation(true);

      // Simulate processing completion (remove this in production with actual processing)
      setTimeout(() => {
        setSubmitting(false);
      }, 2000);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {
        <WholeLoading
          visible={loading || isMapLoading || stpOperation}
          title={
            stpOperation ? "Analyzing suitability" : "Loading Resources"
          }
          message={
            stpOperation
              ? "Analyzing site priorities and generating results..."
              : "Fetching map data and initializing components..."
          }
        />
      }
      <main className="px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          <div className="lg:col-span-4 space-y-4">

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

                    {/* Required selection indicator */}
                    <div className="mb-4 text-sm text-red-600 font-medium flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      At least one condition category must be selected
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-start mt-8">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={`px-8 py-3 rounded-full font-medium shadow-md ${submitting
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600 text-white transform hover:scale-105"
                          } flex items-center transition duration-200`}
                      >
                        {submitting ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
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
              {tableData.length > 0 && (
                <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
                  <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                    <div className="mb-4 flex justify-between ">
                      <h2 className="text-xl font-semibold mb-4">MAR suitability Village-wise Analysis:</h2>
                      <button
                        onClick={() => downloadCSV(tableData, "MAR_suitability_admin.csv")}
                        className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg shadow transition duration-200 gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                        </svg>
                        Download CSV
                      </button>

                    </div>
                    <DataTable
                      columns={Village_columns}
                      data={tableData}
                      pagination
                      responsive
                      paginationPerPage={5}
                      paginationRowsPerPageOptions={[5, 10]}
                    />
                  </div>
                </section>
              )}

              {/* {tableData.length > 0 && (
                  <div className="flex justify-start mt-8">
                    <button
                      type="button"
                      onClick={handlereport}
                      className="px-8 py-3 rounded-full font-medium shadow-md flex items-center gap-2 transition duration-200 bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16h8M8 12h8m-8-4h8M4 6h16M4 6v12M20 6v12"
                        />
                      </svg>
                      Generate Report
                    </button>
                    <WholeLoading
                      visible={reportLoading}
                      title={"Generating report for STP priorities"}
                      message={
                          "Analyzing site priorities and generating results..."    
                      }
                    />
                  </div>
                )} */}

            </section>
          </div>

          {/* Map and Slider area - Now spans 4/12 columns on large screens */}
          <div className="lg:col-span-4 space-y-4">
            {/* Map Section with Larger Height */}
            <section className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Larger Map Component */}
              <div className="w-full p-4 md:min-h-[500px]">
                <MapView />
              </div>
            </section>

            {/* Category Influence Sliders in a separate box below the map */}
            {showCategories && (
              <section className="bg-white rounded-xl shadow-md overflow-hidden animate-fadeIn">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
                  {/* Tabs for switching between condition and constraint categories */}
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setActiveTab("condition")}
                      className={`flex-1 py-2 font-medium ${activeTab === "condition"
                          ? "text-blue-600 border-b-2 border-blue-500"
                          : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      Condition Influences
                    </button>
                    <button
                      onClick={() => setActiveTab("constraint")}
                      className={`flex-1 py-2 font-medium ${activeTab === "constraint"
                          ? "text-blue-600 border-b-2 border-blue-500"
                          : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      Constraint Influences
                    </button>
                  </div>
                </div>

                {activeTab === "condition" &&
                  (selectedCondition.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No condition categories selected. Please select at least
                      one condition category.
                    </div>
                  ) : (
                    <div className="p-4">
                      <CategorySlider activeTab={activeTab} />
                    </div>
                  ))}

                {activeTab === "constraint" &&
                  (selectedConstraint.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No constraint categories selected.
                    </div>
                  ) : (
                    <div className="p-4">
                      {/* Just display the names of selected constraint categories */}
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">
                          Selected Constraints
                        </h3>
                        {selectedConstraint.map((constraint, index) => (
                          <div
                            key={index}
                            className="p-2 bg-gray-50 rounded-md"
                          >
                            {formatName(constraint.file_name)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </section>
            )}
          </div>
        </div>
      </main>

    </div>

  );
};

// Main App component that provides the context
const Home = () => {
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

export default Home;
