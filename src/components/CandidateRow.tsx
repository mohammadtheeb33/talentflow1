"use client";
import Link from "next/link";
import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";

export type CandidateItem = {
  id: string;
  name?: string | null;
  email?: string | null;
  jobProfileId?: string | null;
  jobTitle?: string | null;
  source?: string | null;
  submittedAt?: any;
  updatedAt?: any;
  score?: number | null;
  status?: string | null;
};

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

function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status || "").toLowerCase();
  let cls = "bg-gray-100 text-gray-800 border-gray-200";
  let icon = null;
  let label = status || "Unknown";
  
  if (["accepted", "accept", "approved", "strong_fit", "strong fit"].includes(s)) { 
    cls = "bg-green-50 text-green-700 border-green-200"; 
    icon = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
    label = "Strong fit"; 
  }
  else if (["needs_review", "review", "pending", "pending_review", "pending review"].includes(s)) { 
    cls = "bg-yellow-50 text-yellow-700 border-yellow-200"; 
    icon = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
    label = "Pending review"; 
  }
  else if (["rejected", "reject", "not_a_fit", "not a fit"].includes(s)) { 
    cls = "bg-red-50 text-red-700 border-red-200"; 
    icon = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
    label = "Not a fit"; 
  }
  else if (["scored", "evaluated"].includes(s)) { 
    cls = "bg-indigo-50 text-indigo-700 border-indigo-200"; 
    icon = <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    label = "Scored"; 
  }
  
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

export function CandidateRow({ item, onDeleted }: { item: CandidateItem; onDeleted?: (id: string) => void }) {
  const avatarText = initials(item.name, item.email);
  const scoreNum = typeof item.score === "number" ? Math.max(0, Math.min(100, Math.round(item.score))) : null;
  
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
    <tr className="group border-b border-gray-100 transition-colors hover:bg-gray-50/50">
      <td className="px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 ring-4 ring-white transition-shadow group-hover:ring-indigo-50">
          {avatarText}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <Link href={`/cvs/${item.id}`} className="font-medium text-gray-900 hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2">
            {item.name || item.email || item.id}
          </Link>
          <span className="text-xs text-gray-500">{item.email || ""}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
          {item.jobTitle || item.jobProfileId || "—"}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">{item.source || "—"}</td>
      <td className="px-6 py-4 text-sm">{submittedStr}</td>
      <td className="px-6 py-4">
        {scoreNum !== null ? (
            <div className="flex items-center gap-2">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
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
            <span className="text-xs text-gray-400 italic">Not scored</span>
        )}
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Link 
                href={`/cvs/${item.id}`}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
                View
            </Link>
            <button 
                onClick={deleteCv} 
                disabled={deleting}
                className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                title="Delete Candidate"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
      </td>
    </tr>
  );
}