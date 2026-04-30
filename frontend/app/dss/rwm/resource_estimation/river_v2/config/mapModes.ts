export type MapMode = "varuna_admin" | "varuna_drain" | "all_india";

interface MapModeInfo {
  mode: MapMode;
  shortLabel: string;
  label: string;
  selectionModel: "administrative" | "river-system" | "upload-workflow";
  notes: string;
  badgeClassName: string;
}

const mapModes: Record<MapMode, MapModeInfo> = {
  varuna_admin: {
    mode: "varuna_admin",
    shortLabel: "Admin",
    label: "Varuna Administrative",
    selectionModel: "administrative",
    notes: "Uses state, district, and sub-district selection flow.",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  varuna_drain: {
    mode: "varuna_drain",
    shortLabel: "Drain",
    label: "Varuna River System",
    selectionModel: "river-system",
    notes: "Uses river stretch and seasonal selection flow.",
    badgeClassName: "bg-green-100 text-green-700",
  },
  all_india: {
    mode: "all_india",
    shortLabel: "General",
    label: "All India / General",
    selectionModel: "upload-workflow",
    notes: "Allows uploading custom basin Shapefiles and point CSVs.",
    badgeClassName: "bg-purple-100 text-purple-700",
  },
};

export function getMapModeInfo(mode: MapMode): MapModeInfo {
  return mapModes[mode];
}

export function getNextMapMode(mode: MapMode): MapMode {
  return mode === "varuna_admin" 
    ? "varuna_drain" 
    : mode === "varuna_drain" 
      ? "all_india" 
      : "varuna_admin";
}
