import { ParsedCvResult } from "./parsedCv";

export type EducationLevel = "none" | "high_school" | "associate" | "bachelor" | "master" | "phd";

export interface JobProfile {
  title?: string; // job title for relevance matching
  requiredSkills: string[];
  optionalSkills: string[];
  minYearsExp: number; // minimum total years of experience
  educationLevel: EducationLevel; // minimum education requirement
  weights?: { 
    roleFit: number; 
    skillsQuality: number; 
    experienceQuality: number; 
    projectsImpact: number; 
    languageClarity: number; 
    atsFormat: number; 
  };
}

export interface DetailedScoreBreakdown {
  roleFit: { score: number; keywordMatch: number; seniorityMatch: number };
  skillsQuality: { score: number; coverage: number; depth: number; recency: number };
  experienceQuality: { score: number; relevance: number; duration: number; consistency: number };
  projectsImpact: { score: number; presence: number; details: number; results: number };
  languageClarity: { score: number; grammar: number; clarity: number };
  atsFormat: { score: number; sections: number; readability: number; layout: number };
}

export interface RiskFlag {
  type: "gap" | "job_hopping" | "missing_contact" | "missing_education" | "missing_skills" | "formatting" | "other";
  severity: "low" | "medium" | "high";
  message: string;
}

export interface ScoreResult {
  score: number; // 0-100
  breakdown: DetailedScoreBreakdown;
  riskFlags: RiskFlag[];
  reasons: string[];
  inferredSkills: string[];
  matchedSkills: { skill: string; score: number; source: "parsed" | "inferred" }[];
  normalizedWeights: { 
    roleFit: number; 
    skillsQuality: number; 
    experienceQuality: number; 
    projectsImpact: number; 
    languageClarity: number; 
    atsFormat: number; 
  };
  experienceYears: number; // computed total years
  relevantExperienceYears: number; // computed relevant years based on job profile
  educationDetected: EducationLevel;
}

// ---------- text utils ----------
function normalizeText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-") // en dash/em dash to hyphen
    // Allow Unicode letters/numbers, plus common skill chars (+ . # -)
    .replace(/[^\p{L}\p{N}+.#\-\s]/gu, " ") 
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  return t.split(/\s+/).filter(Boolean);
}

// Levenshtein distance (classic DP)
export function levenshtein(a: string, b: string): number {
  const s = normalizeText(a);
  const t = normalizeText(b);
  const m = s.length, n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + cost // substitution
      );
      prev = temp;
    }
  }
  return dp[n];
}

export function levenshteinSimilarity(a: string, b: string): number {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(normalizeText(a).length, normalizeText(b).length) || 1;
  return 1 - dist / maxLen; // 0..1
}

export function tokenOverlapSimilarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter || 1;
  return inter / union; // Jaccard 0..1
}

export function fuzzyMatchScore(candidate: string, target: string): number {
  // Blend token overlap and levenshtein; emphasize tokens for multi-word skills
  const tok = tokenOverlapSimilarity(candidate, target);
  const lev = levenshteinSimilarity(candidate, target);
  const isMulti = tokenize(target).length > 1 || /[+.-]/.test(target);
  const wTok = isMulti ? 0.6 : 0.5;
  const wLev = 1 - wTok;
  return Math.max(0, Math.min(1, wTok * tok + wLev * lev));
}

// ---------- skills inference ----------
export function inferSkillsFromText(fullText: string, jobSkills: string[]): string[] {
  const textNorm = normalizeText(fullText);
  const inferred: string[] = [];
  for (const skill of jobSkills) {
    const sNorm = normalizeText(skill);
    if (!sNorm) continue;
    // Exact or near-exact presence
    if (textNorm.includes(sNorm)) {
      inferred.push(skill);
      continue;
    }
    // Fuzzy window checks: look for token overlaps around occurrences of first token
    const firstToken = tokenize(sNorm)[0];
    if (!firstToken) continue;
    const idx = textNorm.indexOf(firstToken);
    if (idx >= 0) {
      const win = textNorm.slice(Math.max(0, idx - 40), idx + 40);
      const score = fuzzyMatchScore(win, sNorm);
      if (score >= 0.72) inferred.push(skill);
    } else {
      // global fuzzy when first token not found
      const score = fuzzyMatchScore(textNorm.slice(0, 2000), sNorm);
      if (score >= 0.78) inferred.push(skill);
    }
  }
  return Array.from(new Set(inferred));
}

