"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/stp_priority/users/DrainContext";
import { CategoryProvider } from "@/contexts/stp_priority/admin/CategoryContext";
import { MapProvider } from "@/contexts/stp_priority/users/DrainMapContext";
import RiverSelector from "@/app/dss/rwm/wwt/stp_priority/users/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import CategorySelector from "@/app/dss/rwm/wwt/stp_priority/admin/components/Category";
import { useRiverSystem } from "@/contexts/stp_priority/users/DrainContext";
import { useCategory } from "@/contexts/stp_priority/admin/CategoryContext";
import MapView from "@/app/dss/rwm/wwt/stp_priority/users/components/openlayer";
import { useMap } from "@/contexts/stp_priority/users/DrainMapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import { api } from "@/services/api";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { DRAIN_LAYER_NAMES } from "@/interface/raster_context";
import { downloadCSV } from "@/components/utils/downloadCsv";

const MainContent = () => {
  const { selectedCategories, stpProcess } = useCategory();
  const [reportLoading, setReportLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);

  const {
    selectedCatchments,
    totalArea,
    totalCatchments,
    selectionsLocked,
    displayRaster,
    selectedCatchmentsNames,
    selectedStreachNames,
    selectedDrainsNames,
    selectedRiverName,
    confirmSelections,
    resetSelections,
    tableData,
  } = useRiverSystem();

  const { setstpOperation, loading, isMapLoading, stpOperation, setCatchmentLayer } =
    useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleConfirm = () => confirmSelections();

  const handleReset = () => {
    resetSelections();
    setCatchmentLayer(null);
    DRAIN_LAYER_NAMES.CATCHMENT = null;
    setShowCategories(false);
  };

  const handleSubmit = () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one category", {
        position: "top-center",
      });
    } else if (selectedCatchments.length < 1) {
      toast.error("Please select at least one catchment", {
        position: "top-center",
      });
    } else {
      setstpOperation(true);
    }
  };

  const handlereport = async () => {
    try {
      setReportLoading(true);
      setTaskId(null);
      setShowPdfStatus(false);

      const locationData = {
        River: selectedRiverName,
        Stretch: selectedStreachNames,
        Drain: selectedDrainsNames,
        Catchment: selectedCatchmentsNames,
      };
      const data = {
        table: tableData,
        raster: displayRaster,
        place: "Drain",
        clip: selectedCatchments,
        location: locationData,
        weight_data: selectedCategories,
      };

      const response = await api.post("/stp_operation/stp_priority_drain_report", {
        body: data,
      });

      if (response.status != 201) {
        setReportLoading(false);
        toast.error("Report failed", { position: "top-center" });
        return;
      }

      toast.success("Report generation started");
      const task = response.message as Record<string, string>;
      setTaskId(task["task_id"]);
      setShowPdfStatus(true);
    } catch (error) {
      toast.error("Failed to start report");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || reportLoading}
        title={
          stpOperation
            ? "Analyzing STP priorities"
            : reportLoading
            ? "Generating report for STP priorities"
            : "Loading Resources"
        }
        message={
          stpOperation
            ? "Analyzing site priorities and generating results..."
            : reportLoading
            ? "Generating report, please wait..."
            : "Fetching map data and initializing components..."
        }
      />

      <main className="flex flex-col lg:flex-row gap-4 py-2 h-[calc(80vh-20px)] overflow-hidden">
        {/* LEFT SIDE — SCROLLABLE */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6 h-full">
          <section className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              River System Selection
            </h2>
            {selectionsLocked && (
              <p className="text-sm text-green-600">
                {totalCatchments} catchments selected • Total area:{" "}
                {totalArea.toFixed(2)} sq Km
              </p>
            )}
          </section>

          <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <RiverSelector onConfirm={handleConfirm} onReset={handleReset} />
          </section>

          {showCategories && (
            <div className="animate-fadeIn">
              <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Analysis Categories
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Select the categories to analyze for the selected river
                  catchments
                </p>
                <CategorySelector />
              </section>

              <div className="flex justify-start mt-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={stpProcess}
                  className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center transition duration-200 ${
                    stpProcess
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                  }`}
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
                      Analyze River System
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {tableData.length > 0 && (
            <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
              <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                <div className="mb-4 flex justify-between">
                  <h2 className="text-xl font-semibold mb-4">
                    STP Priority Village-wise Analysis:
                  </h2>
                  <button
                    onClick={() => downloadCSV(tableData, "STP_Priority_drain.csv")}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg shadow transition duration-200 gap-2"
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
                        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                      />
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

          {tableData.length > 0 && (
            <div className="flex justify-center mt-8">
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
                {reportLoading ? "Starting..." : "Generate Report"}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDE — MAP & SLIDER SCROLLABLE */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-4 space-y-6 h-full">
          <section className="rounded-xl overflow-hidden">
            <div className="w-full md:min-h-[400px]">
              <MapView />
            </div>
          </section>

          {showCategories && selectedCategories.length > 0 && (
            <section className="bg-white rounded-xl shadow-md overflow-hidden animate-fadeIn">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Analysis Weights
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Adjust the influence of each category on the analysis
                </p>
              </div>
              <CategorySlider />
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

const PriorityDrain = () => {
  return (
    <RiverSystemProvider>
      <CategoryProvider>
        <MapProvider>
          <MainContent />
        </MapProvider>
      </CategoryProvider>
    </RiverSystemProvider>
  );
};

export default PriorityDrain;
