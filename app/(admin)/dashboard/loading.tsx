export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600 dark:border-slate-800" />
      <div className="mt-4 text-sm text-slate-500 animate-pulse dark:text-slate-500">Loading TalentFlow...</div>
    </div>
  );
}
