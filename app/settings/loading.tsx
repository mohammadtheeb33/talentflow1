export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="mb-8 h-10 w-48 rounded bg-gray-200" />
      <div className="flex flex-col lg:flex-row lg:gap-8">
        <div className="mb-8 w-full lg:mb-0 lg:w-64 space-y-2">
           <div className="h-10 w-full rounded bg-gray-200" />
           <div className="h-10 w-full rounded bg-gray-200" />
           <div className="h-10 w-full rounded bg-gray-200" />
        </div>
        <div className="flex-1 h-96 rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}
