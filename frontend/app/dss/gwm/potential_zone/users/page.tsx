"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/groundwaterzone/users/DrainContext";
import { CategoryProvider } from "@/contexts/groundwaterzone/admin/CategoryContext";
import { MapProvider } from "@/contexts/groundwaterzone/users/DrainMapContext";
import RiverSelector from "@/app/dss/gwm/potential_zone/users/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import CategorySelector from "@/app/dss/gwm/potential_zone/admin/components/Category";
import { useRiverSystem } from "@/contexts/groundwaterzone/users/DrainContext";
import { useCategory } from "@/contexts/groundwaterzone/admin/CategoryContext";
import MapView from "@/app/dss/gwm/potential_zone/users/components/openlayer";
import { useMap } from "@/contexts/groundwaterzone/users/DrainMapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import { api } from "@/services/api";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
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

  const { setstpOperation, loading, isMapLoading, stpOperation, setCatchmentLayer } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleConfirm = (selectedData: any) => {
    const result = confirmSelections();
  };

  const handleReset = () => {
    resetSelections();
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
      // Start the river system analysis
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
      const response = await api.post(
        "/gwz_operation/gwz_drain_report",
        { body: data }
      );
      if (response.status != 201) {

        setReportLoading(false);
        toast.error("Report failed", {
          position: "top-center",
        });
        return null;
      }
      toast.success("Report generated started");
      const task = response.message as Record<string, string>;
      setTaskId(task["task_id"]);
      setShowPdfStatus(true);
    } catch (error) {
      console.log("Report error", error);
      toast.error("Failed to start report");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || reportLoading}
        title={stpOperation ? "Analyzing potential zones" : reportLoading ? "Generating report for STP priorities" : "Loading Resources"}
        message={
          stpOperation
            ? "Analyzing site priorities and generating results..."
            : reportLoading
              ? "Generating report, please wait..."
              : "Fetching map data and initializing components..."
        }
      />

      <main className="px-4 py-8">
        {/* Changed from grid-cols-2 to grid-cols-3 to create a 2:1 ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Main content area - Now spans 4/8 columns on large screens */}
          <div className="lg:col-span-4 space-y-4">
            {/* Selection Components Section */}
            <section className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  River System Selection
                </h2>
                {selectionsLocked && (
                  <p className="text-sm text-green-600 mt-1">
                    {totalCatchments} catchments selected • Total area:{" "}
                    {totalArea.toFixed(2)} sq Km
                  </p>
                )}
              </div>

              <div className="p-6">
                {/* River System Selection Components with improved styling */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <RiverSelector
                    onConfirm={handleConfirm}
                    onReset={handleReset}
                  />
                </div>

                {/* Categories Section - Only shown after confirmation */}
                {showCategories && (
                  <div className="animate-fadeIn">
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-800 mb-2">
                          Analysis Categories
                        </h3>
                        <p className="text-sm text-gray-600">
                          Select the categories to analyze for the selected
                          river catchments
                        </p>
                      </div>
                      <CategorySelector />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-start mt-8">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={stpProcess}
                        className={`px-8 py-3 rounded-full font-medium shadow-md ${stpProcess
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
                            Analyze River System
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* River System Summary */}
              {tableData.length > 0 && (
                <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
                  <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                    <div className="mb-4 flex justify-between ">
                      <h2 className="text-xl font-semibold mb-4">Groundwater potential zones Analysis:</h2>
                      <button
                        onClick={() => downloadCSV(tableData, "Groundwater_potential_drain.csv")}
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
              <div className="flex m-8 justify-center">
                {tableData.length > 0 && (
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
                      {reportLoading ? "Starting..." : "Generate Report"}
                    </button>
                    <WholeLoading
                      visible={reportLoading}
                      title={"Generating report for STP priorities"}
                      message={
                        "Analyzing site priorities and generating results..."
                      }
                    />
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Map and Slider area - Now spans 4/8 columns on large screens */}
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

// Main App component that provides the context
const GWPZDrain = () => {
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

export default GWPZDrain;
