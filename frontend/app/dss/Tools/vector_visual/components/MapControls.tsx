//  // frontend/app/dss/visualizations/vector/components/MapControls.tsx
// Map control buttons component

import React from 'react';

interface MapControlsProps {
  mapInstance: any;
  onHomeClick: () => void;
  onLocateClick: () => void;
  onFullScreen: () => void;
  onBufferToggle: () => void;
  onExportClick: () => void;
}

export default function MapControls({
  mapInstance,
  onHomeClick,
  onLocateClick,
  onFullScreen,
  onBufferToggle,
  onExportClick,
}: MapControlsProps) {
  return (
    <div className="absolute bottom-8 right-4 bg-white rounded-xl shadow-md flex flex-col p-1 pointer-events-auto">
      <button
        onClick={() => mapInstance?.zoomIn()}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Zoom In"
      >
        <i className="fas fa-plus"></i>
      </button>
      
      <button
        onClick={() => mapInstance?.zoomOut()}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Zoom Out"
      >
        <i className="fas fa-minus"></i>
      </button>
      
      <button
        onClick={onHomeClick}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Home"
      >
        <i className="fas fa-home"></i>
      </button>
      
      <button
        onClick={onLocateClick}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Locate"
      >
        <i className="fas fa-location-arrow"></i>
      </button>
      
      <button
        onClick={onFullScreen}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Fullscreen"
      >
        <i className="fas fa-expand"></i>
      </button>
      
      {/* <button
        onClick={onBufferToggle}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Buffer Tool"
      >
        <i className="fas fa-circle-notch"></i>
      </button> */}
      
      <button
        onClick={onExportClick}
        className="w-10 h-10 hover:bg-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Export"
        aria-label="Export"
      >
        <i className="fas fa-file-export"></i>
      </button>
    </div>
  );
}