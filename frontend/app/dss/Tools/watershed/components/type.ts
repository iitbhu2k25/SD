// Type definitions for the Watershed Analysis application

export type WatershedFeature = {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    area_km2?: string;
    outlet_lat?: number;
    outlet_lng?: number;
    [key: string]: any;
  };
};

export type RiverFeature = {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  properties: {
    comid?: number;
    sorder?: number;
    [key: string]: any;
  };
};

export type FlowpathFeature = {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  properties: {
    comid?: number;
    sorder?: number;
    [key: string]: any;
  };
};

export type GeoJSONResponse = {
  type: string;
  features: (WatershedFeature | RiverFeature | FlowpathFeature)[];
};

export type FlowpathAPIResponse = {
  message: string;
  outlet: GeoJSONResponse;
  rivers: GeoJSONResponse;
};

export type APIEndpoint = 'watershed_api' | 'upstream_rivers_api' | 'flowpath_api';

export type AnalysisMode = 'upstream' | 'downstream';

export type BaseMapType = 'osm' | 'satellite' | 'terrain' | 'dark';

export type DrawingTool = 'marker' | 'polyline' | 'polygon' | 'rectangle' | 'circle' | 'circlemarker';

export interface MapSettings {
  riverColor: string;
  riverOpacity: number;
  riverThickness: number;
  watershedColor: string;
  watershedOpacity: number;
  watershedFillOpacity: number;
  baseMap: BaseMapType;
}

export interface CoordinateInput {
  latitude: number;
  longitude: number;
}

export interface LayerData {
  id: string;
  name: string;
  data: GeoJSONResponse;
  visible: boolean;
  color: string;
}