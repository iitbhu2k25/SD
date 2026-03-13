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
            <div className="flex md:h-[850px] min-h-0 gap-4 p-4">
              {/* Left side: Location selector and Charts */}
              <div
                className="
                  w-1/2 flex flex-col gap-4 p-4
                  rounded-xl
                  border border-gray-200
                  bg-white
                  transition-all duration-200
                  hover:ring-2 hover:ring-blue-500/20
                  hover:border-blue-300/60
                    "
              >
                {/* Location selector - top half */}

                <Location />

                {/* Charts - bottom half */}

                <Chart />
              </div>

              {/* Right side: Map */}
              <div
                className="
                    w-1/2 flex flex-col
                    rounded-xl
                    border border-gray-200
                    bg-white
                    shadow-sm
                    transition-all duration-200
                    hover:ring-2 hover:ring-blue-500/20
                    hover:border-blue-300/60
                  "
              >
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
