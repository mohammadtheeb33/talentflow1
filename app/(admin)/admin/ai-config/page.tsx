"use client";
import { useEffect, useState } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AiSettings = {
  model: string;
  resume_prompt: string;
};

const MODEL_OPTIONS = [
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-pro-latest"
];

const DEFAULT_MODEL = "gemini-2.0-flash";

const DEFAULT_RESUME_PROMPT = `
You are a Technical Recruiter. Evaluate this Candidate for the Job.

**Job:** \${job.title}
**Skills:** \${job.requiredSkills.join(", ")}
**Min Exp:** \${job.minYearsExp} years

**Candidate CV:**
\${text.slice(0, 15000)}

**Output JSON:**
{
  "overallScore": number (0-100),
  "roleFitScore": number (0-100),
  "techSkillsScore": number (0-100),
  "keyStrengths": ["str"],
  "gaps": ["str"],
  "summary": "Brief verdict + advice on certifications.",
  "skillsAnalysis": {
    "directMatches": ["str"],
    "inferredMatches": [{ "jobRequirement": "str", "candidateSkill": "str", "reason": "str" }],
    "missing": ["str"]
  }
}
`.trim();

const PARSE_PROMPT_REFERENCE = `
You are an expert CV Parser. Extract structured data from the Resume text.

**Resume Text:**
\${text.slice(0, 20000)}

**Instructions:**
1. **Contact:** Name, Email, Phone, LinkedIn.
2. **Skills:** Technical & Soft skills.
3. **Experience:** Total years (number). Structured list of roles (keep descriptions concise).
4. **Education/Certs:** List all.
5. **ATS Score:** 0-100.

**Output JSON:**
{
  "name": "string", "email": "string", "phone": "string", "linkedin": "string",
  "summary": "string", "skills": ["str"],
  "totalExperienceYears": number,
  "structuredExperience": [{"role": "str", "company": "str", "startDate": "str", "endDate": "str", "description": "str", "isCurrent": bool}],
  "education": ["str"], "certifications": ["str"], "courses": ["str"], "languages": ["str"],
  "generalScore": number
}
`.trim();

export default function AdminAiConfigPage() {
  const [settings, setSettings] = useState<AiSettings>({
    model: DEFAULT_MODEL,
    resume_prompt: DEFAULT_RESUME_PROMPT
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getClientFirestore();
    const ref = doc(db, "system_config", "ai_settings");
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? (snap.data() as any) : {};
      setSettings({
        model: String(data?.model || data?.model_name || DEFAULT_MODEL),
        resume_prompt: String(data?.resume_prompt || DEFAULT_RESUME_PROMPT)
      });
      setLoading(false);
    }, (err) => {
      toast.error(err?.message || "Failed to load AI settings");
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const db = getClientFirestore();
      const ref = doc(db, "system_config", "ai_settings");
      await setDoc(ref, { model: settings.model, model_name: settings.model, resume_prompt: settings.resume_prompt }, { merge: true });
      toast.success("AI settings updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">AI Configuration</h2>
        <p className="text-sm text-slate-400">Manage resume prompt and model selection</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-[0_0_40px_rgba(56,189,248,0.08)] space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-slate-300">Model</label>
            <select
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:ring-cyan-500"
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              {!MODEL_OPTIONS.includes(settings.model) ? (
                <option value={settings.model}>{settings.model}</option>
              ) : null}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-2 text-xs font-semibold text-slate-300">Runtime Models</div>
            <div className="text-xs text-slate-400">
              {MODEL_OPTIONS.map((m, i) => (
                <div key={m} className="flex items-center gap-2 py-1">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-600/30">{i + 1}</span>
                  <span className="font-mono">{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-2 text-xs font-semibold text-slate-300">Parsing Prompt (read-only)</div>
            <textarea
              value={PARSE_PROMPT_REFERENCE}
              disabled
              rows={12}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-300">Resume Prompt</label>
          <textarea
            value={settings.resume_prompt}
            onChange={(e) => setSettings((s) => ({ ...s, resume_prompt: e.target.value }))}
            disabled={loading}
            rows={14}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.45)] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