// ---------- experience extraction ----------
const MONTHS = [
  "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec",
  "january","february","march","april","june","july","august","september","october","november","december",
  // Arabic months (standard)
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  // Arabic months (Levantine)
  "كانون", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين"
];

function parseDateToken(monthStr?: string, yearStr?: string): Date | null {
  const now = new Date();
  const y = yearStr && /\d{4}/.test(yearStr) ? Number(yearStr) : now.getFullYear();
  if (monthStr && MONTHS.includes(monthStr.toLowerCase())) {
    const short = monthStr.slice(0,3).toLowerCase();
    const mi = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(short);
    return new Date(y, mi >= 0 ? mi : 0, 1);
  }
  if (monthStr) {
    const s = monthStr.toLowerCase();
    // English mapping
    const enIdx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(s.slice(0,3));
    if (enIdx >= 0) return new Date(y, enIdx, 1);
    
    // Arabic simple mapping check (naive)
    if (s.includes("يناير") || s.includes("كانون الثاني")) return new Date(y, 0, 1);
    if (s.includes("فبراير") || s.includes("شباط")) return new Date(y, 1, 1);
    if (s.includes("مارس") || s.includes("آذار")) return new Date(y, 2, 1);
    if (s.includes("أبريل") || s.includes("نيسان")) return new Date(y, 3, 1);
    if (s.includes("مايو") || s.includes("أيار")) return new Date(y, 4, 1);
    if (s.includes("يونيو") || s.includes("حزيران")) return new Date(y, 5, 1);
    if (s.includes("يوليو") || s.includes("تموز")) return new Date(y, 6, 1);
    if (s.includes("أغسطس") || s.includes("آب")) return new Date(y, 7, 1);
    if (s.includes("سبتمبر") || s.includes("أيلول")) return new Date(y, 8, 1);
    if (s.includes("أكتوبر") || s.includes("تشرين الأول") || s === "تشرين") return new Date(y, 9, 1); // ambiguous 'tishrin' usually implies first if not specified
    if (s.includes("نوفمبر") || s.includes("تشرين الثاني")) return new Date(y, 10, 1);
    if (s.includes("ديسمبر") || s.includes("كانون الأول")) return new Date(y, 11, 1);
  }
  return new Date(y, 0, 1);
}

function parseDateString(d: string | null): Date | null {
  if (!d) return null;
  // Handle "Present" or "Current" case loosely, though usually handled by caller
  if (/present|current|now|اليوم|الآن|الحالي/i.test(d)) return new Date();
  
  // Try YYYY-MM
  if (/^\d{4}[-/]\d{1,2}/.test(d)) {
    const parts = d.split(/[-/]/);
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    return new Date(y, m, 1);
  }
  
  // Try Month YYYY or Mon YYYY
  const parts = d.split(/[\s,]+/);
  if (parts.length >= 2) {
    const y = parseInt(parts.find(p => /\d{4}/.test(p)) || "");
    const mStr = parts.find(p => /[a-zA-Z]+/.test(p));
    if (y && mStr) {
       const mi = MONTHS.indexOf(mStr.toLowerCase());
       if (mi >= 0) {
         // MONTHS array has 0-11 for jan-dec, but repeats full names. 
         const m = mi % 12; 
         return new Date(y, m, 1);
       }
    }
  }

  // Fallback: try YYYY
  const y = parseInt(d);
  if (!isNaN(y) && y > 1900 && y < 2100) return new Date(y, 0, 1);
  
  return null;
}

function mergeIntervals(intervals: {start: number, end: number}[]): {start: number, end: number}[] {
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a.start - b.start);
  const merged: {start: number, end: number}[] = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const curr = intervals[i];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

