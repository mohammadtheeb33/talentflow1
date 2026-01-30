"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckCircle, Calendar, Upload, Mail } from "lucide-react";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { toast } from "sonner";
import DashboardCalendarWidget from "@/components/DashboardCalendarWidget";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";

const RecentCandidatesTable = dynamic(
  () => import("@/components/dashboard/RecentCandidatesTable"),
  {
    ssr: false,
    loading: () => <div className="h-64 rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
  }
);
const UploadModal = dynamic(() => import("@/components/UploadModal").then((mod) => mod.UploadModal), { ssr: false });
const ConnectOutlookModal = dynamic(() => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal), { ssr: false });

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showOutlookModal, setShowOutlookModal] = useState(false);
  const [stats, setStats] = useState({
    activeJobs: 0,
    newCandidates: 0,
    interviews: 0,
    aiCredits: 0
  });
  const [statsLoaded, setStatsLoaded] = useState({
    jobs: false,
    candidates: false,
    interviews: false,
    credits: false
  });
  const greeting = new Date().getHours() < 12 ? "Good Morning" : "Good Evening";
  const displayName = user?.name || "User";

  useEffect(() => {
    const auth = getClientAuth();
    let unsubscribeJobs;
    let unsubscribeCvsUid;
    let unsubscribeCvsUserId;
    let unsubscribeInterviews;
    let unsubscribeCredits;
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeCvsUid) unsubscribeCvsUid();
      if (unsubscribeCvsUserId) unsubscribeCvsUserId();
      if (unsubscribeInterviews) unsubscribeInterviews();
      if (unsubscribeCredits) unsubscribeCredits();

      if (u) {
        setUser({
          name: u.displayName || "User",
          email: u.email || "",
          initials: (u.displayName || u.email || "U").slice(0, 2).toUpperCase()
        });
        setStatsLoaded({ jobs: false, candidates: false, interviews: false, credits: false });

        const db = getClientFirestore();
        const jobsQuery = query(collection(db, "jobProfiles"), where("uid", "==", u.uid));
        unsubscribeJobs = onSnapshot(
          jobsQuery,
          (snap) => {
            setStats((prev) => ({ ...prev, activeJobs: snap.size }));
            setStatsLoaded((prev) => ({ ...prev, jobs: true }));
          },
          () => setStatsLoaded((prev) => ({ ...prev, jobs: true }))
        );

        const cvsRef = collection(db, "cvs");
        const qUid = query(cvsRef, where("uid", "==", u.uid));
        const qUserId = query(cvsRef, where("userId", "==", u.uid));
        let resultsUid = new Map();
        let resultsUserId = new Map();
        let hasUidLoaded = false;
        let hasUserIdLoaded = false;

        const getMillis = (value) => {
          if (!value) return 0;
          if (typeof value.toMillis === "function") return value.toMillis();
          if (typeof value?.seconds === "number") return value.seconds * 1000;
          if (value instanceof Date) return value.getTime();
          if (typeof value === "number") return value;
          return 0;
        };

        const updateCandidates = () => {
          const allIds = new Set([...Array.from(resultsUid.keys()), ...Array.from(resultsUserId.keys())]);
          const mergedDocs = new Map();
          allIds.forEach((id) => {
            const item1 = resultsUid.get(id);
            const item2 = resultsUserId.get(id);
            if (item1 && item2) {
              const d1 = item1.data();
              const d2 = item2.data();
              const t1 = getMillis(d1.updatedAt);
              const t2 = getMillis(d2.updatedAt);
              mergedDocs.set(id, t1 >= t2 ? item1 : item2);
            } else {
              mergedDocs.set(id, item1 || item2);
            }
          });
          const now = Date.now();
          const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
          let count = 0;
          mergedDocs.forEach((docSnap) => {
            const data = docSnap.data();
            const createdAt = getMillis(data.submittedAt || data.createdAt);
            if (createdAt >= weekAgo) count += 1;
          });
          setStats((prev) => ({ ...prev, newCandidates: count }));
          if (hasUidLoaded && hasUserIdLoaded) {
            setStatsLoaded((prev) => ({ ...prev, candidates: true }));
          }
        };

        unsubscribeCvsUid = onSnapshot(
          qUid,
          (snap) => {
            const map = new Map();
            snap.forEach((docSnap) => map.set(docSnap.id, docSnap));
            resultsUid = map;
            hasUidLoaded = true;
            updateCandidates();
          },
          () => {
            hasUidLoaded = true;
            updateCandidates();
          }
        );

        unsubscribeCvsUserId = onSnapshot(
          qUserId,
          (snap) => {
            const map = new Map();
            snap.forEach((docSnap) => map.set(docSnap.id, docSnap));
            resultsUserId = map;
            hasUserIdLoaded = true;
            updateCandidates();
          },
          () => {
            hasUserIdLoaded = true;
            updateCandidates();
          }
        );

        const eventsQuery = query(collection(db, "events"), where("uid", "==", u.uid));
        unsubscribeInterviews = onSnapshot(
          eventsQuery,
          (snap) => {
            const now = Date.now();
            let count = 0;
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              const startValue = data.start?.toDate
                ? data.start.toDate()
                : data.start?.seconds
                  ? new Date(data.start.seconds * 1000)
                  : new Date(data.start);
              if (!startValue || Number.isNaN(startValue.getTime())) return;
              const isInterview = data.type === "interview" || String(data.title || "").toLowerCase().includes("interview");
              if (isInterview && startValue.getTime() >= now) count += 1;
            });
            setStats((prev) => ({ ...prev, interviews: count }));
            setStatsLoaded((prev) => ({ ...prev, interviews: true }));
          },
          () => setStatsLoaded((prev) => ({ ...prev, interviews: true }))
        );

        const userRef = doc(db, "users", u.uid);
        unsubscribeCredits = onSnapshot(
          userRef,
          (snap) => {
            const data = snap.data() || {};
            const used = Number(data.credits_used || 0);
            const limit = Number(data.credits_limit || 0);
            const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            setStats((prev) => ({ ...prev, aiCredits: percent }));
            setStatsLoaded((prev) => ({ ...prev, credits: true }));
          },
          () => setStatsLoaded((prev) => ({ ...prev, credits: true }))
        );
      } else {
        setUser(null);
        setStats({ activeJobs: 0, newCandidates: 0, interviews: 0, aiCredits: 0 });
        setStatsLoaded({ jobs: true, candidates: true, interviews: true, credits: true });
      }
    });
    return () => {
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeCvsUid) unsubscribeCvsUid();
      if (unsubscribeCvsUserId) unsubscribeCvsUserId();
      if (unsubscribeInterviews) unsubscribeInterviews();
      if (unsubscribeCredits) unsubscribeCredits();
      unsubscribe();
    };
  }, []);

  // Simple loading state or empty if checking auth
  if (!user) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="min-h-[420px] flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300 dark:backdrop-blur-xl dark:shadow-none">
            <div className="h-4 w-4 animate-spin rounded-full border border-cyan-500/60 border-t-transparent dark:border-cyan-300" />
            Loading your workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="grid w-full max-w-[100vw] grid-cols-12 gap-6 px-4 md:px-8 py-6">
        <div className="col-span-12">
          <div className="w-full rounded-3xl bg-white border border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none p-6 transition-all">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/80 to-indigo-500/80 text-sm font-semibold text-white shadow-[0_0_20px_rgba(56,189,248,0.45)]">
                  {user.initials}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-white">{displayName}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">{user.email}</span>
                </div>
              </div>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
                {greeting}, {displayName}!
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Track your pipeline and keep candidates moving forward.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
              >
                <Upload className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span>Upload CV</span>
              </button>
              <button
                onClick={() => setShowOutlookModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(34,211,238,0.45)] transition hover:from-indigo-400 hover:to-cyan-300"
              >
                <Mail className="h-4 w-4" />
                <span>Connect Outlook</span>
              </button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 transition hover:border-slate-300 dark:bg-slate-800/50 dark:border-white/5 dark:text-white">
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Jobs</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{statsLoaded.jobs ? stats.activeJobs : "…"}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 transition hover:border-slate-300 dark:bg-slate-800/50 dark:border-white/5 dark:text-white">
              <p className="text-xs text-slate-500 dark:text-slate-400">New Candidates</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{statsLoaded.candidates ? stats.newCandidates : "…"}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 transition hover:border-slate-300 dark:bg-slate-800/50 dark:border-white/5 dark:text-white">
              <p className="text-xs text-slate-500 dark:text-slate-400">Interviews</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{statsLoaded.interviews ? stats.interviews : "…"}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 transition hover:border-slate-300 dark:bg-slate-800/50 dark:border-white/5 dark:text-white">
              <p className="text-xs text-slate-500 dark:text-slate-400">AI Credits</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{statsLoaded.credits ? `${stats.aiCredits}%` : "…"}</p>
            </div>
          </div>
        </div>
      </div>

        <div className="col-span-12 lg:col-span-7">
          <DashboardCalendarWidget />
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none p-6 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900 dark:text-white">To-dos</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">Today</span>
            </div>
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
                <CheckCircle className="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </div>
              <p className="text-slate-900 font-medium dark:text-white">All done for today</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enjoy your day!</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 w-full">
          <RecentCandidatesTable />
        </div>

        <UploadModal 
          isOpen={showUploadModal} 
          onClose={() => setShowUploadModal(false)} 
        />
        <ConnectOutlookModal 
          isOpen={showOutlookModal} 
          onClose={() => setShowOutlookModal(false)} 
        />
      </div>
    </div>
  );
}
