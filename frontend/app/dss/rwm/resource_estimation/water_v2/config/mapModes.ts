export type MapMode = "admin" | "user";

interface MapModeInfo {
  mode: MapMode;
  shortLabel: string;
  label: string;
  selectionModel: "administrative" | "river-system";
  notes: string;
  badgeClassName: string;
}

const mapModes: Record<MapMode, MapModeInfo> = {
  admin: {
    mode: "admin",
    shortLabel: "Admin",
    label: "Administrative",
    selectionModel: "administrative",
    notes: "Uses state, district, and sub-district selection with year, season, and product type.",
    badgeClassName: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  user: {
    mode: "user",
    shortLabel: "Basin",
    label: "River System",
    selectionModel: "river-system",
    notes: "Uses river, stretch, drain, and catchment selection with year, season, and product type.",
    badgeClassName: "bg-green-100 text-green-700 border border-green-200",
  },
};

export function getMapModeInfo(mode: MapMode): MapModeInfo {
  return mapModes[mode];
}

export function getNextMapMode(mode: MapMode): MapMode {
  return mode === "admin" ? "user" : "admin";
}
