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
  onExportClick,
}: MapControlsProps) {
  return (
    <div className="absolute bottom-8 right-4 bg-white rounded-xl shadow-md flex flex-col p-1 pointer-events-auto">
      <button
        onClick={() => mapInstance?.zoomIn()}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Zoom In"
      >
        <i className="fg-zoom-in" style={{ fontSize: 16 }} />
      </button>

      <button
        onClick={() => mapInstance?.zoomOut()}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Zoom Out"
      >
        <i className="fg-zoom-out" style={{ fontSize: 16 }} />
      </button>

      <button
        onClick={onHomeClick}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Home"
      >
        <i className="fg-home" style={{ fontSize: 16 }} />
      </button>

      <button
        onClick={onLocateClick}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Locate"
      >
        <i className="fg-location-arrow" style={{ fontSize: 16 }} />
      </button>

      <button
        onClick={onFullScreen}
        className="w-10 h-10 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Fullscreen"
      >
        <i className="fg-full-screen" style={{ fontSize: 16 }} />
      </button>

      <button
        onClick={onExportClick}
        className="w-10 h-10 hover:bg-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-colors"
        title="Export"
        aria-label="Export"
      >
        <i className="fg-layer-download" style={{ fontSize: 16 }} />
      </button>
    </div>
  );
}
