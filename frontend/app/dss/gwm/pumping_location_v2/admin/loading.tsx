export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <div className="text-sm font-medium text-slate-600">Loading Pumping Admin Mode...</div>
      </div>
    </div>
  );
}

