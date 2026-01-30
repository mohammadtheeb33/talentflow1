"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getClientFirestore, getClientAuth, deleteCandidatesBatch } from "@/lib/firebase";
import { updateHiringStatus } from "@/services/hiringService";
import RejectionModal from "./RejectionModal";
import { CV } from "@/types/cv";
import { BeakerIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { Briefcase, CalendarPlus, Check, Eye, Loader2, Search, Trash2, XCircle } from "lucide-react";

const BulkAnalysisModal = dynamic(() => import("./BulkAnalysisModal").then(mod => mod.BulkAnalysisModal), {
    loading: () => null,
    ssr: false
});
const BulkEmailModal = dynamic(() => import("./BulkEmailModal").then(mod => mod.BulkEmailModal), {
    loading: () => null,
    ssr: false
});

interface CandidatesTableProps {
  onCheckCv?: () => void;
  limitCount?: number;
}

const getDisplayName = (candidate: CV) => {
  if (candidate.firstName && candidate.lastName) return `${candidate.firstName} ${candidate.lastName}`;
  if (candidate.fullName) return candidate.fullName;
  if (candidate.parsed?.name) return candidate.parsed.name;
  if (candidate.extractedContact?.name) return candidate.extractedContact.name;
  if (candidate.displayName) return candidate.displayName;
  if (candidate.name) return candidate.name;
  if (candidate.email) return candidate.email.split("@")[0];
  if (candidate.parsed?.email) return candidate.parsed.email.split("@")[0];
  if (candidate.extractedContact?.email) return candidate.extractedContact.email.split("@")[0];
  if (candidate.filename) return candidate.filename;
  if (candidate.originalName) return candidate.originalName;
  return "Unnamed Candidate";
};

const getEmail = (candidate: CV) => {
  return candidate.parsed?.email || candidate.email || candidate.extractedContact?.email || "No email";
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return `${first}${second}`.toUpperCase() || "CV";
};

const getScore = (candidate: CV) => {
  const raw = candidate.score ?? candidate.matchScore ?? candidate.overallScore ?? 0;
  const num = typeof raw === "number" ? raw : Number.parseFloat(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? Math.round(Math.max(0, Math.min(100, num))) : 0;
};

const getStatusLabel = (candidate: CV) => {
  const value = candidate.hiringStatus || candidate.status || "New";
  if (value === "undecided") return "New";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
};

const getStatusClasses = (status: string) => {
  const key = status.toLowerCase();
  if (key.includes("interview")) return "border border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (key.includes("new") || key.includes("undecided")) return "border border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (key.includes("accepted")) return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (key.includes("rejected")) return "border border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border border-slate-500/30 bg-slate-500/10 text-slate-300";
};

const getScoreBarClasses = (score: number) => {
  if (score >= 85) {
    return "bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 shadow-[0_0_12px_rgba(16,185,129,0.65)]";
  }
  if (score >= 60) {
    return "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]";
  }
  return "bg-gradient-to-r from-rose-400 via-rose-500 to-pink-400 shadow-[0_0_12px_rgba(244,63,94,0.65)]";
};

export default function CandidatesTable({ onCheckCv, limitCount }: CandidatesTableProps) {
  const [candidates, setCandidates] = useState<CV[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [candidateToReject, setCandidateToReject] = useState<string | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarType, setCalendarType] = useState("Meeting");
  const [calendarStart, setCalendarStart] = useState("");
  const [calendarEnd, setCalendarEnd] = useState("");
  const [calendarSaving, setCalendarSaving] = useState(false);
  
  // New Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    department: "",
    job: "",
    stage: "",
    decision: "all"
  });
  
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [filters, searchQuery]);

  // Filtering Logic
  const allFilteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
        // Search
        const searchLower = searchQuery.toLowerCase();
        const name = (c.parsed?.name || c.name || "").toLowerCase();
        const email = (c.parsed?.email || c.email || "").toLowerCase();
        
        if (searchQuery && !name.includes(searchLower) && !email.includes(searchLower)) {
            return false;
        }

        // Job Filter
        if (filters.job && c.jobId !== filters.job) return false;

        // Decision Filter (Mapped from old statusFilter)
        if (filters.decision !== "all") {
             if (filters.decision === "undecided") {
                 if (c.hiringStatus && c.hiringStatus !== "undecided") return false;
             } else {
                 if (c.hiringStatus !== filters.decision) return false;
             }
        }
        
        // Stage Filter (Mock logic for now, or check pipelineStage if exists)
        if (filters.stage) {
            // If you have a stage field, filter here. For now, ignoring or checking specific field
            // if (c.stage !== filters.stage) return false;
        }

        return true;
    });
  }, [candidates, searchQuery, filters]);

  const pageSize = limitCount || 20;
  const totalPages = Math.max(1, Math.ceil(allFilteredCandidates.length / pageSize));
  const filteredCandidates = limitCount
    ? allFilteredCandidates.slice(0, limitCount)
    : allFilteredCandidates.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredCandidates.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  }, [filteredCandidates]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((pid) => pid !== id));
    }
  }, []);

  const handleRejectClick = (id: string) => {
    setCandidateToReject(id);
    setShowRejectionModal(true);
  };

  const handleConfirmRejection = async (reason: string) => {
    if (!candidateToReject) return;
    try {
      await updateHiringStatus(candidateToReject, "rejected", reason);
      // No need to manually update state as snapshot listener will handle it
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    } finally {
      setShowRejectionModal(false);
      setCandidateToReject(null);
    }
  };

  const handleAcceptCandidate = async (id: string) => {
    try {
      await updateHiringStatus(id, "accepted");
    } catch (error) {
      console.error(error);
      alert("Failed to accept candidate");
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this candidate?")) return;
    try {
      await deleteCandidatesBatch([id]);
      setSelectedIds((prev) => prev.filter((pid) => pid !== id));
    } catch (error) {
      console.error(error);
      alert("Failed to delete candidate");
    }
  };

  const formatDateTime = (date: Date) => {
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (!showCalendarModal) return;
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    setCalendarStart(formatDateTime(now));
    setCalendarEnd(formatDateTime(oneHourLater));
    setCalendarType("Meeting");
  }, [showCalendarModal]);

  const handleAddToCalendar = async () => {
    if (!user) return;
    const start = new Date(calendarStart);
    const end = new Date(calendarEnd);
    if (!calendarStart || !calendarEnd || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      alert("Please select valid start and end times.");
      return;
    }
    if (end <= start) {
      alert("End time must be after start time.");
      return;
    }
    const selectedList = candidates.filter((c) => selectedIds.includes(c.id));
    if (selectedList.length === 0) return;
    setCalendarSaving(true);
    try {
      const db = getClientFirestore();
      const promises = selectedList.map((c) => {
        const name = c.parsed?.name || c.name || c.parsed?.email || c.email || "Candidate";
        const title = `${calendarType} with ${name}`;
        return addDoc(collection(db, "events"), {
          uid: user.uid,
          candidateId: c.id,
          candidateName: name,
          title,
          type: calendarType,
          start,
          end,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await Promise.all(promises);
      setShowCalendarModal(false);
    } catch (e: any) {
      alert(e?.message || "Failed to add to calendar");
    } finally {
      setCalendarSaving(false);
    }
  };

  const executeBatchAction = async (action: string) => {
    const validIds = selectedIds.filter((id) => candidates.some((c) => c.id === id));
    if (validIds.length === 0) return;

    if (!confirm(`Are you sure you want to apply this action to ${validIds.length} candidates?`)) return;

    setProcessingBatch(true);
    try {
      if (action === "delete") {
        await deleteCandidatesBatch(validIds);
        setSelectedIds([]);
      }
    } catch (e) {
      console.error(e);
      alert("Batch action failed");
    } finally {
      setProcessingBatch(false);
    }
  };

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setCandidates([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const db = getClientFirestore();

    // Store results from both queries to handle legacy data (userId vs uid)
    let resultsUid: Record<string, CV> = {};
    let resultsUserId: Record<string, CV> = {};

    const mergeAndSet = () => {
      // Intelligently merge results to avoid stale overwrites
      const allIds = new Set([...Object.keys(resultsUid), ...Object.keys(resultsUserId)]);
      const merged: Record<string, CV> = {};

      allIds.forEach(id => {
        const item1 = resultsUid[id];
        const item2 = resultsUserId[id];

        if (item1 && item2) {
          // Both exist: pick the one with a score if the other doesn't
          const s1 = typeof item1.score === 'number' ? item1.score : null;
          const s2 = typeof item2.score === 'number' ? item2.score : null;
          
          if (s1 !== null && s2 === null) {
            merged[id] = item1;
          } else if (s2 !== null && s1 === null) {
            merged[id] = item2;
          } else {
            // Default: pick item1 (uid) or maybe compare updatedAt if possible
            // If timestamps are available, use them
            const t1 = item1.updatedAt?.seconds || 0;
            const t2 = item2.updatedAt?.seconds || 0;
            merged[id] = t1 >= t2 ? item1 : item2;
          }
        } else {
          merged[id] = item1 || item2;
        }
      });

      const items = Object.values(merged);
      // Client-side sorting
      items.sort((a, b) => {
        const tA = a.submittedAt?.seconds || a.submittedAt?.toMillis?.() / 1000 || 0;
        const tB = b.submittedAt?.seconds || b.submittedAt?.toMillis?.() / 1000 || 0;
        return tB - tA;
      });
      setCandidates(items);
      setLoading(false);
    };

    // Query 1: standard 'uid'
    const q1 = query(collection(db, "cvs"), where("uid", "==", user.uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      const nextRes: Record<string, CV> = {};
      snap.forEach((doc) => {
        const d = doc.data();
        // Fallback name logic if missing
        if (!d.name && d.filename) {
            d.name = d.filename; 
        }
        nextRes[doc.id] = { id: doc.id, ...d } as CV;
      });
      resultsUid = nextRes;
      mergeAndSet();
    }, (err) => console.error("Error fetching uid candidates:", err));

    // Query 2: legacy 'userId'
    const q2 = query(collection(db, "cvs"), where("userId", "==", user.uid));
    const unsub2 = onSnapshot(q2, (snap) => {
      const nextRes: Record<string, CV> = {};
      snap.forEach((doc) => {
        nextRes[doc.id] = { id: doc.id, ...doc.data() } as CV;
      });
      resultsUserId = nextRes;
      mergeAndSet();
    }, (err) => console.error("Error fetching userId candidates:", err));

    // Query 3: Job Profiles (for title resolution)
    const qJobs = query(collection(db, "jobProfiles"), where("uid", "==", user.uid));
    const unsubJobs = onSnapshot(qJobs, (snap) => {
      const titles: Record<string, string> = {};
      snap.forEach((doc) => {
        const d = doc.data();
        titles[doc.id] = d.title || "Untitled Profile";
      });
      setJobTitles(titles);
    });

    return () => {
      unsub1();
      unsub2();
      unsubJobs();
    };

  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center text-slate-400">Please sign in to view candidates.</div>;
  }

  const selectedCandidatesList = candidates.filter(c => selectedIds.includes(c.id));
  const allAccepted = selectedCandidatesList.length > 0 && selectedCandidatesList.every(c => c.hiringStatus === "accepted");
  const allRejected = selectedCandidatesList.length > 0 && selectedCandidatesList.every(c => c.hiringStatus === "rejected");
  const canSendEmail = (allAccepted || allRejected) && selectedCandidatesList.length <= 50;
  const totalCount = candidates.length;
  const newCount = candidates.filter((c) => {
    const status = (c.hiringStatus || c.status || "new").toString().toLowerCase();
    return status === "new" || status === "undecided" || status === "applied";
  }).length;
  const showingFrom = allFilteredCandidates.length === 0 ? 0 : pageIndex * pageSize + 1;
  const showingTo = limitCount
    ? filteredCandidates.length
    : Math.min(allFilteredCandidates.length, pageIndex * pageSize + filteredCandidates.length);

  return (
    <div className="space-y-6">
      <div className="w-full rounded-2xl p-6 transition-all duration-300 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none">
        <div className="border-b border-slate-200 pb-4 dark:border-white/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">Candidates</h1>
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{totalCount}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">New</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{newCount}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCheckCv?.()}
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.45)] transition hover:from-violet-500 hover:to-indigo-500"
            >
              Add Candidate
            </button>
          </div>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.decision}
                onChange={(e) => setFilters((prev) => ({ ...prev, decision: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">All Status</option>
                <option value="undecided">New</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={filters.job}
                onChange={(e) => setFilters((prev) => ({ ...prev, job: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">All Roles</option>
                {Object.entries(jobTitles).map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-transparent dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="w-10 px-6 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 bg-white text-indigo-500 focus:ring-indigo-500/60 dark:border-slate-700 dark:bg-slate-950"
                    checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.includes(c.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={filteredCandidates.length === 0}
                  />
                </th>
                <th className="px-6 py-3 font-semibold">Candidate</th>
                <th className="px-6 py-3 font-semibold">Applied Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Match Score</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-transparent dark:divide-white/5">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No candidates found.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => {
                  const displayName = getDisplayName(candidate);
                  const email = getEmail(candidate);
                  const initials = getInitials(displayName);
                  const score = getScore(candidate);
                  const statusLabel = getStatusLabel(candidate);
                  const role = candidate.parsed?.jobTitle || candidate.jobTitle || jobTitles[candidate.jobId] || "Unknown Role";
                  return (
                    <tr key={candidate.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(candidate.id)}
                          onChange={(e) => handleSelectOne(candidate.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 bg-white text-indigo-500 focus:ring-indigo-500/60 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500/40 via-slate-900 to-cyan-400/40 p-[1px] shadow-[0_0_14px_rgba(99,102,241,0.45)]">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-slate-200">
                              {initials}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-200">{displayName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-900 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          <span>{role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(statusLabel)}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-32 rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-1.5 rounded-full ${getScoreBarClasses(score)}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">{score}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title="Accept Candidate"
                          onClick={() => handleAcceptCandidate(candidate.id)}
                          className="rounded-full p-2 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                        >
                          <Check size={18} />
                        </button>
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="rounded-full p-2 text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
                          title="View Candidate"
                        >
                          <Eye size={18} />
                        </Link>
                        <button
                          type="button"
                          title="Reject Candidate"
                          onClick={() => handleRejectClick(candidate.id)}
                          className="rounded-full p-2 text-rose-500 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        >
                          <XCircle size={18} />
                        </button>
                        <button
                          type="button"
                          title="Delete CV"
                          onClick={() => handleDeleteCandidate(candidate.id)}
                          className="rounded-full p-2 text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!limitCount && (
          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-400">Showing {showingFrom}-{showingTo} of {allFilteredCandidates.length}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={pageIndex === 0}
                className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={pageIndex >= totalPages - 1}
                className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <span className="text-sm font-medium text-slate-200">{selectedIds.length} selected</span>
          <div className="h-4 w-px bg-white/10" />
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={processingBatch}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-white/5"
          >
            <BeakerIcon className="h-4 w-4" />
            Evaluate
          </button>
          <div className="h-4 w-px bg-white/10" />
          <button
            onClick={() => setShowCalendarModal(true)}
            disabled={processingBatch}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-white/5"
          >
            <CalendarPlus className="h-4 w-4" />
            Add to Calendar
          </button>
          {canSendEmail && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={processingBatch}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-white/5"
              >
                <EnvelopeIcon className="h-4 w-4" />
                {allAccepted ? "Invite" : "Reject"}
              </button>
            </>
          )}
          <div className="h-4 w-px bg-white/10" />
          <button
            onClick={() => executeBatchAction("delete")}
            disabled={processingBatch}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-rose-200 hover:bg-white/5"
          >
            Delete
          </button>
        </div>
      )}

      <BulkAnalysisModal 
        isOpen={showBulkModal} 
        onClose={() => setShowBulkModal(false)} 
        selectedIds={selectedIds}
      />
      
      <BulkEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        candidates={selectedCandidatesList}
        emailType={allAccepted ? "accepted" : "rejected"}
        onSuccess={() => {
            setShowEmailModal(false);
            setSelectedIds([]);
        }}
      />
      
      <RejectionModal
        isOpen={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        onConfirm={handleConfirmRejection}
      />

      {showCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => !calendarSaving && setShowCalendarModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add to Calendar</h3>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                disabled={calendarSaving}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={calendarType}
                  onChange={(e) => setCalendarType(e.target.value)}
                  disabled={calendarSaving}
                >
                  <option value="Meeting">Meeting</option>
                  <option value="Interview">Interview</option>
                  <option value="Call">Call</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={calendarStart}
                    onChange={(e) => setCalendarStart(e.target.value)}
                    disabled={calendarSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={calendarEnd}
                    onChange={(e) => setCalendarEnd(e.target.value)}
                    disabled={calendarSaving}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                disabled={calendarSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddToCalendar}
                disabled={calendarSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {calendarSaving ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
