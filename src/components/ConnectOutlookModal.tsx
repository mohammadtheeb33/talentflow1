"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { startOutlookOAuth, checkOutlookStatus, fetchOutlookAttachments, buildOutlookStartUrl } from "@/lib/functions";

type LogEntry = { type: "info" | "error"; message: string };

type JobProfile = { id: string; title?: string };

export function ConnectOutlookModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [uid, setUid] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [fetching, setFetching] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const popupRef = useRef<Window | null>(null);
  const [fileType, setFileType] = useState<string>("pdf");
  const [folder, setFolder] = useState<string>("inbox");
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [jobProfileId, setJobProfileId] = useState<string>("");

  const canFetch = useMemo(() => connected && !!fromDate && !!toDate && !!jobProfileId, [connected, fromDate, toDate, jobProfileId]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      try {
        const auth = getClientAuth();
        const id = auth.currentUser?.uid;
        if (!id) {
          appendLog("error", "غير مصرح: الرجاء تسجيل الدخول");
          return;
        }
        if (!mounted) return;
        setUid(id);
        const s = await checkOutlookStatus(id);
        setConnected(!!s.connected);
        setEmail(s.email);
        setDisplayName(s.displayName);

        // Load job profiles for selection
        try {
          const db = getClientFirestore();
          const snap = await getDocs(query(collection(db, "jobProfiles"), where("uid", "==", id), limit(100)));
          const rows: JobProfile[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
          rows.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
          if (mounted) setJobs(rows);
        } catch (e: any) {
          appendLog("error", e?.message || "Failed to load job profiles");
        }
      } catch (e: any) {
        appendLog("error", e?.message || "Failed to initialize user session");
      }
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev?.data?.type === "outlook-connected") {
        retryStatus();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function appendLog(type: LogEntry["type"], message: string) {
    setLogs((prev) => [...prev, { type, message }]);
  }

  async function handleConnect() {
    if (!uid) return;
    setConnecting(true);
    setCreatedCount(null);
    try {
      // اطلب نطاقات أعلى لضمان صلاحيات القراءة وحصول على معلومات المستخدم، وأجبر شاشة الموافقة إن لزم
      const elevatedScopes = "offline_access Mail.Read User.Read";
      const { authUrl } = await startOutlookOAuth(uid, elevatedScopes, true, "consumers");
      appendLog("info", "Opening Microsoft sign-in window...");
      popupRef.current = window.open(authUrl, "outlook-oauth", "width=600,height=700");
      setTimeout(() => retryStatus(), 2500);
    } catch (e: any) {
      // إذا فشل الطلب (CORS/Network)، افتح مسار البدء بصفحة تحويل تلقائي
      const msg = e?.message || "Failed to start OAuth";
      appendLog("error", msg);
      try {
        const elevatedScopes = "offline_access Mail.Read User.Read";
        const url = buildOutlookStartUrl(uid, elevatedScopes, true, "consumers");
        appendLog("info", "Opening fallback start page...");
        popupRef.current = window.open(url, "outlook-oauth", "width=600,height=700");
        setTimeout(() => retryStatus(), 3000);
      } catch (_) {}
    } finally {
      setConnecting(false);
    }
  }

  async function retryStatus() {
    if (!uid) return;
    try {
      const s = await checkOutlookStatus(uid);
      setConnected(!!s.connected);
      setEmail(s.email);
      setDisplayName(s.displayName);
      if (s.connected) appendLog("info", "Outlook connected");
      else appendLog("info", "Not connected yet");
    } catch (e: any) {
      appendLog("error", e?.message || "Failed to check status");
    }
  }

  async function handleFetch() {
    if (!uid || !fromDate || !toDate) return;
    if (!jobProfileId) {
      appendLog("error", "يرجى اختيار ملف وظيفي أولاً ليتم الفحص بناءً عليه.");
      return;
    }
    setFetching(true);
    setCreatedCount(null);
    const selectedJob = jobs.find((j) => j.id === jobProfileId);
    const jobLabel = selectedJob ? (selectedJob.title || selectedJob.id) : jobProfileId;
    appendLog("info", `سيتم الفحص حسب الملف الوظيفي: ${jobLabel} (${jobProfileId}).`);
    appendLog("info", `Fetching ${fileType.toUpperCase()} from ${folder} and creating documents...`);
    try {
      const resp = await fetchOutlookAttachments(uid, fromDate, toDate, { fileType, folder, jobProfileId: jobProfileId || undefined });
      setCreatedCount(resp.createdCount);
      appendLog("info", `Created ${resp.createdCount} documents from attachments`);
      // أعرض تأكيدًا إضافيًا في السجل إن أعادت الدالة معلومات عن الملف الوظيفي المستخدم
      const statsAny = (resp as any)?.stats as any;
      if (statsAny && (statsAny.jobProfileId || statsAny.folder || statsAny.fileType)) {
        const jp = statsAny.jobProfileId ? String(statsAny.jobProfileId) : jobProfileId;
        const f = statsAny.folder ? String(statsAny.folder) : folder;
        const ft = statsAny.fileType ? String(statsAny.fileType) : fileType;
        appendLog("info", `JobProfileId: ${jp}, Folder: ${f}, FileType: ${ft}`);
      }
      if ((resp as any)?.stats) {
        const s = (resp as any).stats as { messagesCount?: number; scannedAttachmentsCount?: number; attemptedCreatesCount?: number; bucket?: string; env?: any };
        appendLog("info", `Scanned ${s.scannedAttachmentsCount ?? 0} attachments across ${s.messagesCount ?? 0} messages.`);
        if (typeof s.attemptedCreatesCount === "number") {
          appendLog("info", `Attempted to create ${s.attemptedCreatesCount} documents.`);
        }
        if (s.bucket) {
          appendLog("info", `Storage bucket: ${s.bucket}`);
        }
        if (s.env) {
          const st = s.env.FIREBASE_STORAGE_EMULATOR_HOST || s.env.STORAGE_EMULATOR_HOST || "";
          const fs = s.env.FIRESTORE_EMULATOR_HOST || "";
          if (st || fs) appendLog("info", `Emulators — Firestore: ${fs || 'n/a'}, Storage: ${st || 'n/a'}`);
        }
      }
      if ((resp as any)?.samples) {
        const samples = (resp as any).samples as { all?: any[]; accepted?: any[] };
        const show = (arr?: any[], label?: string) => {
          if (!arr || arr.length === 0) return;
          const top = arr.slice(0, 5).map((x) => `${x.name} (${x.contentType || 'unknown'})`).join(", ");
          appendLog("info", `${label}: ${top}`);
        };
        show(samples.all, "Returned attachments (sample)");
        show(samples.accepted, "Accepted attachments (sample)");
      }
      if ((resp as any)?.errorCount && Array.isArray((resp as any).errors) && (resp as any).errors.length) {
        const errs = ((resp as any).errors as any[]).slice(0, 5).map((e) => `${e.stage}: ${e.message}`);
        appendLog("error", `Errors (${(resp as any).errorCount}): ${errs.join('; ')}`);
      }
    } catch (e: any) {
      appendLog("error", e?.message || "Failed to fetch attachments");
    } finally {
      setFetching(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-lg border bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Connect Outlook</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-gray-100">Close</button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">Authentication</div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600">Microsoft Outlook</div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
              >
                {connecting ? "Connecting…" : "Connect with Microsoft Outlook"}
              </button>
            </div>
            {connected && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                <span className="font-medium">Connected</span>
                <span>{email || displayName || "Account linked"}</span>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">Date range</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">From date</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded border p-2 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">To date</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded border p-2 text-xs" />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">Filters</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">File type</label>
                <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="w-full rounded border p-2 text-xs">
                  <option value="pdf">PDF</option>
                  <option value="doc">DOC</option>
                  <option value="docx">DOCX</option>
                  <option value="txt">TXT</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Folder</label>
                <select value={folder} onChange={(e) => setFolder(e.target.value)} className="w-full rounded border p-2 text-xs">
                  <option value="inbox">Inbox</option>
                  <option value="junkemail">Junk Email</option>
                  <option value="archive">Archive</option>
                  <option value="all">All folders</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">Job Profile</div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Select a job profile to evaluate against</label>
              <select value={jobProfileId} onChange={(e) => setJobProfileId(e.target.value)} className="w-full rounded border p-2 text-xs">
                <option value="">— Select Job Profile —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title || j.id}</option>
                ))}
              </select>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">Actions</div>
            <div className="flex items-center justify-between gap-3">
              <div className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs ${connected ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}`}>
                <span className="font-medium">{connected ? "Connected" : "Not connected"}</span>
                {connected && <span>{email || displayName || "Account"}</span>}
              </div>
              <button
                onClick={handleFetch}
                disabled={!canFetch || fetching}
                className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {fetching ? "Fetching…" : "Fetch Attachments"}
              </button>
            </div>
            {createdCount !== null && (
              <div className="mt-2 text-xs text-gray-700">Created {createdCount} documents.</div>
            )}
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-gray-700">Status</div>
            <div className="rounded-md border bg-gray-50 p-3">
              {logs.length === 0 ? (
                <div className="text-xs text-gray-600">Loading messages…</div>
              ) : (
                <ul className="space-y-1 text-xs">
                  {logs.map((l, i) => (
                    <li key={i} className={l.type === "error" ? "text-red-700" : "text-gray-800"}>{l.message}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={onClose} className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50">Close</button>
              <button onClick={retryStatus} className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50">Retry</button>
              <button onClick={onClose} className="rounded-md bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700">Done</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}