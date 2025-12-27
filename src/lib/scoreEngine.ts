import { ParsedCvResult, ExperienceItem } from "./parsedCv";

// ------------------------------------------------------------------
// 1. Interfaces & Types
// ------------------------------------------------------------------

export type EducationLevel = "none" | "high_school" | "associate" | "bachelor" | "master" | "phd";

export interface JobProfile {
  title?: string;
  description?: string;
  requiredSkills: string[];
  optionalSkills: string[];
  minYearsExp: number;
  educationLevel: EducationLevel | string;
}

export interface RiskFlag {
  message: string;
  severity: "low" | "medium" | "high";
  type: string;
}

export interface DetailedScoreBreakdown {
  roleFit: { score: number; keywordMatch: number; seniorityMatch: number };
  skillsQuality: { score: number; coverage: number; depth: number; recency: number };
  experienceQuality: { score: number; relevance: number; duration: number; consistency: number };
  projectsImpact: { score: number; presence: number; details: number; results: number };
  atsFormat: { score: number; sections: number; readability: number; layout: number };
  languageClarity: { score: number; grammar: number; clarity: number };
}

// Re-export the result types so the UI doesn't break immediately
export interface ScoreBreakdown {
  roleFit: number;
  skillsQuality: number;
  experienceQuality: number;
  projectsImpact: number;
  atsFormat: number;
  languageClarity: number;
}

export interface RiskAnalysis {
  jobHopping: boolean;
  employmentGaps: boolean;
  skillDecay: boolean;
  missingContact: boolean;
  flags: string[];
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  detailedBreakdown: DetailedScoreBreakdown;
  riskAnalysis: RiskAnalysis;
  riskFlags: RiskFlag[];
  matchedSkills: { skill: string; score: number; reason: string }[];
  inferredSkills: string[];
  relevantExperienceYears: number;
  explanation: string[];
  debugDetails: {
    calculatedYears: number;
    datesFound: string[];
    contactFound: { email: boolean; phone: boolean; linkedin: boolean };
    jobMinExperience: number | null;
    impactScore: number;
  };
  extractedContact: {
    email: string | null;
    phone: string | null;
    linkedin: string | null;
  };
  skillsAnalysis?: {
    directMatches: string[];
    inferredMatches: { jobRequirement: string; candidateSkill: string; reason: string }[];
    missing: string[];
  };
}

// ------------------------------------------------------------------
// 2. Helper Functions (Regex / Utilities)
// ------------------------------------------------------------------

/**
 * Normalizes date strings by replacing various dash types with a standard hyphen.
 */
