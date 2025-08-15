"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/stp_gwz/admin/LocationContext";
import { CategoryProvider } from "@/contexts/stp_gwz/admin/CategoryContext";
import { MapProvider } from "@/contexts/stp_gwz/admin/MapContext";
import LocationSelector from "@/app/dss/GWM/Potential_zone/admin/components/locations";
import CategorySelector from "@/app/dss/GWM/Potential_zone/admin/components/Category";
import { useLocation } from "@/contexts/stp_gwz/admin/LocationContext";
import { useCategory } from "@/contexts/stp_gwz/admin/CategoryContext";
import MapView from "@/app/dss/GWM/Potential_zone/admin/components/openlayer";
import { useMap } from "@/contexts/stp_gwz/admin/MapContext";
import { CategorySlider } from "./components/weight_slider";
import { toast, ToastContainer } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import WholeLoading from "@/components/app_layout/newLoading";

import "react-toastify/dist/ReactToastify.css";

const MainContent = () => {
  const [showRankings, setShowRankings] = useState(false);
  const [showTier, setShowTier] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const {
    selectedCategories,
    selectAllCategories,
    stpProcess,
    tableData,
  } = useCategory();

  const { selectionsLocked, confirmSelections, resetSelections } =
    useLocation();

  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    setShowCategories(selectionsLocked);
  }, [selectionsLocked]);

  const handleConfirm = () => {
    const result = confirmSelections();
  };

  const handleReset = () => {
    resetSelections();
  };

  const handleSubmit = () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one categories", {
        position: "top-center",
      });
    } else {
      //here club
      setstpOperation(true);
    }
  };

  const toggleSelectorView = () => {
    setShowTier(!showTier);
  };

   return (
    <div className="min-h-screen bg-gray-50">
      {
        <WholeLoading
          visible={loading || isMapLoading || stpOperation}
          title={
            stpOperation ? "Analyzing STP priorities" : "Loading Resources"
          }
          message={
            stpOperation
              ? "Analyzing site priorities and generating results..."
              : "Fetching map data and initializing components..."
          }
        />
      }


      <main className="px-4 py-8">
        {/* Changed from grid-cols-2 to grid-cols-3 to create a 2:1 ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Main content area - Now spans 8/12 columns on large screens */}
          <div className="lg:col-span-4 space-y-4">
            {/* Selection Components Section */}
            <section className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Selection Criteria
                </h2>
              </div>

              <div className="p-6">
                {/* Selection Components with improved styling */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <LocationSelector />
                </div>

                {/* Categories Section - Only shown after confirmation */}
                {showCategories && (
                  <div className="animate-fadeIn">
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                            Submit Analysis
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {tableData.length > 0 && (
                <section className="bg-blue-50 rounded-xl border border-blue-200 p-4 animate-fadeIn"> 
                 <div className="p-6 bg-white rounded-2xl shadow-md mt-3">
                <h2 className="text-xl font-semibold mb-4">
                  STP Priority Village wise Analysis :-
                </h2>
                  <DataTable
                    columns={Village_columns}
                    data={tableData}
                    pagination
                    responsive
                    paginationPerPage={10}
                    paginationRowsPerPageOptions={[5, 10, 20, 50]}
                  />
                </div>
                </section>
              )}
              
            </section>
          </div>
          {/* Map and Slider area - Now spans 4/12 columns on large screens */}
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
                <CategorySlider />
              </section>
            )}
          </div>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};

// Main App component that provides the context
const GWZAdmin = () => {
  return (
    <LocationProvider>
      <CategoryProvider>
        <MapProvider>
          <MainContent />
        </MapProvider>
      </CategoryProvider>
    </LocationProvider>
  );
};

export default GWZAdmin;