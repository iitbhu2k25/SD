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
            <div className="flex h-screen gap-4 p-4">
              {/* Left side: Stretch selector and Charts */}
              <div className="w-1/2 flex flex-col gap-4">
                {/* Stretch selector - top half */}
                <div className="h-1/2 overflow-auto border border-gray-300 rounded p-4 shadow bg-white">
                  <StretchSelector />
                </div>

                {/* Charts - bottom half */}
                <div className="h-1/2 overflow-auto border border-gray-300 rounded p-4 shadow bg-white">
                  <StretchChart />
                </div>
              </div>

              {/* Right side: Map */}
              <div className="w-1/2 rounded-lg shadow border border-gray-300 flex flex-col">
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
