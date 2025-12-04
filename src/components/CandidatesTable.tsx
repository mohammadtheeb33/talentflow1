"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getClientAuth, getClientFirestore, ensureUid } from "@/lib/firebase";
import { CandidateRow, type CandidateItem } from "./CandidateRow";

type JobProfile = { id: string; title?: string };

type SortBy = "score" | "date" | "name";

export default function CandidatesTable({ onCheckCv }: { onCheckCv?: () => void }) {
  const [itemsUid, setItemsUid] = useState<CandidateItem[]>([]);
  const [itemsUserId, setItemsUserId] = useState<CandidateItem[]>([]);
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [quickView, setQuickView] = useState<"all" | "new" | "interviewing" | "scored">("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    let mounted = true;
    let unsubCvsUid: (() => void) | null = null;
    let unsubCvsUserId: (() => void) | null = null;
    let unsubJobs: (() => void) | null = null;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const auth = getClientAuth();
        let uid = auth.currentUser?.uid || null;
        if (!uid) {
          try { uid = await ensureUid(); } catch (_) {}
        }
        if (!uid) { setError("غير مصرح: الرجاء تسجيل الدخول"); return; }
        const db = getClientFirestore();
        // Listen live to CVS (uid)
        unsubCvsUid = onSnapshot(query(collection(db, "cvs"), where("uid", "==", uid), limit(200)), (cvSnap) => {
          if (!mounted) return;
          const rows: CandidateItem[] = [];
          cvSnap.forEach((d) => {
            const data = d.data() as any;
            rows.push({
              id: d.id,
              name: data?.parsed?.name || data?.name || null,
              email: data?.parsed?.email || data?.email || null,
              status: data?.status || null,
              score: typeof data?.score === "number" ? data.score : null,
              jobProfileId: data?.jobProfileId || null,
              jobTitle: data?.jobTitle || undefined,
              source: data?.source || data?.ingestion?.source || data?.origin || null,
              submittedAt: data?.createdAt || data?.submittedAt || null,
              updatedAt: data?.scoreUpdatedAt || data?.updatedAt || null,
            });
          });
          setItemsUid(rows);
        }, (err) => {
          setError(err?.message || "Failed to listen to candidates");
        });

        // Listen live to CVS (legacy: userId)
        unsubCvsUserId = onSnapshot(query(collection(db, "cvs"), where("userId", "==", uid), limit(200)), (cvSnap) => {
          if (!mounted) return;
          const rows: CandidateItem[] = [];
          cvSnap.forEach((d) => {
            const data = d.data() as any;
            rows.push({
              id: d.id,
              name: data?.parsed?.name || data?.name || null,
              email: data?.parsed?.email || data?.email || null,
              status: data?.status || null,
              score: typeof data?.score === "number" ? data.score : null,
              jobProfileId: data?.jobProfileId || null,
              jobTitle: data?.jobTitle || undefined,
              source: data?.source || data?.ingestion?.source || data?.origin || null,
              submittedAt: data?.createdAt || data?.submittedAt || null,
              updatedAt: data?.scoreUpdatedAt || data?.updatedAt || null,
            });
          });
          setItemsUserId(rows);
        }, (err) => {
          setError(err?.message || "Failed to listen to candidates");
        });

        // Listen live to Job Profiles
        unsubJobs = onSnapshot(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(200)), (jobSnap) => {
          if (!mounted) return;
          const js: JobProfile[] = [];
          jobSnap.forEach((d) => js.push({ id: d.id, ...(d.data() as any) }));
          // Keep sorted for dropdown
          js.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
          setJobs(js);
        }, (err) => {
          setError(err?.message || "Failed to listen to job profiles");
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load candidates");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (unsubCvsUid) try { unsubCvsUid(); } catch(_) {};
      if (unsubCvsUserId) try { unsubCvsUserId(); } catch(_) {};
      if (unsubJobs) try { unsubJobs(); } catch(_) {};
    };
  }, []);

  // Merge items from both listeners and decorate with job title labels
  const itemsAll = useMemo(() => {
    const map = new Map<string, CandidateItem>();
    const push = (arr: CandidateItem[]) => arr.forEach((i) => { map.set(i.id, i); });
    push(itemsUid);
    push(itemsUserId);
    // decorate with job title where missing
    const titleById: Record<string, string> = {};
    jobs.forEach((j) => { if (j.id) titleById[j.id] = j.title || j.id; });
    return Array.from(map.values()).map((r) => {
      if (r.jobTitle || !r.jobProfileId) return r;
      return { ...r, jobTitle: titleById[r.jobProfileId] || r.jobProfileId };
    });
  }, [itemsUid, itemsUserId, jobs]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    itemsAll.forEach((i) => { if (i.source) s.add(String(i.source)); });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [itemsAll]);

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      let out = itemsAll.filter((i) => {
        const nm = (i.name || "").toLowerCase();
        const em = (i.email || "").toLowerCase();
        const matchesSearch = q ? (nm.includes(q) || em.includes(q)) : true;
        const matchesJob = jobId ? i.jobProfileId === jobId : true;
        const matchesStatus = status ? String(i.status || "") === status : true;
        const matchesSource = source ? String(i.source || "") === source : true;
        const sc = typeof i.score === "number" ? i.score : null;
        const isDefaultRange = scoreMin === 0 && scoreMax === 100;
        // Include unscored candidates by default; when user narrows range, only include scored within range
        const matchesScore = sc === null ? isDefaultRange : (sc >= scoreMin && sc <= scoreMax);
        // Quick views
        const statusLc = String(i.status || "").toLowerCase();
        const submittedSec = i.submittedAt?.seconds || i.updatedAt?.seconds || 0;
        const nowSec = Math.floor(Date.now() / 1000);
        const isNew = submittedSec ? (nowSec - submittedSec) <= (7 * 24 * 60 * 60) : false;
        const matchesQuick = quickView === "all"
          ? true
          : quickView === "scored"
          ? statusLc === "scored"
          : quickView === "interviewing"
          ? statusLc.includes("interview")
          : quickView === "new"
          ? isNew
          : true;
        return matchesSearch && matchesJob && matchesStatus && matchesSource && matchesScore && matchesQuick;
      });
    const byName = (a: CandidateItem, b: CandidateItem) => String(a.name || a.email || a.id).localeCompare(String(b.name || b.email || b.id));
    const byScore = (a: CandidateItem, b: CandidateItem) => (Number(b.score || 0) - Number(a.score || 0));
    const ts = (i: CandidateItem) => (i.updatedAt?.seconds || i.submittedAt?.seconds || 0);
    const byDate = (a: CandidateItem, b: CandidateItem) => (ts(b) - ts(a));
    const sorter = sortBy === "name" ? byName : sortBy === "date" ? byDate : byScore;
    out.sort(sorter);
    if (sortDir === "asc") out.reverse();
    return out;
  }, [itemsAll, search, jobId, status, source, scoreMin, scoreMax, sortBy, sortDir, quickView]);

  const totalLabel = useMemo(() => `${filtered.length} results`, [filtered.length]);
  const lastUpdatedMinutes = useMemo(() => {
    const latestSec = filtered.reduce((mx, i) => Math.max(mx, i.updatedAt?.seconds || i.submittedAt?.seconds || 0), 0);
    if (!latestSec) return null;
    const mins = Math.max(0, Math.floor((Date.now() - latestSec * 1000) / 60000));
    return mins;
  }, [filtered]);

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Header and result count */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Candidates</h2>
          <p className="mt-1 text-sm text-gray-500">Manage and track your candidate pipeline</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{totalLabel}</div>
            {onCheckCv && (
                <button
                    onClick={onCheckCv}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Check CV
                </button>
            )}
        </div>
      </div>

      {/* Search, quick views, sync indicator, mode toggle */}
      <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or keywords..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
              <button 
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`} 
                onClick={() => setViewMode("table")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Table
              </button>
              <button 
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`} 
                onClick={() => setViewMode("cards")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Cards
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Filters:</span>
            {(["all","new","interviewing","scored"] as const).map((k) => (
              <button 
                key={k} 
                onClick={() => setQuickView(k)} 
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors border ${quickView===k ? "border-indigo-200 bg-indigo-500 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
              >
                {k === "all" ? "All Candidates" : k === "new" ? "New This Week" : k === "interviewing" ? "Interviewing" : "Scored"}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
            <span className={`h-2 w-2 rounded-full ${typeof lastUpdatedMinutes === 'number' && lastUpdatedMinutes < 5 ? 'bg-green-500 animate-pulse' : 'bg-green-500'}`} />
            <span>Synced with ATS{typeof lastUpdatedMinutes === "number" ? ` • ${lastUpdatedMinutes === 0 ? 'Just now' : `${lastUpdatedMinutes}m ago`}` : ""}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="rounded-lg border-gray-300 bg-white py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="">All Job Titles</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title || j.id}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border-gray-300 bg-white py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          <option value="scored">Scored</option>
          <option value="accepted">Strong fit</option>
          <option value="needs_review">Pending review</option>
          <option value="rejected">Not a fit</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border-gray-300 bg-white py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
            <span className="text-xs font-medium text-gray-500">Score Range</span>
            <input type="number" min={0} max={100} value={scoreMin} onChange={(e) => setScoreMin(Number(e.target.value || 0))} className="w-12 rounded border-gray-300 p-0 text-center text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
            <span className="text-gray-400">–</span>
            <input type="number" min={0} max={100} value={scoreMax} onChange={(e) => setScoreMax(Number(e.target.value || 100))} className="w-12 rounded border-gray-300 p-0 text-center text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
          </div>
          
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="rounded-lg border-gray-300 bg-white py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
              <option value="date">Sort by: Date</option>
              <option value="score">Sort by: Score</option>
              <option value="name">Sort by: Name</option>
            </select>
            <button onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")} className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700">
              {sortDir === "desc" ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3 font-semibold">Avatar</th>
              <th className="px-6 py-3 font-semibold">Candidate</th>
              <th className="px-6 py-3 font-semibold">Job Title</th>
              <th className="px-6 py-3 font-semibold">Source</th>
              <th className="px-6 py-3 font-semibold">Submitted</th>
              <th className="px-6 py-3 font-semibold">Match</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-10 w-10 rounded-full bg-gray-200" /></td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-32 rounded bg-gray-200 mb-2" />
                    <div className="h-3 w-24 rounded bg-gray-100" />
                  </td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-2 w-full rounded-full bg-gray-100"><div className="h-2 w-1/2 rounded-full bg-gray-200" /></div></td>
                  <td className="px-6 py-4"><div className="h-6 w-20 rounded-full bg-gray-200" /></td>
                  <td className="px-6 py-4"><div className="h-8 w-8 rounded bg-gray-200" /></td>
                </tr>
              ))
            )}
            {!loading && filtered.map((item) => (
              <CandidateRow
                key={item.id}
                item={item}
                onDeleted={(id) => { setItemsUid((prev) => prev.filter((i) => i.id !== id)); setItemsUserId((prev) => prev.filter((i) => i.id !== id)); }}
              />
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-6 py-12 text-center" colSpan={8}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No candidates found</h3>
                  <p className="mt-1 text-sm text-gray-500">Adjust your search or filters to find what you're looking for.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}