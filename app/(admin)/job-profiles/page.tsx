import dynamic from "next/dynamic";

const JobProfilesTable = dynamic(() => import("@/components/JobProfilesTable"), {
  loading: () => (
    <div className="h-96 w-full rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none" />
  ),
  ssr: false,
});

export default function JobProfilesPage() {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 px-4 py-6 md:px-8">
      <JobProfilesTable />
    </div>
  );
}
