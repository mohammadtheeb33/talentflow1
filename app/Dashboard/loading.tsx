export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-200" />
        </div>
        <div className="h-10 w-32 rounded bg-gray-200" />
      </div>

      {/* Widgets Grid Skeleton */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-gray-200" />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="h-96 rounded-xl bg-gray-200" />
    </div>
  );
}
