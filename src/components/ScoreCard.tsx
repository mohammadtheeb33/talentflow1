"use client";
import React from "react";
import { 
  Trophy, 
  Briefcase, 
  GraduationCap, 
  Layout, 
  Code,
  Target,
  Zap,
  FileText,
  AlertTriangle,
  HelpCircle,
  CheckCircle2
} from "lucide-react";
import { DetailedScoreBreakdown, RiskFlag } from "@/lib/scoreEngine";
import { CV } from "@/types/cv";

// Fallback type if import fails or for loose typing
type Breakdown = { 
  skillsScore?: number; 
  experienceScore?: number; 
  educationScore?: number; 
  formatScore?: number;
  skills?: number;
  experience?: number;
  education?: number;
};

function ScoreTooltip({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="group relative flex items-center justify-center">
      <HelpCircle className="h-3 w-3 text-gray-500 ml-1 cursor-help" />
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="font-semibold mb-1 border-b border-gray-700 pb-1">{title}</div>
        <div className="space-y-1">
          {children}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}

function ScoreItem({ 
  label, 
  score, 
  icon: Icon, 
  breakdown 
}: { 
  label: string; 
  score: number; 
  icon: any; 
  breakdown?: { label: string; value: number; max: number }[] 
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (s >= 60) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-red-600 bg-red-50 border-red-100";
  };

  const colorClass = getScoreColor(score);

  return (
    <div className={`rounded-lg border p-3 ${colorClass} relative`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 opacity-70" />
          <span className="text-xs font-semibold opacity-90">{label}</span>
          {breakdown && (
            <ScoreTooltip title={label}>
              {breakdown.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span>{b.label}:</span>
                  <span className="font-mono">{b.value}/{b.max}</span>
                </div>
              ))}
            </ScoreTooltip>
          )}
        </div>
      </div>
      <div className="text-2xl font-bold opacity-90">{score}</div>
    </div>
  );
}

