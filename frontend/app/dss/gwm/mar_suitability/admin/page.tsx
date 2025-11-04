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
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import WholeLoading from "@/components/app_layout/newLoading";
import { downloadCSV } from "@/components/utils/downloadCsv";

const MainContent = () => {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");
  const { selectedCondition, selectedConstraint, setSelectedCategory, tableData } = useCategory();
  const { selectionsLocked, confirmSelections, resetSelections } = useLocation();
  const { setstpOperation, isMapLoading, loading, stpOperation } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const formatName = (fileName: string): string =>
    fileName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

    setTimeout(() => {
      setSubmitting(false);
    }, 2000);
  };


  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || submitting}
        title={
          stpOperation
            ? "Analyzing MAR Suitability"
            : "Loading Resources"
        }
        message={
          stpOperation
            ? "Analyzing groundwater recharge suitability and generating results..."
            : "Fetching map data and initializing components..."
        }
      />

      <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 h-[calc(100vh-100px)]">
        {/* LEFT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6">
          <section className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Administrative Selection
            </h2>
            
          </section>

          <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <LocationSelector />
          </section>

          {showCategories && (
            <div className="animate-fadeIn">
              <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Analysis Categories
                </h3>
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
                  Analyze Suitability
                </button>
              </div>
            </div>
          )}

          {tableData.length > 0 && (
            <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
              <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                <div className="mb-4 flex justify-between">
                  <h2 className="text-xl font-semibold mb-4">
                    MAR Suitability Village-wise Analysis:
                  </h2>
                  <button
                    onClick={() => downloadCSV(tableData, "MAR_Suitability_admin.csv")}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg shadow transition duration-200 gap-2"
                  >
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
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-4 space-y-6">
          <section className="rounded-xl overflow-hidden">
            <div className="w-full md:min-h-[400px]">
              <MapView />
            </div>
          </section>

          {showCategories && (
            <section className="bg-white rounded-xl shadow-md overflow-hidden animate-fadeIn">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab("condition")}
                    className={`flex-1 py-2 font-medium ${
                      activeTab === "condition"
                        ? "text-blue-600 border-b-2 border-blue-500"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Condition Influences
                  </button>
                  <button
                    onClick={() => setActiveTab("constraint")}
                    className={`flex-1 py-2 font-medium ${
                      activeTab === "constraint"
                        ? "text-blue-600 border-b-2 border-blue-500"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Constraint Influences
                  </button>
                </div>
              </div>

              <div className="p-4">
                {activeTab === "condition" &&
                  (selectedCondition.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No condition categories selected.
                    </div>
                  ) : (
                    <CategorySlider activeTab={activeTab} />
                  ))}

                {activeTab === "constraint" &&
                  (selectedConstraint.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No constraint categories selected.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold mb-4 text-gray-800">
                        Selected Constraints
                      </h3>
                      {selectedConstraint.map((constraint, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded-md">
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

const MARAdmin = () => (
  <LocationProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </LocationProvider>
);

export default MARAdmin;