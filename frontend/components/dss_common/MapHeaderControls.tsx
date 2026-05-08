"use client";

// This is the map header bar shown at the top of the map.
interface MapHeaderControlsProps {
  activePanel: string | null;
  onTogglePanel: (panel: string) => void;
  onToggleFullScreen: () => void;
  isFullScreen: boolean;
  showTools?: boolean;
}

const PANEL_ICONS: Record<string, string> = {
  layers:
    "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  basemap:
    "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z",
  tools:
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
};

export default function MapHeaderControls({
  activePanel,
  onTogglePanel,
  onToggleFullScreen,
  isFullScreen,
  showTools = true,
}: MapHeaderControlsProps) {
  const panels = showTools ? ["layers", "basemap", "tools"] : ["layers", "basemap"];

  return (
    <div className="absolute left-1/2 top-3 z-10 flex w-[calc(100%-1rem)] max-w-max -translate-x-1/2 items-center justify-between gap-2 rounded-2xl bg-white/20 px-2 py-1.5 shadow-xl backdrop-blur-md sm:w-auto sm:gap-4 sm:px-3">
      <span className="hidden items-center font-bold text-gray-800 sm:flex">
        <svg className="mr-2 h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        GIS Viewer
      </span>

      <div className="flex flex-1 justify-center space-x-1 sm:flex-none sm:space-x-2">
        {panels.map((panel) => (
          <button
            key={panel}
            onClick={() => onTogglePanel(panel)}
            className={`relative group rounded-full p-2 transition-all duration-200 hover:scale-110 sm:p-2.5 cursor-pointer ${
              activePanel === panel
                ? "bg-blue-100 text-blue-600 shadow-inner"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={PANEL_ICONS[panel]}
              />
            </svg>

            <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block lg:left-auto lg:right-full lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 lg:-translate-x-4 lg:mr-2">
              {panel.charAt(0).toUpperCase() + panel.slice(1)}
            </span>
          </button>
        ))}

        <button
          onClick={onToggleFullScreen}
          className="rounded-full p-2 text-gray-700 transition-all duration-200 hover:scale-110 hover:bg-gray-100 sm:p-2.5"
          title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={
                !isFullScreen
                  ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  : "M6 18L18 6M6 6l12 12"
              }
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
