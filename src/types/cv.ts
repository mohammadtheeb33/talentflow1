import { ParsedCvResult } from "@/lib/parsedCv";
import { DetailedScoreBreakdown, RiskFlag } from "@/lib/scoreEngine";

export interface CV {
  id: string;
  uid?: string;
  status?: string;
  filename?: string;
  storagePath?: string;
  companyId?: string;
  jobProfileId?: string;
  jobTitle?: string;
  source?: string | null;
  
  // Hiring Status
  hiringStatus?: "accepted" | "rejected" | "undecided" | string;
  decidedAt?: any;
  decidedBy?: string | null;

  // Parsed Data
  parsed?: Partial<ParsedCvResult> & {
    [key: string]: any;
  };
  
  // Contact info extracted specifically (sometimes separate from parsed)
  extractedContact?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    linkedin?: string | null;
    [key: string]: any;
  };

  // Scoring & Analysis
  score?: number;
  matchScore?: number;
  scoreExperienceYears?: number;
  scoreBreakdown?: {
    skills?: number;
    experience?: number;
    education?: number;
    [key: string]: any;
  };
  scoreDetailedBreakdown?: DetailedScoreBreakdown;
  scoreRiskFlags?: RiskFlag[] | string[];
  scoreReasons?: string[];
  scoreSkillsAnalysis?: {
    missing?: string[];
    present?: string[];
    [key: string]: any;
  };
  aiAnalysis?: string;
  
  // Metadata
  createdAt?: any; // Firestore Timestamp or Date
  submittedAt?: any;
  updatedAt?: any;
  rescanRequestedAt?: any;
  scoreRequestedAt?: any;
  
  // Flattened/Root fields sometimes used
  name?: string;
  email?: string;
  phone?: string;
  
  [key: string]: any;
}
