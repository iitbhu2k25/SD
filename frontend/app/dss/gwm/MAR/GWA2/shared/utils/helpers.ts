import type { GwaModuleKey } from "../types/common.types";
import type { AdminSelection, ConfirmedLocation, DrainSelection } from "../types/location.types";
import type { TableRow } from "../types/module.types";
import type {
  DemandModuleState,
  ForecastModuleState,
  GsrModuleState,
  RechargeModuleState,
  TrendModuleState,
  WellsModuleState,
} from "../types/module.types";

interface ModuleStatusInput {
  confirmedLocation: ConfirmedLocation | null;
  wells: WellsModuleState;
  trend: TrendModuleState;
  recharge: RechargeModuleState;
  demand: DemandModuleState;
  gsr: GsrModuleState;
  forecast: ForecastModuleState;
}

export interface WorkflowModuleStatus {
  key: GwaModuleKey;
  label: string;
  description: string;
  status: "locked" | "pending" | "ready" | "complete";
  disabled: boolean;
  count: number;
  detail: string;
}

export function formatAdminLabel(selection: AdminSelection): string {
  return [
    selection.state?.state_name ?? null,
    selection.districts.length ? `${selection.districts.length} district(s)` : null,
    selection.subDistricts.length ? `${selection.subDistricts.length} sub-district(s)` : null,
  ]
    .filter(Boolean)
    .join(" > ");
}

export function formatDrainLabel(selection: DrainSelection): string {
  return [
    selection.river?.name ?? null,
    selection.stretch ? `Stretch ${selection.stretch.id}` : null,
    selection.drains.length ? `${selection.drains.length} drain(s)` : null,
    selection.selectedVillageIds.length ? `${selection.selectedVillageIds.length} village(s)` : null,
  ]
    .filter(Boolean)
    .join(" > ");
}

export function getConfirmedCountSummary(location: ConfirmedLocation | null) {
  if (!location) return [];

  if (location.mode === "admin" && location.admin) {
    return [
      { label: "Districts", value: location.admin.districts.length },
      { label: "Sub-Districts", value: location.admin.subDistricts.length },
    ];
  }

  if (location.mode === "drain" && location.drain) {
    return [
      { label: "Drains", value: location.drain.drains.length },
      { label: "Villages", value: location.drain.selectedVillageIds.length },
    ];
  }

  return [];
}

export function getConfirmedAreaCodes(location: ConfirmedLocation | null) {
  if (!location) {
    return { adminCodes: [] as number[], villageCodes: [] as number[] };
  }

  if (location.mode === "admin" && location.admin) {
    return {
      adminCodes: location.admin.subDistricts
        .map((item) => Number(item.subdistrict_code))
        .filter((value) => Number.isFinite(value)),
      villageCodes: [] as number[],
    };
  }

  if (location.mode === "drain" && location.drain) {
    return {
      adminCodes: [] as number[],
      villageCodes: location.drain.selectedVillageIds
        .map((item) => Number(item))
        .filter((value) => Number.isFinite(value)),
    };
  }

  return { adminCodes: [] as number[], villageCodes: [] as number[] };
}

export function getWellDisplayColumns(rows: TableRow[], customColumns: string[], mode: string | null) {
  if (mode === "upload_csv" && rows.length > 0) {
    return [...Object.keys(rows[0]), ...customColumns.filter((column) => !(column in rows[0]))];
  }

  return [
    "BLOCK",
    "HYDROGRAPH",
    "LATITUDE",
    "LONGITUDE",
    "RL",
    "PRE_2011",
    "POST_2011",
    "PRE_2012",
    "POST_2012",
    "PRE_2013",
    "POST_2013",
    "PRE_2014",
    "POST_2014",
    "PRE_2015",
    "POST_2015",
    "PRE_2016",
    "POST_2016",
    "PRE_2017",
    "POST_2017",
    "PRE_2018",
    "POST_2018",
    "PRE_2019",
    "POST_2019",
    "PRE_2020",
    "POST_2020",
    ...customColumns,
  ];
}

export function getAvailableYearsFromWells(rows: TableRow[]) {
  if (!rows.length) return [] as string[];

  return [...new Set(
    Object.keys(rows[0])
      .filter((column) => /^(PRE|POST)_(\d{4})$/i.test(column))
      .map((column) => column.replace(/^(PRE|POST)_/i, ""))
      .sort((a, b) => Number(a) - Number(b)),
  )];
}

export function csvFromRows(rows: TableRow[], columns: string[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? "")}"`).join(",")),
  ].join("\n");
}

