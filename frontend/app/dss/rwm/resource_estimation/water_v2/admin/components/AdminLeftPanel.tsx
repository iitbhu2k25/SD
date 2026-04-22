"use client";

// Left panel container for admin mode.
// Delegates confirm/reset to useAdminViewModel which owns the full orchestration:
// confirmSelections → setRasterResponse → setExportData → unlockRightPanel.
import AdminLocationSelector from "./AdminLocationSelector";
import { useAdminViewModel } from "../hooks/useAdminViewModel";

export default function AdminLeftPanel() {
  const { handleConfirm, handleEdit, handleReset } = useAdminViewModel();

  return (
    <AdminLocationSelector
      onConfirm={handleConfirm}
      onEdit={handleEdit}
      onReset={handleReset}
    />
  );
}
