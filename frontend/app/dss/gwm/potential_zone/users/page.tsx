"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/gwm/potential_zone/users/DrainContext";
import { CategoryProvider } from "@/contexts/gwm/potential_zone/admin/CategoryContext";
import { MapProvider } from "@/contexts/gwm/potential_zone/users/DrainMapContext";
import RiverSelector from "@/app/dss/gwm/potential_zone/users/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import CategorySelector from "@/app/dss/gwm/potential_zone/admin/components/Category";
import { useRiverSystem } from "@/contexts/gwm/potential_zone/users/DrainContext";
import { useCategory } from "@/contexts/gwm/potential_zone/admin/CategoryContext";
import MapView from "@/app/dss/gwm/potential_zone/users/components/openlayer";
import { useMap } from "@/contexts/gwm/potential_zone/users/DrainMapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import { api } from "@/services/api";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { downloadCSV } from "@/components/utils/downloadCsv";
import { FaLock, FaUnlock } from "react-icons/fa";

const MainContent = () => {
  const { selectedCategories, stpProcess } = useCategory();
  const [reportLoading, setReportLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [categoriesEditable, setCategoriesEditable] = useState(false);

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

  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleConfirm = () => confirmSelections();

  const handleReset = () => {
    resetSelections();
    setShowCategories(false);
  };

  const handleSubmit = () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one category", { position: "top-center" });
    } else if (selectedCatchments.length < 1) {
      toast.error("Please select at least one catchment", { position: "top-center" });
    } else {
      setstpOperation(true);
    }
  };

  const handleReport = async () => {
    try {
      setReportLoading(true);
      setTaskId(null);
      setShowPdfStatus(false);
      setIsPdfGenerating(true);
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

      const response = await api.post("/gwz_operation/gwz_drain_report", { body: data });

      if (response.status != 201) {
        toast.error("Report failed", { position: "top-center" });
        setIsPdfGenerating(false);
        return;
      }

      toast.success("Report generation started");
      const task = response.message as Record<string, string>;
      setTaskId(task["task_id"]);
      setShowPdfStatus(true);
    } catch (error) {
      toast.error("Failed to start report");
      setIsPdfGenerating(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePdfComplete = () => {
    setIsPdfGenerating(false);
    setShowPdfStatus(false);
  };

  const handlePdfFailure = () => {
    setIsPdfGenerating(false);
  };
  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || reportLoading}
        title={
          stpOperation
            ? "Analyzing Groundwater Potential Zones"
            : reportLoading
            ? "Generating report for Groundwater Potential Zones"
            : "Loading Resources"
        }
        message={
          stpOperation
            ? "Analyzing groundwater zones and generating results..."
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
              </section>

              <div className="flex justify-start mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={stpProcess}
                  className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center transition duration-200 ${stpProcess
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                    }`}
                >
                  Analyze System
                </button>
              </div>
            </div>
          )}

          {tableData.length > 0 && (
            <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn">
              <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                <div className="mb-4 flex justify-between">
                  <h2 className="text-xl font-semibold mb-4">
                    Groundwater Potential Zone – Drain Analysis:
                  </h2>
                  <button
                    onClick={() =>
                      downloadCSV(tableData, "Groundwater_Potential_Drain.csv")
                    }
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
                onClick={handleReport}
                disabled={isPdfGenerating} // Use isPdfGenerating state
                className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center gap-2 transition duration-200 ${isPdfGenerating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                  }`}
              >
                {isPdfGenerating ? "Generating PDF..." : "Generate Report"}
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
             <CategorySlider editable={categoriesEditable} />
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
          onComplete={handlePdfComplete}
          onFailure={handlePdfFailure}
        />
      )}
    </div>
  );
};

const GWPZDrain = () => (
  <RiverSystemProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </RiverSystemProvider>
);

export default GWPZDrain;
