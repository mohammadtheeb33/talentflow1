"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Plus, UserPlus, Users, XCircle, CheckCircle2, LayoutDashboard, Settings, CloudUpload } from "lucide-react";
import { getClientAuth } from "@/lib/firebase";
import { getPipelineStats } from "@/services/statsService";
import Link from "next/link";
import { UploadModal } from "@/components/UploadModal";

// Dynamic imports
const ConnectOutlookModal = dynamic(
  () => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal),
  { ssr: false }
);

const RecentCandidatesTable = dynamic(
  () => import("@/components/dashboard/RecentCandidatesTable"),
  { 
    ssr: false,
    loading: () => <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden h-[400px] animate-pulse" />
  }
);

export default function DashboardPage() {
  const [openOutlook, setOpenOutlook] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [stats, setStats] = useState({ accepted: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const auth = getClientAuth();
        const user = auth.currentUser;
        
        if (!user) return;

        // 1. Fetch Stats
        const pipelineStats = await getPipelineStats(user.uid);
        setStats(pipelineStats);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const kpiData = [
    { 
      label: "Offers Accepted", 
      value: stats.accepted.toString(), 
      icon: CheckCircle2, 
      color: "text-green-600", 
      bg: "bg-green-50" 
    },
    { 
      label: "Applications Rejected", 
      value: stats.rejected.toString(), 
      icon: XCircle, 
      color: "text-red-600", 
      bg: "bg-red-50" 
    },
    { 
      label: "Total Candidates", 
      value: stats.total.toString(), 
      icon: Users, 
      color: "text-indigo-600", 
      bg: "bg-indigo-50" 
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <LayoutDashboard className="h-4 w-4" />
          <span className="font-semibold text-gray-900">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/job-profiles/new">
            <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              <Plus className="h-4 w-4" />
              New Job
            </button>
          </Link>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CloudUpload className="h-4 w-4" />
            Upload CV
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          
          {/* 1. KPI Cards */}
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {kpiData.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                    {loading ? (
                      <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
                    ) : (
                      <p className="mt-2 text-3xl font-bold text-gray-900">{kpi.value}</p>
                    )}
                  </div>
                  <div className={`rounded-full p-3 ${kpi.bg}`}>
                    <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* 2. Middle Section: Widgets */}
          <section className="grid gap-6 md:grid-cols-2">
            {/* Connect Outlook Widget */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="rounded-lg bg-blue-50 p-3">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Import Candidates</h3>
                  <p className="text-sm text-gray-500">Sync CVs directly from your Outlook inbox</p>
                </div>
              </div>
              <button
                onClick={() => setOpenOutlook(true)}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Connect Outlook
              </button>
            </div>

            {/* Upload CV Widget */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="rounded-lg bg-indigo-50 p-3">
                  <CloudUpload className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Upload CV</h3>
                  <p className="text-sm text-gray-500">Manually upload resumes (PDF/DOCX).</p>
                </div>
              </div>
              <button 
                onClick={() => setIsUploadOpen(true)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Upload Now
              </button>
            </div>
          </section>

          {/* 3. Bottom: Candidate Table */}
          <RecentCandidatesTable />

        </div>
      </main>

      <ConnectOutlookModal isOpen={openOutlook} onClose={() => setOpenOutlook(false)} />
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
}
