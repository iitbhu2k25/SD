"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/pumping_location/users/DrainContext";
import { CategoryProvider } from "@/contexts/pumping_location/admin/CategoryContext";
import { MapProvider } from "@/contexts/pumping_location/users/DrainMapContext";

import RiverSelector from "@/app/dss/gwm/pumping_location/users/components/locations";
import CategorySelector from "@/app/dss/gwm/pumping_location/users/components/Category";
import MapView from "@/app/dss/gwm/pumping_location/users/components/openlayer";

import { CategorySlider } from "./components/weight_slider";
import CsvUploader from "./components/handle_csv";
import DataTable from "react-data-table-component";
import WholeLoading from "@/components/app_layout/newLoading";
import { Gwpl_columns } from "@/interface/table";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useRiverSystem } from "@/contexts/pumping_location/users/DrainContext";
import { useCategory } from "@/contexts/pumping_location/admin/CategoryContext";
import { useMap } from "@/contexts/pumping_location/users/DrainMapContext";
import { downloadCSV } from "@/components/utils/downloadCsv";

const MainContent = () => {
  const [uploadCSV, setUploadCSV] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");

  const { selectedCondition, selectedConstraint, setSelectedCategory } = useCategory();
  const {
    selectedCatchments,
    totalArea,
    totalCatchments,
    selectionsLocked,
    displayRaster,
    well_points,
    tableData,
    setValidateTable,
  } = useRiverSystem();
  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleSubmit = () => {
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", {
        position: "top-center",
      });
      return;
    }
    setSubmitting(true);
    const selectedData = [...selectedCondition, ...selectedConstraint];
    setSelectedCategory(selectedData);
    setstpOperation(true);
    setTimeout(() => setSubmitting(false), 2000);
  };

  const formatName = (fileName: string) =>
    fileName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || submitting}
        title={
          stpOperation
            ? "Analyzing Groundwater Pumping Zones"
            : submitting
            ? "Starting Analysis..."
            : "Loading Resources"
        }
        message={
          stpOperation
            ? "Analyzing pumping locations and generating results..."
            : submitting
            ? "Initializing data layers..."
            : "Fetching map data and initializing components..."
        }
      />

      <main className="flex flex-col lg:flex-row gap-4 py-2 h-[calc(80vh-20px)] overflow-hidden">
        {/* LEFT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6 h-full">
          {/* Header */}
          <section className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Drain System Selection
            </h2>
            {selectionsLocked && (
              <p className="text-sm text-green-600">
                {totalCatchments} catchments selected • Total area:{" "}
                {totalArea.toFixed(2)} sq.km
              </p>
            )}
          </section>

          {/* River System */}
          <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <RiverSelector />
          </section>

          {/* Input Method */}
          {displayRaster.find((item) => item.file_name === "Pumping_location") &&
            tableData.length === 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Input Method</h3>
                    <p className="text-sm text-gray-500">
                      Choose how you want to provide location data.
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-medium ${
                        !uploadCSV ? "text-blue-600" : "text-gray-400"
                      }`}
                    >
                      Manual
                    </span>
                    <button
                      onClick={() => setUploadCSV(!uploadCSV)}
                      className={`relative inline-flex h-6 w-12 rounded-full transition-colors duration-300 focus:outline-none ${
                        uploadCSV ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                          uploadCSV ? "translate-x-6" : ""
                        }`}
                      />
                    </button>
                    <span
                      className={`text-sm font-medium ${
                        uploadCSV ? "text-blue-600" : "text-gray-400"
                      }`}
                    >
                      CSV
                    </span>
                  </div>

                  {well_points?.length > 0 && (
                    <button
                      onClick={() => setValidateTable(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
                    >
                      Validate
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  {uploadCSV ? (
                    <CsvUploader />
                  ) : (
                    <p className="text-sm text-gray-500">
                      Click on the map to add pumping location points.
                    </p>
                  )}
                </div>
              </section>
            )}

          {/* Data Table */}
          {tableData.length > 0 && (
            <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
              <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                <div className="mb-4 flex justify-between">
                  <h2 className="text-xl font-semibold mb-4">
                    Groundwater Well Points Analysis
                  </h2>
                </div>
                <DataTable
                  columns={Gwpl_columns}
                  data={tableData}
                  pagination
                  responsive
                  paginationPerPage={5}
                  paginationRowsPerPageOptions={[5, 10]}
                />
              </div>
            </section>
          )}

          {/* Category Section */}
          {showCategories && (
            <div className="animate-fadeIn">
              <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Analysis Categories
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Select condition and constraint categories for analysis.
                </p>
                <CategorySelector />
              </section>

              <div className="flex justify-start mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center transition duration-200 ${
                    submitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                  }`}
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
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

        {/* RIGHT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-4 space-y-6 h-full">
          <section className="rounded-xl overflow-hidden">
            <div className="w-full md:min-h-[400px]">
              <MapView />
            </div>
          </section>

          {showCategories && (
            <section className="bg-white rounded-xl shadow-md overflow-hidden animate-fadeIn">
              <div className="border-b border-gray-200 bg-gray-50 flex">
                <button
                  onClick={() => setActiveTab("condition")}
                  className={`flex-1 py-3 font-semibold ${
                    activeTab === "condition"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Condition Influences
                </button>
                <button
                  onClick={() => setActiveTab("constraint")}
                  className={`flex-1 py-3 font-semibold ${
                    activeTab === "constraint"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Constraint Influences
                </button>
              </div>

              <div className="p-5">
                {activeTab === "condition" &&
                  (selectedCondition.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      No condition categories selected.
                    </div>
                  ) : (
                    <CategorySlider activeTab={activeTab} />
                  ))}

                {activeTab === "constraint" &&
                  (selectedConstraint.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      No constraint categories selected.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Selected Constraints
                      </h3>
                      {selectedConstraint.map((constraint, i) => (
                        <div
                          key={i}
                          className="p-2 bg-gray-50 rounded-md border border-gray-100"
                        >
                          {formatName(constraint.file_name)}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

const GWPLDrain = () => (
  <RiverSystemProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </RiverSystemProvider>
);

export default GWPLDrain;
