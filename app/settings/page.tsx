"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const PipelineSettings = dynamic(() => import("@/components/PipelineSettings"), {
  loading: () => <div className="h-96 w-full rounded-xl bg-gray-50 animate-pulse" />,
  ssr: false,
});

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "general";
  const [activeTab, setActiveTab] = useState(initialTab === "pipeline" ? "pipeline" : "general");

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your recruitment process and account preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-8">
        {/* Sidebar Navigation */}
        <nav className="mb-8 w-full flex-shrink-0 lg:mb-0 lg:w-64">
          <div className="flex space-x-2 overflow-x-auto lg:flex-col lg:space-x-0 lg:space-y-1">
            <button
              onClick={() => setActiveTab("general")}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === "general"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-900 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === "pipeline"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-900 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === "team"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-900 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Team Members
            </button>
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === "pipeline" && <PipelineSettings />}
          
          {activeTab === "general" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
              <p className="mt-1 text-sm text-gray-500">Account details and preferences.</p>
              <div className="mt-6 border-t border-gray-100 pt-6">
                <p className="text-sm text-gray-500 italic">General settings are coming soon.</p>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900">Team Management</h3>
              <p className="mt-1 text-sm text-gray-500">Invite and manage team members.</p>
              <div className="mt-6 border-t border-gray-100 pt-6">
                <p className="text-sm text-gray-500 italic">Team management is coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}