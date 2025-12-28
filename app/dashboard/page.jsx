"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Plus, UserPlus, Users, XCircle, CheckCircle2, LayoutDashboard, Settings } from "lucide-react";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { getPipelineStats } from "@/services/statsService";
import Link from "next/link";

// Dynamic imports
const ConnectOutlookModal = dynamic(
  () => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal),
  { ssr: false }
);

export default function DashboardPage() {
  const [openOutlook, setOpenOutlook] = useState(false);
  const [stats, setStats] = useState({ accepted: 0, rejected: 0, total: 0 });
  const [recentCandidates, setRecentCandidates] = useState([]);
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

        // 2. Fetch Recent Candidates
        const db = getClientFirestore();
        const cvsRef = collection(db, "cvs");
        // We use a simple query here. For robust "uid OR userId" support with sorting, 
        // client-side merging would be needed, but for "Recent" we'll prioritize 'uid' 
        // or just fetch 'uid' to keep it fast.
        // Note: This requires a composite index on [uid, createdAt]. 
        // If it fails, we'll catch the error and maybe fallback to client-side sort if needed.
        const q = query(
          cvsRef, 
          where("uid", "==", user.uid), 
          orderBy("createdAt", "desc"), 
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        const candidates = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.parsed?.name || data.name || "Unnamed Candidate",
            role: data.parsed?.jobTitle || data.jobTitle || "Unknown Role",
            source: data.source || "Upload",
            score: typeof data.score === 'number' ? Math.round(data.score) : 0,
            status: data.hiringStatus 
              ? (data.hiringStatus.charAt(0).toUpperCase() + data.hiringStatus.slice(1)) 
              : (data.status || "New")
          };
        });
        
        setRecentCandidates(candidates);
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

            {/* Pipeline Settings Widget */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <Settings className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Pipeline Settings</h3>
                  <p className="text-sm text-gray-500">Configure stages and scoring criteria</p>
                </div>
              </div>
              <Link href="/settings?tab=pipeline">
                <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  Manage Settings
                </button>
              </Link>
            </div>
          </section>

          {/* 3. Bottom: Candidate Table */}
          <section className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Recent Candidates</h3>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                Live Updates
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Candidate</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Source</th>
                    <th className="px-6 py-3 font-medium">Match Score</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : recentCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No candidates found. Start by importing or uploading a CV.
                      </td>
                    </tr>
                  ) : (
                    recentCandidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <Link href={`/cvs/${candidate.id}`} className="hover:text-indigo-600">
                            {candidate.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4">{candidate.role}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                            {candidate.source}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 rounded-full bg-gray-100">
                              <div
                                className={`h-2 rounded-full ${
                                  candidate.score >= 80 ? "bg-green-500" : candidate.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                                }`}
                                style={{ width: `${candidate.score}%` }}
                              />
                            </div>
                            <span className="font-semibold text-gray-900">{candidate.score}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              candidate.status === "Interview" || candidate.status === "Accepted"
                                ? "bg-green-100 text-green-800"
                                : candidate.status === "Rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {candidate.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-center">
              <Link href="/cvs">
                <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  View All Candidates &rarr;
                </button>
              </Link>
            </div>
          </section>

        </div>
      </main>

      <ConnectOutlookModal isOpen={openOutlook} onClose={() => setOpenOutlook(false)} />
    </div>
  );
}
