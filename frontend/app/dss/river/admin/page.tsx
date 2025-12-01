"use client";

import React from "react";
import { LocationProvider } from "@/contexts/riverwater_assessment/admin/LocationContext";
import { MapProvider } from "@/contexts/riverwater_assessment/admin/MapContext";
import { ChartProvider } from "@/contexts/riverwater_assessment/admin/ChartContext";
import { AppProvider } from "@/contexts/riverwater_assessment/admin/AppContext";
import Location from "./components/location";
import MapComponent from "./components/map";
import Chart from "./components/chart";

const Page: React.FC = () => {
  return (
    <AppProvider>
    <LocationProvider>
      <MapProvider>
        <ChartProvider>
          <div className="flex h-screen gap-4 p-4">
            {/* Left side: Location selector and Charts */}
            <div className="w-1/2 flex flex-col gap-4">
              {/* Location selector - top half */}
              <div className="h-1/2 overflow-auto border border-gray-300 rounded p-4 shadow bg-white">
                <Location />
              </div>
              
              {/* Charts - bottom half */}
              <div className="h-1/2 overflow-auto border border-gray-300 rounded p-4 shadow bg-white">
                <Chart />
              </div>
            </div>

            {/* Right side: Map */}
            <div className="w-1/2 rounded-lg shadow border border-gray-300 flex flex-col">
              <MapComponent />
            </div>
          </div>
        </ChartProvider>
      </MapProvider>
    </LocationProvider>
    </AppProvider>
  );
};

export default Page;