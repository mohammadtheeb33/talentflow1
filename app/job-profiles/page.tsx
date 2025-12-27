"use client";
import dynamic from "next/dynamic";

const JobProfilesTable = dynamic(() => import("@/components/JobProfilesTable"), {
  loading: () => <div className="h-96 w-full rounded-xl bg-gray-50 animate-pulse" />,
  ssr: false,
});

export default function JobProfilesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <JobProfilesTable />
    </main>
  );
}