export function computeRelevantExperienceYears(parsed: ParsedCvResult, job: JobProfile): number {
  if (!parsed.structuredExperience || parsed.structuredExperience.length === 0) {
    return 0; 
  }

  const jobTitleNorm = normalizeText(job.title || "");
  const jobSkills = new Set([...(job.requiredSkills || []), ...(job.optionalSkills || [])].map(normalizeText));
  
  const intervals: {start: number, end: number}[] = [];

  for (const item of parsed.structuredExperience) {
    let isRelevant = false;
    const roleNorm = normalizeText(item.role);
    const descNorm = normalizeText(item.description);

    // 1. Title match (fuzzy match score > 0.6)
    if (jobTitleNorm && roleNorm) {
       const score = fuzzyMatchScore(roleNorm, jobTitleNorm);
       if (score > 0.6) isRelevant = true;
       // Also check for partial inclusion of significant words
       else {
         const roleToks = tokenize(roleNorm);
         const titleToks = tokenize(jobTitleNorm).filter(t => t.length > 3);
         const overlap = titleToks.filter(t => roleToks.some(r => r.includes(t) || t.includes(r)));
         if (overlap.length >= 1 && titleToks.length <= 2) isRelevant = true; // e.g. "Software" in "Software Engineer"
         else if (overlap.length >= 2) isRelevant = true;
       }
    }

    // 2. Skills match in description or role
    if (!isRelevant && jobSkills.size > 0) {
        let skillMatches = 0;
        for (const s of jobSkills) {
            // Check for skill presence (whole word or fuzzy)
            if (roleNorm.includes(s) || descNorm.includes(s)) {
              skillMatches++;
            } else {
              // Try fuzzy for longer skills
              if (s.length > 4 && (fuzzyMatchScore(roleNorm, s) > 0.8 || fuzzyMatchScore(descNorm, s) > 0.8)) {
                skillMatches++;
              }
            }
        }
        // If the role matches at least 2 required skills, or 1 if it's a short job description
        if (skillMatches >= 2) isRelevant = true;
        else if (skillMatches >= 1 && jobSkills.size <= 3) isRelevant = true;
    }

    if (isRelevant) {
      const start = parseDateString(item.startDate);
      const end = item.isCurrent ? new Date() : parseDateString(item.endDate);
      
      if (start && end && end.getTime() > start.getTime()) {
        intervals.push({ start: start.getTime(), end: end.getTime() });
      }
    }
    
    if (intervals.length > 0) {
      const merged = mergeIntervals(intervals);
      let totalMs = 0;
      for (const int of merged) {
        totalMs += int.end - int.start;
      }
      const years = Math.max(0, Math.min(50, totalMs / (1000 * 60 * 60 * 24 * 365.25)));
      return Number(years.toFixed(2));
    }
  }
  return 0;
}

