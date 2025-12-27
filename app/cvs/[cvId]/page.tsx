"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getClientFirestore, getCvDownloadUrl, getClientStorage, getClientAuth } from "@/lib/firebase";
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
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  User,
  Briefcase,
  GraduationCap,
  MessageSquare,
  History,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Maximize,
  Award,
  BookOpen,
  AlertTriangle,
  BrainCircuit,
  Lightbulb,
  Quote,
  Mail,
  Phone,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ScoreCard from "@/components/ScoreCard";
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function CvDetailPage({ params }: { params: { cvId: string } }) {
  const router = useRouter();
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
  
  // New state for UI tabs
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "raw">("overview");

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        setError(null);
        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setError("غير مصرح: الرجاء تسجيل الدخول");
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
              setError("غير مصرح: لا تملك هذه السيرة الذاتية");
              return;
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
              if (sp) { candidates.push(sp); if (mounted) setPdfRefPath(sp); }
              
              // Standard path (Fixed upload flow)
              candidates.push(`cvs/${cvId}/original/${fname}`);

              // Fallbacks based on server ingestion conventions
              if (companyId) candidates.push(`companies/${companyId}/cvs/${cvId}/original/${fname}`);
              candidates.push(`unscoped/cvs/${cvId}/original/${fname}`);
              
              for (const p of candidates) {
                try {
                  const url = await getCvDownloadUrl(p);
                  if (url && mounted) { 
                    setPdfUrl(url); 
                    setPdfRefPath(p); 
                    setPdfLoadError(null);
                    return; 
                  }
                } catch (err: any) {
                   // If we have an explicit storage path and it fails with permission denied, report it
                   if (sp && p === sp && (err?.code === 'storage/unauthorized' || err?.message?.includes('403'))) {
                      if (mounted) setPdfLoadError("Permission denied: You do not have access to this file.");
                   }
                }
              }
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
        // Load job profiles for linking
        const jSnap = await getDocs(query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(50)));
        const js: JobProfile[] = [];
        jSnap.forEach((d) => js.push({ id: d.id, ...(d.data() as any) }));
        js.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        setJobs(js);
      } catch (e: any) {
        setError(e?.message || "فشل تحميل التفاصيل");
      }
    })();
    return () => { mounted = false; if (unsub) try { unsub(); } catch (_) {} };
  }, [cvId]);

  useEffect(() => {
    let active = true;
    async function fetchPdfBlob() {
      if (!pdfUrl) { setPdfBlobUrl(null); setPdfLoadError(null); return; }
      try {
        setPdfLoading(true);
        setPdfLoadError(null);
        // Prefer Storage SDK blob fetch (respects Firebase auth & rules)
        let blob: Blob | null = null;
        try {
          if (pdfRefPath) {
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
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      // If we are calling the local Functions emulator, seed the Firestore emulator
      // with the current CV (and its job profile) so the function can find the doc.
      try {
        const onLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const useEmu = String(process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR || "") === "1";
        if (onLocalhost && useEmu) {
          const appMod = await import("firebase/app");
          const fsMod: any = await import("firebase/firestore");
          const firebaseConfig = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
          } as any;
          const remoteApp = (appMod.getApps().find((a: any) => a.name === "remote") || appMod.initializeApp(firebaseConfig, "remote"));
          const dbRemote = fsMod.getFirestore(remoteApp);
          const remoteRef = fsMod.doc(dbRemote, "cvs", cvId);
          const remoteSnap = await fsMod.getDoc(remoteRef);
          if (remoteSnap.exists()) {
            const data = remoteSnap.data();
            const emuApp = (appMod.getApps().find((a: any) => a.name === "emu") || appMod.initializeApp(firebaseConfig, "emu"));
            const dbEmu = fsMod.getFirestore(emuApp);
            const emuFsPort = Number(process.env.FIREBASE_EMULATORS_FIRESTORE_PORT || 0) || 8090;
            fsMod.connectFirestoreEmulator(dbEmu, "127.0.0.1", emuFsPort);
            await fsMod.setDoc(fsMod.doc(dbEmu, "cvs", cvId), data, { merge: true });
            const jpId = String((data as any)?.jobProfileId || "");
            if (jpId) {
              const jpSnap = await getDoc(doc(dbRemote, "jobProfiles", jpId));
              if (jpSnap.exists()) {
                await fsMod.setDoc(fsMod.doc(dbEmu, "jobProfiles", jpId), jpSnap.data(), { merge: true });
              }
            }
          }
        }
      } catch (_) { /* best-effort seeding for emulator */ }
      const projectId = String(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "");
      const region = "us-central1";
      const name = "forceScoreCvPublic";
      const onLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const useEmu = String(process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR || "") === "1";
      const emuPort = Number(process.env.FIREBASE_EMULATORS_FUNCTIONS_PORT || 0) || 5001;
      const base = (onLocalhost && useEmu && projectId)
        ? `http://127.0.0.1:${emuPort}/${projectId}/${region}`
        : (projectId ? `https://${region}-${projectId}.cloudfunctions.net` : "");
      if (!base) throw new Error("لم يتم ضبط projectId. حدّث .env.local");
      let headers: Record<string, string> | undefined = undefined;
      try {
        const auth = getClientAuth();
        const user = auth.currentUser;
        if (user) {
          const token = await user.getIdToken();
          headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        }
      } catch (_) {}
      const url = `${base}/${name}?cvId=${encodeURIComponent(cvId)}`;
      const res = await fetch(url, { method: "POST", headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e: any) {
      // مسار احتياطي: إذا فشل استدعاء وظيفة السحابة (مثلاً قيود Invoker أو 403)،
      // حفّز المُشغِّل scoreCv عبر تعديل المستند ليدير التقييم من خلال Trigger.
      try {
        const db = getClientFirestore();
        const ref = doc(db, "cvs", cvId);
        await updateDoc(ref, { status: "pending", scoreRequestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await addDoc(collection(db, "cvs", cvId, "events"), { type: "score_requested_fallback", createdAt: serverTimestamp(), error: String(e?.message || e) });
        router.refresh();
        // محاولة ثانية: تقييم محلي وكتابة النتائج مباشرةً لعرض الدرجة فورًا
        await localScoreAndPersist();
      } catch (_) {
        setError(e?.message || "تعذّر تنفيذ التقييم الآن");
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
      const parsed = data?.parsed;
      if (!parsed) throw new Error("لا توجد بيانات مستخرجة parsed");

      // حضّر ملف الوظيفة المستخدم
      let jobData: any = null;
      let jobId = selectedJobId || String(data?.jobProfileId || "");
      if (jobId && jobId !== "auto") {
        try {
          const jpSnap = await getDoc(doc(db, "jobProfiles", jobId));
          if (jpSnap.exists()) jobData = jpSnap.data();
        } catch (_) {}
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
      const rawText = (data as any)?.text || (data as any)?.content || JSON.stringify(parsed);
      
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

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/Dashboard" 
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <Link href="/Dashboard" className="hover:text-gray-900">Candidates</Link>
                <span>/</span>
                <span className="text-gray-900">
                  {cv?.parsed?.name || cv?.name || "Candidate Profile"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">
                  {!cv ? "Loading..." : (cv.parsed?.name || cv.name || cv.parsed?.email || cv.email || "Unnamed Candidate")}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={forceScoreNow} 
              disabled={statusUpdating}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              {statusUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>AI is reading...</span>
                </>
              ) : (
                <>
                  <BrainCircuit className="h-4 w-4" />
                  <span>Evaluate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-6 max-w-7xl px-6">
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p>{error}</p>
          </div>
        </div>
      )}

      <main className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Left Panel: PDF Viewer */}
        <div className="w-[55%] h-full bg-zinc-900 overflow-hidden relative flex flex-col border-r border-gray-200">
          <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Original Resume</span>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-zinc-600 bg-zinc-700 p-1 shadow-sm">
              <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100 rounded transition-colors">
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[3rem] text-center text-xs font-medium text-zinc-300">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100 rounded transition-colors">
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-3 w-px bg-zinc-600" />
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100 rounded transition-colors" title="Open in new tab">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
            
          <div className="relative flex-1 w-full bg-zinc-900 overflow-hidden">
            {pdfBlobUrl || pdfUrl ? (
              <div className="h-full w-full overflow-auto p-8 flex justify-center custom-scrollbar">
                <div style={{ width: `${zoom}%`, transition: 'width 0.2s' }} className="shadow-2xl">
                  <iframe 
                    src={pdfBlobUrl || pdfUrl || undefined} 
                    className="min-h-[calc(100vh-10rem)] w-full bg-white rounded-sm" 
                    title="PDF Viewer"
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
                <div className="rounded-full bg-zinc-800 p-4">
                  <FileText className="h-8 w-8 text-zinc-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-400">No Document Available</p>
                  {pdfLoading && <p className="text-xs mt-1 text-zinc-500">Loading document from secure storage...</p>}
                  {pdfLoadError && <p className="text-xs text-red-400 mt-1">{pdfLoadError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Analysis & Details */}
        <div className="w-[45%] h-full overflow-y-auto bg-white p-6 pb-20 custom-scrollbar">
          <div className="space-y-6">
          {/* Tabs */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-1">
              <div className="flex gap-1">
                {(["overview", "analysis", "raw"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                      activeTab === tab
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Job Match Selection */}
                  <div className="rounded-lg bg-indigo-50/50 p-4 border border-indigo-100">
                    <label className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2 block">
                      Target Role
                    </label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded-md border-indigo-200 bg-white py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
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

                  <ScoreCard cv={cv} />

                  {/* Recruiter Notes (AI Analysis) */}
                  {cv?.aiAnalysis && (
                    <div className="relative rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                         <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                           <BrainCircuit className="h-5 w-5" />
                         </div>
                         <h3 className="font-semibold text-gray-900">Recruiter Notes</h3>
                      </div>
                      
                      <div className="relative pl-4">
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-indigo-200"></div>
                        <Quote className="absolute -left-1.5 -top-2 h-4 w-4 bg-white text-indigo-300" />
                        <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-gray-700 pt-1">
                          "{cv.aiAnalysis}"
                        </p>
                      </div>
                      
                      <div className="mt-3 flex items-center justify-end border-t border-indigo-50 pt-2">
                        <span className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                          Generated by AI Recruiter <BrainCircuit className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Contact Info (Identity Card) */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <User className="h-4 w-4 text-gray-500" />
                      Identity Card
                    </h3>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-start justify-between rounded-md border border-gray-100 bg-white p-3 shadow-sm">
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium text-gray-900 select-all">
                          {cv?.extractedContact?.email || cv?.parsed?.email || cv?.email || <span className="text-red-400">Not Found</span>}
                        </span>
                      </div>
                      <div className="flex items-start justify-between rounded-md border border-gray-100 bg-white p-3 shadow-sm">
                        <span className="text-gray-500">Phone</span>
                        <span className="font-medium text-gray-900 select-all">
                          {cv?.extractedContact?.phone || cv?.parsed?.phone || <span className="text-red-400">Not Found</span>}
                        </span>
                      </div>
                      <div className="flex items-start justify-between rounded-md border border-gray-100 bg-white p-3 shadow-sm">
                        <span className="text-gray-500">LinkedIn</span>
                        {cv?.extractedContact?.linkedin || cv?.parsed?.linkedin ? (
                          <a 
                            href={cv?.extractedContact?.linkedin || cv?.parsed?.linkedin} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-1 font-medium text-indigo-600 hover:underline"
                          >
                            View Profile <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-red-400">Not Found</span>
                        )}
                      </div>
                      <div className="flex items-start justify-between rounded-md border border-gray-100 bg-white p-3 shadow-sm">
                        <span className="text-gray-500">Experience</span>
                        <span className="font-bold text-gray-900">
                          {cv?.scoreExperienceYears !== undefined ? `${cv.scoreExperienceYears} Years` : "Calculating..."}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Skills Analysis */}
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                      <Lightbulb className="h-4 w-4" />
                      Smart Skill Match
                    </h3>

                    <div className="space-y-4">
                      {/* Direct Matches */}
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">Direct Matches</span>
                        {(cv?.scoreSkillsAnalysis?.directMatches?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {cv.scoreSkillsAnalysis.directMatches.map((s: string, idx: number) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">None</span>
                        )}
                      </div>

                      {/* Inferred Matches */}
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">Inferred / Related</span>
                        {(cv?.scoreSkillsAnalysis?.inferredMatches?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {cv.scoreSkillsAnalysis.inferredMatches.map((item: any, idx: number) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200"
                                title={item.reason}
                              >
                                {item.candidateSkill} <span className="opacity-75 ml-1 text-[10px]">(matches {item.jobRequirement})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">None</span>
                        )}
                      </div>

                      {/* Missing Matches */}
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">Missing</span>
                        {(cv?.scoreSkillsAnalysis?.missing?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {cv.scoreSkillsAnalysis.missing.map((s: string, idx: number) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 border border-gray-200 decoration-dotted underline decoration-gray-300"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "analysis" && (
                <div className="space-y-6">
                  {/* AI Analysis Block */}
                  {cv?.parsed?.aiAnalysis || cv?.aiAnalysis ? (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-900">
                        <BrainCircuit className="h-4 w-4" />
                        AI Analysis
                      </div>
                      <div className="prose prose-sm prose-indigo max-w-none text-gray-700">
                        <p className="whitespace-pre-wrap leading-relaxed text-xs">
                          {cv?.parsed?.aiAnalysis || cv?.aiAnalysis}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
                      <BrainCircuit className="h-10 w-10 text-gray-400 mb-3" />
                      <h3 className="text-sm font-medium text-gray-900">No AI analysis available yet</h3>
                      <p className="mt-1 text-sm text-gray-500 mb-4">Run a rescan to generate the CV Coach feedback.</p>
                      <button
                        onClick={rescanCv}
                        className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Generate Analysis
                      </button>
                    </div>
                  )}

                  {/* Improvements Block */}
                  {(cv?.parsed?.improvements || cv?.improvements) && (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4" />
                        Suggested Improvements
                      </div>
                      <div className="prose prose-sm prose-emerald max-w-none text-gray-700">
                        <p className="whitespace-pre-wrap leading-relaxed text-xs">
                          {cv.parsed.improvements}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "raw" && (
                <div className="space-y-6">
                  {/* Experience */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      Experience
                    </h3>
                    <ul className="space-y-3">
                      {(Array.isArray(cv?.parsed?.structuredExperience) && cv.parsed.structuredExperience.length > 0) ? (
                        cv.parsed.structuredExperience.map((e: any, idx: number) => (
                          <li key={idx} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                            {formatExpItem(e)}
                          </li>
                        ))
                      ) : (Array.isArray(cv?.parsed?.experience) && cv.parsed.experience.length > 0) ? (
                        cv.parsed.experience.map((e: any, idx: number) => (
                          <li key={idx} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                            {formatExpItem(e)}
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500 italic">No experience data.</li>
                      )}
                    </ul>
                  </div>

                  {/* Education */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <GraduationCap className="h-4 w-4 text-gray-500" />
                      Education
                    </h3>
                    <ul className="space-y-3">
                      {Array.isArray(cv?.parsed?.education) && cv.parsed.education.length > 0 ? (
                        cv.parsed.education.map((e: any, idx: number) => (
                          <li key={idx} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                            {formatEduItem(e)}
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500 italic">No education data.</li>
                      )}
                    </ul>
                  </div>

                  {/* Certifications */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Award className="h-4 w-4 text-gray-500" />
                      Certifications
                    </h3>
                    <ul className="space-y-3">
                      {Array.isArray(cv?.parsed?.certifications) && cv.parsed.certifications.length > 0 ? (
                        cv.parsed.certifications.map((c: string, idx: number) => (
                          <li key={idx} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                            {c}
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500 italic">No certifications found.</li>
                      )}
                    </ul>
                  </div>

                  {/* Courses */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      Courses
                    </h3>
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                       {cv?.parsed?.courses || <span className="italic text-gray-400">No courses found.</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes & Timeline Section (Always visible below tabs) */}
          <div className="space-y-6">
            {/* Notes */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  Notes
                </h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full min-h-[80px] rounded-lg border-gray-200 bg-gray-50 p-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={addNote} 
                    disabled={!newNote.trim()}
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {notes.map((n) => (
                  <div key={n.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-700 leading-relaxed">{n.text}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : "Just now"}
                      </p>
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">No notes added yet.</p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <History className="h-4 w-4 text-gray-500" />
                Activity Log
              </h3>
              
              <div className="relative border-l border-gray-200 ml-2 space-y-6 pl-6">
                {events.map((e) => (
                  <div key={e.id} className="relative">
                    <span className="absolute -left-[29px] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-white bg-indigo-500 ring-4 ring-gray-50" />
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        {e.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleString() : ""}
                      </p>
                      {typeof e.score === "number" && (
                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                          Score: {e.score}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-xs text-gray-400">No activity recorded.</p>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
