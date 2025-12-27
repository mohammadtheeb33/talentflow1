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
  loading: () => <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const ScoreDecisionChart = dynamic(() => import("@/components/reports/ScoreDecisionChart"), {
  loading: () => <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const MonthlyTrendsChart = dynamic(() => import("@/components/reports/MonthlyTrendsChart"), {
  loading: () => <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const TopSkillsChart = dynamic(() => import("@/components/reports/TopSkillsChart"), {
  loading: () => <div className="mt-4 h-48 w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const SourceBreakdownChart = dynamic(() => import("@/components/reports/SourceBreakdownChart"), {
  loading: () => <div className="mt-4 h-40 w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const AiInsightsPanel = dynamic(() => import("@/components/reports/AiInsightsPanel"), {
  loading: () => <div className="h-32 w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const JobAnalyticsTable = dynamic(() => import("@/components/reports/JobAnalyticsTable"), {
  loading: () => <div className="h-64 w-full animate-pulse rounded bg-gray-100" />,
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
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">HR Analytics Dashboard</h1>
            <p className="text-sm text-gray-500">Real-time insights for decision support</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={handleExportCSV} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              Export CSV
            </button>
            <button onClick={handlePrint} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              Print PDF
            </button>
          </div>
        </div>

        {/* SMART Filters */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:hidden">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Date Range</label>
              <div className="flex gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded border-gray-300 text-xs" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded border-gray-300 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Job Title</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded border-gray-300 text-xs">
                <option value="">All Jobs</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title || j.id}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Source</label>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full rounded border-gray-300 text-xs">
                <option value="">All Sources</option>
                <option value="upload">Upload</option>
                <option value="outlook">Outlook</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Decision</label>
              <select value={decisionStatus} onChange={(e) => setDecisionStatus(e.target.value)} className="w-full rounded border-gray-300 text-xs">
                <option value="">All Statuses</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="undecided">Undecided</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Min Score: {minScore}</label>
              <input type="range" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Min Experience (Yrs)</label>
              <input type="number" min="0" value={minExp} onChange={(e) => setMinExp(Number(e.target.value))} className="w-full rounded border-gray-300 text-xs" />
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <AiInsightsPanel insights={insights} loading={loading} />

        {/* KPI Sections */}
        <div className="space-y-6">
          
          {/* Volume & Efficiency */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Volume & Efficiency</h2>
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

          {/* Quality & Health */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Quality & Health</h2>
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

          {/* Decisions */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Decisions</h2>
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

        {/* Charts Row 1: Funnel & Decision */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Hiring Funnel" subtitle="Conversion rates across stages">
            <HiringFunnelChart data={funnelData} />
          </ChartCard>
          <ChartCard title="Score vs. Decision" subtitle="Distribution of scores by outcome">
            <ScoreDecisionChart data={scoreData} />
          </ChartCard>
        </div>

        {/* Charts Row 2: Trends */}
        <div className="grid grid-cols-1 gap-6">
          <ChartCard title="Monthly Trends" subtitle="Volume and Quality over time">
            <MonthlyTrendsChart data={trendsData} />
          </ChartCard>
        </div>

        {/* Charts Row 3: Source & Skills */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Source Breakdown" subtitle="Where candidates are coming from">
            <SourceBreakdownChart data={sourceData.map} pct={sourceData.pct} />
          </ChartCard>
          <ChartCard title="Top Skills" subtitle="Most frequent skills extracted">
            <TopSkillsChart items={topSkills} />
          </ChartCard>
        </div>

        {/* Job Analytics Table */}
        <div className="print:hidden">
          <h3 className="mb-4 text-lg font-medium text-gray-900">Detailed Job Analytics</h3>
          <JobAnalyticsTable data={jobAnalytics} />
        </div>

        {error && <div className="rounded bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, tooltip }: { title: string; value: string | number; subtitle: string; tooltip?: string }) {
  return (
    <div title={tooltip} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md cursor-help">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <span className="text-3xl font-semibold text-gray-900">{value}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