export function computeExperienceYears(parsed: ParsedCvResult): number {
  if (typeof parsed.totalExperienceYears === 'number' && parsed.totalExperienceYears > 0) {
    return parsed.totalExperienceYears;
  }

  // Use structured experience if available
  if (parsed.structuredExperience && parsed.structuredExperience.length > 0) {
    const intervals: {start: number, end: number}[] = [];
    
    for (const item of parsed.structuredExperience) {
      const start = parseDateString(item.startDate);
      const end = item.isCurrent ? new Date() : parseDateString(item.endDate);
      
      if (start && end && end.getTime() > start.getTime()) {
        intervals.push({ start: start.getTime(), end: end.getTime() });
      }
    }
    
    if (intervals.length > 0) {
      const merged = mergeIntervals(intervals);
      let totalMs = 0;
      for (const int of merged) {
        totalMs += int.end - int.start;
      }
      const years = Math.max(0, Math.min(50, totalMs / (1000 * 60 * 60 * 24 * 365.25)));
      return Number(years.toFixed(2));
    }
  }

  const now = new Date();
  let totalMs = 0;
  const lines = [
    ...(parsed.experience || []),
    normalizeText(parsed.fullText)
  ];
  const rangeRegex = new RegExp(
    String.raw`((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\s*(\d{4}))\s*(?:-|to|–|—|until|through|\s+to\s+)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\s*(\d{4}|present|current))`,
    "i"
  );
  const singleYearRegex = /(\d{4})/g;

  for (const raw of lines) {
    const text = typeof raw === "string" ? raw : String(raw || "");
    const r = rangeRegex.exec(text);
    if (r) {
      const [_, startTok, startYear, endTok, endYearStr] = r;
      const startMonth = startTok?.split(" ")[0];
      const endMonth = endTok?.split(" ")[0];
      const start = parseDateToken(startMonth, startYear);
      const end = (endYearStr && /present|current/i.test(endYearStr))
        ? now
        : parseDateToken(endMonth, endYearStr);
      if (start && end && end > start) totalMs += end.getTime() - start.getTime();
      continue;
    }
    // fallback
    const years = Array.from(text.matchAll(singleYearRegex)).map(x => Number(x[1])).filter(y => y >= 1970 && y <= 2100);
    if (years.length >= 2) {
      const start = new Date(Math.min(...years), 0, 1);
      const endYear = Math.max(...years);
      const end = new Date(endYear, 0, 1);
      if (end > start) totalMs += end.getTime() - start.getTime();
    }
  }
  const years = Math.max(0, Math.min(50, totalMs / (1000 * 60 * 60 * 24 * 365.25)));
  return Number(years.toFixed(2));
}

// ---------- education detection ----------
const EDU_ORDER: EducationLevel[] = ["none","high_school","associate","bachelor","master","phd"];
export function detectEducationLevel(parsed: ParsedCvResult): EducationLevel {
  const text = normalizeText(parsed.fullText + " " + (parsed.education || []).join(" "));
  if (/phd|doctorate|dr\.?\s|doctoral|دكتوراه/i.test(text)) return "phd";
  if (/master|msc|m\.sc|mtech|m\.tech|ma\b|m\.a|mba|ماجستير/i.test(text)) return "master";
  if (/bachelor|bsc|b\.sc|btech|b\.tech|ba\b|b\.a|bs\b|b\.s|بكالوريوس/i.test(text)) return "bachelor";
  if (/associate|diploma|community college|دبلوم|معهد/i.test(text)) return "associate";
  if (/high\s*school|secondary\s*school|ged|ثانوية|ثانوي/i.test(text)) return "high_school";
  return "none";
}

// ---------- Detailed Scoring Functions ----------

// 1. Role Fit: Keywords & Seniority
function calculateRoleFit(
  matchedSkills: { skill: string; score: number }[],
  jobReq: string[],
  relevantYears: number,
  minYears: number
): { score: number; keywordMatch: number; seniorityMatch: number } {
  // Skill match percentage
  const totalReq = jobReq.length || 1;
  const matchedCount = matchedSkills.filter(m => m.score > 70).length; // Consider matches > 70% as good
  const skillMatchRatio = Math.min(1, matchedCount / totalReq);
  
  // Experience match
  const expRatio = minYears > 0 ? Math.min(1, relevantYears / minYears) : 1;
  
  // Weights: 50% Keywords, 50% Seniority (to sum to 100)
  const keywordMatch = Math.round(skillMatchRatio * 50);
  const seniorityMatch = Math.round(expRatio * 50);
  
  return {
    score: keywordMatch + seniorityMatch,
    keywordMatch,
    seniorityMatch
  };
}

