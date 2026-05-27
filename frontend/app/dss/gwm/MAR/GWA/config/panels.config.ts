export interface PanelSizeSettings {
  widthOpen: string;
  mobileWidthOpen: string;
  widthClosed: string;
  defaultOpen: boolean;
}

export interface RightPanelSettings extends PanelSizeSettings {
  minWidthPercent: number;
  maxWidthPercent: number;
}

export interface PanelSettings {
  left: PanelSizeSettings;
  right: RightPanelSettings;
}

export const gwaPanelSettings: PanelSettings = {
  left: {
    widthOpen: "22%",
    mobileWidthOpen: "min(22rem, calc(100vw - 4rem))",
    widthClosed: "0px",
    defaultOpen: true,
  },
  right: {
    widthOpen: "35%",
    mobileWidthOpen: "min(24rem, calc(100vw - 4rem))",
    widthClosed: "0px",
    defaultOpen: false,
    minWidthPercent: 25,
    maxWidthPercent: 55,
  },
};
