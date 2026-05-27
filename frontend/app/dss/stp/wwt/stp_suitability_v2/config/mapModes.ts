export type MapMode = "admin" | "user" | "manual";

interface MapModeInfo {
  mode: MapMode;
  shortLabel: string;
  label: string;
  selectionModel: "administrative" | "river-system" | "manual";
  notes: string;
  badgeClassName: string;
}

const mapModes: Record<MapMode, MapModeInfo> = {
  admin: {
    mode: "admin",
    shortLabel: "Admin",
    label: "Administrative",
    selectionModel: "administrative",
    notes: "Uses administrative geography selection before suitability analysis.",
    badgeClassName: "border border-sky-200 bg-sky-100 text-sky-700",
  },
  user: {
    mode: "user",
    shortLabel: "Drain",
    label: "River System",
    selectionModel: "river-system",
    notes: "Uses river, stretch, drain, and catchment selection before suitability analysis.",
    badgeClassName: "border border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  manual: {
    mode: "manual",
    shortLabel: "Manual",
    label: "Manual Area",
    selectionModel: "manual",
    notes: "Uses a custom area defined by shapefile upload, polygon drawing, or KML file before suitability analysis.",
    badgeClassName: "border border-violet-200 bg-violet-100 text-violet-700",
  },
};

export function getMapModeInfo(mode: MapMode): MapModeInfo {
  return mapModes[mode];
}
