"use client";

import Calculator from "./components/calculator";
import MapView from "./components/openlayer";
import { LocationProvider } from "@/contexts/rainwater/LocationContext";
import { CategoryProvider } from "@/contexts/rainwater/CategoryContext";
import { MapProvider } from "@//contexts/rainwater/MapContext";
import { useState } from "react";

const Rainwater: React.FC = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [coordinates, setCoordinates] = useState<number[][] | null>(null);
  const [resetPolygon, setResetPolygon] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen p-2 sm:p-4 gap-2 sm:gap-4">
      <div className="lg:w-1/2 w-full h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] order-1 flex items-stretch group mx-2 sm:mx-4 lg:mx-10 min-w-0 overflow-hidden">
        <Calculator
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          coordinates={coordinates}
          setCoordinates={setCoordinates}
          setResetPolygon={setResetPolygon}
        />
      </div>
      <div className="lg:w-1/2 w-full h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] order-2 flex items-stretch group">
        <MapView
          isDrawing={isDrawing} // Ensure this is passed
          setIsDrawing={setIsDrawing}
          coordinates={coordinates}
          setCoordinates={setCoordinates}
          resetPolygon={resetPolygon}
          setResetPolygon={setResetPolygon}
        />
      </div>
    </div>
  );
};

const RainwaterAdmin = () => {
  return (
    <LocationProvider>
      <CategoryProvider>
        <MapProvider>
          <Rainwater />
        </MapProvider>
      </CategoryProvider>
    </LocationProvider>
  );
};

export default RainwaterAdmin;
