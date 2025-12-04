"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getClientAuth, getClientFirestore, ensureUid } from "@/lib/firebase";

type PipelineStage = {
  id: string;
  label: string;
  color: string;
};

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "new", label: "New", color: "bg-blue-100 text-blue-800" },
  { id: "screening", label: "Screening", color: "bg-yellow-100 text-yellow-800" },
  { id: "interview", label: "Interview", color: "bg-purple-100 text-purple-800" },
  { id: "offer", label: "Offer", color: "bg-orange-100 text-orange-800" },
  { id: "hired", label: "Hired", color: "bg-green-100 text-green-800" },
  { id: "rejected", label: "Rejected", color: "bg-red-100 text-red-800" },
];

export default function PipelineSettings() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New stage input
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const auth = getClientAuth();
        let uid = auth.currentUser?.uid;
        if (!uid) try { uid = await ensureUid(); } catch (_) {}
        
        if (!uid) {
          setError("Unauthorized");
          return;
        }

        const db = getClientFirestore();
        const docRef = doc(db, "settings", `pipeline_${uid}`);
        const snap = await getDoc(docRef);

        if (snap.exists() && snap.data().stages) {
          setStages(snap.data().stages);
        } else {
          setStages(DEFAULT_STAGES);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const auth = getClientAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Unauthorized");

      const db = getClientFirestore();
      await setDoc(doc(db, "settings", `pipeline_${uid}`), {
        stages,
        uid,
        updatedAt: serverTimestamp(),
      });
      
      setSuccess("Pipeline settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    if (!newLabel.trim()) return;
    const id = newLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    setStages([...stages, { id, label: newLabel, color: "bg-gray-100 text-gray-800" }]);
    setNewLabel("");
  };

  const removeStage = (idx: number) => {
    const newStages = [...stages];
    newStages.splice(idx, 1);
    setStages(newStages);
  };

  const moveStage = (idx: number, direction: -1 | 1) => {
    if (idx + direction < 0 || idx + direction >= stages.length) return;
    const newStages = [...stages];
    const temp = newStages[idx];
    newStages[idx] = newStages[idx + direction];
    newStages[idx + direction] = temp;
    setStages(newStages);
  };

  if (loading) return <div className="text-sm text-gray-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900">Pipeline Stages</h3>
        <p className="mt-1 text-sm text-gray-500">Customize the stages of your recruitment pipeline.</p>

        {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <div className="mt-6 space-y-3">
          {stages.map((stage, idx) => (
            <div key={`${stage.id}-${idx}`} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => moveStage(idx, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button 
                  onClick={() => moveStage(idx, 1)}
                  disabled={idx === stages.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              
              <div className="flex-1">
                <input 
                  value={stage.label}
                  onChange={(e) => {
                    const newStages = [...stages];
                    newStages[idx].label = e.target.value;
                    setStages(newStages);
                  }}
                  className="w-full rounded border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${stage.color}`}>
                  Preview
                </span>
                <button 
                  onClick={() => removeStage(idx)}
                  className="ml-2 text-gray-400 hover:text-red-600"
                  title="Remove stage"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input 
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="New Stage Name (e.g. Technical Interview)"
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addStage()}
          />
          <button 
            onClick={addStage}
            disabled={!newLabel.trim()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Add Stage
          </button>
        </div>

        <div className="mt-8 flex justify-end border-t border-gray-100 pt-5">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}