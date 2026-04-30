export interface PanelSizeSettings {
  // Width when this panel is visible.
  widthOpen: string;
  // Width when this panel is visible on smaller screens.
  mobileWidthOpen: string;
  // Width when this panel is hidden (normally "0px").
  widthClosed: string;
  // Initial open/closed state when the page loads.
  defaultOpen: boolean;
}

export interface RightPanelSettings extends PanelSizeSettings {
  // Desktop resize clamp lower bound.
  minWidthPercent: number;
  // Desktop resize clamp upper bound.
  maxWidthPercent: number;
}

export interface PanelSettings {
  left: PanelSizeSettings;
  right: RightPanelSettings;
}

export const rwmRiverPanelSettings: PanelSettings = {
  left: {
    widthOpen: "18%",
    mobileWidthOpen: "min(18rem, calc(100vw - 4rem))",
    widthClosed: "0px",
    defaultOpen: true,
  },
  right: {
    widthOpen: "25%",
    mobileWidthOpen: "min(24rem, calc(100vw - 4rem))",
    widthClosed: "0px",
    defaultOpen: false,
    minWidthPercent: 25,
    maxWidthPercent: 45,
  },
};

// Backward-compatible aliases to avoid breaking imports during migration.
export type PanelConfig = PanelSizeSettings;
export type ModulePanelsConfig = PanelSettings;
export const RWM_RIVER_V2_PANELS = rwmRiverPanelSettings;
export const RIGHT_PANEL_CONFIG = rwmRiverPanelSettings.right;
