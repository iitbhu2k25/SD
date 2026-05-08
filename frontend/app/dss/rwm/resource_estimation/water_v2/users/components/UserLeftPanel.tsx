"use client";

// Left panel container for basin (user) mode.
// Delegates confirm/reset to useUserViewModel which owns the full orchestration:
// confirmSelections → setRasterResponse → setExportData → unlockRightPanel.
import UserRiverSelector from "./UserRiverSelector";
import { useUserViewModel } from "../hooks/useUserViewModel";

export default function UserLeftPanel() {
  const { handleConfirm, handleReset } = useUserViewModel();

  return (
    <UserRiverSelector onConfirm={handleConfirm} onReset={handleReset} />
  );
}
