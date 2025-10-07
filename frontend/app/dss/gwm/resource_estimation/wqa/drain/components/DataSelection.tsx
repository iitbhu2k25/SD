"use client";

import React, { useState } from "react";
import AreaSelection from "./AreaSelection";
import WellSelection from "./WellSelection";
import { useLocation } from "@/contexts/water_quality_assesment/drain/LocationContext";
import { useWell } from "@/contexts/water_quality_assesment/drain/WellContext";

interface DataSelectionProps {
  step: number;
  onConfirm?: (selectedData: any) => void;
  onReset?: () => void;
}

const DataSelection: React.FC<DataSelectionProps> = ({ onConfirm, onReset }) => {
  const { areaConfirmed, lockSelections, resetSelections } = useLocation();
  const { resetWellSelections } = useWell();
  const [finalConfirmed, setFinalConfirmed] = useState(false);

  const handleAreaConfirmed = () => {
    console.log("Area confirmed, can now proceed to well selection");
  };

  const handleWellsConfirmed = (data: any) => {
    console.log("Wells confirmed:", data);
    setFinalConfirmed(true);
    lockSelections(); // Lock the location selections
    
    if (onConfirm) {
      onConfirm(data);
    }
  };

  const handleResetAll = () => {
    console.log("Resetting all data selection...");
    setFinalConfirmed(false);
    resetSelections(); // Reset location selections
    resetWellSelections(); // Reset well selections
    
    if (onReset) {
      onReset();
    }
  };

  const handleResetWells = () => {
    console.log("Resetting well selection only...");
    setFinalConfirmed(false);
    resetWellSelections(); // Reset only well selections
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Progress indicator */}
      <div className="flex-shrink-0 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${areaConfirmed ? 'text-green-600' : 'text-blue-600'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium ${areaConfirmed ? 'bg-green-500' : 'bg-blue-500'}`}>
              1
            </div>
            <span className="font-medium">Area Selection</span>
            {areaConfirmed && <span className="text-green-600">✓</span>}
          </div>
          
          <div className={`w-8 h-px ${areaConfirmed ? 'bg-green-300' : 'bg-gray-300'}`}></div>
          
          <div className={`flex items-center space-x-2 ${finalConfirmed ? 'text-green-600' : areaConfirmed ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium ${finalConfirmed ? 'bg-green-500' : areaConfirmed ? 'bg-blue-500' : 'bg-gray-400'}`}>
              2
            </div>
            <span className="font-medium">Well Selection</span>
            {finalConfirmed && <span className="text-green-600">✓</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {/* Step 1: Area Selection - Always visible, disabled after confirmation */}
        <div className={`${areaConfirmed ? 'opacity-75' : ''}`}>
          <AreaSelection onAreaConfirmed={handleAreaConfirmed} />
        </div>

        {/* Step 2: Well Selection - Show after area is confirmed, keep visible after final confirmation */}
        {areaConfirmed && (
          <div className={`${finalConfirmed ? 'opacity-75' : ''}`}>
            <WellSelection 
              onWellsConfirmed={handleWellsConfirmed}
              onReset={handleResetWells}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSelection;