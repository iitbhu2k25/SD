"use client";

// This is the left side panel of the user page.
// It lets the user choose the river system for the analysis.
import RiverSelector from "./RiverSelector";

export default function UserLeftPanel() {
  return (
    <div className="space-y-4">
      <RiverSelector />
    </div>
  );
}
