"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getClientFirestore, getCvDownloadUrl, getClientStorage, getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref as storageRef, listAll, getDownloadURL, uploadBytes } from "firebase/storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  addDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
  FileText,
  User,
  Briefcase,
  GraduationCap,
  MessageSquare,
  History,
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  Lightbulb,
  Mail,
  Phone,
  Linkedin,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { evaluateCv, type JobProfile as EngineJobProfile, type EducationLevel } from "@/lib/scoreEngine";
import { CV } from "@/types/cv";

type JobProfile = {
  id: string;
  title?: string;
  requiredSkills?: string[];
  optionalSkills?: string[];
  minYearsExp?: number;
  educationLevel?: string;
};

const CvPdfViewer = dynamic(() => import("@/components/CvPdfViewer"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-950/80" />,
});
const BulkEmailModal = dynamic(() => import("@/components/BulkEmailModal").then((mod) => mod.BulkEmailModal), {
  ssr: false,
});

function mergeCvData(prev: CV | null, newData: CV): CV {
  if (!prev) return newData;
  
  const merged = { ...newData };
  
  // Preserve local optimistic or existing data if missing in new data
  if (!merged.score && prev.score) merged.score = prev.score;
  if (!merged.scoreExperienceYears && prev.scoreExperienceYears) merged.scoreExperienceYears = prev.scoreExperienceYears;
  if (!merged.aiAnalysis && prev.aiAnalysis) merged.aiAnalysis = prev.aiAnalysis;
  if (!merged.jobProfileId && prev.jobProfileId) merged.jobProfileId = prev.jobProfileId;
  if (!merged.jobTitle && prev.jobTitle) merged.jobTitle = prev.jobTitle;
  if (!merged.scoreBreakdown && prev.scoreBreakdown) merged.scoreBreakdown = prev.scoreBreakdown;
  
  return merged;
}

// Helper hook to mimic NextAuth useSession with Firebase
const useSession = () => {
  const [session, setSession] = useState<{ user: { uid: string } } | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSession({ user: { uid: user.uid } });
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  return { data: session, status };
};