export function normalizeDateString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return dateStr
    .replace(/[\u2013\u2014\u2212]/g, "-") // En-dash, Em-dash, Minus sign
    .replace(/[–—−]/g, "-") // Visual dash chars
    .replace(/[\s\u00A0]+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Robust date parser handling various formats and "Present".
 */
export function parseDateSafe(dateStr: string | null): Date | null {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return null;

  // Handle "Present", "Current", "Now"
  if (/^(present|current|now|date)$/i.test(normalized)) {
    return new Date();
  }

  try {
    // Try "Month YYYY" or "Mon YYYY" or "MM/YYYY" or "YYYY"
    
    // Split by common separators: space, comma, hyphen, slash
    const parts = normalized.split(/[\s,/\-]+/).filter(p => p);
    
    // Look for a 4-digit year
    const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
    if (yearIdx === -1) return null;
    
    const year = parseInt(parts[yearIdx]);
    let month = 0; // Default Jan
    
    // Look for month in other parts
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    
    for (let i = 0; i < parts.length; i++) {
      if (i === yearIdx) continue;
      const part = parts[i].toLowerCase();
      
      // Check for numeric month 1-12
      if (/^\d{1,2}$/.test(part)) {
         const m = parseInt(part);
         if (m >= 1 && m <= 12) {
           month = m - 1;
           break;
         }
      }
      
      // Check for text month
      const mIdx = months.findIndex(m => part.startsWith(m));
      if (mIdx !== -1) {
        month = mIdx;
        break;
      }
    }
    
    // Construct date (use 1st of month)
    return new Date(year, month, 1);
    
  } catch (e) {
    return null;
  }
}

/**
 * Calculates total years of experience from structured items, handling overlaps.
 */
export function calculateTotalYears(experience: ExperienceItem[]): number {
  if (!experience || experience.length === 0) return 0;

  const intervals: { start: number; end: number }[] = [];

  for (const item of experience) {
    let startStr = item.startDate;
    let endStr = item.endDate;
    
    // Normalize first
    let sNorm = normalizeDateString(startStr);
    let eNorm = normalizeDateString(endStr);
    
    // Check if startStr contains a range separator and endStr is empty/null
    // Regex: whitespace + (hyphens or 'to') + whitespace
    // Note: normalizeDateString converts all dashes to hyphen '-'
    const rangeRegex = /\s+(?:-|to)\s+/i;
    
    if (sNorm && rangeRegex.test(sNorm) && !eNorm) {
       const parts = sNorm.split(rangeRegex);
       if (parts.length >= 2) {
         sNorm = parts[0];
         eNorm = parts[1];
       }
    }
    
    const start = parseDateSafe(sNorm);
    let end = parseDateSafe(eNorm);
    
    if (start) {
      // Handle open-ended current roles
      if (!end && (item.isCurrent || /present|current|now/i.test(eNorm || ""))) {
        end = new Date();
      }
      
      // If we still don't have an end date but it's not marked current, 
      // check if the normalized string was just "Present" (handled in parseDateSafe)
      if (!end && eNorm && /^(present|current|now)$/i.test(eNorm)) {
        end = new Date();
      }

      if (end && end >= start) {
        intervals.push({ start: start.getTime(), end: end.getTime() });
      } else if (!end && item.isCurrent) {
         // Fallback if isCurrent is true but end string was weird
         intervals.push({ start: start.getTime(), end: Date.now() });
      }
    }
  }

  if (intervals.length === 0) return 0;

  // Merge overlapping intervals
  intervals.sort((a, b) => a.start - b.start);
  
  const merged: { start: number; end: number }[] = [];
  let current = intervals[0];
  
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start < current.end) {
      // Overlap or adjacent
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  
  // Sum years
  let totalMs = 0;
  for (const interval of merged) {
    totalMs += (interval.end - interval.start);
  }
  
  // Convert to years (365.25 days)
  const years = totalMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(years * 10) / 10; // Round to 1 decimal
}

export function extractContactInfo(text: string): { email: string | null; phone: string | null; linkedin: string | null } {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  // Expanded phone regex to catch International formats with spaces (e.g. +962 7 7592 7567)
  // Matches: Optional (+ or 00), 1-3 digits, then groups of 1-4 digits separated by space/dot/dash
  const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{1,4})[-. )]*(\d{1,4})[-. ]*(\d{1,9})(?:[-. ]*(\d{1,9}))?/; 
  const linkedinRegex = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/;

  const emailMatch = text.match(emailRegex);
  const phoneMatch = text.match(phoneRegex);
  const linkedinMatch = text.match(linkedinRegex);

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    linkedin: linkedinMatch ? linkedinMatch[0] : null,
  };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ------------------------------------------------------------------
// 3. AI Orchestrator (Wrapper)
// ------------------------------------------------------------------

import { evaluateCandidateWithAI, parseCvWithAI, parseAndEvaluateCvWithAI } from "@/services/aiMatcher";
import { logAiUsage } from "@/services/usageService";

/**
 * Orchestrates the AI-based evaluation.
 * Uses a combined single-shot AI call for speed.
 * 1. Parses and Evaluates in one step.
 * 2. Returns a compatible ScoreResult object.
 */
