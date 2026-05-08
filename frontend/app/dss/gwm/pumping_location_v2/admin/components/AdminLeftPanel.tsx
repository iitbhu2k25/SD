"use client";

import LocationSelector from "./LocationSelector";
import AdminWellPointsInput from "./AdminWellPointsInput";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";

export default function AdminLeftPanel() {
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const tableData = useAdminCategoryStore((state) => state.tableData);

  const showInputPanel =
    displayRaster.some((layer) => layer.file_name === "Pumping_location") &&
    tableData.length === 0;

  return (
    <div className="space-y-4">
      <LocationSelector />
      {showInputPanel && <AdminWellPointsInput />}
    </div>
  );
}
