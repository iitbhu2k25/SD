export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600"></div>
        <div className="text-sm font-medium text-slate-600">Loading MAR Suitability V2...</div>
      </div>
    </div>
  );
}
