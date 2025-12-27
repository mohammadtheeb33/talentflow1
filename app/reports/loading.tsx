export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-16 rounded-lg border bg-gray-100" />
      
      {/* Filters */}
      <div className="h-24 rounded-lg border bg-gray-100" />
      
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg border bg-gray-100" />
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-lg border bg-gray-100" />
        <div className="h-64 rounded-lg border bg-gray-100" />
      </div>
      
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-lg border bg-gray-100" />
        <div className="h-64 rounded-lg border bg-gray-100" />
      </div>
    </div>
  );
}
