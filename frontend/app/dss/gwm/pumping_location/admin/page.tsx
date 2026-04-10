"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider, useLocation } from "@/contexts/gwm/pumping_location/admin/LocationContext";
import { CategoryProvider, useCategory } from "@/contexts/gwm/pumping_location/admin/CategoryContext";
import { MapProvider, useMap } from "@/contexts/gwm/pumping_location/admin/MapContext";

import LocationSelector from "@/app/dss/gwm/pumping_location/admin/components/locations";
import CategorySelector from "@/app/dss/gwm/pumping_location/admin/components/Category";
import MapView from "@/app/dss/gwm/pumping_location/admin/components/openlayer";
import CsvUploader from "./components/handle_csv";
import { CategorySlider } from "./components/weight_slider";
import WholeLoading from "@/components/app_layout/newLoading";
import toast from "react-hot-toast";
import DataTable from "react-data-table-component";
import { Gwpl_columns } from "@/interface/table";
import { FaLock, FaUnlock } from "react-icons/fa";

const MainContent = () => {
  const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");
  const { selectedCondition, selectedConstraint, setSelectedCategory } = useCategory();
  const { selectionsLocked, displayRaster, setValidateTable, well_points, tableData } = useLocation();
  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();
      const [categoriesEditable, setCategoriesEditable] = useState(false);

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

      <main className="flex flex-col lg:flex-row gap-4 py-2 h-[calc(80vh-20px)] overflow-hidden">
        {/* LEFT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6 h-full">
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
               

                <CsvUploader />

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
            <div className="animate-fadeIn">
            <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-800 mb-2">
                    Analysis Categories
                  </h3>
                  <button
                    onClick={() => setCategoriesEditable(!categoriesEditable)}
                    className="relative group p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition"
                  >
                    {categoriesEditable ? <FaUnlock /> : <FaLock />}

                    {/* Tooltip */}
                    <span className="absolute -top-9 left-1/4 -translate-x-1/2 
                                   whitespace-nowrap rounded-md bg-gray-600 px-2 py-1 
                                   text-xs text-white opacity-0 
                                   group-hover:opacity-100 transition
                                  ">
                      Weight Lock/Unlock
                    </span>
                  </button>
                </div>
                <CategorySelector />
                <div className="mt-3 text-sm text-red-600 font-medium flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  At least one condition category must be selected
                </div>
              </section>

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
              </div>

          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-4 space-y-6 h-full">
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
                                         <CategorySlider activeTab="condition" editable={categoriesEditable}/>
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
