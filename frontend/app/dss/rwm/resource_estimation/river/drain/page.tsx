"use client";

import React from "react";
import { StretchProvider } from "@/contexts/riverwater_assessment/drain/LocationContext";
import { StretchMapProvider } from "@/contexts/riverwater_assessment/drain/MapContext";
import { StretchChartProvider } from "@/contexts/riverwater_assessment/drain/ChartContext";
import { StretchAppProvider } from "@/contexts/riverwater_assessment/drain/AppContext";
import { useStretch } from "@/contexts/riverwater_assessment/drain/LocationContext";
import StretchSelector from "./components/location";
import StretchMapComponent from "./components/map";
import StretchChart from "./components/chart";

const StretchPageContent: React.FC = () => {
  const { areaConfirmed } = useStretch();

  return (
    <div className="flex md:h-[850px] min-h-0 gap-4 p-4">
      <div
        className="w-1/2 flex flex-col gap-4 p-4
          rounded-xl
          border border-gray-200
          bg-white
          transition-all duration-200
          hover:ring-2 hover:ring-blue-500/20
          hover:border-blue-300/60"
      >
        {!areaConfirmed && <StretchSelector />}
        <StretchChart />
      </div>

      <div className="w-1/2 rounded-xl overflow-hidden shadow border border-gray-300 flex flex-col">
        <StretchMapComponent />
      </div>
    </div>
  );
};

const StretchPage: React.FC = () => {
  return (
    <StretchAppProvider>
      <StretchProvider>
        <StretchMapProvider>
          <StretchChartProvider>
            <StretchPageContent />
          </StretchChartProvider>
        </StretchMapProvider>
      </StretchProvider>
    </StretchAppProvider>
  );
};

export default StretchPage;