export default function ScoreCard({ cv }: { cv: CV | null }) {
  // Robust score parsing
  const rawScore = cv?.score as any;
  let score: number | null = null;
  
  if (typeof rawScore === 'number') {
    score = isNaN(rawScore) ? null : rawScore;
  } else if (typeof rawScore === 'string') {
    const match = rawScore.match(/(\d+(\.\d+)?)/);
    if (match) {
      score = parseFloat(match[0]);
    }
  }

  // Try to find detailed breakdown in either field
  let detailed: DetailedScoreBreakdown | undefined = cv?.scoreDetailedBreakdown;
  
  if (!detailed && cv?.scoreBreakdown && 'roleFit' in cv.scoreBreakdown) {
    detailed = cv.scoreBreakdown as DetailedScoreBreakdown;
  }
  
  // Handle riskFlags which can be string[] (legacy) or RiskFlag[] (new)
  const rawRiskFlags = cv?.scoreRiskFlags || cv?.scoreReasons || [];
  const riskFlags: RiskFlag[] = Array.isArray(rawRiskFlags) ? rawRiskFlags.map((f: any) => {
      if (typeof f === 'string') return { message: f, severity: 'medium', type: 'other' } as RiskFlag;
      return f as RiskFlag;
  }) : [];
  
  // Backward compatibility
  const b: Breakdown | undefined = cv?.scoreBreakdown || undefined;

  // Helper to determine overall score color
  const getOverallColor = (s: number | null) => {
    if (s === null) return "text-gray-500";
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Target className="h-4 w-4 text-gray-500" />
          Evaluation Score
        </h3>
      </div>
      
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Overall Match</div>
            <div className={`text-5xl font-bold mt-1 ${getOverallColor(score)}`}>
              {score ?? "—"}<span className="text-xl text-gray-500 font-normal">/100</span>
            </div>
          </div>
          {cv?.scoreExperienceYears !== undefined && (
            <div className="text-right">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Experience</div>
              <div className="text-xl font-semibold text-gray-900 mt-1">{cv.scoreExperienceYears} <span className="text-sm font-normal text-gray-500">Years</span></div>
            </div>
          )}
        </div>

        {detailed ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <ScoreItem 
              label="Role Fit" 
              score={detailed.roleFit.score} 
              icon={Target}
              breakdown={[
                { label: "Keywords", value: detailed.roleFit.keywordMatch, max: 50 },
                { label: "Seniority", value: detailed.roleFit.seniorityMatch, max: 50 }
              ]}
            />
            <ScoreItem 
              label="Skills Quality" 
              score={detailed.skillsQuality.score} 
              icon={Code}
              breakdown={[
                { label: "Coverage", value: detailed.skillsQuality.coverage, max: 40 },
                { label: "Depth", value: detailed.skillsQuality.depth, max: 30 },
                { label: "Recency", value: detailed.skillsQuality.recency, max: 30 }
              ]}
            />
            <ScoreItem 
              label="Experience" 
              score={detailed.experienceQuality.score} 
              icon={Briefcase}
              breakdown={[
                { label: "Relevance", value: detailed.experienceQuality.relevance, max: 50 },
                { label: "Duration", value: detailed.experienceQuality.duration, max: 30 },
                { label: "Consistency", value: detailed.experienceQuality.consistency, max: 20 }
              ]}
            />
            <ScoreItem 
              label="Projects" 
              score={detailed.projectsImpact.score} 
              icon={Zap}
              breakdown={[
                { label: "Presence", value: detailed.projectsImpact.presence, max: 30 },
                { label: "Details", value: detailed.projectsImpact.details, max: 40 },
                { label: "Results", value: detailed.projectsImpact.results, max: 30 }
              ]}
            />
            <ScoreItem 
              label="Language" 
              score={detailed.languageClarity.score} 
              icon={FileText}
              breakdown={[
                { label: "Grammar", value: detailed.languageClarity.grammar, max: 40 },
                { label: "Clarity", value: detailed.languageClarity.clarity, max: 60 }
              ]}
            />
            <ScoreItem 
              label="ATS Format" 
              score={detailed.atsFormat.score} 
              icon={Layout}
              breakdown={[
                { label: "Sections", value: detailed.atsFormat.sections, max: 40 },
                { label: "Readability", value: detailed.atsFormat.readability, max: 30 },
                { label: "Layout", value: detailed.atsFormat.layout, max: 30 }
              ]}
            />
          </div>
        ) : b && (
          // Fallback for old data
          <div className="grid grid-cols-2 gap-3 mb-6">
             <ScoreItem label="Skills" score={b.skillsScore ?? 0} icon={Code} />
             <ScoreItem label="Experience" score={b.experienceScore ?? 0} icon={Briefcase} />
             <ScoreItem label="Education" score={b.educationScore ?? 0} icon={GraduationCap} />
             <ScoreItem label="Format" score={b.formatScore ?? 0} icon={Layout} />
          </div>
        )}

        {/* Risk Flags Section */}
        {riskFlags && riskFlags.length > 0 && (
          <div className="mt-2 rounded-lg border border-red-100 bg-red-50 p-3">
            <div className="flex items-center gap-2 mb-2 text-red-800 font-semibold text-xs uppercase tracking-wide">
              <AlertTriangle className="h-4 w-4" />
              Risk Flags
            </div>
            <ul className="space-y-1.5">
              {riskFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-red-700">
                  <span className={`mt-1.5 block h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      flag.severity === 'high' ? 'bg-red-600' : 
                      flag.severity === 'medium' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />
                  <span>{flag.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inferred Skills Section (Optional) */}
        {cv?.scoreInferredSkills && cv.scoreInferredSkills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
             <div className="text-xs font-semibold text-gray-900 mb-2">Inferred Skills</div>
             <div className="flex flex-wrap gap-1.5">
               {cv.scoreInferredSkills.map((s: string, idx: number) => (
                 <span key={idx} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
                   {s}
                 </span>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

