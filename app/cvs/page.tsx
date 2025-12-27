"use client";
import dynamic from "next/dynamic";

const CandidatesTable = dynamic(() => import("@/components/CandidatesTable"), {
  loading: () => <div className="h-96 w-full rounded-xl bg-gray-50 animate-pulse" />,
  ssr: false,
});

export default function CvsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Table and filters */}
      <CandidatesTable />
    </main>
  );
}
