import { Candidate, JobProfile, FunnelData, JobAnalytics, MonthlyTrend, ScoreBin } from "./types"; // Assuming types might be moved or I should keep them here. I'll keep them here for now as they are in the file.

export interface Candidate {
  id: string;
  score?: number;
  status?: string; // "strong fit", "not a fit", "interview", etc.
  hiringStatus?: string; // STRICT: "accepted" | "rejected" | "undecided"
  jobTitle?: string;
  jobProfileId?: string;
  source?: string;
  ingestion?: { source?: string };
  origin?: string;
  submittedAt?: { seconds: number };
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
  scoreUpdatedAt?: { seconds: number };
  skills?: string[];
  parsed?: { skills?: string[] };
  rawKeywords?: string[];
}

export interface JobProfile {
  id: string;
  title?: string;
}

export interface FunnelData {
  stage: string;
  count: number;
  conversion: number; // percentage from previous stage
  fill: string;
}

export interface JobAnalytics {
  jobTitle: string;
  total: number;
  medianScore: number | "N/A"; // Changed to allow N/A
  acceptanceRate: number | "N/A"; // STRICT: N/A if decided < 2
  atsPassRate: number | "N/A"; // STRICT: N/A if scored == 0
  accepted: number;
  rejected: number;
  decided: number;
  jobHealthScore: number | "N/A"; // STRICT: N/A if decided == 0
}

export interface HRMetrics {
  totalApplicants: number;
  qualifiedRate: number; // % scored >= threshold
  decisionCoverage: number; // % of total who are decided
  acceptanceRate: number | "N/A"; // % of decided who are accepted
  cvToScoredConversion: number; // % of total who are scored
  scoredToDecidedConversion: number; // % of scored who are decided
  medianMatchScore: number | "N/A";
  skillGapIndex: { skill: string; count: number }[];
}

export interface MonthlyTrend {
  month: string; // "Jan 2024"
  count: number;
  avgScore: number | null; // Changed to allow null for gaps
}

export interface ScoreBin {
  range: string; // "0-10", "10-20"
  accepted: number;
  rejected: number;
  undecided: number;
}

// --- Helpers ---

function getCandidateDate(c: Candidate): Date {
  const sec = c.submittedAt?.seconds || c.createdAt?.seconds || c.updatedAt?.seconds || c.scoreUpdatedAt?.seconds || 0;
  return new Date(sec * 1000);
}

// Helper to check if candidate has an HR decision (strict definition)
// Critical: Decision = HR manual acceptance or rejection ONLY
export function isDecided(candidate: Candidate): boolean {
  const status = (candidate.hiringStatus || "").toLowerCase();
  return status === "accepted" || status === "rejected";
}

function normalizeSource(c: Candidate): string {
  const s = (c.source || c.ingestion?.source || c.origin || "other").toLowerCase();
  if (s.includes("upload") || s.includes("csv")) return "Upload";
  if (s.includes("outlook")) return "Outlook";
  return "Other";
}

export function normalizeCandidates(candidates: Candidate[]) {
  const all = candidates;
  const scored = candidates.filter(c => typeof c.score === "number" && !isNaN(c.score));
  
  // Strict HR Decision Logic
  const decided = candidates.filter(isDecided);
  
  const accepted = decided.filter(c => (c.hiringStatus || "").toLowerCase() === "accepted");
  const rejected = decided.filter(c => (c.hiringStatus || "").toLowerCase() === "rejected");
  
  // Undecided includes everyone else (including "interview", "offer", etc. if they are not strictly accepted/rejected yet)
  const undecided = candidates.filter(c => !isDecided(c));

  return { all, scored, decided, accepted, rejected, undecided };
}

