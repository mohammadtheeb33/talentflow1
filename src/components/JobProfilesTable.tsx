"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    return (item.title || "").toLowerCase().includes(s) || (item.description || "").toLowerCase().includes(s);
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Job Profiles</h2>
          <p className="mt-1 text-sm text-gray-500">Manage job requirements, skills, and scoring weights.</p>
        </div>
        <Link href="/job-profiles/new" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Job Profile
        </Link>
      </div>

      {/* Search */}
      <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search profiles..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && <div className="m-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3 font-semibold">Job Title</th>
              <th className="px-6 py-3 font-semibold">Experience</th>
              <th className="px-6 py-3 font-semibold">Education</th>
              <th className="px-6 py-3 font-semibold">Required Skills</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-48 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-8 w-8 ml-auto rounded bg-gray-200" /></td>
                </tr>
              ))
            )}
            {!loading && filtered.map((item) => (
              <tr key={item.id} className="group hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{item.title || "Untitled Profile"}</div>
                  {item.description && <div className="mt-1 line-clamp-1 text-xs text-gray-500">{item.description}</div>}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {item.minYearsExp ? `${item.minYearsExp} years` : "No minimum"}
                </td>
                <td className="px-6 py-4 text-gray-600 capitalize">
                  {item.educationLevel?.replace("_", " ") || "None"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(item.requiredSkills || []).slice(0, 3).map((skill, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {skill}
                      </span>
                    ))}
                    {(item.requiredSkills || []).length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        +{(item.requiredSkills?.length || 0) - 3}
                      </span>
                    )}
                    {(item.requiredSkills || []).length === 0 && <span className="text-gray-400 italic">No skills specified</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link href={`/job-profiles/new?prefill=${encodeURIComponent(item.title || item.id)}`} className="text-gray-400 hover:text-indigo-600" title="Duplicate">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </Link>
                    <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-indigo-600" title="Edit">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600" title="Delete">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-6 py-12 text-center" colSpan={5}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No job profiles found</h3>
                  <p className="mt-1 text-sm text-gray-500">Create a profile to start scoring candidates.</p>
                  <div className="mt-4">
                    <Link href="/job-profiles/new" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
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