export function parseCsvText(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [] as TableRow[];

  const headers = lines[0].split(",").map((header) => header.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    return headers.reduce<TableRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function combineDemandRows(domestic: TableRow[], agricultural: TableRow[], industrial: TableRow[]) {
  const villageMap = new Map<string, TableRow>();

  domestic.forEach((row) => {
    const villageCode = String(row.village_code ?? row.Village_code ?? "");
    if (!villageCode) return;
    villageMap.set(villageCode, {
      village_code: villageCode,
      village_name: row.village_name ?? row.Village_name ?? "Unknown",
      domestic_demand: Number(row.domestic_demand ?? row["Domestic_demand_(Million litres/Year)"] ?? 0),
      agricultural_demand: 0,
      industrial_demand: 0,
    });
  });

  agricultural.forEach((row) => {
    const villageCode = String(row.village_code ?? row.Village_code ?? "");
    if (!villageCode) return;
    const existing = villageMap.get(villageCode) ?? {
      village_code: villageCode,
      village_name: row.village_name ?? row.Village_name ?? "Unknown",
      domestic_demand: 0,
      agricultural_demand: 0,
      industrial_demand: 0,
    };
    existing.agricultural_demand = Number(row.village_demand ?? row.agricultural_demand ?? 0);
    villageMap.set(villageCode, existing);
  });

  industrial.forEach((row) => {
    const villageCode = String(row.village_code ?? row.Village_code ?? "");
    if (!villageCode) return;
    const existing = villageMap.get(villageCode) ?? {
      village_code: villageCode,
      village_name: row.village_name ?? row.Village_name ?? "Unknown",
      domestic_demand: 0,
      agricultural_demand: 0,
      industrial_demand: 0,
    };
    existing.industrial_demand = Number(
      row["Industrial_demand_(Million litres/Year)"] ?? row.industrial_demand ?? 0,
    );
    villageMap.set(villageCode, existing);
  });

  return [...villageMap.values()].map((row) => ({
    ...row,
    total_demand:
      Number(row.domestic_demand ?? 0) +
      Number(row.agricultural_demand ?? 0) +
      Number(row.industrial_demand ?? 0),
  }));
}

export function getWorkflowModuleStatuses({
  confirmedLocation,
  wells,
  trend,
  recharge,
  demand,
  gsr,
  forecast,
}: ModuleStatusInput): WorkflowModuleStatus[] {
  const hasLocation = !!confirmedLocation;
  const hasWells = wells.isSaved && !!wells.csvFilename;
  const hasTrend = !!trend.data;
  const hasRecharge = recharge.data.length > 0;
  const hasDemand = demand.combinedData.length > 0;
  const hasGsr = gsr.data.length > 0;
  const hasForecast = !!forecast.data;

  return [
    {
      key: "overview",
      label: "Overview",
      description: "Review the confirmed area and workflow readiness.",
      status: hasLocation ? "ready" : "pending",
      disabled: false,
      count: getConfirmedCountSummary(confirmedLocation).reduce((sum, item) => sum + Number(item.value ?? 0), 0),
      detail: hasLocation ? confirmedLocation.label : "Confirm an area to begin.",
    },
    {
      key: "wells",
      label: "Wells",
      description: "Load or upload the wells dataset for analysis.",
      status: !hasLocation ? "locked" : hasWells ? "complete" : wells.data.length ? "ready" : "pending",
      disabled: !hasLocation,
      count: wells.data.length,
      detail: hasWells
        ? `${wells.data.length} row(s) saved`
        : wells.data.length
          ? `${wells.data.length} row(s) loaded and ready to save`
          : "Load existing wells or upload CSV",
    },
    {
      key: "trend",
      label: "Trend",
      description: "Generate groundwater trend outputs and timeseries CSVs.",
      status: !hasWells ? "locked" : hasTrend ? "complete" : "pending",
      disabled: !hasWells,
      count: trend.data?.villages?.length ?? 0,
      detail: hasTrend ? "Trend analysis generated" : "Requires saved wells data",
    },
    {
      key: "recharge",
      label: "Recharge",
      description: "Compute recharge for the selected area.",
      status: !hasWells ? "locked" : hasRecharge ? "complete" : "pending",
      disabled: !hasWells,
      count: recharge.data.length,
      detail: hasRecharge ? "Recharge output ready" : "Requires saved wells data",
    },
    {
      key: "demand",
      label: "Demand",
      description: "Run domestic, agricultural, and industrial demand scenarios.",
      status: !hasWells ? "locked" : hasDemand ? "complete" : "pending",
      disabled: !hasWells,
      count: demand.combinedData.length,
      detail: hasDemand ? "Combined demand table ready" : "Run at least one demand computation",
    },
    {
      key: "gsr",
      label: "GSR",
      description: "Generate GSR and MAR need assessment.",
      status: !(hasRecharge && hasDemand) ? "locked" : hasGsr ? "complete" : "pending",
      disabled: !(hasRecharge && hasDemand),
      count: gsr.data.length + gsr.stressData.length,
      detail: hasGsr ? "GSR results ready" : "Requires recharge and demand outputs",
    },
    {
      key: "forecast",
      label: "Forecast",
      description: "Forecast groundwater values from timeseries output.",
      status: !hasTrend ? "locked" : hasForecast ? "complete" : "pending",
      disabled: !hasTrend,
      count: (forecast.data?.results ?? forecast.data?.data ?? forecast.data?.forecast_results ?? []).length,
      detail: hasForecast ? "Forecast results ready" : "Requires trend timeseries output",
    },
  ];
}

export function getWorkflowCompletionPercent(input: ModuleStatusInput) {
  const actionable = getWorkflowModuleStatuses(input).filter((item) => item.key !== "overview");
  const completed = actionable.filter((item) => item.status === "complete").length;
  return actionable.length === 0 ? 0 : Math.round((completed / actionable.length) * 100);
}
