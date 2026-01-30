"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getClientFirestore, getClientAuth, ensureUid, getClientStorage } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, limit, addDoc, setDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { X, Upload, FileText, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface JobProfile {
  id: string;
  title?: string;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch Job Profiles
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const fetchJobs = async () => {
      try {
        setLoading(true);
        await ensureUid();
        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const db = getClientFirestore();
        const q = query(collection(db, "jobProfiles"), where("uid", "==", uid), limit(50));
        const snap = await getDocs(q);
        const fetchedJobs: JobProfile[] = [];
        snap.forEach((doc) => {
          fetchedJobs.push({ id: doc.id, ...doc.data() });
        });
        
        if (mounted) {
          setJobs(fetchedJobs);
          if (fetchedJobs.length > 0) {
            setSelectedJobId(fetchedJobs[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch job profiles", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchJobs();
    return () => { mounted = false; };
  }, [isOpen]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedJobId) return;
    setUploading(true);
    setError(null);
    
    try {
        await ensureUid();
        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) {
            setError("User not authenticated");
            return;
        }

        const db = getClientFirestore();
        const storage = getClientStorage();
        const token = await auth.currentUser?.getIdToken();

        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
            const userData = userSnap.data() || {};
            const creditsUsed = Number((userData as any)?.credits_used || 0);
            const creditsLimit = Number((userData as any)?.credits_limit || 0);
            if (creditsUsed >= creditsLimit) {
                setError("You have run out of credits. Please contact admin to upgrade.");
                return;
            }
        }

        const newDocRef = doc(collection(db, "cvs"));
        const newId = newDocRef.id;

        const path = `cvs/${newId}/original/${file.name}`;
        
        let uploaded = false;
        let extractedText = "";

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("path", path);
            
            const headers: HeadersInit = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
                headers
            });

            if (res.ok) {
                uploaded = true;
                const resData = await res.json();
                const responseText = resData?.cvText ?? resData?.text ?? "";
                extractedText = typeof responseText === "string" ? responseText : "";
            } else {
                const errJson = await res.json().catch(() => ({}));
                console.warn("Server upload failed, falling back to client upload:", res.status, errJson);
            }
        } catch (serverErr) {
            console.warn("Server upload error, falling back to client upload:", serverErr);
        }
        
        if (!uploaded) {
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, file);
            uploaded = true;
        }

        const safeText = extractedText || "";
        await setDoc(newDocRef, {
            uid,
            userId: uid,
            status: "uploaded",
            analysisStatus: "pending",
            source: "manual_upload",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            jobProfileId: selectedJobId,
            originalName: file.name,
            filename: file.name,
            size: file.size,
            type: file.type,
            storagePath: path,
            text: safeText,
            cvText: safeText,
            resumeText: safeText
        });

        const analysisRes = await fetch('/api/admin/score-cv', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ cvId: newId })
        });

        if (analysisRes.status === 401) {
            throw new Error("Unauthorized. Please sign in again.");
        }
        if (analysisRes.status === 403) {
            throw new Error("You have run out of credits. Please contact admin to upgrade.");
        }
        if (!analysisRes.ok) {
            const details = await analysisRes.text().catch(() => "");
            throw new Error(details || "Failed to start analysis");
        }

        toast.info("AI Analysis started in background...");
        onClose();
        setFile(null);
        router.push(`/candidates/${newId}`);
        router.refresh();
    } catch (err: any) {
        console.error("Upload process failed", err);
        setError(err.message || "Upload failed");
    } finally {
        setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all p-4">
      <div 
        className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white p-6 shadow-2xl transition-all border border-slate-200 dark:bg-slate-900 dark:border-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
          <div>
            <h3 id="modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">Upload CV / Resume</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Add a new candidate to your pipeline</p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Job Profile Selector */}
          <div className="space-y-2">
            <label htmlFor="job-profile" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Assign to Job Profile <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <select
                  id="job-profile"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                  disabled={loading || jobs.length === 0}
                >
                  {loading ? (
                    <option>Loading profiles...</option>
                  ) : jobs.length === 0 ? (
                    <option value="">No job profiles found</option>
                  ) : (
                    jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title || "Untitled Job"}
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
            {jobs.length === 0 && !loading && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    You need to create a job profile first.
                </p>
            )}
            
             {/* Source Indicator Badge */}
             <div className="flex justify-end mt-1">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
                  Source: Manual Upload
                </span>
             </div>
          </div>

          {/* Drag & Drop Area */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`
                relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all
                ${isDragging 
                  ? "border-indigo-500 bg-indigo-50 dark:bg-slate-800/50"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 dark:bg-slate-800/50 dark:border-slate-600 dark:hover:bg-slate-800"
                }
              `}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
              <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-gray-900/5 mb-3 dark:bg-slate-950 dark:ring-white/10">
                <Upload className={`h-6 w-6 ${isDragging ? "text-indigo-600" : "text-slate-400"}`} />
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                PDF, DOCX, or TXT (max 10MB)
              </p>
            </div>
          ) : (
            /* File Preview */
            <div className="relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors dark:hover:bg-rose-500/10"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !selectedJobId || uploading || jobs.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            {uploading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                <>
                    <Upload className="h-4 w-4" />
                    Upload & Analyze
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
