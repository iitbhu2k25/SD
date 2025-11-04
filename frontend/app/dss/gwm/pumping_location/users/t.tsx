"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/groundwaterIdent/users/DrainContext";
import { CategoryProvider } from "@/contexts/groundwaterIdent/admin/CategoryContext";
import { MapProvider } from "@/contexts/groundwaterIdent/users/DrainMapContext";

import RiverSelector from "@/app/dss/gwm/pumping_location/users/components/locations";
import CategorySelector from "@/app/dss/gwm/pumping_location/users/components/Category";
import MapView from "@/app/dss/gwm/pumping_location/users/components/openlayer";
import { CategorySlider } from "./components/weight_slider";
import CsvUploader from "./components/handle_csv";
import DataTable from "react-data-table-component";

import WholeLoading from "@/components/app_layout/newLoading";
import { Gwpl_columns } from "@/interface/table";
import { toast } from "react-toastify";

import { useRiverSystem } from "@/contexts/groundwaterIdent/users/DrainContext";
import { useCategory } from "@/contexts/groundwaterIdent/admin/CategoryContext";
import { useMap } from "@/contexts/groundwaterIdent/users/DrainMapContext";

const MainContent = () => {
  const [submitting, setSubmitting] = useState(false);
  const [uploadCSV, setUploadCSV] = useState(false);
  const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");
  const [showCategories, setShowCategories] = useState(false);

  const { selectedCondition, selectedConstraint, setSelectedCategory } = useCategory();
  const {
    selectedCatchments,
    totalArea,
    totalCatchments,
    selectionsLocked,
    displayRaster,
    setValidateTable,
    well_points,
    tableData,
  } = useRiverSystem();
  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleSubmit = () => {
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", { position: "top-center" });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation}
        title={stpOperation ? "Analyzing Pumping Zones" : "Loading Resources"}
        message={
          stpOperation
            ? "Analyzing pumping locations and generating results..."
            : "Fetching map data and initializing components..."
        }
      />

      <main className="flex flex-col lg:flex-row gap-6 p-6 h-[calc(100vh-80px)]">
        {/* LEFT PANEL */}
        <div className="w-full lg:w-1/2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="pb-2 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800">Groundwater Pumping Zone</h2>
            {selectionsLocked && (
              <p className="text-sm text-green-600 mt-1">
                {totalCatchments} catchments selected • {totalArea.toFixed(2)} sq.km area
              </p>
            )}
          </div>

          {/* River System Selection */}
          <section className="bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">River System Selection</h3>
            <RiverSelector />
          </section>

          {/* Input Method */}
          {displayRaster.find((item) => item.file_name === "Pumping_location") && tableData.length === 0 && (
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
                    className={`text-sm font-medium ${!uploadCSV ? "text-blue-600" : "text-gray-400"}`}
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
                    className={`text-sm font-medium ${uploadCSV ? "text-blue-600" : "text-gray-400"}`}
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
            <section className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Groundwater Well Points Analysis
              </h3>
              <DataTable
                columns={Gwpl_columns}
                data={tableData}
                pagination
                responsive
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10]}
              />
            </section>
          )}

          {/* Category Section */}
          {showCategories && (
            <section className="space-y-5">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <CategorySelector />
              </div>

              <p className="text-sm text-red-600 font-medium flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                At least one condition category must be selected
              </p>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center shadow-md transition duration-200 ${
                  submitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white"
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
            </section>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full lg:w-1/2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-y-auto p-6 space-y-6">
          <section className="rounded-xl overflow-hidden">
            <div className="w-full h-[500px] md:h-[600px] rounded-xl overflow-hidden border border-gray-200">
              <MapView />
            </div>
          </section>

          {showCategories && (
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
                        <div key={i} className="p-2 bg-gray-50 rounded-md border border-gray-100">
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