// 2. Skills Quality: Coverage, Depth, Recency
function calculateSkillsQuality(
  parsed: ParsedCvResult,
  matchedSkills: { skill: string; score: number }[],
  jobReq: string[]
): { score: number; coverage: number; depth: number; recency: number } {
  if (jobReq.length === 0) return { score: 100, coverage: 40, depth: 30, recency: 30 };
  
  // Coverage: how many required skills are present
  const coverageRatio = matchedSkills.length / jobReq.length;

  // Depth: mentioned in structured experience?
  let depthPoints = 0;
  if (parsed.structuredExperience) {
    for (const skill of matchedSkills) {
      const sNorm = normalizeText(skill.skill);
      const inExp = parsed.structuredExperience.some(e => 
        normalizeText(e.description).includes(sNorm) || normalizeText(e.role).includes(sNorm)
      );
      if (inExp) depthPoints++;
    }
  }
  const depthRatio = matchedSkills.length > 0 ? depthPoints / matchedSkills.length : 0;

  // Recency: mentioned in most recent role?
  let recencyRatio = 0;
  if (parsed.structuredExperience && parsed.structuredExperience.length > 0) {
    const recent = parsed.structuredExperience[0]; 
    const recentText = normalizeText(recent.description + " " + recent.role);
    const recentMatches = matchedSkills.filter(s => recentText.includes(normalizeText(s.skill))).length;
    recencyRatio = matchedSkills.length > 0 ? recentMatches / matchedSkills.length : 0;
  }

  // Weight: 40% coverage, 30% depth, 30% recency
  const coverage = Math.round(coverageRatio * 40);
  const depth = Math.round(depthRatio * 30);
  const recency = Math.round(recencyRatio * 30);

  return {
    score: coverage + depth + recency,
    coverage,
    depth,
    recency
  };
}

// 3. Experience Quality: Relevance, Duration, Consistency
function calculateExperienceQuality(
  parsed: ParsedCvResult,
  relevantYears: number,
  totalYears: number,
  minYears: number
): { score: number; relevance: number; duration: number; consistency: number } {
  // Relevance
  const relevanceRatio = totalYears > 0 ? Math.min(1, relevantYears / totalYears) : 0;
  
  // Duration vs Requirement
  const durationRatio = minYears > 0 ? Math.min(1.2, relevantYears / minYears) : 1; 
  
  // Consistency (gaps)
  let consistencyRatio = 1;
  if (parsed.structuredExperience && parsed.structuredExperience.length > 1) {
    // Check for gaps > 6 months
    const intervals: {start: number, end: number}[] = [];
    for (const item of parsed.structuredExperience) {
      const start = parseDateString(item.startDate);
      const end = item.isCurrent ? new Date() : parseDateString(item.endDate);
      if (start && end) intervals.push({ start: start.getTime(), end: end.getTime() });
    }
    intervals.sort((a, b) => a.start - b.start);
    for (let i = 0; i < intervals.length - 1; i++) {
      const gap = intervals[i+1].start - intervals[i].end;
      if (gap > 180 * 24 * 60 * 60 * 1000) { // ~6 months
        consistencyRatio -= 0.1;
      }
    }
  }
  consistencyRatio = Math.max(0, consistencyRatio);

  // Weight: 50% relevance, 30% duration, 20% consistency
  const relevance = Math.round(relevanceRatio * 50);
  const duration = Math.round((durationRatio > 1 ? 1 : durationRatio) * 30);
  const consistency = Math.round(consistencyRatio * 20);

  return {
    score: relevance + duration + consistency,
    relevance,
    duration,
    consistency
  };
}

// 4. Projects Impact: Presence, Detail, Quantifiable Results
function calculateProjectsImpact(parsed: ParsedCvResult): { score: number; presence: number; details: number; results: number } {
  let presence = 0;
  let details = 0;
  let results = 0;
  
  if (parsed.structuredExperience && parsed.structuredExperience.length > 0) {
    presence = 30; // Base points for having experience listed
    
    let hasNumbers = false;
    let hasDetail = false;
    
    const numberRegex = /\d+%|\$\d+|\d+x/i; // percentages, money, multipliers
    
    for (const item of parsed.structuredExperience) {
      if (item.description && item.description.length > 50) hasDetail = true;
      if (numberRegex.test(item.description)) hasNumbers = true;
    }
    
    if (hasDetail) details = 40;
    if (hasNumbers) results = 30;
  } else if (parsed.experience && parsed.experience.length > 0) {
    presence = 20; // unstructured experience
  }
  
  return {
    score: presence + details + results,
    presence,
    details,
    results
  };
}

