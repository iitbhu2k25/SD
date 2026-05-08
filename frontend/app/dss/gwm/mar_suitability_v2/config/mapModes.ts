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
    notes: "Uses state, district, and sub-district selection flow.",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  user: {
    mode: "user",
    shortLabel: "Drain",
    label: "River System",
    selectionModel: "river-system",
    notes: "Uses river, stretch, drain, and catchment selection flow.",
    badgeClassName: "bg-green-100 text-green-700",
  },
};

export function getMapModeInfo(mode: MapMode): MapModeInfo {
  return mapModes[mode];
}

export function getNextMapMode(mode: MapMode): MapMode {
  return mode === "admin" ? "user" : "admin";
}
