"use client";
import Link from "next/link";
import { useState, useEffect, memo } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";
import { updateHiringStatus, HiringStatus } from "@/services/hiringService";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { CV } from "@/types/cv";

export type CandidateItem = CV;

function initials(name?: string | null, email?: string | null): string {
  const n = (name || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    return (first.slice(0, 1) + (last.slice(0, 1) || "")).toUpperCase() || (first.slice(0, 2).toUpperCase());
  }
  const e = (email || "").trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "CV";
}

export const CandidateRow = memo(function CandidateRow({ item, onDeleted, selected, onSelect, jobTitles }: { item: CandidateItem; onDeleted?: (id: string) => void; selected?: boolean; onSelect?: (checked: boolean) => void; jobTitles?: Record<string, string> }) {
  const avatarText = initials(item.parsed?.name || item.name, item.parsed?.email || item.email);
  
  // Robust score parsing
  const rawScore = item.score;
  let scoreNum: number | null = null;
  
  if (rawScore !== null && rawScore !== undefined) {
      if (typeof rawScore === 'number') {
          if (!isNaN(rawScore)) {
             scoreNum = Math.max(0, Math.min(100, Math.round(rawScore)));
          }
      } else if (typeof rawScore === 'string') {
          const match = (rawScore as string).match(/(\d+(\.\d+)?)/);
          if (match) {
              const n = parseFloat(match[0]);
              scoreNum = Math.max(0, Math.min(100, Math.round(n)));
          }
      }
  }
  
  function fmtSubmitted(ts?: any) {
    const sec = ts?.seconds || 0;
    if (!sec) return "—";
    const d = new Date(sec * 1000);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const isYest = d.toDateString() === yest.toDateString();
    
    if (sameDay) {
        return <span className="text-green-600 font-medium">Today <span className="text-gray-400 font-normal">{d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span>;
    }
    if (isYest) {
        return <span className="text-gray-700">Yesterday <span className="text-gray-400 font-normal">{d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span>;
    }
    const dow = d.toLocaleDateString([], { weekday: "short" });
    const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return <span className="text-gray-600">{dateStr} <span className="text-gray-400 text-xs">({dow})</span></span>;
  }
  
  const submittedStr = fmtSubmitted(item.submittedAt?.seconds ? item.submittedAt : item.updatedAt);
  const [deleting, setDeleting] = useState(false);
  const [localStatus, setLocalStatus] = useState<HiringStatus>((item.hiringStatus as HiringStatus) || "undecided");

  // Sync local status if prop changes
  useEffect(() => {
    if (item.hiringStatus) {
      setLocalStatus(item.hiringStatus as HiringStatus);
    }
  }, [item.hiringStatus]);

  async function handleDecision(status: HiringStatus) {
    // Optimistic update
    const previousStatus = localStatus;
    setLocalStatus(status);
    
    try {
      await updateHiringStatus(item.id, status);
      toast.success(`Candidate ${status}`);
    } catch (e) {
      setLocalStatus(previousStatus);
      toast.error("Failed to update status");
      console.error(e);
    }
  }

  async function deleteCv() {
    if (!item?.id) return;
    if (!confirm("هل تريد حذف هذا السيرة الذاتية نهائيًا؟")) return;
    try {
      setDeleting(true);
      const db = getClientFirestore();
      await deleteDoc(doc(db, "cvs", item.id));
      if (onDeleted) onDeleted(item.id);
    } catch (e: any) {
      alert(e?.message || "تعذّر حذف السيرة الذاتية");
    } finally {
      setDeleting(false);
    }
  }
  
  return (
    <tr className={`group border-b border-gray-100 transition-colors hover:bg-gray-50/50 ${selected ? "bg-indigo-50/30" : ""}`}>
      <td className="pl-3 py-2 w-4">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
          checked={selected || false}
          onChange={(e) => onSelect && onSelect(e.target.checked)}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 ring-2 ring-white transition-shadow group-hover:ring-indigo-50">
            {avatarText}
          </div>
          <div className="flex flex-col">
            <Link href={`/cvs/${item.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2">
              {item.parsed?.name || item.name || item.parsed?.email || item.email || "Unnamed Candidate"}
            </Link>
            <span className="text-xs text-gray-500">{item.parsed?.email || item.email || ""}</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
         <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-gray-900">
              {item.jobTitle || (item.jobProfileId && jobTitles?.[item.jobProfileId]) || "Unknown Job"}
            </span>
            <span className="text-xs text-gray-500 capitalize">{item.source || "—"}</span>
         </div>
      </td>
      <td className="px-3 py-2">
        {scoreNum !== null ? (
            <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${scoreNum >= 75 ? "bg-green-500" : scoreNum >= 50 ? "bg-yellow-500" : "bg-red-500"}`} 
                        style={{ width: `${scoreNum}%` }} 
                    />
                </div>
                <span className={`text-xs font-semibold ${scoreNum >= 75 ? "text-green-700" : scoreNum >= 50 ? "text-yellow-700" : "text-red-700"}`}>
                    {scoreNum}%
                </span>
            </div>
        ) : (
            <span className="text-xs text-gray-400 italic" title={`Raw: ${JSON.stringify(rawScore)}`}>Not scored</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
          localStatus === 'accepted' ? 'bg-green-50 text-green-700 ring-green-600/20' :
          localStatus === 'rejected' ? 'bg-red-50 text-red-700 ring-red-600/20' :
          'bg-gray-50 text-gray-600 ring-gray-500/10'
        }`}>
          {localStatus === 'accepted' ? 'Accepted' : localStatus === 'rejected' ? 'Rejected' : 'Undecided'}
        </span>
      </td>
      <td className="px-3 py-2 text-sm">{submittedStr}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
                onClick={() => handleDecision('accepted')}
                className={`rounded-md p-1 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${localStatus === 'accepted' ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600'}`}
                title="Accept"
            >
                <CheckCircle2 className="h-4 w-4" />
            </button>
            <button
                onClick={() => handleDecision('rejected')}
                className={`rounded-md p-1 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${localStatus === 'rejected' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600'}`}
                title="Reject"
            >
                <XCircle className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-gray-200 mx-1"></div>
            <Link 
                href={`/cvs/${item.id}`}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
                View
            </Link>
            <button 
                onClick={deleteCv} 
                disabled={deleting}
                className="rounded-md border border-gray-200 bg-white p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                title="Delete Candidate"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
      </td>
    </tr>
  );
});
