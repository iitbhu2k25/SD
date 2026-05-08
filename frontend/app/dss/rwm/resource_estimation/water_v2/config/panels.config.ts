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

export interface BottomPanelSettings {
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

export const waterV2PanelSettings: PanelSettings = {
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
    heightOpen: "38%",
    mobileHeightOpen: "min(20rem, 46vh)",
    heightClosed: "3rem",
    defaultOpen: false,
    minHeightPercent: 22,
    maxHeightPercent: 55,
  },
};
