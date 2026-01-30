"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from "firebase/firestore";

function getDisplayName(data: any) {
  // 1. Parsed Name (Highest Priority)
  if (data.parsed && data.parsed.name) return data.parsed.name;
  if (data.extractedContact && data.extractedContact.name) return data.extractedContact.name;
  
  // 2. Manual Name (if it's not just a filename)
  const name = data.name;
  const filename = data.filename || "";
  const originalName = data.originalName || "";
  
  // Check if name is just the filename (with or without extension)
  const isFilename = name && (
      name === filename || 
      name === originalName ||
      name === filename.replace(/\.[^/.]+$/, "") ||
      name === originalName.replace(/\.[^/.]+$/, "")
  );
  
  if (name && !isFilename) return name;

  // 3. Email (Good fallback if name is just a filename)
  if (data.email) return data.email;
  if (data.parsed && data.parsed.email) return data.parsed.email;
  if (data.extractedContact && data.extractedContact.email) return data.extractedContact.email;

  // 4. Filename-like Name (Last Resort)
  if (name) return name;
  if (filename) return filename;
  
  return "Unnamed Candidate";
}

interface Candidate {
  id: string;
  name: string;
  role: string;
  source: string;
  score: number;
  status: string;
  date: string;
}

export default function RecentCandidatesTable() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    setLoading(true); // Ensure loading is true initially

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (!user) {
            setCandidates([]);
            setLoading(false);
            return;
        }

        // User is authenticated, start fetching
        setLoading(true);

        try {
            const db = getClientFirestore();
            const cvsRef = collection(db, "cvs");
            
            // Query 1: standard 'uid'
            const q1 = query(cvsRef, where("uid", "==", user.uid));
            
            // Query 2: legacy 'userId'
            const q2 = query(cvsRef, where("userId", "==", user.uid));

            let resultsUid: Map<string, any> = new Map();
            let resultsUserId: Map<string, any> = new Map();
            let hasUidLoaded = false;
            let hasUserIdLoaded = false;

            const updateState = () => {
                // Smart Merge Logic (copied from CandidatesTable to ensure consistency)
                const allIds = new Set([...Array.from(resultsUid.keys()), ...Array.from(resultsUserId.keys())]);
                const mergedDocs = new Map();

                allIds.forEach(id => {
                    const item1 = resultsUid.get(id);
                    const item2 = resultsUserId.get(id);

                    if (item1 && item2) {
                        const d1 = item1.data();
                        const d2 = item2.data();
                        // Prefer the one with a score
                        const s1 = typeof d1.score === 'number' ? d1.score : null;
                        const s2 = typeof d2.score === 'number' ? d2.score : null;

                        if (s1 !== null && s2 === null) {
                            mergedDocs.set(id, item1);
                        } else if (s2 !== null && s1 === null) {
                            mergedDocs.set(id, item2);
                        } else {
                            // Default to item1 (uid) or newest updatedAt
                            const t1 = d1.updatedAt?.seconds || 0;
                            const t2 = d2.updatedAt?.seconds || 0;
                            mergedDocs.set(id, t1 >= t2 ? item1 : item2);
                        }
                    } else {
                        mergedDocs.set(id, item1 || item2);
                    }
                });

                console.log("Debug: updateState called. Total docs merged:", mergedDocs.size);

                const fetchedCandidates = Array.from(mergedDocs.values())
                    .map(doc => {
                        const data = doc.data();
                        
                        // Robust timestamp logic: max of submittedAt or createdAt
                        const tSubmitted = data.submittedAt?.seconds || 0;
                        const tCreated = data.createdAt?.seconds || 0;
                        const timestamp = Math.max(tSubmitted, tCreated);

                        // Date string preference
                        let dateStr = "N/A";
                        if (timestamp > 0) {
                             dateStr = new Date(timestamp * 1000).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            });
                        }

                        const scoreVal = typeof data.score === 'number' ? data.score : (typeof data.matchScore === 'number' ? data.matchScore : 0);
                        const score = isNaN(scoreVal) ? 0 : Math.round(scoreVal);

                        return {
                            id: doc.id,
                            name: getDisplayName(data),
                            role: data.parsed?.jobTitle || data.jobTitle || "Unknown Role",
                            source: data.source || "Upload",
                            score: score,
                            status: data.hiringStatus 
                            ? (data.hiringStatus.charAt(0).toUpperCase() + data.hiringStatus.slice(1)) 
                            : (data.status || "New"),
                            date: dateStr,
                            timestamp: timestamp
                        };
                    })
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 5);
                
                setCandidates(fetchedCandidates);
                setLoading(false);
            };

            const unsub1 = onSnapshot(q1, (snap) => {
                const map = new Map();
                snap.forEach(doc => map.set(doc.id, doc));
                resultsUid = map;
                hasUidLoaded = true;
                updateState();
            }, (error) => {
                console.error("Error fetching uid candidates:", error);
                hasUidLoaded = true;
                if (hasUserIdLoaded) setLoading(false);
            });

            const unsub2 = onSnapshot(q2, (snap) => {
                const map = new Map();
                snap.forEach(doc => map.set(doc.id, doc));
                resultsUserId = map;
                hasUserIdLoaded = true;
                updateState();
            }, (error) => {
                console.warn("Legacy userId query failed (likely permission), ignoring:", error);
                hasUserIdLoaded = true;
                // If legacy fails, we don't block the UI if uid loaded
                if (hasUidLoaded) updateState();
            });

            // Cleanup listeners on unmount or user change
            return () => {
                unsub1();
                unsub2();
            };
        } catch (error) {
            console.error("Error setting up listeners:", error);
            setLoading(false);
        }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full rounded-2xl p-6 transition-all duration-300 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-0 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Candidates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Latest activity from your pipeline</p>
        </div>
        <Link href="/candidates" className="text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-6 py-3">Candidate Name</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Match Score</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-slate-100 animate-pulse dark:bg-white/10" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-slate-100 animate-pulse dark:bg-white/10" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-slate-100 animate-pulse dark:bg-white/10" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-slate-100 animate-pulse dark:bg-white/10" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-slate-100 animate-pulse dark:bg-white/10" /></td>
                </tr>
              ))
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                  No candidates found.
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => (
                <tr key={candidate.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                    <Link href={`/candidates/${candidate.id}`} className="hover:text-cyan-600 dark:hover:text-cyan-300">
                      {candidate.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-900 dark:text-slate-200">{candidate.role}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-28 rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className={`h-1 rounded-full ${
                            candidate.score >= 80
                              ? "bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                              : candidate.score >= 60
                              ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                              : "bg-gradient-to-r from-rose-400 via-rose-500 to-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                          }`}
                          style={{ width: `${candidate.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{candidate.score}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 ${
                        candidate.status === "Interview" || candidate.status === "Accepted"
                          ? "bg-emerald-400/15 ring-1 ring-inset ring-emerald-400/30"
                          : candidate.status === "Rejected"
                          ? "bg-rose-400/15 ring-1 ring-inset ring-rose-400/30"
                          : "bg-cyan-400/15 ring-1 ring-inset ring-cyan-400/30"
                      }`}
                    >
                      {candidate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{candidate.date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
