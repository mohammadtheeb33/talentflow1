"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";

const PipelineSettings = dynamic(() => import("@/components/PipelineSettings"), {
  loading: () => <div className="h-96 w-full rounded-xl bg-gray-50 animate-pulse" />,
  ssr: false,
});

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "general";
  const [activeTab, setActiveTab] = useState(initialTab === "pipeline" ? "pipeline" : "general");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const auth = getClientAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again.");
      if (!user.email) throw new Error("Email is missing for this account.");
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      const db = getClientFirestore();
      await updateDoc(doc(db, "users", user.uid), {
        passwordUpdatedAt: serverTimestamp()
      });
      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code === "auth/wrong-password") {
        toast.error("Current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts, please try again later.");
      } else if (code === "auth/weak-password") {
        toast.error("New password is too weak.");
      } else if (code === "auth/requires-recent-login") {
        toast.error("Please sign in again and retry.");
      } else {
        toast.error(error?.message || "Failed to update password.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

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
            <Link
              href="/settings/team"
              className="flex w-full items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors text-gray-900 hover:bg-gray-50 hover:text-gray-900"
            >
              <span>Team Members</span>
            </Link>
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
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Reset Password</h4>
                  <p className="mt-1 text-xs text-gray-500">Enter your current password and set a new one.</p>
                  <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingPassword ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
