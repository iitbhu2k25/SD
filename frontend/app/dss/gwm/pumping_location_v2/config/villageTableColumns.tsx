"use client";

import React from "react";
import type { TableColumn } from "react-data-table-component";
import { Gwpl_Table, Gwpl_columns } from "@/interface/table";

export const pumpingVillageColumns: TableColumn<Gwpl_Table>[] = Gwpl_columns.map((column) => {
  const rest = (({ width, minWidth, maxWidth, ...remaining }) => remaining)(column);
  return {
    ...rest,
    grow: 1,
    minWidth: "130px",
  };
});

export interface PumpingExportColumn {
  header: string;
  selector: (row: Gwpl_Table) => string | number;
}

export const pumpingVillageExportColumns: PumpingExportColumn[] = [
  { header: "Well Id", selector: (row) => row.Well_id },
  { header: "Name", selector: (row) => row.Name },
  { header: "Rank", selector: (row) => row.Rank },
  { header: "Groundwater table", selector: (row) => row["Groundwater table"] },
  { header: "Groundwater trends", selector: (row) => row["Groundwater trends"] },
  { header: "Slope", selector: (row) => row["Slope"] },
  { header: "Specific yield", selector: (row) => row["Specific yield"] },
  { header: "slope per year", selector: (row) => row["slope per year"] },
];
