"use client";
import { useState, useMemo, useEffect } from "react";
import { updateJobProfile } from "@/lib/firebase";

type Weights = {
  roleFit: number;
  skillsQuality: number;
  experienceQuality: number;
  projectsImpact: number;
  languageClarity: number;
  atsFormat: number;
};

type JobProfile = {
  id: string;
  title?: string;
  description?: string;
  requiredSkills?: string[];
  optionalSkills?: string[];
  minYearsExp?: number;
  educationLevel?: string;
  weights?: Weights;
};

function parseList(input: string): string[] {
  return input
    .split(/[\,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function EditJobModal({
  job,
  isOpen,
  onClose,
  onUpdated,
}: {
  job: JobProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkillsTxt, setRequiredSkillsTxt] = useState("");
  const [optionalSkillsTxt, setOptionalSkillsTxt] = useState("");
  const [minYearsExp, setMinYearsExp] = useState<number>(2);
  const [educationLevel, setEducationLevel] = useState<string>("bachelor");
  const [weights, setWeights] = useState<Weights>({
    roleFit: 0.30,
    skillsQuality: 0.30,
    experienceQuality: 0.20,
    projectsImpact: 0.10,
    languageClarity: 0.05,
    atsFormat: 0.05,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job && isOpen) {
      setTitle(job.title || "");
      setDescription(job.description || "");
      setRequiredSkillsTxt((job.requiredSkills || []).join(", "));
      setOptionalSkillsTxt((job.optionalSkills || []).join(", "));
      setMinYearsExp(job.minYearsExp || 0);
      setEducationLevel(job.educationLevel || "none");
      if (job.weights) {
        setWeights(job.weights);
      }
    }
  }, [job, isOpen]);

  const requiredSkills = useMemo(() => parseList(requiredSkillsTxt), [requiredSkillsTxt]);
  const optionalSkills = useMemo(() => parseList(optionalSkillsTxt), [optionalSkillsTxt]);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    try {
      setSaving(true);
      setError(null);

      const payload = {
        title,
        description,
        requiredSkills,
        optionalSkills,
        minYearsExp,
        educationLevel,
        weights,
      };

      await updateJobProfile(job.id, payload);
      onUpdated();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to update job profile");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-6">
      <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Job Profile</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4">
          {error && <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <form id="edit-job-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Job Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  rows={3}
                  placeholder="Brief description of the role..."
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Required Skills</label>
                <textarea
                  value={requiredSkillsTxt}
                  onChange={(e) => setRequiredSkillsTxt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  rows={3}
                  placeholder="e.g. React, TypeScript, Node.js (one per line or comma separated)"
                />
                <p className="mt-1 text-xs text-gray-500">{requiredSkills.length} skills detected</p>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Optional Skills</label>
                <textarea
                  value={optionalSkillsTxt}
                  onChange={(e) => setOptionalSkillsTxt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  rows={2}
                  placeholder="e.g. Docker, AWS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Minimum Experience (Years)</label>
                <input
                  type="number"
                  min={0}
                  value={minYearsExp}
                  onChange={(e) => setMinYearsExp(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Education Level</label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                >
                  <option value="none">None / Any</option>
                  <option value="high_school">High School</option>
                  <option value="associate">Associate Degree</option>
                  <option value="bachelor">Bachelor's Degree</option>
                  <option value="master">Master's Degree</option>
                  <option value="phd">PhD</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Scoring Weights</h3>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    Math.abs(totalWeight - 1) < 0.01 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  Total: {totalWeight.toFixed(2)} (Should be 1.00)
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: "roleFit", label: "Role Fit" },
                  { key: "skillsQuality", label: "Skills Quality" },
                  { key: "experienceQuality", label: "Experience Quality" },
                  { key: "projectsImpact", label: "Projects Impact" },
                  { key: "languageClarity", label: "Language Clarity" },
                  { key: "atsFormat", label: "ATS Format" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={weights[key as keyof Weights]}
                      onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-job-form"
            disabled={saving}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}