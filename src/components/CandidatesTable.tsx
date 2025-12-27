"use client";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getClientFirestore, getClientAuth, deleteCandidatesBatch } from "@/lib/firebase";
import { CandidateRow, CandidateItem } from "./CandidateRow";
import { BeakerIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";

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

export default function CandidatesTable({ onCheckCv, limitCount }: CandidatesTableProps) {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "accepted" | "rejected" | "undecided">("all");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [statusFilter]);

  const allFilteredCandidates = candidates.filter((c) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "undecided") return !c.hiringStatus || c.hiringStatus === "undecided";
    return c.hiringStatus === statusFilter;
  });

  const filteredCandidates = allFilteredCandidates.slice(0, limitCount || visibleCount);

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
    let resultsUid: Record<string, CandidateItem> = {};
    let resultsUserId: Record<string, CandidateItem> = {};

    const mergeAndSet = () => {
      // Intelligently merge results to avoid stale overwrites
      const allIds = new Set([...Object.keys(resultsUid), ...Object.keys(resultsUserId)]);
      const merged: Record<string, CandidateItem> = {};

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
      const nextRes: Record<string, CandidateItem> = {};
      snap.forEach((doc) => {
        nextRes[doc.id] = { id: doc.id, ...doc.data() } as CandidateItem;
      });
      resultsUid = nextRes;
      mergeAndSet();
    }, (err) => console.error("Error fetching uid candidates:", err));

    // Query 2: legacy 'userId'
    const q2 = query(collection(db, "cvs"), where("userId", "==", user.uid));
    const unsub2 = onSnapshot(q2, (snap) => {
      const nextRes: Record<string, CandidateItem> = {};
      snap.forEach((doc) => {
        nextRes[doc.id] = { id: doc.id, ...doc.data() } as CandidateItem;
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
    return <div className="p-8 text-center text-gray-500">Loading candidates...</div>;
  }

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Please sign in to view candidates.</div>;
  }

  const selectedCandidatesList = candidates.filter(c => selectedIds.includes(c.id));
  const allAccepted = selectedCandidatesList.length > 0 && selectedCandidatesList.every(c => c.hiringStatus === "accepted");
  const allRejected = selectedCandidatesList.length > 0 && selectedCandidatesList.every(c => c.hiringStatus === "rejected");
  const canSendEmail = (allAccepted || allRejected) && selectedCandidatesList.length <= 50;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Candidates</h2>
        <div className="flex items-center gap-3">

            <div className="isolate inline-flex rounded-md shadow-sm">
                {(['all', 'accepted', 'rejected', 'undecided'] as const).map((status, idx, arr) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10 ${
                            statusFilter === status 
                            ? 'bg-indigo-600 text-white ring-indigo-600 z-10' 
                            : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'
                        } ${
                            idx === 0 ? 'rounded-l-md' : ''
                        } ${
                            idx === arr.length - 1 ? 'rounded-r-md' : ''
                        } ${
                            idx !== 0 ? '-ml-px' : ''
                        }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>
            <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
            <BeakerIcon className="h-4 w-4" />
            Bulk Analysis
            </button>
        </div>
      </div>

      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="pl-3 py-2 w-4">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  checked={filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.includes(c.id))}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                Candidate
              </th>
              <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                Job / Source
              </th>
              <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                Score
              </th>
              <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                Decision
              </th>
              <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-gray-900">
                Date
              </th>
              <th scope="col" className="relative py-2 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No candidates found.
                </td>
              </tr>
            ) : (
              filteredCandidates.map((candidate) => (
                <CandidateRow
                  key={candidate.id}
                  item={candidate}
                  selected={selectedIds.includes(candidate.id)}
                  onSelect={(checked) => handleSelectOne(candidate.id, checked)}
                  jobTitles={jobTitles}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!limitCount && filteredCandidates.length < allFilteredCandidates.length && (
          <div className="flex justify-center py-4">
              <button
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                  Load More Candidates ({allFilteredCandidates.length - filteredCandidates.length} remaining)
              </button>
          </div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 shadow-2xl ring-1 ring-black/10">
          <span className="text-sm font-medium text-gray-600">{selectedIds.length} selected</span>
          <div className="h-4 w-px bg-gray-200" />
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={processingBatch}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <BeakerIcon className="h-4 w-4" />
            Evaluate
          </button>
          
          {canSendEmail && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={processingBatch}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <EnvelopeIcon className="h-4 w-4" />
                {allAccepted ? "Invite" : "Reject"}
              </button>
            </>
          )}

          <div className="h-4 w-px bg-gray-200" />
          <button
            onClick={() => executeBatchAction("delete")}
            disabled={processingBatch}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
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
    </div>
  );
}