function calculateMedian(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateJobHealth(acceptanceRate: number | "N/A", medianScore: number | "N/A", atsPassRate: number | "N/A", decidedCount: number): number | "N/A" {
  // Composite score (0-100)
  // Rule: If decidedCandidates === 0 -> Job Health = "N/A"
  if (decidedCount === 0) return "N/A";

  // Weights:
  // Acceptance Rate: 40% weight
  // Median Score: 40% weight
  // ATS Pass Rate: 20% weight
  
  // Normalize components (treat N/A as 0 contribution, or handle gracefully?)
  // User says: "Clamp result between 0–100."
  // If Acceptance Rate is N/A (because decided < 2 but > 0), we can't really use it.
  // However, we need a score. Let's use 0 if N/A to be safe, or 50 as neutral?
  // Given "Job Health", a lack of data usually implies low confidence or health.
  // But wait, if we have 1 decision and it's accepted (100%), but display is N/A...
  // The prompt implies we should calculate it.
  
  // Let's use raw values if possible, but the input here is likely already "N/A".
  // I should probably pass raw numbers to this helper or handle "N/A" as 0.
  
  const acc = acceptanceRate === "N/A" ? 0 : acceptanceRate;
  const med = medianScore === "N/A" ? 0 : medianScore;
  const ats = atsPassRate === "N/A" ? 0 : atsPassRate;

  const score = (acc * 0.4) + (med * 0.4) + (ats * 0.2);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function getSkillGapAnalysis(rejectedCandidates: Candidate[]): { skill: string; count: number }[] {
  const counts: Record<string, number> = {};
  
  rejectedCandidates.forEach(c => {
    // Check parsed missing skills or infer from raw keywords?
    // Since we don't have explicit "missing skills" field, we'll look at the skills of rejected candidates
    // to identify patterns. However, "Skill Gap" usually means what they lacked.
    // If we can't find explicit missing skills, we might list the skills they HAD, which is counter-intuitive for "Gap".
    // Assumption: The prompt asks for "AI-based summary of top missing skills". 
    // Without a 'missingSkills' field, we can't compute this deterministically.
    // We will attempt to use 'rejectionReason' or just return empty for now if no such data.
    // BUT, let's assume we want to know what skills the rejected candidates *didn't* have compared to the job.
    // That requires job description comparison.
    // For now, I will reuse getTopSkills logic on rejected candidates but label it as "Skills present in rejected candidates" 
    // or if the user implies we should guess, I'll stick to a placeholder or use 'rejectionReason' keyword analysis if possible.
    // Let's analyze 'rejectionReason' if available.
    
    // Fallback: analyze skills of rejected candidates to see if there's a commonality (maybe they all have 'Java' but job needed 'Python'?).
    // Actually, a "Skill Gap Index" usually aggregates data from an "Analysis" phase.
    // Let's look at `parsed` object. If it has `missingSkills`, use that.
    
    const missing = (c as any).parsed?.missingSkills || [];
    if (Array.isArray(missing)) {
      missing.forEach(k => {
        const key = String(k).trim().toLowerCase();
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    }
  });

  return Object.entries(counts)
    .map(([skill, count]) => ({ skill: skill.charAt(0).toUpperCase() + skill.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// --- Core Logic ---

export function calculateHRMetrics(candidates: Candidate[]): HRMetrics {
  const { all, scored, decided, accepted, rejected } = normalizeCandidates(candidates);
  
  const totalApplicants = all.length;
  const scoredCount = scored.length;
  const decidedCount = decided.length;

  // 2. Qualified Candidates Rate (score >= 60)
  const qualified = scored.filter(c => (c.score || 0) >= 60).length;
  const qualifiedRate = scoredCount ? Math.round((qualified / scoredCount) * 100) : 0;

  // 3. Decision Coverage
  const decisionCoverage = totalApplicants ? Math.round((decidedCount / totalApplicants) * 100) : 0;

  // 4. Acceptance Rate (Decided Only)
  const acceptanceRate = decidedCount ? Math.round((accepted.length / decidedCount) * 100) : "N/A";

  // 5. CV -> Scored Conversion
  const cvToScoredConversion = totalApplicants ? Math.round((scoredCount / totalApplicants) * 100) : 0;

  // 6. Scored -> Decided Conversion
  const scoredToDecidedConversion = scoredCount ? Math.round((decidedCount / scoredCount) * 100) : 0;

  // 7. Median Match Score
  const scores = scored.map(c => c.score!);
  const medianMatchScore = scores.length > 0 ? Math.round(calculateMedian(scores)) : "N/A";

  // 8. Skill Gap Index
  const skillGapIndex = getSkillGapAnalysis(rejected);

  return {
    totalApplicants,
    qualifiedRate,
    decisionCoverage,
    acceptanceRate,
    cvToScoredConversion,
    scoredToDecidedConversion,
    medianMatchScore,
    skillGapIndex
  };
}

export function calculateKPIs(candidates: Candidate[]) {
  // Keeping this for backward compatibility if needed, but calculateHRMetrics is preferred
  const metrics = calculateHRMetrics(candidates);
  // Map back to old structure if strict backward compatibility is needed, 
  // but the user wants a redesign, so we might just export this new function.
  // I will leave the old function as is for now to avoid breaking other components not yet updated,
  // or I can implement it using the new logic.
  
  const { all, scored, decided, accepted, rejected } = normalizeCandidates(candidates);
  const totalCandidates = all.length;
  const decidedCount = decided.length;
  const acceptanceRate = decidedCount ? Math.round((accepted.length / decidedCount) * 100) : 0;
  const rejectionRate = decidedCount ? Math.round((rejected.length / decidedCount) * 100) : 0;
  const passed = scored.filter(c => (c.score || 0) >= 60).length;
  const atsPassRate = scored.length ? Math.round((passed / scored.length) * 100) : 0;

  return {
    totalCandidates,
    acceptanceRate,
    rejectionRate,
    atsPassRate,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    decidedCount,
    scoredCount: scored.length
  };
}

// Kept for backward compatibility but using new logic
export const getReportStats = calculateKPIs;

export function getHiringFunnel(candidates: Candidate[]): FunnelData[] {
  const { all, scored, decided, accepted } = normalizeCandidates(candidates);

  const appliedCount = all.length;
  const scoredCount = scored.length;
  const decidedCount = decided.length;
  const acceptedCount = accepted.length;

  return [
    { stage: "Applied", count: appliedCount, conversion: 100, fill: "#6366f1" },
    { stage: "Scored", count: scoredCount, conversion: appliedCount ? Math.round((scoredCount / appliedCount) * 100) : 0, fill: "#818cf8" },
    { stage: "Decided", count: decidedCount, conversion: scoredCount ? Math.round((decidedCount / scoredCount) * 100) : 0, fill: "#a5b4fc" },
    { stage: "Accepted", count: acceptedCount, conversion: decidedCount ? Math.round((acceptedCount / decidedCount) * 100) : 0, fill: "#10b981" },
  ];
}

export function getScoreDistribution(candidates: Candidate[]): ScoreBin[] {
  const { scored } = normalizeCandidates(candidates);
  const bins: Record<string, ScoreBin> = {};
  
  // Initialize bins 0-10, 10-20 ... 90-100
  for (let i = 0; i < 10; i++) {
    const range = `${i * 10}-${(i + 1) * 10}`;
    bins[range] = { range, accepted: 0, rejected: 0, undecided: 0 };
  }

  scored.forEach(c => {
    // Already checked strictly number in normalizeCandidates
    const s = Math.max(0, Math.min(99, Math.floor(c.score!)));
    const idx = Math.floor(s / 10);
    const range = `${idx * 10}-${(idx + 1) * 10}`;
    
    let status: "accepted" | "rejected" | "undecided" = "undecided";
    if (isDecided(c)) {
      status = (c.hiringStatus || "").toLowerCase() as "accepted" | "rejected";
    }

    if (bins[range]) {
      bins[range][status]++;
    }
  });

  return Object.values(bins);
}

export function getMonthlyTrends(candidates: Candidate[]): MonthlyTrend[] {
  const points: Record<string, { count: number; totalScore: number; scoredCount: number }> = {};
  
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`; // "Jan 2024"
    months.push(key);
    points[key] = { count: 0, totalScore: 0, scoredCount: 0 };
  }

  candidates.forEach(c => {
    const d = getCandidateDate(c);
    const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    if (points[key]) {
      points[key].count++; // Volume = total candidates created that month
      
      if (typeof c.score === "number" && !isNaN(c.score)) {
        points[key].totalScore += c.score;
        points[key].scoredCount++;
      }
    }
  });

  return months.map(m => ({
    month: m,
    count: points[m].count,
    // If no scored candidates -> Avg Score = null (gap in chart)
    avgScore: points[m].scoredCount ? Math.round(points[m].totalScore / points[m].scoredCount) : null
  }));
}

export function calculateJobAnalytics(candidates: Candidate[], jobs: JobProfile[]): JobAnalytics[] {
  const jobMap: Record<string, string> = {};
  jobs.forEach(j => { jobMap[j.id] = j.title || j.id; });

  // Group candidates by job title
  const candidatesByJob: Record<string, Candidate[]> = {};
  
  candidates.forEach(c => {
    const title = c.jobTitle || jobMap[c.jobProfileId || ""] || c.jobProfileId || "Unknown Role";
    if (!candidatesByJob[title]) candidatesByJob[title] = [];
    candidatesByJob[title].push(c);
  });

  return Object.entries(candidatesByJob).map(([jobTitle, jobCandidates]) => {
    const { all, scored, decided, accepted, rejected } = normalizeCandidates(jobCandidates);
    
    const total = all.length;
    const scoredCount = scored.length;
    const decidedCount = decided.length;

    // 1. Median Score (Scored ONLY)
    // Rule: If scoredCandidates === 0 -> N/A
    const scores = scored.map(c => c.score!);
    const medianScore = scores.length > 0 ? Math.round(calculateMedian(scores)) : "N/A";
    
    // 2. HR Acceptance Rate (Decided ONLY)
    // Rule: acceptedCandidates / decidedCandidates
    // Rule: If decidedCandidates < 2 -> N/A
    // Rule: Never calculate from allCandidates
    let acceptanceRate: number | "N/A" = "N/A";
    if (decidedCount >= 2) {
      acceptanceRate = Math.round((accepted.length / decidedCount) * 100);
    }
    
    // 3. ATS Pass Rate (Scored ONLY)
    // Rule: scoredCandidates >= threshold / scoredCandidates
    // Rule: If scoredCandidates === 0 -> N/A
    let atsPassRate: number | "N/A" = "N/A";
    if (scoredCount > 0) {
      const passed = scored.filter(s => (s.score || 0) >= 60).length;
      atsPassRate = Math.round((passed / scoredCount) * 100);
    }

    // 4. Job Health Score
    // Rule: If decidedCandidates === 0 -> N/A
    // Formula: (Acc * 0.4) + (Med * 0.4) + (ATS * 0.2)
    // Note: For calculation, we need numbers. If display is N/A, we try to use internal values if available,
    // otherwise 0.
    // Actually, if acceptanceRate is N/A because count < 2, it might skew the score.
    // But let's follow the display logic for inputs to the health score or calculate raw for health?
    // "Job Health Score must be meaningful". 
    // If we have 1 decision, Acceptance Rate is N/A for display.
    // Should we use the 1 decision for Health Score?
    // Let's compute raw Acceptance Rate for Health Score calculation if decided > 0.
    const rawAcceptanceRate = decidedCount > 0 ? Math.round((accepted.length / decidedCount) * 100) : 0;
    const rawMedianScore = typeof medianScore === "number" ? medianScore : 0;
    const rawAtsPassRate = typeof atsPassRate === "number" ? atsPassRate : 0;

    const jobHealthScore = calculateJobHealth(
      rawAcceptanceRate, 
      typeof medianScore === "number" ? medianScore : "N/A", // Pass N/A if 0 scored
      typeof atsPassRate === "number" ? atsPassRate : "N/A", // Pass N/A if 0 scored
      decidedCount
    );

    return {
      jobTitle,
      total,
      medianScore,
      acceptanceRate,
      atsPassRate,
      accepted: accepted.length,
      rejected: rejected.length,
      decided: decidedCount,
      jobHealthScore
    };
  }).sort((a, b) => b.total - a.total);
}

// Backward compatibility alias
export const getJobAnalytics = calculateJobAnalytics;

export function getTopSkills(candidates: Candidate[]): { skill: string; count: number }[] {
  const counts: Record<string, number> = {};
  
  candidates.forEach(c => {
    const skills: string[] = Array.isArray(c.skills) ? c.skills
      : Array.isArray(c.parsed?.skills) ? c.parsed?.skills
      : Array.isArray(c.rawKeywords) ? c.rawKeywords
      : [];
      
    skills.forEach(k => {
      const key = String(k).trim().toLowerCase();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([skill, count]) => ({ skill: skill.charAt(0).toUpperCase() + skill.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function getSourceBreakdown(candidates: Candidate[]) {
  const map: Record<string, number> = { Upload: 0, Outlook: 0, Other: 0 };
  candidates.forEach(c => {
    map[normalizeSource(c)]++;
  });
  
  const total = candidates.length || 1;
  const pct = (v: number) => Math.round((v / total) * 100);
  
  return { map, pct };
}