// 5. Language Clarity: Grammar proxy, structure
function calculateLanguageClarity(parsed: ParsedCvResult): { score: number; grammar: number; clarity: number } {
  // Proxy: use of bullet points, sentence length, capitalization
  let grammar = 40; 
  let clarity = 60;
  
  const text = parsed.fullText || "";
  if (text.length < 200) {
    grammar -= 10;
    clarity -= 20;
  }
  
  // Check for ALL CAPS chunks (shouting)
  const caps = text.match(/[A-Z\s]{20,}/g);
  if (caps && caps.length > 2) {
    clarity -= 10;
  }
  
  // Check for bullet points in raw text
  if (!/[•\-\*]\s/.test(text)) {
    clarity -= 10;
  }

  grammar = Math.max(0, grammar);
  clarity = Math.max(0, clarity);
  
  return {
    score: grammar + clarity,
    grammar,
    clarity
  };
}

// 6. ATS Format: Readability, Sections
function calculateAtsFormat(parsed: ParsedCvResult): { score: number; sections: number; readability: number; layout: number } {
  let sections = 0;
  let readability = 0;
  let layout = 0;
  
  const hasName = !!parsed.name;
  const hasEmail = !!parsed.email;
  const hasPhone = !!parsed.phone;
  const hasSummary = !!parsed.summary;
  const hasSkills = parsed.skills && parsed.skills.length > 0;
  const hasExp = (parsed.structuredExperience && parsed.structuredExperience.length > 0) || (parsed.experience && parsed.experience.length > 0);
  const hasEdu = (parsed.education && parsed.education.length > 0);
  
  // Sections (max 40)
  if (hasName) sections += 5;
  if (hasEmail) sections += 5;
  if (hasPhone) sections += 5;
  if (hasSummary) sections += 5;
  if (hasSkills) sections += 10;
  if (hasExp) sections += 5;
  if (hasEdu) sections += 5;
  
  // Readability (max 30) - naive check
  readability = 30; 
  if (!parsed.email && !parsed.phone) readability -= 10;
  
  // Layout (max 30) - placeholder
  layout = 30;

  return {
    score: sections + readability + layout,
    sections,
    readability,
    layout
  };
}

// 7. Risk Flags
function detectRiskFlags(
  parsed: ParsedCvResult, 
  job: JobProfile, 
  relevantYears: number, 
  educationDetected: EducationLevel
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  
  // Employment Gaps
  if (parsed.structuredExperience) {
    const intervals: {start: number, end: number}[] = [];
    for (const item of parsed.structuredExperience) {
      const start = parseDateString(item.startDate);
      const end = item.isCurrent ? new Date() : parseDateString(item.endDate);
      if (start && end) intervals.push({ start: start.getTime(), end: end.getTime() });
    }
    intervals.sort((a, b) => a.start - b.start);
    for (let i = 0; i < intervals.length - 1; i++) {
      const gapDays = (intervals[i+1].start - intervals[i].end) / (1000 * 60 * 60 * 24);
      if (gapDays > 180) {
        flags.push({
          type: "gap",
          severity: gapDays > 365 ? "high" : "medium",
          message: `Employment gap of ${Math.round(gapDays/30)} months detected.`
        });
      }
    }
  }

  // Job Hopping: Average tenure < 1 year
  if (parsed.structuredExperience && parsed.structuredExperience.length > 2) {
    let totalMonths = 0;
    for (const item of parsed.structuredExperience) {
       const start = parseDateString(item.startDate);
       const end = item.isCurrent ? new Date() : parseDateString(item.endDate);
       if (start && end) {
         totalMonths += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
       }
    }
    const avgTenure = totalMonths / parsed.structuredExperience.length;
    if (avgTenure < 12) {
      flags.push({
        type: "job_hopping",
        severity: "medium",
        message: "Average tenure is less than 1 year, indicating potential job hopping."
      });
    }
  }

  // Missing Contact Info
  if (!parsed.email && !parsed.phone) {
    flags.push({
      type: "missing_contact",
      severity: "high",
      message: "No email or phone number found."
    });
  }

  // Education Mismatch
  const eduOrder = EDU_ORDER.indexOf(educationDetected);
  const reqOrder = EDU_ORDER.indexOf(job.educationLevel);
  if (eduOrder < reqOrder) {
    flags.push({
      type: "missing_education",
      severity: "medium",
      message: `Education level (${educationDetected}) is below required (${job.educationLevel}).`
    });
  }

  return flags;
}

