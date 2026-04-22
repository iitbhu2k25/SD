export default function WaterV2Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-blue-50 to-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <span className="text-sm text-slate-500">Loading Water Availability…</span>
      </div>
    </div>
  );
}
