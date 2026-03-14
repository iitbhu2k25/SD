export interface PanelSizeSettings {
  // Width when this panel is visible.
  widthOpen: string;
  // Width when this panel is hidden (normally "0px").
  widthClosed: string;
  // Initial open/closed state when the page loads.
  defaultOpen: boolean;
}

export interface PanelSettings {
  left: PanelSizeSettings;
  right: PanelSizeSettings & {
    enabled: boolean;
  };
}

export const stpPriorityPanelSettings: PanelSettings = {
  left: {
    widthOpen: "15%",
    widthClosed: "0px",
    defaultOpen: true,
  },
  right: {
    enabled: false,
    widthOpen: "30%",
    widthClosed: "0px",
    defaultOpen: false,
  },
};

// Backward-compatible aliases to avoid breaking imports during migration.
export type PanelConfig = PanelSizeSettings;
export type ModulePanelsConfig = PanelSettings;
export const STP_PRIORITY_V2_PANELS = stpPriorityPanelSettings;
