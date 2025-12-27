export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-9 w-full rounded-lg bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
}
