'use client';
import React from 'react';
import Left from './components/left';
import Right from './components/right';  // Import the new component
import MapComponent from './components/map';
import { ShapefileProvider } from '@/contexts/datahub/Section1Context';
import { MapProvider } from '@/contexts/datahub/MapContext';

const Page = () => {
  return (
    <ShapefileProvider>
      <MapProvider>
        <div className="h-[80vh] w-full flex overflow-hidden bg-gray-100">
          {/* Left panel - 25% */}
          <div className="w-3/20 h-full p-2 overflow-y-auto border-r border-gray-300">
            <Left />
          </div>

          {/* Middle panel - 50% */}
          <div className="w-1/2 h-full p-2 border-r border-gray-300">
            <MapComponent />
          </div>

          {/* Right panel - 25% */}
          <div className="w-7/20 h-full p-2 overflow-y-auto">
            <Right />
          </div>
        </div>
      </MapProvider>
    </ShapefileProvider>
  );
};

export default Page;