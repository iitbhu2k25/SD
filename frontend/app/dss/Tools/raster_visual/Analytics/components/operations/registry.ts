export type ParamType = "select" | "number" | "text" | "boolean";

export interface OperationParam {
  key: string;
  label: string;
  type: ParamType;
  default: string | number | boolean;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
}

export interface OperationDef {
  id: string;
  label: string;
  description: string;
  category: OperationCategory;
  icon: string; // SVG path (d attribute)
  accentColor: string; // CSS variable name, e.g. "--accent"
  params: OperationParam[];
  apiEndpoint?: string; // override default endpoint
}

export type OperationCategory =
  | "terrain"
  | "transform"
  | "hydrology"
  | "classification"
  | "distance";

export interface CategoryDef {
  id: OperationCategory;
  label: string;
  color: string; // CSS variable
  dotColor: string; // direct hex for the dot
}

// ── Categories ───────────────────────────────────────────────────────────────

export const CATEGORIES: CategoryDef[] = [
  {
    id: "terrain",
    label: "Terrain Analysis",
    color: "--accent",
    dotColor: "#0d9b7a",
  },
  { id: "hydrology", label: "Hydrology", color: "--blue", dotColor: "#3b82f6" },
  {
    id: "transform",
    label: "Transformation",
    color: "--amber",
    dotColor: "#d97706",
  },
  {
    id: "classification",
    label: "Classification",
    color: "--purple",
    dotColor: "#8b5cf6",
  },
  {
    id: "distance",
    label: "Distance Analysis",
    color: "--orange",
    dotColor: "#ea580c",
  },
];

// ── Operations ───────────────────────────────────────────────────────────────

export const OPERATIONS: OperationDef[] = [
  // ── Terrain ─────────────────────────────────────────────
  {
    id: "slope",
    label: "Slope",
    description: "Calculate surface slope from DEM",
    category: "terrain",
    icon: "M3 17l6-6 4 4 8-8",
    accentColor: "--accent",
    params: [
      {
        key: "unit",
        label: "Output Unit",
        type: "select",
        default: "degree",
        options: [
          { label: "Degrees", value: "degree" },
          { label: "Percent", value: "percent" },
        ],
      },
      {
        key: "z_factor",
        label: "Z-Factor",
        type: "number",
        default: 1,
        min: 0.001,
        max: 1000,
        step: 0.1,
      },
    ],
  },

  {
    id: "tpi",
    label: "TPI",
    description: "Topographic Position Index",
    category: "terrain",
    icon: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3",
    accentColor: "--accent",
    params: [
      {
        key: "radius",
        label: "Neighborhood Radius",
        type: "number",
        default: 3,
        min: 1,
        max: 50,
        step: 1,
      },
    ],
  },

  // ── Hydrology ───────────────────────────────────────────
  {
    id: "flow_direction",
    label: "Flow Direction",
    description: "D8 flow routing",
    category: "hydrology",
    icon: "M12 5v14M5 12l7 7 7-7",
    accentColor: "--blue",
    params: [],
  },

  {
    id: "flow_accumulation",
    label: "Flow Accumulation",
    description: "Upstream contributing area",
    category: "hydrology",
    icon: "M17 20H7",
    accentColor: "--blue",
    params: [],
  },

  {
    id: "twi",
    label: "TWI",
    description: "Topographic Wetness Index",
    category: "hydrology",
    icon: "M12 2.69l5.66 5.66",
    accentColor: "--blue",
    params: [],
  },

  // ── Transformation ───────────────────────────────────────
  {
    id: "projection",
    label: "Projection",
    description: "Reproject raster to another CRS",
    category: "transform",
    icon: "M12 2a10 10 0 110 20",
    accentColor: "--amber",
    params: [
      {
        key: "target_crs",
        label: "Target CRS",
        type: "select",
        default: "WGS84",
        options: [
          { label: "WGS84", value: "WGS84" },
          { label: "WGS84 Web Mercator", value: "WGS84_Web_Mercator" },
          { label: "NAD83", value: "NAD83" },
          { label: "ETRS89", value: "ETRS89" },
          { label: "UTM Zone 33N", value: "UTM_Zone_33N" },
          { label: "UTM Zone 43N", value: "UTM_Zone_43N" },
          { label: "UTM Zone 44N", value: "UTM_Zone_44N" },
          { label: "UTM Zone 45N", value: "UTM_Zone_45N" },
          { label: "UTM Zone 46N", value: "UTM_Zone_46N" },
        ],
        hint: "Example: EPSG:3857",
      },
      {
        key: "resampling",
        label: "Resampling Method",
        type: "select",
        default: "bilinear",
        options: [
          { label: "Nearest", value: "near" },
          { label: "Bilinear", value: "bilinear" },
          { label: "Cubic", value: "cubic" },
        ],
      },
    ],
  },

  {
    id: "cell_resize",
    label: "Cell Resize",
    description: "Change raster cell resolution",
    category: "transform",
    icon: "M4 4h16v16H4zM4 12h16M12 4v16",
    accentColor: "--amber",
    params: [
      {
        key: "cell_size",
        label: "Target Cell Size",
        type: "number",
        default: 30,
        min: 0.1,
        max: 10000,
        step: 0.1,
        unit: "map units",
      },
      {
        key: "method",
        label: "Resampling Method",
        type: "select",
        default: "bilinear",
        options: [
          { label: "Nearest", value: "nearest" },
          { label: "Bilinear", value: "bilinear" },
          { label: "Cubic", value: "cubic" },
        ],
      },
    ],
  },

  {
    id: "interpolation",
    label: "Interpolation",
    description: "Interpolate raster from point data",
    category: "transform",
    icon: "M4 4h16v16H4z",
    accentColor: "--amber",
    params: [
      {
        key: "method",
        label: "Method",
        type: "select",
        default: "idw",
        options: [
          { label: "IDW", value: "idw" },
          { label: "Linear", value: "linear" },
          { label: "Nearest", value: "nearest" },
        ],
      },
      {
        key: "cell_size",
        label: "Output Cell Size",
        type: "number",
        default: 30,
        min: 1,
        max: 10000,
        step: 1,
        unit: "map units",
      },
    ],
  },

  // ── Classification ───────────────────────────────────────
  {
    id: "reclassification",
    label: "Reclassification",
    description: "Remap pixel values into classes",
    category: "classification",
    icon: "M3 3h7v7H3z",
    accentColor: "--purple",
    params: [
      {
        key: "num_classes",
        label: "Number of Classes",
        type: "number",
        default: 5,
        min: 2,
        max: 20,
        step: 1,
      },
    ],
  },

  // ── Distance ─────────────────────────────────────────────
  {
    id: "euclidean_distance",
    label: "Euclidean Distance",
    description: "Distance to nearest source cell",
    category: "distance",
    icon: "M12 22s8-4 8-10",
    accentColor: "--orange",
    params: [],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getOperationsByCategory(
  cat: OperationCategory,
): OperationDef[] {
  return OPERATIONS.filter((o) => o.category === cat);
}

export function getOperationById(id: string): OperationDef | undefined {
  return OPERATIONS.find((o) => o.id === id);
}

export function getCategoryDef(id: OperationCategory): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
