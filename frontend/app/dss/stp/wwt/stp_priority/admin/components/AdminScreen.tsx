"use client";

// This builds the full admin page layout.
// It loads starting data, shows the left panel, and shows the main map area.
import AdminDataInit from "./AdminDataInit";
import AdminLeftPanel from "./AdminLeftPanel";
import AdminMainView from "./AdminMainView";
import ScreenLayout from "../../shared/ui/ScreenLayout";

export default function AdminScreen() {
  return (
    <AdminDataInit>
      <ScreenLayout leftPanel={<AdminLeftPanel />} mainContent={<AdminMainView />} />
    </AdminDataInit>
  );
}
