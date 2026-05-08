"use client";

import RiverSelector from "./RiverSelector";
import UserWellPointsInput from "./UserWellPointsInput";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserCategoryStore } from "../stores/userCategoryStore";

export default function UserLeftPanel() {
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const tableData = useUserCategoryStore((state) => state.tableData);

  const showInputPanel =
    displayRaster.some((layer) => layer.file_name === "Pumping_location") &&
    tableData.length === 0;

  return (
    <div className="space-y-4">
      <RiverSelector />
      {showInputPanel && <UserWellPointsInput />}
    </div>
  );
}
