"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/water_quality_assesment/users/DrainContext";
import { MapProvider } from "@/contexts/water_quality_assesment/users/DrainMapContext";
import WholeLoading from "@/components/app_layout/newLoading";
import { useRiverSystem } from "@/contexts/water_quality_assesment/users/DrainContext";
import MapView from "@/app/dss/gwm/resource_estimation/wqa/users/components/openlayer";
import { useMap } from "@/contexts/water_quality_assesment/users/DrainMapContext";

import "react-toastify/dist/ReactToastify.css";
import RiverSelector from "@/app/dss/gwm/resource_estimation/wqa/users/components/locations";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { DRAIN_LAYER_NAMES } from "@/interface/raster_context";
import { YearProvider, useYear } from "@/contexts/water_quality_assesment/users/yearContext";
import YearSelector from "@/app/dss/gwm/resource_estimation/wqa/users/components/year";
import MultiSelectButtons from "@/app/dss/gwm/resource_estimation/wqa/users/components/Params";
import WQIDataTable from "@/components/utils/dataTable"

const MainContent = () => {
  const [reportLoading, setReportLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);
  const { wqi_data, selectedParam, qualityParam } = useYear();
  const {
    totalArea,
    totalCatchments,
    selectionsLocked,
    confirmSelections,
    resetSelections,
  } = useRiverSystem();

  const { setstpOperation, loading, isMapLoading, stpOperation, setCatchmentLayer } =
    useMap();
  const [showYears, setshowYears] = useState(false);

  useEffect(() => {
    setshowYears(selectionsLocked);
  }, [selectionsLocked]);



  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || reportLoading}
        title={
          stpOperation
            ? "Analyzing Water quality"
            : reportLoading
              ? "Generating report"
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
        {/* LEFT SIDE — SCROLLABLE */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-6">
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
            <RiverSelector />
          </section>

          {showYears && (
            <div className="animate-fadeIn">
              <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Select year
                </h3>
                <YearSelector />
              </section>
            </div>
          )}
          {wqi_data && wqi_data.length > 0 && (
            <div className="animate-fadeIn">
              <section className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Well Points
                </h3>
                <WQIDataTable initialData={wqi_data} />
              </section>
            </div>
          )}
          {wqi_data && wqi_data.length > 0 && (
            <div className="animate-fadeIn">
              <section className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Select Parameter
                </h3>
                <MultiSelectButtons
                  options={qualityParam}
                  onChange={(selected) => console.log("Selected:", selected)}
                />
              </section>
            </div>
          )}
          {wqi_data && wqi_data.length > 0 && selectedParam.length > 0 && (
            <div className="animate-fadeIn">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
                onClick={() => setstpOperation(true)}
              >
                Analysis Water Quality
              </button>
            </div>
          )}
        </div>


        {/* RIGHT SIDE — MAP & SLIDER SCROLLABLE */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-4 space-y-6">
          <section className="rounded-xl overflow-hidden">
            <div className="w-full md:min-h-[400px]">
              <MapView />
            </div>
          </section>
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
      <YearProvider>
        <MapProvider>
          <MainContent />
        </MapProvider>
      </YearProvider>
    </RiverSystemProvider>
  );
};

export default PriorityDrain;
