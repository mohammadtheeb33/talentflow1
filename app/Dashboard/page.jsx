"use client";
import React, { useState } from "react";
import { UploadModal } from "@/components/UploadModal";
import { ConnectOutlookModal } from "@/components/ConnectOutlookModal";
import CandidatesTable from "@/components/CandidatesTable";
import Link from "next/link";

export default function DashboardPage() {
  const [openUpload, setOpenUpload] = useState(false);
  const [openOutlook, setOpenOutlook] = useState(false);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Actions */}
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Overview of your recruitment pipeline and activities.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpenUpload(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Upload CV
          </button>
        </div>
      </section>

      {/* Widgets Grid */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Connect Outlook Widget */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-2xl">
                📧
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Connect Outlook</h3>
                <p className="text-xs text-gray-500">Sync emails & calendar</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button 
              onClick={() => setOpenOutlook(true)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
            >
              Connect Now
            </button>
          </div>
        </div>

        {/* Configure Stages Widget */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-2xl">
                ⚙️
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Pipeline Settings</h3>
                <p className="text-xs text-gray-500">Configure interview stages</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/settings?tab=pipeline" className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600">
              Manage Stages
            </Link>
          </div>
        </div>

        {/* Quick Stats Widget (Placeholder) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-2xl">
                📊
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Pipeline Stats</h3>
                <p className="text-xs text-gray-500">Weekly activity summary</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">New candidates</span>
            <span className="font-semibold text-gray-900">12</span>
          </div>
        </div>
      </div>

      {/* Main Content: Candidates Table */}
      <CandidatesTable />

      {/* Modals */}
      <UploadModal isOpen={openUpload} onClose={() => setOpenUpload(false)} />
      <ConnectOutlookModal isOpen={openOutlook} onClose={() => setOpenOutlook(false)} />
    </main>
  );
}