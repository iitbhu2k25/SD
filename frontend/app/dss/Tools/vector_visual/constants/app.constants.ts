// constants/app.constants.ts - Remove hardcoded SUBCATEGORIES

export const DEFAULT_MAP_CENTER: [number, number] = [22.3511, 78.6677];
export const DEFAULT_MAP_ZOOM = 5;

export const BASEMAP_OPTIONS = [
  { id: 'streets', label: 'Streets', icon: 'fa-road' },
  { id: 'satellite', label: 'Satellite', icon: 'fa-satellite' },
  { id: 'terrain', label: 'Terrain', icon: 'fa-mountain' },
  { id: 'traffic', label: 'Traffic', icon: 'fa-car' },
  { id: 'hybrid', label: 'Hybrid', icon: 'fa-globe' },
  { id: 'none', label: 'No Basemap', icon: 'fa-ban' },
];

export const ANALYSIS_TOOLS = [
  { id: 'spatial_analysis', label: 'Spatial Analysis (All Operations)', icon: 'fa-project-diagram' },
  
];

export const ACCEPTED_SHAPEFILE_EXTENSIONS = ['.zip', '.shp', '.shx', '.dbf', '.prj', '.cpg'];

export const DEFAULT_STYLE = {
  lineColor: '#000000',
  fillColor: '#78b4db',
  opacity: 0.8,
  weight: 2,
};

export const PDF_EXPORT_DEFAULTS = {
  heading: 'Map Export',
  dpi: 200,
  format: 'a4' as 'a4' | 'a3',
  orientation: 'landscape' as 'portrait' | 'landscape',
};
