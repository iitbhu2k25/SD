"use client";

// This is the left side panel of the admin page.
// It lets the user choose the location for the analysis.
import LocationSelector from "./LocationSelector";

export default function AdminLeftPanel() {
  return (
    <div className="space-y-4">
      <LocationSelector />
    </div>
  );
}
