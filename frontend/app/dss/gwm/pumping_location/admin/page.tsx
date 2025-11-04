"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider, useLocation } from "@/contexts/groundwaterIdent/admin/LocationContext";
import { CategoryProvider, useCategory } from "@/contexts/groundwaterIdent/admin/CategoryContext";
import { MapProvider, useMap } from "@/contexts/groundwaterIdent/admin/MapContext";

import LocationSelector from "@/app/dss/gwm/pumping_location/admin/components/locations";
import CategorySelector from "@/app/dss/gwm/pumping_location/admin/components/Category";
import MapView from "@/app/dss/gwm/pumping_location/admin/components/openlayer";
import CsvUploader from "./components/handle_csv";
import { CategorySlider } from "./components/weight_slider";
import WholeLoading from "@/components/app_layout/newLoading";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Gwpl_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";

const MainContent = () => {
  const [uploadCsv, setUploadCsv] = useState(false);
  const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");
  const { selectedCondition, selectedConstraint, setSelectedCategory } = useCategory();
  const { selectionsLocked, displayRaster, setValidateTable, well_points, tableData } = useLocation();
  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();

  const [showCategories, setShowCategories] = useState(false);

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
    setTimeout(() => setSubmitting(false), 1500);
  };

  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation}
        title={
          stpOperation
            ? "Analyzing Pumping Zones"
            : "Loading Groundwater Resources"
        }
        message={
          stpOperation
            ? "Analyzing groundwater pumping zones and generating results..."
            : "Fetching map data and initializing layers..."
        }
      />

      <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 h-[calc(100vh-100px)]">
        {/* LEFT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6">
          {/* Administrative Selection */}
          <section className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Administrative Selection
            </h2>
            {selectionsLocked && (
              <p className="text-sm text-green-600">
                Selection locked — ready for analysis.
              </p>
            )}
          </section>

          {/* Location */}
          <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <LocationSelector />
          </section>

          {/* CSV / Manual Input */}
          {displayRaster.find((item) => item.file_name === "Pumping_location") &&
            tableData.length === 0 && (
              <section className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">
                    Input Method
                  </h3>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm ${!uploadCsv ? "text-blue-600" : "text-gray-400"
                        }`}
                    >
                      Manual
                    </span>
                    <button
                      onClick={() => setUploadCsv(!uploadCsv)}
                      className={`relative inline-flex h-6 w-12 rounded-full transition-colors duration-300 focus:outline-none ${uploadCsv ? "bg-blue-600" : "bg-gray-300"
                        }`}
                    >
                      <span
                        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transform transition-transform ${uploadCsv ? "translate-x-6" : ""
                          }`}
                      />
                    </button>
                    <span
                      className={`text-sm ${uploadCsv ? "text-blue-600" : "text-gray-400"
                        }`}
                    >
                      CSV
                    </span>
                  </div>
                </div>

                {uploadCsv ? (
                  <CsvUploader />
                ) : (
                  <p className="text-sm text-gray-500">
                    Click on the map to mark pumping locations manually.
                  </p>
                )}

                {well_points?.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setValidateTable(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                    >
                      Validate
                    </button>
                  </div>
                )}
              </section>
            )}

          {/* Table Section */}
          {tableData.length > 0 && (
            <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
              <div className="p-6 bg-white rounded-2xl shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Groundwater Well Points
                </h2>
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

          {/* Category Selection */}
          {showCategories && (
            <section className="animate-fadeIn">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Analysis Categories
                </h3>
                <CategorySelector />
              </div>

              <div className="flex justify-start mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center transition duration-200 ${submitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                    }`}
                >
                  {submitting ? "Processing..." : "Analyze Zones"}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-4 space-y-6">
          {/* Map */}
          <section className="rounded-xl overflow-hidden">
            <div className="w-full md:min-h-[400px]">
              <MapView />
            </div>
          </section>

          {/* Sliders */}
          {showCategories && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
              <div className="border-b border-gray-200 bg-gray-50 flex">
                <button
                  onClick={() => setActiveTab("condition")}
                  className={`flex-1 py-3 font-medium ${activeTab === "condition"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Condition Influences
                </button>
                <button
                  onClick={() => setActiveTab("constraint")}
                  className={`flex-1 py-3 font-medium ${activeTab === "constraint"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Constraint Influences
                </button>
              </div>

              {activeTab === "condition" ? (
                selectedCondition.length > 0 ? (
                  <div className="p-5">
                    <CategorySlider activeTab="condition" />
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No condition categories selected.
                  </div>
                )
              ) : selectedConstraint.length > 0 ? (
                <div className="p-5 space-y-3">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Selected Constraints
                  </h3>
                  {selectedConstraint.map((c, i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded-md border border-gray-200">
                      {c.file_name.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No constraint categories selected.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const GWPLAdmin = () => (
  <LocationProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </LocationProvider>
);

export default GWPLAdmin;
