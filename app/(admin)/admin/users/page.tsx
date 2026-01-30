"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";
import { toast } from "sonner";
import { Eye, Pencil } from "lucide-react";

type UserRow = {
  id: string;
  displayName?: string;
  email?: string;
  plan?: "free" | "pro";
  credits_limit?: number;
  credits_used?: number;
  is_vip?: boolean;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [quotaValue, setQuotaValue] = useState<number>(0);

  useEffect(() => {
    const db = getClientFirestore();
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list: UserRow[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => String(a.email || a.displayName || "").localeCompare(String(b.email || b.displayName || "")));
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openQuota = (user: UserRow) => {
    setActiveUser(user);
    setQuotaValue(Number(user.credits_limit || 0));
    setQuotaOpen(true);
  };

  const closeQuota = () => {
    setQuotaOpen(false);
    setActiveUser(null);
  };

  const saveQuota = async () => {
    if (!activeUser) return;
    setBusyId(activeUser.id);
    try {
      const db = getClientFirestore();
      await updateDoc(doc(db, "users", activeUser.id), {
        credits_limit: Number(quotaValue || 0)
      });
      toast.success("Quota updated");
      closeQuota();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update quota");
    } finally {
      setBusyId(null);
    }
  };

  const handlePlanChange = async (userId: string, plan: "free" | "pro") => {
    setBusyId(userId);
    try {
      const db = getClientFirestore();
      await updateDoc(doc(db, "users", userId), { plan });
      toast.success("Plan updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update plan");
    } finally {
      setBusyId(null);
    }
  };

  const tableRows = useMemo(() => rows.map((u) => {
    const name = u.displayName || u.email || "User";
    const initials = name.slice(0, 1).toUpperCase();
    const used = Number(u.credits_used || 0);
    const limit = Number(u.credits_limit || 0);
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return { ...u, name, initials, used, limit, percent };
  }), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">User Management</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Manage plans, quotas, and usage.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm shadow-slate-200/40 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500 dark:text-slate-400" colSpan={4}>Loading users...</td>
                </tr>
              )}
              {!loading && tableRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500 dark:text-slate-400" colSpan={4}>No users found.</td>
                </tr>
              )}
              {tableRows.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                        {u.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{u.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{u.email || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan || "free"}
                      onChange={(e) => handlePlanChange(u.id, e.target.value as "free" | "pro")}
                      disabled={busyId === u.id}
                      className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/30"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-800 dark:text-slate-100">{u.used} / {u.limit}</div>
                    <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500"
                        style={{ width: `${u.percent}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openQuota(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 transition hover:bg-cyan-500/20 dark:text-cyan-200"
                        title="Edit Quota"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Quota
                      </button>
                      <button
                        disabled
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200/60 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400 dark:border-white/5 dark:bg-white/5 dark:text-slate-500"
                        title="Impersonate"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Impersonate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {quotaOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 dark:shadow-none">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Credits Quota</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{activeUser.email || activeUser.displayName}</p>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Currently used: {Number(activeUser.credits_used || 0)}</p>
            <div className="mt-4">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Credits Limit</label>
              <input
                type="number"
                min={0}
                value={quotaValue}
                onChange={(e) => setQuotaValue(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/30"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeQuota}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={saveQuota}
                disabled={busyId === activeUser.id}
                className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
