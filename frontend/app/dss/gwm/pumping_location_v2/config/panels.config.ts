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

export interface BottomPanelSettings extends PanelSizeSettings {
  heightOpen: string;
  mobileHeightOpen: string;
  heightClosed: string;
  defaultOpen: boolean;
  minHeightPercent: number;
  maxHeightPercent: number;
}

export interface PanelSettings {
  left: PanelSizeSettings;
  right: RightPanelSettings;
  bottom: BottomPanelSettings;
}

export const gwmPumpingPanelSettings: PanelSettings = {
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

export type PanelConfig = PanelSizeSettings;
export type ModulePanelsConfig = PanelSettings;
export const GWM_PUMPING_V2_PANELS = gwmPumpingPanelSettings;