// ---------- Main Scoring Function ----------
export function scoreCv(parsed: ParsedCvResult, job: JobProfile): ScoreResult {
  const defaultWeights = { 
    roleFit: 0.3, 
    skillsQuality: 0.25, 
    experienceQuality: 0.2, 
    projectsImpact: 0.1, 
    languageClarity: 0.05, 
    atsFormat: 0.1 
  };
  const weights = { ...defaultWeights, ...job.weights };
  
  // Normalization of weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const normW = {
    roleFit: weights.roleFit / totalWeight,
    skillsQuality: weights.skillsQuality / totalWeight,
    experienceQuality: weights.experienceQuality / totalWeight,
    projectsImpact: weights.projectsImpact / totalWeight,
    languageClarity: weights.languageClarity / totalWeight,
    atsFormat: weights.atsFormat / totalWeight
  };

  const parsedSkills = (parsed.skills || []).map(normalizeText);
  const jobReq = (job.requiredSkills || []).map(normalizeText).filter(Boolean);
  const jobOpt = (job.optionalSkills || []).map(normalizeText).filter(Boolean);
  const allJobSkills = [...jobReq, ...jobOpt];

  // Inferred Skills
  const inferred = inferSkillsFromText(parsed.fullText || "", allJobSkills);
  
  // Skill Matching
  const matchedSkills: { skill: string; score: number; source: "parsed" | "inferred" }[] = [];
  const reasons: string[] = [];
  
  for (const req of allJobSkills) {
    let best = 0;
    let bestSrc: "parsed" | "inferred" = "parsed";
    for (const s of parsedSkills) {
      const m = fuzzyMatchScore(s, req);
      if (m > best) { best = m; bestSrc = "parsed"; }
    }
    for (const inf of inferred.map(normalizeText)) {
      const m = fuzzyMatchScore(inf, req);
      if (m > best) { best = m; bestSrc = "inferred"; }
    }
    if (best > 0.6) {
      matchedSkills.push({ skill: req, score: Math.round(best * 100), source: bestSrc });
    }
  }

  // Calculate Sub-Scores
  const totalYears = computeExperienceYears(parsed);
  const relevantYears = computeRelevantExperienceYears(parsed, job);
  const educationDetected = detectEducationLevel(parsed);

  const roleFit = calculateRoleFit(matchedSkills, jobReq, relevantYears, job.minYearsExp);
  const skillsQuality = calculateSkillsQuality(parsed, matchedSkills, jobReq);
  const experienceQuality = calculateExperienceQuality(parsed, relevantYears, totalYears, job.minYearsExp);
  const projectsImpact = calculateProjectsImpact(parsed);
  const languageClarity = calculateLanguageClarity(parsed);
  const atsFormat = calculateAtsFormat(parsed);

  const breakdown: DetailedScoreBreakdown = {
    roleFit,
    skillsQuality,
    experienceQuality,
    projectsImpact,
    languageClarity,
    atsFormat
  };

  const finalScore = Math.round(
    normW.roleFit * roleFit.score +
    normW.skillsQuality * skillsQuality.score +
    normW.experienceQuality * experienceQuality.score +
    normW.projectsImpact * projectsImpact.score +
    normW.languageClarity * languageClarity.score +
    normW.atsFormat * atsFormat.score
  );

  const riskFlags = detectRiskFlags(parsed, job, relevantYears, educationDetected);

  return {
    score: finalScore,
    breakdown,
    riskFlags,
    reasons, // Can populate more if needed
    inferredSkills: inferred,
    matchedSkills,
    normalizedWeights: normW,
    experienceYears: totalYears,
    relevantExperienceYears: relevantYears,
    educationDetected
  };
}

export default scoreCv;
