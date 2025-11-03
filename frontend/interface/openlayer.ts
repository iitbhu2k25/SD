
export const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
export const INITIAL_ZOOM = 6;

export interface RasterMetadata {
  id: string;
  name: string;
  description?: string;
  source: string;
  bounds: [number, number, number, number];
  resolution: [number, number]; 
  width: number;
  height: number;
  projection?: string;
  bands?: number;
  dataType?: string;
  noDataValue?: number;
  timestamp?: Date;
}

export interface RasterLayerProps {
  id: string;
  visible: boolean;
  url?: string;
  opacity?: number;
}

export type MapLibrary = 'openlayers' | 'leaflet';

export interface MapViewProps {
  selectedRasters: RasterLayerProps[];
  library: MapLibrary;
  center?: [number, number];
  zoom?: number;
  onMapClick?: (coords: [number, number]) => void;
}



interface LayerColorConfig {
  color: string;
  name: string;
  fill: string;
}

interface LayerColorsType {
  [key: string]: LayerColorConfig;
}

export const LAYER_COLORS: LayerColorsType = {
  primary: {
    color: "#3b82f6",
    name: "India Layer",
    fill: "rgba(59, 130, 246, 0.3)",
  },
  river: { color: "#1E40AF", name: "Rivers", fill: "rgba(30, 64, 175, 0.3)" },
  stretch: {
    color: "#059669",
    name: "Stretches",
    fill: "rgba(5, 150, 105, 0.3)",
  },
  drain: { color: "#DC2626", name: "Drains", fill: "rgba(220, 38, 38, 0.3)" },
  catchment: {
    color: "#7C2D12",
    name: "Catchments",
    fill: "rgba(124, 45, 18, 0.3)",
  },
  raster: {
    color: "#7C3AED",
    name: "Raster Layer",
    fill: "rgba(124, 58, 237, 0.3)",
  },
};

