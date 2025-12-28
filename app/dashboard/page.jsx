"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Plus, UserPlus, Users, XCircle, CheckCircle2, LayoutDashboard, Settings } from "lucide-react";

// Dummy Data for immediate rendering
const KPI_DATA = [
  { label: "Offers Accepted", value: "12", change: "+2 this week", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  { label: "Applications Rejected", value: "45", change: "+15 this week", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  { label: "Total Candidates", value: "128", change: "+24 this week", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
];

const CANDIDATES_DATA = [
  { id: 1, name: "Sarah Connor", role: "Frontend Developer", source: "Outlook", score: 92, status: "Interview" },
  { id: 2, name: "John Smith", role: "Backend Engineer", source: "Upload", score: 78, status: "Review" },
  { id: 3, name: "Emily Chen", role: "Product Manager", source: "LinkedIn", score: 85, status: "Shortlisted" },
  { id: 4, name: "Michael Brown", role: "DevOps Engineer", source: "Outlook", score: 64, status: "Rejected" },
  { id: 5, name: "Jessica Wu", role: "UX Designer", source: "Upload", score: 88, status: "Interview" },
];

// Dynamic imports
const ConnectOutlookModal = dynamic(
  () => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal),
  { ssr: false }
);

export default function DashboardPage() {
  const [openOutlook, setOpenOutlook] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <LayoutDashboard className="h-4 w-4" />
          <span className="font-semibold text-gray-900">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            <Plus className="h-4 w-4" />
            New Job
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          
          {/* 1. KPI Cards */}
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {KPI_DATA.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                  <div className={`rounded-full p-3 ${kpi.bg}`}>
                    <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-green-600 font-medium">{kpi.change}</span>
                  <span className="ml-2 text-gray-400">vs last 30 days</span>
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
              <button className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Manage Settings
              </button>
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
                  {CANDIDATES_DATA.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{candidate.name}</td>
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
                            candidate.status === "Interview"
                              ? "bg-purple-100 text-purple-800"
                              : candidate.status === "Rejected"
                              ? "bg-red-100 text-red-800"
                              : candidate.status === "Shortlisted"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {candidate.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-center">
              <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                View All Candidates &rarr;
              </button>
            </div>
          </section>

        </div>
      </main>

      {/* Modals */}
      <ConnectOutlookModal isOpen={openOutlook} onClose={() => setOpenOutlook(false)} />
    </div>
  );
}
