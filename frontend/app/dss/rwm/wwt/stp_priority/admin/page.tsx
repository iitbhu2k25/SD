"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/stp_priority/admin/LocationContext";
import { CategoryProvider } from "@/contexts/stp_priority/admin/CategoryContext";
import { MapProvider } from "@/contexts/stp_priority/admin/MapContext";
import LocationSelector from "@/app/dss/rwm/wwt/stp_priority/admin/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import CategorySelector from "@/app/dss/rwm/wwt/stp_priority/admin/components/Category";
import { useLocation } from "@/contexts/stp_priority/admin/LocationContext";
import { useCategory } from "@/contexts/stp_priority/admin/CategoryContext";
import MapView from "@/app/dss/rwm/wwt/stp_priority/admin/components/openlayer";
import { useMap } from "@/contexts/stp_priority/admin/MapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import { api } from "@/services/api";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { downloadCSV } from "@/components/utils/downloadCsv";

const MainContent = () => {
  const { selectedCategories, stpProcess, tableData } = useCategory();
  const [reportLoading, setReportLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);

  const {
    selectionsLocked,
    displayRaster,
    selectedSubDistricts,
    selectedSubDistrictsNames,
    selectedDistrictsNames,
    selectedStateName,
  } = useLocation();

  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleSubmit = () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one category", {
        position: "top-center",
      });
    } else {
      setstpOperation(true);
    }
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
      };

      const data = {
        table: tableData,
        raster: displayRaster,
        place: "Admin",
        clip: selectedSubDistricts,
        location: locationData,
        weight_data: selectedCategories,
      };

      const response = await api.post("/stp_operation/stp_priority_admin_report", {
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

      <main className="flex flex-col lg:flex-row gap-4 px-4 py-6 h-[calc(100vh-100px)]">
        {/* LEFT PANEL */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6">
          <section className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Administrative Selection
            </h2>
            {selectionsLocked && (
              <p className="text-sm text-green-600">
                {selectedSubDistrictsNames.length} sub-districts selected
              </p>
            )}
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
                  disabled={stpProcess}
                  className={`px-8 py-3 rounded-full font-medium shadow-md flex items-center transition duration-200 ${
                    stpProcess
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
                    STP Priority Village-wise Analysis:
                  </h2>
                  <button
                    onClick={() => downloadCSV(tableData, "STP_Priority_admin.csv")}
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

          {tableData.length > 0 && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleReport}
                className="px-8 py-3 rounded-full font-medium shadow-md flex items-center gap-2 transition duration-200 bg-green-500 hover:bg-green-600 text-white hover:scale-105"
              >
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

const PriorityAdmin = () => (
  <LocationProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </LocationProvider>
);

export default PriorityAdmin;
