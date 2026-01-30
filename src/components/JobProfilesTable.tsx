"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { collection, getDocs, limit, query, where, deleteDoc, doc } from "firebase/firestore";
import { getClientAuth, getClientFirestore, ensureUid } from "@/lib/firebase";
import EditJobModal from "./EditJobModal";

type Weights = {
  roleFit: number;
  skillsQuality: number;
  experienceQuality: number;
  projectsImpact: number;
  languageClarity: number;
  atsFormat: number;
};

type JobProfile = {
  id: string;
  title?: string;
  description?: string;
  requiredSkills?: string[];
  optionalSkills?: string[];
  minYearsExp?: number;
  educationLevel?: string;
  weights?: Weights;
  status?: 'Active' | 'Closed' | 'Draft';
};

export default function JobProfilesTable() {
  const [items, setItems] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingJob, setEditingJob] = useState<JobProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const auth = getClientAuth();
        let uid = auth.currentUser?.uid;
        if (!uid) {
          try { uid = await ensureUid(); } catch (_) {}
        }
        if (!uid) {
          setError("Unauthorized: Please sign in");
          return;
        }
        const db = getClientFirestore();
        const snap = await getDocs(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(100)));
        const rows: JobProfile[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        rows.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        if (!mounted) return;
        setItems(rows);
      } catch (e: any) {
        setError(e?.message || "Failed to load job profiles");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [refreshKey]);

  const handleEdit = (job: JobProfile) => {
    setEditingJob(job);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job profile?")) return;
    try {
      const db = getClientFirestore();
      await deleteDoc(doc(db, "jobProfiles", id));
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    }
  };

  const handleToggleStatus = async (job: JobProfile) => {
    const newStatus = job.status === 'Closed' ? 'Active' : 'Closed';
    const action = newStatus === 'Closed' ? 'close' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this job?`)) return;

    // Store original state for revert
    const originalStatus = job.status;

    try {
      // Optimistic update
      setItems(prev => prev.map(item => 
        item.id === job.id ? { ...item, status: newStatus } : item
      ));

      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
    } catch (e: any) {
      alert("Failed to update status: " + e.message);
      // Revert optimistic update
      setItems(prev => prev.map(item => 
        item.id === job.id ? { ...item, status: originalStatus } : item
      ));
    }
  };

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    return (item.title || "").toLowerCase().includes(s) || (item.description || "").toLowerCase().includes(s);
  });

  return (
    <section className="w-full rounded-2xl p-6 transition-all duration-300 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Job Profiles</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage job requirements, skills, and scoring weights.</p>
        </div>
        <Link href="/job-profiles/new" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-950">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Job Profile
        </Link>
      </div>

      {/* Search */}
      <div className="border-b border-slate-200 py-4 dark:border-white/10">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
          </div>
          <input
            aria-label="Search profiles"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search profiles..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white"
          />
        </div>
      </div>

      {/* Error */}
      {error && <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{error}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-6 py-3 font-semibold">Job Title</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Experience</th>
              <th className="px-6 py-3 font-semibold">Education</th>
              <th className="px-6 py-3 font-semibold">Required Skills</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-transparent dark:divide-white/5">
            {loading && (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800" /></td>
                  <td className="px-6 py-4"><div className="ml-auto h-8 w-8 rounded bg-slate-100 dark:bg-slate-800" /></td>
                </tr>
              ))
            )}
            {!loading && filtered.map((item) => (
              <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900 dark:text-slate-200">{item.title || "Untitled Profile"}</div>
                  {item.description && <div className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.status === 'Closed' 
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300' 
                      : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}>
                    {item.status === 'Closed' ? 'Closed' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-900 dark:text-slate-200">
                  {item.minYearsExp ? `${item.minYearsExp} years` : "No minimum"}
                </td>
                <td className="px-6 py-4 text-slate-900 dark:text-slate-200 capitalize">
                  {item.educationLevel?.replace("_", " ") || "None"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(item.requiredSkills || []).slice(0, 3).map((skill, i) => (
                      <span key={i} className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:border-cyan-500/30 dark:bg-slate-800 dark:text-cyan-300">
                        {skill}
                      </span>
                    ))}
                    {(item.requiredSkills || []).length > 3 && (
                      <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:border-cyan-500/30 dark:bg-slate-800 dark:text-cyan-300">
                        +{(item.requiredSkills?.length || 0) - 3}
                      </span>
                    )}
                    {(item.requiredSkills || []).length === 0 && <span className="text-slate-500 dark:text-slate-400 italic">No skills specified</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link 
                      href={`/careers/${item.id}`} 
                      target="_blank"
                      className="text-slate-400 transition-transform hover:scale-110 hover:text-cyan-300" 
                      title="View Public Page"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </Link>
                    <button 
                      onClick={() => handleToggleStatus(item)} 
                      className={`transition-transform hover:scale-110 ${item.status === 'Closed' ? 'text-emerald-300 hover:text-emerald-200' : 'text-rose-300 hover:text-rose-200'}`}
                      title={item.status === 'Closed' ? "Reopen Job" : "Close Job"}
                    >
                      {item.status === 'Closed' ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <Link 
                      href={`/job-profiles/new?prefill=${encodeURIComponent(item.title || item.id)}`} 
                      className="text-slate-400 transition-transform hover:scale-110 hover:text-indigo-300" 
                      title="Duplicate"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </Link>
                    <button onClick={() => handleEdit(item)} className="text-slate-400 transition-transform hover:scale-110 hover:text-sky-300" title="Edit">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-slate-400 transition-transform hover:scale-110 hover:text-rose-300" title="Delete">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-6 py-12 text-center" colSpan={6}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/60">
                    <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">No job profiles found</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create a profile to start scoring candidates.</p>
                  <div className="mt-4">
                    <Link href="/job-profiles/new" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-indigo-500">
                      Create Job Profile
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <EditJobModal
        job={editingJob}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </section>
  );
}
