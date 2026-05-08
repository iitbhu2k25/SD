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

export interface BottomPanelSettings extends PanelSizeSettings {
  // Height when this panel is visible.
  heightOpen: string;
  // Height when this panel is visible on smaller screens.
  mobileHeightOpen: string;
  // Height when this panel is collapsed.
  heightClosed: string;
  // Initial open/closed state when the page loads.
  defaultOpen: boolean;
  // Desktop resize clamp lower bound.
  minHeightPercent: number;
  // Desktop resize clamp upper bound.
  maxHeightPercent: number;
}

export interface PanelSettings {
  left: PanelSizeSettings;
  right: RightPanelSettings;
  bottom: BottomPanelSettings;
}

export const marSuitabilityPanelSettings: PanelSettings = {
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
  bottom: {
    widthOpen: "0px",
    mobileWidthOpen: "0px",
    widthClosed: "0px",
    heightOpen: "38%",
    mobileHeightOpen: "min(20rem, 46vh)",
    heightClosed: "3rem",
    defaultOpen: false,
    minHeightPercent: 22,
    maxHeightPercent: 55,
  },
};

// Backward-compatible aliases to avoid breaking imports during migration.
export type PanelConfig = PanelSizeSettings;
export type ModulePanelsConfig = PanelSettings;
export const MAR_SUITABILITY_V2_PANELS = marSuitabilityPanelSettings;
