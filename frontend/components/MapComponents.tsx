import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
export const GISCompass = () => (
  <div className="absolute left-20 top-1  p-3 rounded-lg transition-all duration-300 ease-in-out animate-fade-in">
    <div className="flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="48" fill="white" stroke="#ddd" strokeWidth="1" />
        <path d="M50 10 L55 50 L50 45 L45 50 Z" fill="#3b82f6" />
        <path d="M50 90 L45 50 L50 55 L55 50 Z" fill="#606060" />
        <path d="M90 50 L50 45 L55 50 L50 55 Z" fill="#606060" />
        <path d="M10 50 L50 55 L45 50 L50 45 Z" fill="#606060" />
        <text x="50" y="20" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#3b82f6">N</text>
        <text x="50" y="85" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#606060">S</text>
        <text x="85" y="52" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#606060">E</text>
        <text x="15" y="52" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#606060">W</text>
        <circle cx="50" cy="50" r="5" fill="#3b82f6" stroke="#fff" strokeWidth="1" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.3" />
      </svg>
    </div>
  </div>
);
export interface BaseMapDefinition {
  name: string;
  source: () => OSM | XYZ;
  thumbnail?: string;
  icon?: string;
}


export const baseMaps: Record<string, BaseMapDefinition> = {
  osm: {
    name: "OpenStreetMap",
    source: () =>
      new OSM({
        crossOrigin: "anonymous",
      }),
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  },
  satellite: {
    name: "Satellite",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions: "Tiles © Esri",
        crossOrigin: "anonymous",
      }),
    icon: "M17.66 8L12 2.35 6.34 8C4.78 9.56 4 11.64 4 13.64s.78 4.11 2.34 5.67 3.61 2.35 5.66 2.35 4.1-.79 5.66-2.35S20 15.64 20 13.64 19.22 9.56 17.66 8z",
  },
  terrain: {
    name: "Terrain",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions: "Tiles © Esri",
        crossOrigin: "anonymous",
      }),
    icon: "M14 11l4-8H6l4 8H6l6 10 6-10h-4z",
  },
  dark: {
    name: "Dark Mode",
    source: () =>
      new XYZ({
        url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions: "© CARTO",
        crossOrigin: "anonymous",
      }),
    icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
  },
  light: {
    name: "Light Mode",
    source: () =>
      new XYZ({
        url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions: "© CARTO",
        crossOrigin: "anonymous",
      }),
    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  },
};

export const HoverTooltip = ({ hoveredFeature, mousePosition }: { hoveredFeature: any; mousePosition: { x: number; y: number } }) => {
  if (!hoveredFeature) return null;

  const featureName = hoveredFeature.get("name") || hoveredFeature.get("Name") || hoveredFeature.get("NAME") || hoveredFeature.get("area_ha");
  
  return (
    <div 
      className="absolute z-50 bg-gray-900/90 text-white text-sm px-3 py-2 rounded-lg shadow-lg pointer-events-none transition-all duration-200 backdrop-blur-sm border border-gray-700"
      style={{
        left: `${mousePosition.x + 15}px`,
        top: `${mousePosition.y - 35}px`,
        transform: mousePosition.x > window.innerWidth - 200 ? 'translateX(-100%)' : 'none'
      }}
    >
      <div className="flex items-center">
        <svg className="w-3 h-3 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
        <span className="font-medium">{featureName}</span>
      </div>
      {/* Tooltip arrow */}
      <div className="absolute bottom-0 left-4 transform translate-y-full">
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/90"></div>
      </div>
    </div>
  );
};