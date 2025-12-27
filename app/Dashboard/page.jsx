"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { getClientAuth, ensureUid } from "@/lib/firebase";
import { getPipelineStats } from "@/services/statsService";

// Dynamic imports for heavy/interactive components
const UploadModal = dynamic(
  () => import("@/components/UploadModal").then((mod) => mod.UploadModal),
  { ssr: false }
);
const ConnectOutlookModal = dynamic(
  () => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal),
  { ssr: false }
);
const CandidatesTable = dynamic(() => import("@/components/CandidatesTable"), {
  loading: () => <div className="h-96 w-full rounded-xl bg-gray-50 animate-pulse" />,
  ssr: false,
});

export default function DashboardPage() {
  const [openUpload, setOpenUpload] = useState(false);
  const [openOutlook, setOpenOutlook] = useState(false);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState("Last 30 Days");

  // Fetch stats separately to show loading state
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await ensureUid();
        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const data = await getPipelineStats(uid);
        if (mounted) {
          setStats(data);
        }
      } catch (e) {
        console.error("Stats fetch error", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Overview</span>
          <span>/</span>
          <span className="font-semibold text-gray-900">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/job-profiles/new"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Job
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 p-8">
        <div className="mx-auto w-[90%] max-w-none">
          {/* Pipeline Overview */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pipeline Overview</h1>
              <p className="mt-1 text-sm text-gray-500">Key performance metrics for current hiring period</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setOpenOutlook(true)}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <span className="mr-2">📧</span> Connect Outlook
              </button>
              <button
                onClick={() => setOpenUpload(true)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <span className="mr-2">↑</span> Upload CV
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Offers Accepted */}
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-600">Offers Accepted</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{stats ? stats.accepted : "—"}</div>
                  <div className="mt-1 text-xs text-emerald-600">+12.5% vs last month</div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">✓</div>
              </div>
            </div>
            {/* Applications Rejected */}
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-600">Applications Rejected</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{stats ? stats.rejected : "—"}</div>
                  <div className="mt-1 text-xs text-red-600">-2.4% vs last month</div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">✕</div>
              </div>
            </div>
            {/* Total Candidates */}
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-600">Total Candidates</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{stats ? stats.total : "—"}</div>
                  <div className="mt-1 text-xs text-indigo-600">+8.1% vs last month</div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">👥</div>
              </div>
            </div>
          </section>

          {/* Recent Applications */}
          <section className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Applications</h2>
            <Link href="/cvs" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View All Candidates</Link>
          </section>
          <CandidatesTable limitCount={10} />

          {/* Modals */}
          <UploadModal isOpen={openUpload} onClose={() => setOpenUpload(false)} />
          <ConnectOutlookModal isOpen={openOutlook} onClose={() => setOpenOutlook(false)} />
        </div>
      </main>
    </div>
  );
}
