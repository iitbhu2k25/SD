// types/map.types.ts - Dynamic version

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ManagedLayer {
  id: string;
  name: string;
  layer: any;
  visible: boolean;
  type: 'geojson' | 'uploaded' | 'drawn';
}

export interface MapProps {
  sidebarCollapsed: boolean;
  onFeatureClick: (feature: any, layer: any) => void;
  currentLayer: any;
  activeFeature: any;
  compassVisible: boolean;
  gridVisible: boolean;
  showNotification: (title: string, message: string, type?: NotificationType) => void;
}

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMapLayerChange: (layer: string) => void;
  onFeatureInfoToggle: (show: boolean) => void;
  onCompassToggle: (show: boolean) => void;
  onGridToggle: (show: boolean) => void;
  showNotification: (title: string, message: string, type?: NotificationType) => void;
  onUploadShapefile: (files: FileList) => Promise<any>;
}

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  show: boolean;
  title: string;
  message: string;
  type: string;
}

export interface PDFExportOptions {
  mapEl: HTMLElement;
  mapInstance: any;
  heading: string;
  qualityDPI: number;
  pageFormat: 'a4' | 'a3';
  orientation: 'portrait' | 'landscape';
  currentBasemapId?: string;
}

export interface ArcMapCoordinate {
  x: number;
  y: number;
  lat: number;
  lng: number;
  position: 'top' | 'right' | 'bottom' | 'left';
}

// DYNAMIC - No hardcoded categories
export type Category = string;
export type DirectoryStructure = Record<string, string[]>;  // From /shapefiles/ API

declare global {
  interface Window {
    toggleBufferTool?: () => void;
    changeBasemap?: (basemapId: string) => void;
    // Changed: now accepts geoJsonData directly instead of category/subcategory
    loadGeoJSON?: (geoJsonData: any, styleOptions?: {
      lineColor?: string;
      fillColor?: string;
      opacity?: number;
      weight?: number;
      showLabels?: boolean;
    }) => Promise<any | null>;
    updateMapStyles?: () => void;
    uploadShapefile?: (files: FileList) => Promise<any>;
    openIntersectionModal?: () => void;
    openSpatialAnalysisModal?: () => void;
  }
}
