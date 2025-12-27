export interface ExperienceItem {
  role: string;
  company: string;
  startDate: string | null;
  endDate: string | null;
  description: string;
  isCurrent: boolean;
  durationMonths?: number;
}

export interface ParsedCvResult {
  fullText: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  summary: string | null;
  skills: string[];
  skillsMissing?: string[];
  experience: string[];
  structuredExperience?: ExperienceItem[];
  totalExperienceYears?: number;
  education: string[];
  projects?: string; // markdown or text description
  courses?: string; // markdown or text description
  languages: string[];
  certifications: string[];
  rawKeywords: string[];
  aiAnalysis?: string;
  improvements?: string;
  formatIssues?: string[];
  generalScore?: number;
  suggestedScores?: {
    skills?: number;
    experience?: number;
    format?: number;
    overall?: number;
  };
  detectedLanguage?: string;
  inferredTargetRole?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

