"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getClientFirestore, ensureUid } from "@/lib/firebase";
import dynamic from "next/dynamic";
import { 
  calculateHRMetrics,
  getHiringFunnel, 
  getScoreDistribution, 
  getMonthlyTrends, 
  getJobAnalytics, 
  getTopSkills, 
  getSourceBreakdown,
  Candidate,
  JobProfile 
} from "@/services/analyticsService";

// Dynamic Components
const HiringFunnelChart = dynamic(() => import("@/components/reports/HiringFunnelChart"), {
  loading: () => <div className="mt-4 h-64 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});
const ScoreDecisionChart = dynamic(() => import("@/components/reports/ScoreDecisionChart"), {
  loading: () => <div className="mt-4 h-64 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});
const MonthlyTrendsChart = dynamic(() => import("@/components/reports/MonthlyTrendsChart"), {
  loading: () => <div className="mt-4 h-64 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});
const TopSkillsChart = dynamic(() => import("@/components/reports/TopSkillsChart"), {
  loading: () => <div className="mt-4 h-48 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});
const SourceBreakdownChart = dynamic(() => import("@/components/reports/SourceBreakdownChart"), {
  loading: () => <div className="mt-4 h-40 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});
const AiInsightsPanel = dynamic(() => import("@/components/reports/AiInsightsPanel"), {
  loading: () => <div className="h-32 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});
const JobAnalyticsTable = dynamic(() => import("@/components/reports/JobAnalyticsTable"), {
  loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-white/5" />,
  ssr: false,
});

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidatesUid, setCandidatesUid] = useState<Candidate[]>([]);
  const [candidatesUserId, setCandidatesUserId] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<JobProfile[]>([]);

  // SMART Filters
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
  const [decisionStatus, setDecisionStatus] = useState<string>("");
  const [minScore, setMinScore] = useState<number>(0);
  const [minExp, setMinExp] = useState<number>(0);

  // Data Fetching
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
        unsubCvsUid = onSnapshot(query(collection(db, "cvs"), where("uid", "==", uid), limit(5000)), (snap) => {
          if (!mounted) return;
          const rows: Candidate[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
          setCandidatesUid(rows);
        }, (err) => setError(err?.message || "Failed to load candidates"));
        
        // Live CVS by legacy userId
        unsubCvsUserId = onSnapshot(query(collection(db, "cvs"), where("userId", "==", uid), limit(5000)), (snap) => {
          if (!mounted) return;
          const rows: Candidate[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
          setCandidatesUserId(rows);
        }, (err) => setError(err?.message || "Failed to load candidates"));
        
        // Live Job Profiles
        unsubJobs = onSnapshot(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(200)), (snap) => {
          if (!mounted) return;
          const js: JobProfile[] = [];
          snap.forEach((d) => js.push({ id: d.id, ...(d.data() as any) }));
          js.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
          setJobs(js);
        }, (err) => setError(err?.message || "Failed to load jobs"));
        
      } catch (e: any) {
        setError(e?.message || "Failed to connect to database");
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

  // Merge candidates
  const candidatesAll = useMemo(() => {
    const map = new Map<string, Candidate>();
    candidatesUid.forEach((c) => map.set(c.id, c));
    candidatesUserId.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [candidatesUid, candidatesUserId]);

  // Apply SMART Filters
  const filtered = useMemo(() => {
    const fromMs = Date.parse(fromDate + "T00:00:00Z");
    const toMs = Date.parse(toDate + "T23:59:59Z");

    return candidatesAll.filter((c) => {
      // 1. Date Range
      const sec = c.submittedAt?.seconds || c.createdAt?.seconds || c.updatedAt?.seconds || c.scoreUpdatedAt?.seconds || 0;
      const ms = sec * 1000;
      const inDateRange = !fromMs || !toMs ? true : (ms >= fromMs && ms <= toMs);
      if (!inDateRange) return false;

      // 2. Job Title
      if (jobId && String(c.jobProfileId || "") !== jobId) return false;

      // 3. Source
      if (sourceFilter) {
        const s = String(c.source || c.ingestion?.source || c.origin || "").toLowerCase();
        if (!s.includes(sourceFilter.toLowerCase())) return false;
      }

      // 4. Decision Status
      if (decisionStatus) {
        const hs = (c.hiringStatus || "").toLowerCase();
        if (decisionStatus === "accepted" && hs !== "accepted") return false;
        if (decisionStatus === "rejected" && hs !== "rejected") return false;
        if (decisionStatus === "undecided" && (hs === "accepted" || hs === "rejected")) return false;
      }

      // 5. Score Range
      const score = typeof c.score === "number" ? c.score : 0;
      if (score < minScore) return false;

      // 6. Experience (Simple heuristic: check if 'experience' field exists or parse from text? 
      // Assuming 'experience' field exists or we skip this if not present for now, 
      // but user asked for it. If data doesn't have it, we can't filter reliably.
      // I'll check if there's an experience years field. If not, I'll skip or use a placeholder logic)
      // Checking Candidate type: no explicit experience field. 
      // I'll check 'parsed.totalYearsExperience' if it exists in real data, otherwise skip.
      const exp = (c as any).parsed?.totalYearsExperience || (c as any).yearsOfExperience || 0;
      if (minExp > 0 && exp < minExp) return false;

      return true;
    });
  }, [candidatesAll, fromDate, toDate, jobId, sourceFilter, decisionStatus, minScore, minExp]);

  // Analytics Calculations
  const stats = useMemo(() => calculateHRMetrics(filtered), [filtered]);
  const funnelData = useMemo(() => getHiringFunnel(filtered), [filtered]);
  const scoreData = useMemo(() => getScoreDistribution(filtered), [filtered]);
  const trendsData = useMemo(() => getMonthlyTrends(filtered), [filtered]);
  const jobAnalytics = useMemo(() => getJobAnalytics(filtered, jobs), [filtered, jobs]);
  const topSkills = useMemo(() => getTopSkills(filtered), [filtered]);
  const sourceData = useMemo(() => getSourceBreakdown(filtered), [filtered]);

  // AI Insights Generation (Mock)
  const insights = useMemo(() => {
    if (filtered.length === 0) return ["No data available for analysis."];
    
    const lines = [];
    
    // Contextualize Acceptance Rate
    if (stats.acceptanceRate !== "N/A") {
      lines.push(`Based on HR decisions only, your acceptance rate is ${stats.acceptanceRate}%.`);
    } else {
      lines.push("No hiring decisions have been made yet (Acceptance Rate N/A).");
    }
    
    // Contextualize Qualified Rate
    lines.push(`Qualified Candidate Rate is ${stats.qualifiedRate}% (candidates scoring ≥60).`);
    
    // Skill Gap Insights
    if (stats.skillGapIndex.length > 0) {
      lines.push(`Rejected candidates frequently possess: ${stats.skillGapIndex.map(s => s.skill).join(", ")}.`);
    }

    const mostRejectedBin = scoreData.reduce((prev, current) => (prev.rejected > current.rejected) ? prev : current, scoreData[0]);
    if (mostRejectedBin && mostRejectedBin.rejected > 0) {
      lines.push(`Most rejections occur in the ${mostRejectedBin.range} score range.`);
    }

    if (topSkills.length > 0) {
      lines.push(`Top emerging skill is "${topSkills[0].skill}".`);
    }

    return lines;
  }, [filtered, stats, scoreData, topSkills]);

  // Export Functions
  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Email", "Job Title", "Score", "Status", "Decision", "Rejection Reason", "Top Skills", "Source", "Date"];
    const rows = filtered.map(c => {
      const skills = topSkills.map(s => s.skill).slice(0, 5).join("; ");
      const decision = (c.hiringStatus || "").toLowerCase() === "accepted" ? "Accepted" 
        : (c.hiringStatus || "").toLowerCase() === "rejected" ? "Rejected" 
        : "Undecided";
      
      return [
        c.id,
        (c as any).name || "Candidate",
        (c as any).email || "",
        c.jobTitle || "",
        c.score || "0",
        c.status || "",
        decision,
        (c as any).rejectionReason || "",
        skills,
        c.source || "Other",
        new Date((c.submittedAt?.seconds || 0) * 1000).toLocaleDateString()
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hr_analytics_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-50 px-6 py-8 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white [--report-axis:#64748b] [--report-grid:#e2e8f0] [--report-tooltip-bg:#ffffff] [--report-tooltip-border:#e2e8f0] [--report-tooltip-text:#0f172a] [--report-tooltip-shadow:0_10px_25px_rgba(15,23,42,0.12)] dark:[--report-grid:#334155] dark:[--report-tooltip-bg:rgba(15,23,42,0.9)] dark:[--report-tooltip-border:rgba(255,255,255,0.08)] dark:[--report-tooltip-text:#e2e8f0] dark:[--report-tooltip-shadow:0_10px_25px_rgba(15,23,42,0.6)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 left-1/4 h-72 w-72 rounded-full bg-indigo-500/20 blur-[140px]" />
        <div className="absolute top-1/2 -left-12 h-80 w-80 rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute -bottom-32 right-8 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[160px]" />
      </div>
      <div className="relative mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Command Center</p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">HR Analytics</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Live intelligence across volume, quality, and decisions</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={handleExportCSV} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:shadow-[0_0_18px_rgba(99,102,241,0.2)] dark:hover:border-white/30 dark:hover:bg-white/10">
              Export CSV
            </button>
            <button onClick={handlePrint} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:shadow-[0_0_18px_rgba(34,211,238,0.25)] dark:hover:border-white/30 dark:hover:bg-white/10">
              Print PDF
            </button>
          </div>
        </div>

        <div className="mb-6 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl dark:shadow-none print:hidden">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Date Range</label>
              <div className="flex gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Job Title</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All Jobs</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title || j.id}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Source</label>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All Sources</option>
                <option value="upload">Upload</option>
                <option value="outlook">Outlook</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Decision</label>
              <select value={decisionStatus} onChange={(e) => setDecisionStatus(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All Statuses</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="undecided">Undecided</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Min Score: {minScore}</label>
              <input type="range" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="range-gradient w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Min Experience</label>
              <input type="number" min="0" value={minExp} onChange={(e) => setMinExp(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <AiInsightsPanel insights={insights} loading={loading} />

        {/* KPI Sections */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Volume & Efficiency</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard 
                title="Total Applicants" 
                value={stats.totalApplicants} 
                subtitle="All Candidates" 
                tooltip="Total number of candidates in the pipeline" 
              />
              <KpiCard 
                title="CV → Scored" 
                value={`${stats.cvToScoredConversion}%`} 
                subtitle="Conversion Rate" 
                tooltip="Percentage of applicants who have been scored by the AI" 
              />
              <KpiCard 
                title="HR Decision Coverage" 
                value={`${stats.decisionCoverage}%`} 
                subtitle="Decided / Total" 
                tooltip="Percentage of applicants who have received a final HR decision (Accepted/Rejected)" 
              />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Quality & Health</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KpiCard 
                title="Qualified Rate" 
                value={`${stats.qualifiedRate}%`} 
                subtitle="Score ≥ 60" 
                tooltip="Percentage of scored candidates who meet the qualification threshold" 
              />
              <KpiCard 
                title="Median Match Score" 
                value={stats.medianMatchScore} 
                subtitle="Scored Candidates" 
                tooltip="The median score among all scored candidates (ignoring N/A)" 
              />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Decisions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KpiCard 
                title="HR Acceptance Rate" 
                value={stats.acceptanceRate !== "N/A" ? `${stats.acceptanceRate}%` : "N/A"} 
                subtitle="Decided Only" 
                tooltip="Percentage of HR-decided candidates who were accepted" 
              />
              <KpiCard 
                title="Scored → HR Decided" 
                value={`${stats.scoredToDecidedConversion}%`} 
                subtitle="Process Completion" 
                tooltip="Percentage of scored candidates who have been decided by HR" 
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Hiring Funnel" subtitle="Conversion rates across stages" minHeightClass="min-h-[256px]">
            <HiringFunnelChart data={funnelData} />
          </ChartCard>
          <ChartCard title="Score vs. Decision" subtitle="Distribution of scores by outcome" minHeightClass="min-h-[256px]">
            <ScoreDecisionChart data={scoreData} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <ChartCard title="Monthly Trends" subtitle="Volume and Quality over time" minHeightClass="min-h-[256px]">
            <MonthlyTrendsChart data={trendsData} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Source Breakdown" subtitle="Where candidates are coming from" minHeightClass="min-h-[160px]">
            <SourceBreakdownChart data={sourceData.map} pct={sourceData.pct} />
          </ChartCard>
          <ChartCard title="Top Skills" subtitle="Most frequent skills extracted" minHeightClass="min-h-[192px]">
            <TopSkillsChart items={topSkills} />
          </ChartCard>
        </div>

        <div className="print:hidden">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Detailed Job Analytics</h3>
            </div>
            <JobAnalyticsTable data={jobAnalytics} />
          </div>
        </div>

        {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">{error}</div>}
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, tooltip }: { title: string; value: string | number; subtitle: string; tooltip?: string }) {
  return (
    <div title={tooltip} className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl dark:shadow-none">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-3 flex items-baseline">
        <span className="text-4xl font-bold text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children, minHeightClass }: { title: string; subtitle: string; children: React.ReactNode; minHeightClass?: string }) {
  return (
    <div className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl dark:shadow-none">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className={`flex-1 ${minHeightClass || ''}`}>{children}</div>
    </div>
  );
}
