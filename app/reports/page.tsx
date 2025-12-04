"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getClientFirestore, ensureUid } from "@/lib/firebase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

type Candidate = any;
type Job = { id: string; title?: string };

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidatesUid, setCandidatesUid] = useState<Candidate[]>([]);
  const [candidatesUserId, setCandidatesUserId] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Filters
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    return start.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    const end = new Date(d.getFullYear(), 11, 31);
    return end.toISOString().slice(0, 10);
  });
  const [jobId, setJobId] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    let unsubCvsUid: (() => void) | null = null;
    let unsubCvsUserId: (() => void) | null = null;
    let unsubJobs: (() => void) | null = null;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const uid = await ensureUid();
        const db = getClientFirestore();
        // Live CVS by uid
        unsubCvsUid = onSnapshot(query(collection(db, "cvs"), where("uid", "==", uid), limit(1000)), (snap) => {
          if (!mounted) return;
          const rows: Candidate[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
          setCandidatesUid(rows);
        }, (err) => setError(err?.message || "تعذّر تحميل السير الذاتية"));
        // Live CVS by legacy userId
        unsubCvsUserId = onSnapshot(query(collection(db, "cvs"), where("userId", "==", uid), limit(1000)), (snap) => {
          if (!mounted) return;
          const rows: Candidate[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
          setCandidatesUserId(rows);
        }, (err) => setError(err?.message || "تعذّر تحميل السير الذاتية"));
        // Live Job Profiles
        unsubJobs = onSnapshot(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(200)), (snap) => {
          if (!mounted) return;
          const js: Job[] = [];
          snap.forEach((d) => js.push({ id: d.id, ...(d.data() as any) }));
          js.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
          setJobs(js);
        }, (err) => setError(err?.message || "تعذّر تحميل ملفات الوظائف"));
      } catch (e: any) {
        setError(e?.message || "تعذّر بدء الاتصال بقاعدة البيانات");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; if (unsubCvsUid) try { unsubCvsUid(); } catch(_) {}; if (unsubCvsUserId) try { unsubCvsUserId(); } catch(_) {}; if (unsubJobs) try { unsubJobs(); } catch(_) {}; };
  }, []);

  // Merge candidates from both listeners
  const candidatesAll = useMemo(() => {
    const map = new Map<string, Candidate>();
    candidatesUid.forEach((c) => map.set(String((c as any)?.id || ""), c));
    candidatesUserId.forEach((c) => map.set(String((c as any)?.id || ""), c));
    return Array.from(map.values());
  }, [candidatesUid, candidatesUserId]);

  // Filtering
  const filtered = useMemo(() => {
    const fromMs = Date.parse(fromDate + "T00:00:00Z");
    const toMs = Date.parse(toDate + "T23:59:59Z");
    const byJob = (c: Candidate) => jobId ? String(c?.jobProfileId || "") === jobId : true;
    const srcLc = (s?: string) => String(s || "").toLowerCase();
    const bySrc = (c: Candidate) => sourceFilter ? srcLc(c?.source || c?.ingestion?.source || c?.origin).includes(sourceFilter.toLowerCase()) : true;
    const tsSec = (c: Candidate) => (c?.submittedAt?.seconds || c?.createdAt?.seconds || c?.updatedAt?.seconds || c?.scoreUpdatedAt?.seconds || 0);
    return candidatesAll.filter((c) => {
      const ms = tsSec(c) * 1000;
      const inRange = !fromMs || !toMs ? true : (ms >= fromMs && ms <= toMs);
      return inRange && byJob(c) && bySrc(c);
    });
  }, [candidatesAll, fromDate, toDate, jobId, sourceFilter]);

  // Derived KPIs
  const totalCandidates = filtered.length;
  const scored = filtered.filter((c) => typeof c?.score === "number");
  const avgScore = scored.length ? Math.round(scored.reduce((acc, c) => acc + Number(c.score || 0), 0) / scored.length) : 0;
  const atsPassRate = scored.length ? Math.round(100 * (scored.filter((c) => Number(c.score || 0) >= 60).length) / scored.length) : 0;
  const acceptedCount = filtered.filter((c) => String(c?.status || "").toLowerCase().includes("strong fit")).length;
  const rejectedCount = filtered.filter((c) => String(c?.status || "").toLowerCase().includes("not a fit")).length;

  // Score histogram (0-100 by 10s)
  const bins = useMemo(() => {
    const arr = new Array(10).fill(0);
    scored.forEach((c) => {
      const s = Math.max(0, Math.min(99, Math.floor(Number(c.score || 0))));
      const idx = Math.floor(s / 10);
      arr[idx] += 1;
    });
    return arr;
  }, [scored]);
  const maxBin = Math.max(1, ...bins);

  // Top skills extracted
  const topSkills = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((c) => {
      const skills: string[] = Array.isArray((c as any)?.skills) ? (c as any).skills
        : Array.isArray((c as any)?.parsed?.skills) ? (c as any).parsed.skills
        : Array.isArray((c as any)?.rawKeywords) ? (c as any).rawKeywords
        : [];
      skills.forEach((k) => { const key = String(k).trim(); if (!key) return; counts[key] = (counts[key] || 0) + 1; });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const max = Math.max(1, ...sorted.map(([, v]) => v));
    return { items: sorted, max };
  }, [filtered]);

  // Source breakdown
  const srcBreakdown = useMemo(() => {
    const norm = (s?: string) => {
      const v = String(s || "other").toLowerCase();
      if (v.includes("upload") || v.includes("csv")) return "Upload";
      if (v.includes("outlook")) return "Outlook";
      return "Other";
    };
    const map: Record<string, number> = { Upload: 0, Outlook: 0, Other: 0 };
    filtered.forEach((c) => { map[norm(c?.source || c?.ingestion?.source || c?.origin)] += 1; });
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    const pct = (v: number) => Math.round(100 * v / total);
    return { map, pct, total };
  }, [filtered]);

  // Monthly volume (last 12 months)
  const monthly = useMemo(() => {
    const points: number[] = new Array(12).fill(0);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    filtered.forEach((c) => {
      const sec = (c?.submittedAt?.seconds || c?.createdAt?.seconds || c?.updatedAt?.seconds || c?.scoreUpdatedAt?.seconds || 0);
      if (!sec) return;
      const d = new Date(sec * 1000);
      const monthsDiff = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
      if (monthsDiff >= 0 && monthsDiff < 12) points[monthsDiff] += 1;
    });
    const max = Math.max(1, ...points);
    return { points, max, start };
  }, [filtered]);

  // Per-role table
  const roleRows = useMemo(() => {
    const titleById: Record<string, string> = {}; jobs.forEach((j) => { titleById[j.id] = j.title || j.id; });
    const map: Record<string, { total: number; avg: number; pass: number; accepted: number; rejected: number }> = {};
    filtered.forEach((c) => {
      const key = String(c?.jobTitle || titleById[c?.jobProfileId || ""] || c?.jobProfileId || "—");
      const r = map[key] || { total: 0, avg: 0, pass: 0, accepted: 0, rejected: 0 };
      r.total += 1;
      const sNum = typeof c?.score === "number" ? Number(c.score || 0) : null;
      if (sNum !== null) { r.avg += sNum; if (sNum >= 60) r.pass += 1; }
      const statusLc = String(c?.status || "").toLowerCase();
      if (statusLc.includes("strong fit")) r.accepted += 1;
      if (statusLc.includes("not a fit")) r.rejected += 1;
      map[key] = r;
    });
    const rows = Object.entries(map).map(([role, v]) => ({
      role,
      total: v.total,
      avg: v.total ? Math.round(v.avg / v.total) : 0,
      passRate: v.total ? Math.round(100 * v.pass / v.total) : 0,
      accepted: v.accepted,
      rejected: v.rejected,
    }));
    rows.sort((a, b) => b.total - a.total);
    return rows.slice(0, 8);
  }, [filtered, jobs]);

  // Export CSV of roleRows
  function exportCsv() {
    const headers = ["Job Title", "Total Candidates", "Average Score", "ATS Pass Rate", "Accepted", "Rejected"];
    const lines = [headers.join(","), ...roleRows.map((r) => [r.role, r.total, r.avg, r.passRate + "%", r.accepted, r.rejected].join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "reports.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function exportPdf() { try { window.print(); } catch(_) {} }
  function resetFilters() {
    const d = new Date(); setJobId(""); setSourceFilter("");
    setFromDate(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10));
    setToDate(new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10));
  }

  return (
    <main className="w-full space-y-6">
      {/* Header */}
      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">Reports & Analytics</h1>
            <p className="text-xs text-gray-600">Overview of candidates, performance, and skill trends.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50">Export CSV</button>
            <button onClick={exportPdf} className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700">Export PDF</button>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-lg border bg-red-50 p-4 text-sm text-red-700">{error}</section>
      )}

      {/* Filters bar */}
      <section className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="text-[11px] text-gray-600">Date range</div>
            <div className="mt-2 flex items-center gap-2">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40 rounded border px-2 py-1 text-xs" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40 rounded border px-2 py-1 text-xs" />
            </div>
          </div>
          <div>
            <div className="text-[11px] text-gray-600">Job</div>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-2 w-full rounded border px-2 py-1 text-xs">
              <option value="">All roles</option>
              {jobs.map((j) => (<option key={j.id} value={j.id}>{j.title || j.id}</option>))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-gray-600">Source</div>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="mt-2 w-full rounded border px-2 py-1 text-xs">
              <option value="">Upload, Outlook, Other</option>
              <option value="upload">Upload</option>
              <option value="outlook">Outlook</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700">Apply</button>
            <button onClick={resetFilters} className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50">Reset</button>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-600">Total Candidates</div>
          <div className="mt-2 text-2xl font-semibold">{totalCandidates}</div>
          <div className="mt-1 text-[11px] text-gray-500">Last 12 months</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-600">Average Match Score</div>
          <div className="mt-2 text-2xl font-semibold">{avgScore}%</div>
          <div className="mt-1 text-[11px] text-gray-500">Weighted by role</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-600">ATS Pass Rate</div>
          <div className="mt-2 text-2xl font-semibold">{atsPassRate}%</div>
          <div className="mt-1 text-[11px] text-gray-500">First screening</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-600">Accepted vs Rejected</div>
          <div className="mt-2 text-2xl font-semibold">{acceptedCount} / {rejectedCount}</div>
          <div className="mt-1 text-[11px] text-gray-500">Offer accepted / Rejected</div>
        </div>
      </section>

      {/* Charts row: histogram + top skills (Recharts) */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Histogram */}
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Score Distribution (Histogram)</div>
              <div className="text-[11px] text-gray-500">Most candidates cluster between 60–85 ATS score.</div>
            </div>
            <div className="text-[11px] text-gray-500">Sample size: {totalCandidates}</div>
          </div>
          <div className="mt-4 h-40 w-full">
            <ResponsiveContainer>
              <BarChart data={bins.map((v, i) => ({ bucket: `${i * 10}`, count: v }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIndigoPurple" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="url(#gradIndigoPurple)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top skills */}
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Top Skills (Extracted)</div>
            <div className="text-[11px] text-gray-500">Top {Math.min(12, topSkills.items.length)} skills</div>
          </div>
          <div className="mt-4 h-48 w-full">
            {topSkills.items.length > 0 ? (
              <ResponsiveContainer>
                <BarChart
                  layout="vertical"
                  data={topSkills.items.map(([skill, count]) => ({ skill, count }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="gradIndigoPurple2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="skill" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" fill="url(#gradIndigoPurple2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[11px] text-gray-500">No skill data available.</div>
            )}
          </div>
        </div>
      </section>

      {/* Source breakdown + Monthly volume (Recharts) */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Source pie */}
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Candidate Source Breakdown</div>
            <div className="text-[11px] text-gray-500">Upload vs Outlook vs Other</div>
          </div>
          <div className="mt-4 flex items-center gap-6">
            <div className="h-40 w-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Upload", value: srcBreakdown.map.Upload },
                      { name: "Outlook", value: srcBreakdown.map.Outlook },
                      { name: "Other", value: srcBreakdown.map.Other },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {[
                      "#6366f1",
                      "#22c55e",
                      "#a78bfa",
                    ].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded bg-indigo-600" /> Upload <span className="text-gray-600">{srcBreakdown.pct(srcBreakdown.map.Upload)}%</span></div>
              <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded bg-green-500" /> Outlook <span className="text-gray-600">{srcBreakdown.pct(srcBreakdown.map.Outlook)}%</span></div>
              <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded bg-purple-400" /> Other <span className="text-gray-600">{srcBreakdown.pct(srcBreakdown.map.Other)}%</span></div>
              <div className="pt-2 text-[10px] text-gray-500">Uploaded vs Outlook vs Other</div>
            </div>
          </div>
        </div>

        {/* Monthly line */}
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Monthly Candidate Volume</div>
            <div className="text-[11px] text-gray-500">Last 12 months</div>
          </div>
          <div className="mt-4 h-40 w-full">
            <ResponsiveContainer>
              <LineChart
                data={monthly.points.map((v, i) => ({ m: i + 1, count: v }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} cursor={{ stroke: "#e5e7eb" }} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 text-[10px] text-gray-500">Units: candidates/month</div>
            <div className="text-[10px] text-gray-500">Peak in Q4 driven by graduate intake</div>
          </div>
        </div>
      </section>

      {/* Per-role table */}
      <section className="rounded-lg border bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">By Job Title</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-t border-b bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-4 py-2">Job Title</th>
                <th className="px-4 py-2">Total Candidates</th>
                <th className="px-4 py-2">Average Score</th>
                <th className="px-4 py-2">ATS Pass Rate</th>
                <th className="px-4 py-2">Accepted</th>
                <th className="px-4 py-2">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {roleRows.map((r) => (
                <tr key={r.role} className="border-b">
                  <td className="px-4 py-3 text-xs text-gray-700">{r.role}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{r.total}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{r.avg}%</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{r.passRate}%</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{r.accepted}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{r.rejected}</td>
                </tr>
              ))}
              {!loading && roleRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-xs text-gray-500" colSpan={6}>No data for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}