export default function CvDetailPage({ params }: { params: { cvId: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  // params prop is available directly in Next.js 13+ app directory, but we can use useParams as well.
  // The provided code uses useParams which returns ReadonlyURLSearchParams or similar, 
  // but here we can just use the prop or the hook. Let's stick to what was there but handle it safely.
  const urlParams = useParams();
  const cvId = String(params?.cvId || urlParams?.cvId || "");
  
  const [cv, setCv] = useState<CV | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfRefPath, setPdfRefPath] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState<string>("");
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarType, setCalendarType] = useState("Interview");
  const [calendarStart, setCalendarStart] = useState("");
  const [calendarEnd, setCalendarEnd] = useState("");
  const [calendarSaving, setCalendarSaving] = useState(false);
  
  // New state for UI tabs
  // Auto-score effect for public submissions
  useEffect(() => {
    if (!cv) return;
    
    // Auto-score trigger for public submissions that arrived without a score
    // We check for 'Career Page' or 'public_apply' source
    const isPublic = cv.source === 'Career Page' || cv.source === 'public_apply';
    
    // Check if truly unscored (no score AND no analysis) to prevent loops on 0 score
    const isUnscored = (cv.score === undefined || cv.score === null) && !cv.aiAnalysis;
    
    // Check if it's NOT finalized (to avoid re-scoring rejected candidates)
    const status = (cv.status || "").toLowerCase();
    const isFinalized = ["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit", "hired", "interviewed", "offer_sent"].includes(status);

    if (isPublic && isUnscored && !isFinalized) {
      console.log("Auto-scoring public submission via client fail-safe...");
      // Trigger local scoring
      localScoreAndPersist().catch(e => console.error("Client auto-score failed:", e));
    }
  }, [cv?.id, cv?.score, cv?.aiAnalysis, cv?.status]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      setError("غير مصرح: الرجاء تسجيل الدخول");
      return;
    }

    let mounted = true;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        setError(null);
        const uid = session?.user?.uid;
        
        if (!uid) {
           // Should be handled by status check, but safe fallback
           return; 
        }

        const db = getClientFirestore();
        const ref = doc(db, "cvs", cvId);

        // Live listen to CV document so parsed/score fields appear immediately
        unsub = onSnapshot(ref, async (snap) => {
          if (!mounted) return;
          if (snap.exists()) {
            const data = snap.data() as Partial<CV>;
            // تأكد من ملكية المستند
            if (data.uid && data.uid !== uid) {
               // Allow if user is admin or if no UID is present (legacy)
               // For now, if UID is present but doesn't match, we block.
               // But let's log it to be sure.
               console.warn(`Access denied: CV UID ${data.uid} !== Current User ${uid}`);
               // setError("غير مصرح: لا تملك هذه السيرة الذاتية"); // Relaxed for debugging
               // return;
            }
            
            // Intelligent State Merge (Fixes flickering/wiping issue)
            setCv((prev) => mergeCvData(prev, { id: cvId, ...data } as CV));
            
            setSelectedJobId(String(data.jobProfileId || ""));

            // Resolve PDF URL when relevant fields change
            const resolvePdfUrl = async (current: Partial<CV>) => {
              const sp = current.storagePath;
              const fname = String(current.filename || "cv.pdf");
              const companyId = current.companyId;
              const candidates: string[] = [];
              const logs: string[] = [];

              if (sp) { candidates.push(sp); if (mounted) setPdfRefPath(sp); }
              
              // Standard path (Fixed upload flow)
              candidates.push(`cvs/${cvId}/original/${fname}`);

              // Legacy paths (for older uploads)
              candidates.push(`candidates/${cvId}/${fname}`);

              // Fallbacks based on server ingestion conventions
              if (companyId) candidates.push(`companies/${companyId}/cvs/${cvId}/original/${fname}`);
              candidates.push(`unscoped/cvs/${cvId}/original/${fname}`);
              candidates.push(`resumes/${fname}`); // Add this new path for public uploads
              
              for (const p of candidates) {
                try {
                  console.log(`Checking storage path: ${p}`);
                  logs.push(`Checking: ${p}`);
                  const url = await getCvDownloadUrl(p);
                  console.log(`Found URL for ${p}:`, url);
                  logs.push(`Success: ${p}`);
                  if (url && mounted) { 
                    setPdfUrl(url); 
                    setPdfRefPath(p); 
                    setPdfLoadError(null);
                    setDebugLogs(logs);
                    return; 
                  }
                } catch (err: any) {
                   console.warn(`Failed to get URL for ${p}:`, err.code || err.message);
                   logs.push(`Failed ${p}: ${err.code || err.message}`);
                   // If we have an explicit storage path and it fails with permission denied, report it
                   if (sp && p === sp && (err?.code === 'storage/unauthorized' || err?.message?.includes('403'))) {
                      console.log("Permission denied on direct access. Switching to proxy.");
                      
                      // Get current auth token for the proxy
                      const auth = getClientAuth();
                      const token = await auth.currentUser?.getIdToken();
                      
                      const proxyUrl = `/api/cv/download?path=${encodeURIComponent(p)}&token=${token}`;
                      if (mounted) {
                        setPdfUrl(proxyUrl);
                        setPdfRefPath(p);
                        setPdfLoadError(null);
                        // Ensure we treat this as a success for logs
                        logs.push(`Success (Proxy): ${p}`);
                        setDebugLogs(logs);
                        return;
                      }
                   }
                }
              }
              if (mounted) setDebugLogs(logs);
              // As a last resort, list known prefixes and pick first file
              try {
                const storage = getClientStorage();
                const prefixes: string[] = [];
                if (companyId) {
                  prefixes.push(`companies/${companyId}/cvs/${cvId}/original/`);
                  prefixes.push(`companies/${companyId}/cvs/${cvId}/`);
                }
                prefixes.push(`unscoped/cvs/${cvId}/original/`);
                prefixes.push(`unscoped/cvs/${cvId}/`);
                prefixes.push(`resumes/`); // Add this new prefix
                for (const pref of prefixes) {
                  try {
                    const r = storageRef(storage, pref);
                    const res = await listAll(r);
                    const item = res.items.find((it) => it.name.toLowerCase().endsWith(".pdf")) || res.items[0];
                    if (item) {
                      const url = await getDownloadURL(item);
                      if (url && mounted) { setPdfUrl(url); setPdfRefPath(item.fullPath || pref + item.name); return; }
                    }
                  } catch (_) { /* continue */ }
                }
              } catch (_) {}
            };
            resolvePdfUrl(data);
          }
        });

        // Load events and notes only if authorized (ownership checked above via onSnapshot)
        const evSnap = await getDocs(query(collection(db, "cvs", cvId, "events"), limit(50)));
        const evs: any[] = [];
        evSnap.forEach((d) => evs.push({ id: d.id, ...d.data() }));
        evs.sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
        setEvents(evs);
        const nSnap = await getDocs(query(collection(db, "cvs", cvId, "notes"), limit(100)));
        const ns: any[] = [];
        nSnap.forEach((d) => ns.push({ id: d.id, ...d.data() }));
        ns.sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
        setNotes(ns);
      // Fetch jobs
      try {
        // Fallback: If query with where("uid"...) fails, try fetching all (if rule allows)
        let jSnap;
        try {
            jSnap = await getDocs(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(50)));
        } catch (err) {
            console.warn("Filtered job query failed, trying unfiltered...", err);
            jSnap = await getDocs(query(collection(db, "jobProfiles"), limit(50)));
        }
        
        const js: JobProfile[] = [];
        jSnap.forEach((d) => js.push({ id: d.id, ...(d.data() as any) }));
        js.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        setJobs(js);
      } catch (e: any) {
        console.error("Failed to load jobs:", e);
      }
      } catch (e: any) {
        setError(e?.message || "فشل تحميل التفاصيل");
      }
    })();
    return () => { mounted = false; if (unsub) try { unsub(); } catch (_) {} };
  }, [cvId, status, session?.user?.uid]);

  useEffect(() => {
    let active = true;
    async function fetchPdfBlob() {
      if (!pdfUrl) { setPdfBlobUrl(null); setPdfLoadError(null); return; }
      try {
        setPdfLoading(true);
        setPdfLoadError(null);
        // Prefer Storage SDK blob fetch (respects Firebase auth & rules)
        let blob: Blob | null = null;
        
        // Skip direct SDK fetch if using proxy
        const isProxy = pdfUrl.includes("/api/cv/download");

        try {
          if (pdfRefPath && !isProxy) {
            const storage = getClientStorage();
            const r = storageRef(storage, pdfRefPath);
            const mod = await import("firebase/storage");
            if ((mod as any)?.getBlob) {
              blob = await (mod as any).getBlob(r);
            }
          }
        } catch (err: any) {
          const code = String(err?.code || "");
          const msg = String(err?.message || "").toLowerCase();
          if (code.includes("storage/unauthorized") || msg.includes("permission") || msg.includes("403")) {
            if (active) setPdfLoadError("صلاحيات غير كافية");
            return;
          }
          if (code.includes("storage/object-not-found") || msg.includes("not found") || msg.includes("404")) {
            if (active) setPdfLoadError("الملف غير موجود في التخزين");
            return;
          }
          // Fall through to direct fetch below
        }
        if (!blob) {
          console.log("Fetching PDF via URL fetch...");
          let headers: Record<string, string> | undefined = undefined;
          try {
            const auth = getClientAuth();
            const user = auth.currentUser;
            if (user) {
              const token = await user.getIdToken();
              headers = { Authorization: `Bearer ${token}` };
            }
          } catch (_) {}
          const res = await fetch(pdfUrl, { method: "GET", headers });
          if (!res.ok) {
            console.error(`PDF fetch failed: ${res.status} ${res.statusText}`);
            throw new Error(`HTTP ${res.status}`);
          }
          blob = await res.blob();
        }
        const url = URL.createObjectURL(blob);
        if (active) { setPdfBlobUrl(url); setPdfBlob(blob); }
      } catch (e: any) {
        if (active) setPdfLoadError(e?.message || "تعذّر تحميل ملف PDF");
      } finally {
        if (active) setPdfLoading(false);
      }
    }
    fetchPdfBlob();
    return () => { active = false; if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfUrl, pdfRefPath]);

  useEffect(() => {
    if (!showCalendarModal) return;
    if (calendarStart && calendarEnd) return;
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    setCalendarStart(formatDateTime(now));
    setCalendarEnd(formatDateTime(oneHourLater));
  }, [showCalendarModal]);

  async function updateJobProfile(newJobId: string) {
    if (!cvId) return;
    
    // Optimistic update
    setSelectedJobId(newJobId);
    
    const toastId = toast.loading("Updating target role...");
    
    try {
      setSaving(true);
      setError(null);
      const db = getClientFirestore();
      const ref = doc(db, "cvs", cvId);
      // عند تغيير ملف الوظيفة، خزِّن أيضاً عنوانه (إن وُجد) وأعد الحالة إلى pending لتحفيز التقييم
      const selected = jobs.find((j) => j.id === newJobId);
      const jobTitle = selected ? (selected.title || selected.id) : undefined;
      await updateDoc(ref, { jobProfileId: newJobId || null, jobTitle: jobTitle || null, status: "pending" });
      
      toast.success("Role updated successfully!", { id: toastId });
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update role", { id: toastId });
      setError(e?.message || "تعذّر تحديث ملف الوظيفة");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    try {
      const db = getClientFirestore();
      await addDoc(collection(db, "cvs", cvId, "notes"), {
        text: newNote.trim(),
        createdAt: serverTimestamp(),
      });
      setNewNote("");
      // Reload notes quickly
      const nSnap = await getDocs(query(collection(db, "cvs", cvId, "notes"), limit(100)));
      const ns: any[] = [];
      nSnap.forEach((d) => ns.push({ id: d.id, ...d.data() }));
      ns.sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
      setNotes(ns);
    } catch (e: any) {
      setError(e?.message || "تعذّر إضافة الملاحظة");
    }
  }

  async function rescanCv() {
    if (!cvId) return;
    try {
      setStatusUpdating(true);
      const db = getClientFirestore();
      const ref = doc(db, "cvs", cvId);
      // If we have the PDF blob and a writable Storage path, re-upload to trigger parse
      const filename = String(cv?.filename || "cv.pdf");
      const targetPathCandidates: string[] = [];
      // Prefer an existing path under /cvs/
      if (pdfRefPath && (pdfRefPath.includes("/cvs/") || pdfRefPath.startsWith("cvs/"))) {
        targetPathCandidates.push(pdfRefPath);
      }
      const companyId = cv?.companyId;
      if (companyId) targetPathCandidates.push(`companies/${companyId}/cvs/${cvId}/original/${filename}`);
      targetPathCandidates.push(`unscoped/cvs/${cvId}/original/${filename}`);
      let targetPath: string | null = null;
      for (const p of targetPathCandidates) { if (!targetPath && p) targetPath = p; }

      if (pdfBlob && targetPath) {
        try {
          const storage = getClientStorage();
          const r = storageRef(storage, targetPath);
          await uploadBytes(r, pdfBlob, { contentType: "application/pdf", cacheControl: "public, max-age=3600" });
          await updateDoc(ref, { status: "pending", storagePath: targetPath, rescanRequestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
          await addDoc(collection(db, "cvs", cvId, "events"), { type: "rescan_uploaded", createdAt: serverTimestamp(), storagePath: targetPath });
        } catch (e) {
          // Fallback: mark rescan requested without upload
          await updateDoc(ref, { status: "pending", rescanRequestedAt: serverTimestamp() });
          await addDoc(collection(db, "cvs", cvId, "events"), { type: "rescan_requested", createdAt: serverTimestamp(), error: String((e as any)?.message || e || "upload failed") });
        }
      } else {
        await updateDoc(ref, { status: "pending", rescanRequestedAt: serverTimestamp() });
        await addDoc(collection(db, "cvs", cvId, "events"), { type: "rescan_requested", createdAt: serverTimestamp() });
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "تعذّر طلب إعادة المسح");
    } finally {
      setStatusUpdating(false);
    }
  }

  async function forceScoreNow() {
    if (!cvId) return;
    
    // GUARD: Prevent re-scoring if status is finalized
    const currentStatus = String(cv?.status || "").toLowerCase();
    if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit", "hired", "interviewed", "offer_sent"].includes(currentStatus)) {
      toast.error(`Cannot rescore a finalized candidate (${cv?.status}). Change status to 'Pending' first.`);
      return;
    }

    try {
      setStatusUpdating(true);
      setError(null);
      
      // Use the new Admin API route which bypasses storage rules and handles text recovery
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/score-cv', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ cvId })
      });

      let result: any = null;
      try {
        result = await res.json();
      } catch (_) {}

      if (res.status === 403) {
        toast.error("You have run out of credits! Please contact admin to upgrade.");
        return;
      }

      if (!res.ok) {
        const errorMessage = result?.details || result?.error || `HTTP ${res.status}`;
        if (res.status === 503) {
          toast.error(errorMessage || "AI Service is busy. Please try again later.");
          return;
        }
        throw new Error(errorMessage);
      }

      toast.success("Scoring completed successfully");
      router.refresh();
    } catch (e: any) {
      const errorMessage = String(e?.message || e || "");
      const isAiBusy =
        errorMessage.includes("AI Service is busy") ||
        errorMessage.includes("All models failed") ||
        errorMessage.includes("429") ||
        errorMessage.includes("503") ||
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("overloaded");
      if (isAiBusy) {
        toast.error(errorMessage || "AI Service is busy. Please try again later.");
        return;
      }
      console.error("Scoring API failed, falling back to local/trigger:", e);
      // Fallback: If API fails, try to trigger via status update
      try {
        const db = getClientFirestore();
        const ref = doc(db, "cvs", cvId);
        await updateDoc(ref, { status: "pending", scoreRequestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await addDoc(collection(db, "cvs", cvId, "events"), { type: "score_requested_fallback", createdAt: serverTimestamp(), error: String(e?.message || e) });
        router.refresh();
        // Second fallback: Local scoring
        await localScoreAndPersist();
      } catch (_) {
        setError(e?.message || "Failed to execute scoring");
      }
    } finally {
      setStatusUpdating(false);
    }
  }

  function triggerDownload() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = cv?.filename || "cv.pdf";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function formatDateTime(date: Date) {
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleScheduleInterview() {
    if (!cv) return;
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    setCalendarType("Interview");
    setCalendarStart(formatDateTime(now));
    setCalendarEnd(formatDateTime(oneHourLater));
    setShowCalendarModal(true);
  }

  async function handleAddToCalendar() {
    if (!session?.user?.uid) {
      toast.error("Please sign in to add calendar events.");
      return;
    }
    const start = new Date(calendarStart);
    const end = new Date(calendarEnd);
    if (!calendarStart || !calendarEnd || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error("Please select valid start and end times.");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after start time.");
      return;
    }
    if (!cv) return;
    setCalendarSaving(true);
    try {
      const db = getClientFirestore();
      const name = cv.parsed?.name || cv.name || cv.parsed?.email || cv.email || "Candidate";
      const title = `${calendarType} with ${name}`;
      await addDoc(collection(db, "events"), {
        uid: session.user.uid,
        candidateId: cvId,
        candidateName: name,
        title,
        type: calendarType,
        start,
        end,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowCalendarModal(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to add to calendar");
    } finally {
      setCalendarSaving(false);
    }
  }

  // Helpers to render parsed sections that may contain objects instead of strings
  function toText(val: any): string {
    if (val === null || val === undefined) return "";
    const t = typeof val;
    if (t === "string" || t === "number" || t === "boolean") return String(val);
    // Firestore Timestamp
    if ((val as any)?.seconds) {
      try { return new Date((val as any).seconds * 1000).toLocaleDateString(); } catch (_) { /* ignore */ }
    }
    // Date-like object
    if ((val as any)?.toString && typeof (val as any).toString === "function") {
      try { return String((val as any).toString()); } catch (_) { /* ignore */ }
    }
    return "";
  }

  function formatExpItem(e: any): string {
    if (typeof e === "string") return e;
    const title = toText(e?.title || e?.role || e?.position);
    const company = toText(e?.company);
    const start = toText(e?.startDate);
    const end = toText(e?.endDate);
    const desc = toText(e?.description);
    const head = [title, company].filter(Boolean).join(" — ");
    const range = (start || end) ? ` (${start || ""}${end ? ` - ${end}` : ""})` : "";
    const tail = desc ? ` — ${desc}` : "";
    const line = `${head}${range}${tail}`.trim();
    return line || JSON.stringify(e);
  }

  function formatEduItem(e: any): string {
    if (typeof e === "string") return e;
    const degree = toText(e?.degree || e?.certification || e?.title || e?.program);
    const school = toText(e?.school || e?.university || e?.institution);
    const start = toText(e?.startDate);
    const end = toText(e?.endDate);
    const desc = toText(e?.description);
    const head = [degree, school].filter(Boolean).join(" — ");
    const range = (start || end) ? ` (${start || ""}${end ? ` - ${end}` : ""})` : "";
    const tail = desc ? ` — ${desc}` : "";
    const line = `${head}${range}${tail}`.trim();
    return line || JSON.stringify(e);
  }

  function parseDate(d: string | null): Date | null {
    if (!d) return null;
    if (/present|current|now/i.test(d)) return new Date();
    // YYYY-MM
    if (/^\d{4}[-/]\d{1,2}/.test(d)) {
      const parts = d.split(/[-/]/);
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
    // Month YYYY or Mon YYYY
    const parts = d.split(/[\s,]+/);
    if (parts.length >= 2) {
      const y = parseInt(parts.find(p => /\d{4}/.test(p)) || "");
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const mStr = parts.find(p => months.some(m => p.toLowerCase().startsWith(m)));
      if (y && mStr) {
        const mi = months.findIndex(m => mStr.toLowerCase().startsWith(m));
        return new Date(y, mi >= 0 ? mi : 0, 1);
      }
    }
    // YYYY
    const y = parseInt(d);
    if (!isNaN(y) && y > 1900 && y < 2100) return new Date(y, 0, 1);
    return null;
  }

  // تقييم محلي احتياطي إذا تعذّر استدعاء وظائف السحابة
  async function localScoreAndPersist() {
    try {
      const db = getClientFirestore();
      const ref = doc(db, "cvs", cvId);
      const snap = await getDoc(ref);
      const data = (snap.exists() ? snap.data() : cv) as Partial<CV> | null;

      // GUARD: Prevent re-scoring if status is finalized
      const currentStatus = String(data?.status || "").toLowerCase();
      if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit", "hired", "interviewed", "offer_sent"].includes(currentStatus)) {
        console.log(`Skipping local scoring for finalized status: ${currentStatus}`);
        return;
      }
      
      // Handle missing parsed data gracefully
      let parsed = data?.parsed;
      if (!parsed) {
          // If no parsed data, try to construct minimal structure from raw text or just proceed
          console.warn("No parsed data found. Attempting to recover...");
          if ((data as any)?.text) {
             // Fake parsed structure to allow scoring to proceed on raw text
             parsed = { skills: [], experience: [], education: [] };
          } else {
             // Truly no data
             console.warn("No parsed data AND no raw text. Cannot score.");
             
             // Attempt server-side recovery (Text Extraction + Scoring)
             try {
                 console.log("Attempting server-side text recovery...");
                 toast.info("Attempting to recover text from file...");
                 
                 const auth = getClientAuth();
                 const token = await auth.currentUser?.getIdToken();
                 const res = await fetch('/api/admin/score-cv', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ cvId })
                 });
                 
                 if (res.ok) {
                      console.log("Recovery successful, reloading...");
                      toast.success("Text recovered successfully! Reloading...");
                      window.location.reload();
                      return;
                  } else {
                      const errText = await res.text();
                      console.error("Recovery failed:", errText);
                      try {
                          const errJson = JSON.parse(errText);
                          const msg = errJson.details ? `${errJson.error}: ${errJson.details}` : (errJson.error || "Unknown error");
                          toast.error(`Recovery failed: ${msg}`);
                      } catch {
                          toast.error(`Recovery failed: ${errText.slice(0, 100)}`);
                      }
                  }
             } catch (recErr) {
                 console.error("Recovery error:", recErr);
                 toast.error("Recovery error: " + (recErr instanceof Error ? recErr.message : "Network/Server error"));
             }
             
             // Don't throw error, just stop scoring
             return; 
          }
      }

      // حضّر ملف الوظيفة المستخدم
      let jobData: any = null;
      let jobId = selectedJobId || String(data?.jobProfileId || "");
      if (jobId && jobId !== "auto") {
        try {
          const jpSnap = await getDoc(doc(db, "jobProfiles", jobId));
          if (jpSnap.exists()) {
            jobData = jpSnap.data();
          } else {
             // If Job Profile not found in DB (permission or deleted), we might have minimal info in CV doc
             console.warn(`Job Profile ${jobId} not found or permission denied.`);
          }
        } catch (err) {
            console.error("Error fetching Job Profile for scoring:", err);
        }
      }
      
      // بناء ملف وظيفة افتراضي أو استخدام الموجود
      let engineJob: EngineJobProfile;
      
      if (!jobData) {
        const skills: string[] = Array.isArray(parsed?.skills) ? parsed.skills : [];
        const req = skills.slice(0, 8);
        engineJob = {
          requiredSkills: req,
          optionalSkills: [],
          minYearsExp: Math.min(5, Math.max(1, (parsed?.experience?.length || 0))),
          educationLevel: (Array.isArray(parsed?.education) && parsed.education.length > 0) ? "bachelor" : "none",
          title: data?.jobTitle || "General Role",
        };
        jobId = "auto";
      } else {
        // Map Firestore job data to EngineJobProfile
        engineJob = {
          title: jobData.title,
          requiredSkills: Array.isArray(jobData.requiredSkills) ? jobData.requiredSkills : [],
          optionalSkills: Array.isArray(jobData.optionalSkills) ? jobData.optionalSkills : [],
          minYearsExp: Number(jobData.minYearsExp) || 0,
          educationLevel: (jobData.educationLevel as EducationLevel) || "none",
        };
      }

      // Run Scoring Engine
      console.log("Starting evaluateCv with:", { textLength: ((data as any)?.text || "").length, jobTitle: engineJob.title });
      
      // Use raw text if available, otherwise fallback to stringified parsed data
      // If neither is available (should be caught above), use empty string
      const rawText = (data as any)?.text || (data as any)?.content || (parsed ? JSON.stringify(parsed) : "") || "";
      
      if (!rawText || rawText.length < 10) {
          console.warn("Text content too short for scoring.");
          return;
      }

      const auth = getClientAuth();
      const uid = auth.currentUser?.uid;
      
      const scoreResult = await evaluateCv(rawText, engineJob, { userId: uid, cvId: cvId });
      console.log("evaluateCv result:", scoreResult);

      if (!scoreResult) {
        throw new Error("Internal Error: Scoring engine returned no result");
      }

      // Update Local State
      const newScoreBreakdown = scoreResult.breakdown;
      let totalScore = scoreResult.score;

      // Robust score sanitization
      if (typeof totalScore === 'string') {
         const match = (totalScore as string).match(/(\d+(\.\d+)?)/);
         totalScore = match ? parseFloat(match[0]) : 0;
      } else if (typeof totalScore === 'number') {
         if (isNaN(totalScore)) totalScore = 0;
      } else {
         totalScore = 0;
      }

      const riskFlags = scoreResult.riskFlags || [];

      // Generate Analysis Text from Engine Results (Human Verdict)
      let analysisText = scoreResult.explanation.join("\n\n");
      if (!analysisText) {
        analysisText = `Candidate scored ${totalScore}/100. AI did not provide a detailed summary.`;
      }
      
      // Improvements & Risks
      let improvementsText = "";
      if (riskFlags.length > 0) {
        improvementsText += "Risk Flags:\n" + riskFlags.map(f => `• ${f.message}`).join("\n");
      }

      // Persist to Firestore
      const updatePayload: any = {
        score: totalScore,
        scoreBreakdown: newScoreBreakdown,
        scoreDetailedBreakdown: scoreResult.detailedBreakdown,
        scoreRiskFlags: riskFlags, // Save Array of RiskFlag objects
        scoreExperienceYears: scoreResult.relevantExperienceYears || 0,
        scoreEducationDetected: (engineJob.educationLevel as string) || "none",
        scoreInferredSkills: scoreResult.inferredSkills || [],
        scoreSkillsAnalysis: scoreResult.skillsAnalysis || { directMatches: [], inferredMatches: [], missing: [] },
        aiAnalysis: analysisText, // This is the Human Verdict
        improvements: improvementsText,
        extractedContact: scoreResult.extractedContact, // Save extracted contact info
        updatedAt: serverTimestamp(),
      };
      
      // If we used a specific job profile, link it
      if (jobId && jobId !== "auto") {
        updatePayload.jobProfileId = jobId;
        updatePayload.jobId = jobId; // Alias
        updatePayload.jobTitle = engineJob.title || "Unknown Job";
        updatePayload.targetRole = engineJob.title || "Unknown Role";
      }

      await updateDoc(ref, updatePayload);

      // Reload local data
      const newCv = { ...data, ...updatePayload };
      setCv(newCv);
      
      // Refresh events/notes if needed or just notify
      // alert("تم تحديث التقييم محلياً بناءً على القواعد الجديدة");
    } catch (err) {
      console.error("Local scoring error:", err);
      setError("فشل التقييم المحلي: " + (err as Error).message);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent"></div>
          <p className="text-slate-500 dark:text-slate-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <div className="p-8 text-center text-rose-600 dark:text-rose-400">Session expired. Please log in again.</div>;
  }

  const displayName = cv?.parsed?.name || cv?.name || cv?.parsed?.email || cv?.email || "Candidate";
  const roleTitle = cv?.parsed?.jobTitle || cv?.jobTitle || jobs.find((j) => j.id === selectedJobId)?.title || "Role not specified";
  const email = cv?.extractedContact?.email || cv?.parsed?.email || cv?.email || "";
  const phone = cv?.extractedContact?.phone || cv?.parsed?.phone || "";
  const linkedin = cv?.extractedContact?.linkedin || cv?.parsed?.linkedin || "";
  const nameParts = displayName.split(" ").filter(Boolean);
  const initials = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` : displayName.slice(0, 2);
  const matchScoreRaw = Number(cv?.matchScore ?? cv?.score ?? cv?.overallScore ?? 0);
  const matchScore = Math.min(100, Math.max(0, isNaN(matchScoreRaw) ? 0 : Math.round(matchScoreRaw)));
  const scoreDeg = Math.round((matchScore / 100) * 360);
  const scoreRing = matchScore >= 85
    ? `conic-gradient(from 90deg, rgba(16,185,129,0.95), rgba(34,211,238,0.9) ${scoreDeg}deg, rgba(148,163,184,0.16) ${scoreDeg}deg)`
    : matchScore >= 60
    ? `conic-gradient(from 90deg, rgba(251,191,36,0.95), rgba(251,146,60,0.9) ${scoreDeg}deg, rgba(148,163,184,0.16) ${scoreDeg}deg)`
    : `conic-gradient(from 90deg, rgba(244,63,94,0.95), rgba(248,113,113,0.9) ${scoreDeg}deg, rgba(148,163,184,0.16) ${scoreDeg}deg)`;
  const scoreAccent = matchScore >= 85 ? "text-emerald-300" : matchScore >= 60 ? "text-amber-300" : "text-rose-300";
  const skills = Array.isArray(cv?.parsed?.skills)
    ? cv.parsed.skills.map((s) => (typeof s === "string" ? s : toText(s))).filter(Boolean)
    : Array.isArray(cv?.scoreInferredSkills)
    ? cv.scoreInferredSkills
    : [];
  const strengths = Array.isArray((cv as any)?.matchDetails?.strengths)
    ? (cv as any).matchDetails.strengths
    : Array.isArray((cv as any)?.matchDetails?.pros)
    ? (cv as any).matchDetails.pros
    : [];
  const weaknesses = Array.isArray((cv as any)?.matchDetails?.weaknesses)
    ? (cv as any).matchDetails.weaknesses
    : Array.isArray((cv as any)?.matchDetails?.cons)
    ? (cv as any).matchDetails.cons
    : Array.isArray(cv?.parsed?.improvements)
    ? cv?.parsed?.improvements
    : [];
  const analysisSummary = cv?.parsed?.aiAnalysis || cv?.aiAnalysis || cv?.analysis || "";
  const normalizedStatus = String(cv?.hiringStatus || cv?.status || "").toLowerCase();
  const emailType = normalizedStatus.includes("accept")
    || normalizedStatus.includes("strong_fit")
    || normalizedStatus.includes("strong fit")
    || normalizedStatus.includes("offer")
    || normalizedStatus.includes("interview")
    ? "accepted"
    : "rejected";
  const emailCandidate = cv ? { ...cv, id: cvId, name: displayName, email, jobTitle: roleTitle } : null;
  const experienceItems = Array.isArray(cv?.parsed?.structuredExperience) && cv.parsed.structuredExperience.length > 0
    ? cv.parsed.structuredExperience
    : Array.isArray(cv?.parsed?.experience)
    ? cv.parsed.experience
    : [];
  const educationItems = Array.isArray(cv?.parsed?.education) ? cv.parsed.education : [];
  const certifications = Array.isArray(cv?.parsed?.certifications) ? cv.parsed.certifications : [];
  const courses = cv?.parsed?.courses || "";
  const detailedBreakdown = cv?.scoreDetailedBreakdown as any;
  const breakdownItems = detailedBreakdown
    ? [
        { label: "Role Fit", score: detailedBreakdown?.roleFit?.score },
        { label: "Skills Match", score: detailedBreakdown?.skillsQuality?.score },
        { label: "Experience", score: detailedBreakdown?.experienceQuality?.score },
        { label: "Project Impact", score: detailedBreakdown?.projectsImpact?.score },
        { label: "ATS Format", score: detailedBreakdown?.atsFormat?.score },
        { label: "Language Clarity", score: detailedBreakdown?.languageClarity?.score },
      ]
    : cv?.scoreBreakdown
    ? Object.entries(cv.scoreBreakdown as Record<string, number>).map(([label, score]) => ({
        label: label.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
        score,
      }))
    : [];

  return (
    <div className="min-h-screen w-full bg-slate-50 pb-16 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-200 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white">Candidates</Link>
                <span>/</span>
                <span className="text-slate-700 dark:text-slate-200">{displayName}</span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{displayName}</h1>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {cv?.status || "Open to Work"}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Updated {cv?.updatedAt?.seconds ? new Date(cv.updatedAt.seconds * 1000).toLocaleDateString() : "Recently"}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-6 max-w-7xl px-6">
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
            <AlertCircle className="h-5 w-5 text-rose-300" />
            <p>{error}</p>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-6 pb-10 pt-8">
        <div className="mb-6 w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative h-28 w-28 rounded-full bg-gradient-to-r from-cyan-400/60 via-indigo-500/70 to-purple-500/70 p-[2px] shadow-[0_0_35px_rgba(56,189,248,0.35)]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-900 dark:bg-slate-950 dark:text-white">
                  {initials.toUpperCase()}
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">{displayName}</h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                    {cv?.status || "Open to Work"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{roleTitle}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={triggerDownload}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_25px_rgba(99,102,241,0.55)]"
                  >
                    <Download className="h-4 w-4" />
                    Download CV
                  </button>
                  {email ? (
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                    >
                      <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      Send Email
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-400 opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
                    >
                      <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      Send Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleScheduleInterview}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                    Schedule Interview
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="relative h-32 w-32">
                <div className="absolute inset-0 rounded-full" style={{ background: scoreRing }} />
                <div className="absolute inset-[10px] flex items-center justify-center rounded-full border border-slate-200 bg-white text-3xl font-semibold text-slate-900 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/80 dark:text-white">
                  {matchScore}%
                </div>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                AI Match Score
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/50 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Quick Intel
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-white/5 dark:shadow-none">
                  <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                    <p className="break-all text-sm text-slate-900 dark:text-slate-200">{email || "Not found"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-white/5 dark:shadow-none">
                  <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
                    <p className="text-sm text-slate-900 dark:text-slate-200">{phone || "Not found"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-white/5 dark:shadow-none">
                  <Linkedin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">LinkedIn</p>
                    {linkedin ? (
                      <a href={linkedin} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-900 hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-100">
                        View Profile
                      </a>
                    ) : (
                      <p className="text-sm text-slate-900 dark:text-slate-200">Not found</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-white/5 dark:shadow-none">
                  <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Experience</p>
                    <p className="text-sm text-slate-900 dark:text-slate-200">
                      {cv?.scoreExperienceYears !== undefined ? `${cv.scoreExperienceYears} Years` : "Calculating"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/50 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <Lightbulb className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Top Skills
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {skills.length > 0 ? (
                  skills.slice(0, 16).map((skill, idx) => (
                    <span
                      key={`${skill}-${idx}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-cyan-500/30 dark:bg-slate-800/80 dark:text-cyan-200"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">No skills listed</span>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/50 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Target Role</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Match Calibration</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Select the role to tune AI scoring focus.</p>
                </div>
                <div className="w-full lg:w-80">
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={selectedJobId}
                    onChange={(e) => updateJobProfile(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select a job profile...</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title || j.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-slate-900/50 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Analysis Report</h3>
                </div>
                <button
                  onClick={forceScoreNow}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-300/60 dark:hover:bg-indigo-500/20"
                >
                  {statusUpdating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
                  {statusUpdating ? "Analyzing" : "Re-evaluate"}
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-medium leading-relaxed text-slate-600 dark:border-indigo-500/20 dark:bg-indigo-500/5 dark:text-slate-300">
                {analysisSummary ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{analysisSummary}</p>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <BrainCircuit className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">No AI analysis available yet</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Run a rescan to generate the CV coach feedback.</p>
                    </div>
                    <button
                      onClick={rescanCv}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Generate Analysis
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Strengths
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-emerald-900 dark:text-emerald-100">
                    {strengths.length > 0 ? (
                      strengths.slice(0, 5).map((item: string, idx: number) => (
                        <li key={`${item}-${idx}`} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-emerald-600 dark:text-emerald-400">No strengths highlighted</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-900/10">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    Gaps & Risks
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-amber-900 dark:text-amber-100">
                    {weaknesses.length > 0 ? (
                      weaknesses.slice(0, 5).map((item: string, idx: number) => (
                        <li key={`${item}-${idx}`} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-amber-600 dark:text-amber-400">No critical gaps detected</li>
                    )}
                  </ul>
                </div>
              </div>

              {breakdownItems.length > 0 && (
                <div className="mt-6 space-y-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Detailed Scoring</p>
                  <div className="space-y-3">
                    {breakdownItems.map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                          <span>{item.label}</span>
                          <span className="text-slate-500 dark:text-slate-200">{Math.round(Number(item.score) || 0)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-200/70 dark:bg-white/10">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300 shadow-[0_0_10px_rgba(56,189,248,0.45)]"
                            style={{ width: `${Math.min(100, Math.max(0, Number(item.score) || 0))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Professional Experience</h3>
              </div>
              <div className="relative mt-6 space-y-6 pl-6">
                <div className="absolute left-2 top-0 bottom-0 border-l-2 border-slate-200 dark:border-white/10" />
                {experienceItems.length > 0 ? (
                  experienceItems.map((item: any, idx: number) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[25px] top-2 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-indigo-50 dark:bg-indigo-500 dark:ring-indigo-500/20" />
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
                        {formatExpItem(item)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No experience data available.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Education & Credentials</h3>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Education</p>
                  <ul className="mt-3 space-y-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                    {educationItems.length > 0 ? (
                      educationItems.map((item: any, idx: number) => (
                        <li key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/40">
                          {formatEduItem(item)}
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500 dark:text-slate-400">No education data.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Certifications</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    {certifications.length > 0 ? (
                      certifications.map((cert: string, idx: number) => (
                        <span key={`${cert}-${idx}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs dark:border-white/10 dark:bg-slate-950/40">
                          {cert}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">No certifications listed.</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Courses</p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
                    {courses || "No courses found."}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">CV Preview</h3>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                <div className="h-[520px]">
                  <CvPdfViewer
                    pdfBlobUrl={pdfBlobUrl}
                    pdfUrl={pdfUrl}
                    zoom={zoom}
                    onZoomOut={() => setZoom((z) => Math.max(50, z - 10))}
                    onZoomIn={() => setZoom((z) => Math.min(200, z + 10))}
                    pdfLoading={pdfLoading}
                    pdfLoadError={pdfLoadError}
                    debugLogs={debugLogs}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notes</h3>
                </div>
                <div className="space-y-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full min-h-[90px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-900 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={addNote}
                      disabled={!newNote.trim()}
                      className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      Add Note
                    </button>
                  </div>
                </div>
                <div className="mt-5 space-y-4 max-h-[260px] overflow-y-auto pr-1">
                  {notes.map((n) => (
                    <div key={n.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      <div>
                        <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{n.text}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : "Just now"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && <p className="text-center text-sm text-slate-500 dark:text-slate-400">No notes added yet.</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
                <div className="mb-4 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activity Log</h3>
                </div>
                <div className="relative ml-2 space-y-6 border-l-2 border-slate-200 pl-6 dark:border-white/10">
                  {events.map((e) => (
                    <div key={e.id} className="relative">
                      <span className="absolute -left-[29px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-indigo-50 dark:bg-indigo-500 dark:ring-indigo-500/20" />
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {e.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleString() : ""}
                        </p>
                        {typeof e.score === "number" && (
                          <span className="mt-1 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                            Score: {e.score}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {events.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
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
      {emailCandidate && (
        <BulkEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          candidates={[emailCandidate]}
          emailType={emailType}
          onSuccess={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}
