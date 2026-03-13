"use client";

import React, { useState } from "react";
import { StretchProvider } from "@/contexts/riverwater_assessment/drain/LocationContext";
import { StretchMapProvider } from "@/contexts/riverwater_assessment/drain/MapContext";
import { StretchChartProvider } from "@/contexts/riverwater_assessment/drain/ChartContext";
import { StretchAppProvider } from "@/contexts/riverwater_assessment/drain/AppContext";
import StretchSelector from "./components/location";
import StretchMapComponent from "./components/map";
import StretchChart from "./components/chart";
type OverlayStatus = "loading" | "success" | "error";

const StretchPage: React.FC = () => {
  return (
    <StretchAppProvider>
      <StretchProvider>
        <StretchMapProvider>
          <StretchChartProvider>
            <div className="flex md:h-[850px] min-h-0 gap-4 p-4">
              {/* Left side: Stretch selector and Charts */}
              <div
                className="w-1/2 flex flex-col gap-4 p-4
                  rounded-xl
                  border border-gray-200
                  bg-white
                  transition-all duration-200
                  hover:ring-2 hover:ring-blue-500/20
                  hover:border-blue-300/60"
              >
                {/* Stretch selector - top half */}

                <StretchSelector />

                {/* Charts - bottom half */}

                <StretchChart />
              </div>

              {/* Right side: Map */}
              <div className="w-1/2 rounded-xl overflow-hidden shadow border border-gray-300 flex flex-col">
                <StretchMapComponent />
              </div>
            </div>
          </StretchChartProvider>
        </StretchMapProvider>
      </StretchProvider>
    </StretchAppProvider>
  );
};

export default StretchPage;
