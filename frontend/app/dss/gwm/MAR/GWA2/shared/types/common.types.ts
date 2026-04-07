export type GwaModuleKey =
  | "overview"
  | "wells"
  | "trend"
  | "recharge"
  | "demand"
  | "gsr"
  | "forecast";

export interface ModuleMeta {
  key: GwaModuleKey;
  label: string;
  description: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