export async function evaluateCv(
  text: string, 
  job: JobProfile,
  metadata?: { userId?: string; cvId?: string }
): Promise<ScoreResult> {
  // Use combined AI call for speed
  const combinedResult = await parseAndEvaluateCvWithAI(text, job);
  let parsedCv = combinedResult.parsed;
  const aiVerdict = combinedResult.evaluation;

  // Log usage (single call)
  if (combinedResult.usage && metadata?.userId && metadata?.cvId) {
    await logAiUsage({
      userId: metadata.userId,
      cvId: metadata.cvId,
      model: combinedResult.usage.model,
      inputTokens: combinedResult.usage.inputTokens,
      outputTokens: combinedResult.usage.outputTokens,
      type: "cv_scan" // Use scan type for the combined action
    });
  }
  
  // Recalculate experience years robustly if structured data exists
  // This handles cases where AI fails to calculate years due to weird date formats (e.g. en-dashes)
  if (parsedCv.structuredExperience && parsedCv.structuredExperience.length > 0) {
    const calcYears = calculateTotalYears(parsedCv.structuredExperience);
    // Prefer our calculated value if it seems valid, as it handles overlaps and precise dates
    if (calcYears > 0) {
       parsedCv.totalExperienceYears = calcYears;
    }
  }

  // Fallback for contact info if AI missed it
  const contactFallback = extractContactInfo(text);
  if (!parsedCv.email) parsedCv.email = contactFallback.email;
  if (!parsedCv.phone) parsedCv.phone = contactFallback.phone;
  if (!parsedCv.linkedin) parsedCv.linkedin = contactFallback.linkedin;

  // Helper to create detailed breakdown from single score
  const toDetail = (score: number) => ({ score, keywordMatch: score, seniorityMatch: score, coverage: score, depth: score, recency: score, relevance: score, duration: score, consistency: score, presence: score, details: score, results: score, sections: score, readability: score, layout: score, grammar: score, clarity: score });

  const detailed: DetailedScoreBreakdown = {
    roleFit: toDetail(aiVerdict.roleFitScore),
    skillsQuality: toDetail(aiVerdict.techSkillsScore),
    experienceQuality: toDetail(aiVerdict.overallScore),
    projectsImpact: toDetail(0),
    atsFormat: toDetail(parsedCv.generalScore || 80),
    languageClarity: toDetail(100)
  };

  const riskFlags: RiskFlag[] = aiVerdict.gaps.map(g => ({
    message: g,
    severity: "medium",
    type: "other"
  }));

  // Step 3: Map to ScoreResult (for UI compatibility)
  return {
    score: aiVerdict.overallScore,
    breakdown: {
      roleFit: aiVerdict.roleFitScore,
      skillsQuality: aiVerdict.techSkillsScore,
      experienceQuality: aiVerdict.overallScore, // Simplified mapping
      projectsImpact: 0, // Not explicitly scored by new AI logic yet
      atsFormat: parsedCv.generalScore || 80, // From parser or default
      languageClarity: 100,
    },
    detailedBreakdown: detailed,
    riskAnalysis: {
      jobHopping: false,
      employmentGaps: false,
      skillDecay: false,
      missingContact: !parsedCv.email && !parsedCv.phone,
      flags: aiVerdict.gaps
    },
    riskFlags: riskFlags,
    matchedSkills: aiVerdict.keyStrengths.map(s => ({ skill: s, score: 100, reason: "AI Identified Strength" })),
    inferredSkills: [],
    relevantExperienceYears: parsedCv.totalExperienceYears || 0,
    explanation: [aiVerdict.summary], // The "Human Verdict"
    debugDetails: {
      calculatedYears: parsedCv.totalExperienceYears || 0,
      datesFound: [],
      contactFound: {
        email: !!parsedCv.email,
        phone: !!parsedCv.phone,
        linkedin: !!parsedCv.linkedin
      },
      jobMinExperience: job.minYearsExp,
      impactScore: 0
    },
    extractedContact: {
      email: parsedCv.email || null,
      phone: parsedCv.phone || null,
      linkedin: parsedCv.linkedin || null
    },
    skillsAnalysis: aiVerdict.skillsAnalysis
  };
}
