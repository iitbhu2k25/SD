"use client";

import React, { useEffect, useState } from "react";
import { LocationProvider } from "@/contexts/stp_suitability/admin/LocationContext";
import { CategoryProvider } from "@/contexts/stp_suitability/admin/CategoryContext";
import { MapProvider } from "@/contexts/stp_suitability/admin/MapContext";
import LocationSelector from "@/app/dss/rwm/wwt/stp_suitability/admin/components/locations";
import CategorySelector from "@/app/dss/rwm/wwt/stp_suitability/admin/components/Category";
import MapView from "@/app/dss/rwm/wwt/stp_suitability/admin/components/openlayer";
import { useLocation } from "@/contexts/stp_suitability/admin/LocationContext";
import { useCategory } from "@/contexts/stp_suitability/admin/CategoryContext";
import { useMap } from "@/contexts/stp_suitability/admin/MapContext";
import { CategorySlider } from "./components/weight_slider";
import WholeLoading from "@/components/app_layout/newLoading";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import { api } from "@/services/api";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { downloadCSV } from "@/components/utils/downloadCsv";
import { TreatmentForm } from "@/app/dss/rwm/wwt/stp_suitability/admin/components/Stp_area";

const MainContent: React.FC = () => {
  // Category context (suitability)
  const {
    selectedCondition,
    selectedConstraint,
    setSelectedCategory,
    tableData,
  } = useCategory();

  // Location context (suitability)
  const {
    selectionsLocked,
    displayRaster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    selectedTownsNames,
    selectedVillages,
    totalPopulation,
  } = useLocation();

  // Map context (suitability)
  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();

  // Local UI state
  const [showCategories, setShowCategories] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const formatName = (fileName: string) =>
    fileName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleAnalyze = () => {
    // Mirror the Priority UI approach: quick validation then set operation
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", { position: "top-center" });
      return;
    }

    // Merge condition + constraint into selected categories for server / processing
    const selectedData = [...selectedCondition, ...selectedConstraint];
    setSelectedCategory(selectedData);
    setstpOperation(true);
  };

  const handleReport = async () => {
    try {
      setReportLoading(true);
      setTaskId(null);
      setShowPdfStatus(false);

      const locationData = {
        state: selectedStateName,
        districts: selectedDistrictsNames,
        subDistricts: selectedSubDistrictsNames,
        towns: selectedTownsNames,
        population: totalPopulation,
      };

      const data = {
        table: tableData,
        raster: displayRaster,
        place: "Admin",
        clip: selectedVillages,
        location: locationData,
        weight_data: selectedCondition,
        non_weight_data: selectedConstraint,
      };

      const response = await api.post("/stp_operation/stp_suitability_admin_report", {
        body: data,
      });

      if (response.status !== 201) {
        toast.error("Report failed", { position: "top-center" });
        return;
      }

      toast.success("Report generation started");
      const task = response.message as Record<string, string>;
      setTaskId(task["task_id"]);
      setShowPdfStatus(true);
    } catch (error) {
      console.error("Report error", error);
      toast.error("Failed to start report");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="bg-gray-50  flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || reportLoading}
        title={
          stpOperation
            ? "Analyzing STP suitability"
            : reportLoading
            ? "Generating report for STP suitability"
            : "Loading Resources"
        }
        message={
          stpOperation
            ? "Analyzing site suitability and generating results..."
            : reportLoading
            ? "Generating report, please wait..."
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
            {selectionsLocked && (
              <p className="text-sm text-green-600">
                {selectedSubDistrictsNames.length} Towns selected
              </p>
            )}
          </section>

          <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <LocationSelector />
          </section>

          {showCategories && (
            <>
              <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">Analysis Categories</h3>
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

              <div className="flex justify-start mt-2">
                <button
                  onClick={handleAnalyze}
                  disabled={stpOperation || submitting}
                  className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center transition duration-200 ${
                    stpOperation || submitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                  }`}
                >
                  {stpOperation || submitting ? "Processing..." : "Analyze Suitability"}
                </button>
              </div>
            </>
          )}

          {/* Table / CSV / Treatment */}
          {tableData.length > 0 && (
            <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
              <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-xl font-semibold mb-0">STP Suitability Village-wise Analysis</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadCSV(tableData, "STP_suitability_admin.csv")}
                      className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg shadow transition duration-200 gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                      </svg>
                      Download CSV
                    </button>
                  </div>
                </div>

                <DataTable
                  columns={Village_columns}
                  data={tableData}
                  pagination
                  responsive
                  paginationPerPage={5}
                  paginationRowsPerPageOptions={[5, 10, 20]}
                />
              </div>
            </section>
          )}

          {tableData.length > 0 && (
            <div className="flex justify-center mt-6">
              <TreatmentForm />
            </div>
          )}

          {tableData.length > 0 && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleReport}
                disabled={reportLoading}
                className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center gap-2 transition duration-200 ${
                  reportLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586l5.414 5.414V19a2 2 0 01-2 2z" />
                </svg>
                {reportLoading ? "Starting..." : "Generate Report"}
              </button>
            </div>
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
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">Analysis Weights</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Adjust influence of each condition & constraint category
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setActiveTab("condition")}
                      className={`px-3 py-1 rounded ${activeTab === "condition" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      Conditions
                    </button>
                    <button
                      onClick={() => setActiveTab("constraint")}
                      className={`px-3 py-1 rounded ${activeTab === "constraint" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      Constraints
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {activeTab === "condition" && (
                  <>
                    {selectedCondition.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No condition categories selected.</div>
                    ) : (
                      <CategorySlider activeTab="condition" />
                    )}
                  </>
                )}

                {activeTab === "constraint" && (
                  <>
                    {selectedConstraint.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No constraint categories selected.</div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">Selected Constraints</h3>
                        <div className="space-y-2">
                          {selectedConstraint.map((c, idx) => (
                            <div key={idx} className="p-2 bg-gray-50 rounded-md border border-gray-100">
                              {formatName((c as any).file_name ?? String(c))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {showPdfStatus && taskId && (
        <PDFGenerationStatus
          taskId={taskId}
          className="fixed bottom-8 right-8 w-96 z-50 animate-fadeIn"
          autoClose={true}
          closeDelay={3000}
          enableAutoDownload={true}
        />
      )}
    </div>
  );
};

const SuitabilityAdminWrapper: React.FC = () => (
  <LocationProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </LocationProvider>
);

export default SuitabilityAdminWrapper;
