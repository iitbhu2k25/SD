// This shows a loading message while the admin page is opening.
export default function AdminLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-600">Loading Admin view...</div>
    </div>
  );
}
