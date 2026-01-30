"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getClientAuth, getClientFirestore, disconnectOutlook } from "@/lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { startOutlookOAuth, checkOutlookStatus, fetchOutlookAttachments, buildOutlookStartUrl } from "@/lib/functions";
import { 
  X, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileText, 
  Folder, 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  LogOut, 
  Play
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type LogEntry = { type: "info" | "error"; message: string };

type JobProfile = { id: string; title?: string };

export function ConnectOutlookModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [uid, setUid] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  
  // Defaults: Last 30 days
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  const [fetching, setFetching] = useState(false);
  const [finished, setFinished] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const popupRef = useRef<Window | null>(null);
  
  const [fileType, setFileType] = useState<string>("pdf");
  const [folder, setFolder] = useState<string>("inbox");
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [jobProfileId, setJobProfileId] = useState<string>("");
  
  const [showFilters, setShowFilters] = useState(false);

  const canFetch = useMemo(() => connected && !!fromDate && !!toDate && !!jobProfileId, [connected, fromDate, toDate, jobProfileId]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      try {
        const auth = getClientAuth();
        const id = auth.currentUser?.uid;
        if (!id) {
          appendLog("error", "Unauthorized: Please sign in");
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
          if (mounted) {
            setJobs(rows);
            // Auto-select if only one exists
            if (rows.length === 1) setJobProfileId(rows[0].id);
          }
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
      const elevatedScopes = "openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send";
      const { authUrl } = await startOutlookOAuth(uid, elevatedScopes, true, "common");
      appendLog("info", "Opening Microsoft sign-in window...");
      popupRef.current = window.open(authUrl, "outlook-oauth", "width=600,height=700");
      setTimeout(() => retryStatus(), 2500);
    } catch (e: any) {
      const msg = e?.message || "Failed to start OAuth";
      appendLog("error", msg);
      try {
        const elevatedScopes = "openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send";
        const url = buildOutlookStartUrl(uid, elevatedScopes, true, "common");
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
      if (s.connected) appendLog("info", "Outlook connected successfully");
    } catch (e: any) {
      appendLog("error", e?.message || "Failed to check status");
    }
  }

  async function handleDisconnect() {
    if (!uid) return;
    if (!confirm("Are you sure you want to disconnect Outlook? This will clear your saved tokens.")) return;
    setDisconnecting(true);
    try {
      await disconnectOutlook(uid);
      setConnected(false);
      setEmail(undefined);
      setDisplayName(undefined);
      appendLog("info", "Outlook disconnected");
    } catch (e: any) {
      appendLog("error", e?.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleFetch() {
    if (!uid || !fromDate || !toDate) return;
    if (!jobProfileId) {
      appendLog("error", "Please select a job profile first.");
      return;
    }
    setFetching(true);
    setFinished(false);
    setCreatedCount(null);
    setLogs([]); // Clear previous logs
    
    const selectedJob = jobs.find((j) => j.id === jobProfileId);
    const jobLabel = selectedJob ? (selectedJob.title || selectedJob.id) : jobProfileId;
    appendLog("info", `Starting import for profile: ${jobLabel}`);
    
    const typesToFetch = fileType === "docs" ? ["pdf", "docx", "doc"] : [fileType];
    let totalCreated = 0;

    try {
      for (const ft of typesToFetch) {
        appendLog("info", `Fetching ${ft.toUpperCase()} from ${folder}...`);
        const resp = await fetchOutlookAttachments(uid, fromDate, toDate, { fileType: ft, folder, jobProfileId: jobProfileId || undefined });
        totalCreated += resp.createdCount;
        
        if (resp.createdCount > 0) {
           appendLog("info", `✓ Imported ${resp.createdCount} ${ft.toUpperCase()} files`);
        } else {
           appendLog("info", `No ${ft.toUpperCase()} attachments found`);
        }
        
        if ((resp as any)?.errorCount && Array.isArray((resp as any).errors) && (resp as any).errors.length) {
          const errs = ((resp as any).errors as any[]).slice(0, 3).map((e) => e.message);
          appendLog("error", `Errors: ${errs.join('; ')}`);
        }
      }
      setCreatedCount(totalCreated);
      appendLog("info", `Process complete. Total imported: ${totalCreated}`);
      setFinished(true);
    } catch (e: any) {
      appendLog("error", e?.message || "Failed to fetch attachments");
    } finally {
      setFetching(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all border border-slate-200 dark:bg-slate-900 dark:border-white/10"
        role="dialog"
        aria-modal="true"
      >
        {/* 1. Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Import CVs from Outlook</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Fetch CV attachments and analyze them automatically</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">
          
          {/* 2. Connection Section */}
          <div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:bg-slate-800/50 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className={cn("h-2.5 w-2.5 rounded-full", connected ? "bg-green-500" : "bg-gray-300")} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {connected ? "Connected to Outlook" : "Not Connected"}
                  </span>
                  {connected && (email || displayName) && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{email || displayName}</span>
                    </span>
                  )}
                </div>
              </div>
              
              {connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="flex items-center gap-2 rounded-md bg-white border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Connect Outlook
                </button>
              )}
            </div>
          </div>

          {/* 3. Import Settings */}
          <div className="space-y-6">
             {/* Step 1: Job Profile */}
             <div className="space-y-3">
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                 Step 1: Assign to Job Profile <span className="text-red-500">*</span>
               </label>
               <div className="relative">
                 <select 
                   value={jobProfileId} 
                   onChange={(e) => setJobProfileId(e.target.value)} 
                   className="block w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                 >
                   <option value="">Select a job profile...</option>
                   {jobs.map((j) => (
                     <option key={j.id} value={j.id}>{j.title || j.id}</option>
                   ))}
                 </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
               </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                 Imported CVs will be automatically evaluated against this job description.
               </p>
             </div>

             {/* Step 2: Filters */}
             <div className="space-y-3">
               <button 
                 onClick={() => setShowFilters(!showFilters)}
                 className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
               >
                 <Settings className="h-4 w-4" />
                 Step 2: Advanced Filters (Optional)
                 {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
               </button>
               
               {showFilters && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 animate-in slide-in-from-top-2 duration-200 dark:border-white/10 dark:bg-slate-800/50">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <Calendar className="h-3.5 w-3.5" /> Date Range
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="date" 
                          value={fromDate} 
                          onChange={(e) => setFromDate(e.target.value)} 
                          className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white" 
                        />
                        <span className="self-center text-slate-400">-</span>
                        <input 
                          type="date" 
                          value={toDate} 
                          onChange={(e) => setToDate(e.target.value)} 
                          className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <FileText className="h-3.5 w-3.5" /> File Type
                      </label>
                      <select 
                        value={fileType} 
                        onChange={(e) => setFileType(e.target.value)} 
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                      >
                        <option value="pdf">PDF Only</option>
                        <option value="docs">All Documents (PDF, DOC, DOCX)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <Folder className="h-3.5 w-3.5" /> Source Folder
                      </label>
                      <select 
                        value={folder} 
                        onChange={(e) => setFolder(e.target.value)} 
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                      >
                        <option value="inbox">Inbox</option>
                        <option value="junkemail">Junk Email</option>
                        <option value="archive">Archive</option>
                        <option value="all">Search All Folders</option>
                      </select>
                    </div>
                 </div>
               )}
             </div>
          </div>

          {/* 4. Primary Action */}
          <div>
            <button
              onClick={handleFetch}
              disabled={!canFetch || fetching}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {fetching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Fetching & Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Fetch & Analyze CVs
                </>
              )}
            </button>
            {!connected && (
               <p className="mt-2 text-center text-xs text-red-500">
                 Please connect your Outlook account to proceed.
               </p>
            )}
            {connected && !jobProfileId && (
               <p className="mt-2 text-center text-xs text-amber-600">
                 Please select a job profile to proceed.
               </p>
            )}
          </div>

          {/* 5. Status & Progress */}
          {(fetching || logs.length > 0) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden dark:border-white/10 dark:bg-slate-800/50">
               <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center dark:bg-slate-900 dark:border-white/10">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status Log</span>
                  {createdCount !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {createdCount} Imported
                    </span>
                  )}
               </div>
               <div className="max-h-32 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                  {logs.length === 0 && <p className="text-xs text-slate-500 italic dark:text-slate-400">Waiting to start...</p>}
                  {logs.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                       {l.type === 'error' ? (
                         <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                       ) : (
                         <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                       )}
                       <span className={l.type === "error" ? "text-red-700 font-medium" : "text-slate-600 dark:text-slate-300"}>
                         {l.message}
                       </span>
                    </div>
                  ))}
                  {fetching && (
                     <div className="flex items-center gap-2 text-xs text-indigo-600 animate-pulse mt-2 dark:text-indigo-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                     </div>
                  )}
               </div>
            </div>
          )}

        </div>

        {/* 6. Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end gap-3 dark:border-white/10 dark:bg-slate-900">
          <button 
            onClick={onClose} 
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {finished ? "Close" : "Cancel"}
          </button>
          {finished && (
            <button 
              onClick={onClose} 
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
