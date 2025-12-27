"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { getClientFirestore, getClientAuth, ensureUid, getClientStorage } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, addDoc, setDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { X, Upload, FileText, AlertCircle, Loader2 } from "lucide-react";

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

        // 1. Generate ID first (don't create doc yet)
        const newDocRef = doc(collection(db, "cvs"));
        const newId = newDocRef.id;

        // 2. Upload file FIRST
        // Path: cvs/{candidateId}/original/{filename}
        const path = `cvs/${newId}/original/${file.name}`;
        
        try {
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, file);
        } catch (e: any) {
            console.error("Storage Upload Error", e);
            // If upload fails, we stop here. No doc created.
            if (e.code === 'storage/unauthorized') {
                 throw new Error("Permission denied: You do not have rights to upload files.");
            }
            throw new Error(`Storage Upload Failed: ${e.message}`);
        }

        // 3. Create Firestore document ONLY after successful upload
        try {
            await setDoc(newDocRef, {
                uid,
                userId: uid, // Legacy support
                status: "uploaded", // Ready for backend
                source: "manual_upload",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                jobProfileId: selectedJobId,
                originalName: file.name,
                filename: file.name,
                name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                size: file.size,
                type: file.type,
                storagePath: path
            });
        } catch (e: any) {
             console.error("Firestore Create Error", e);
             // Verify if we should cleanup storage? 
             // Ideally yes, but usually acceptable to leave orphan file vs broken doc
             throw new Error(`Firestore Create Failed: ${e.message}`);
        }
        
        onClose();
        setFile(null);
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
        className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white p-6 shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 id="modal-title" className="text-lg font-semibold text-gray-900">Upload CV / Resume</h3>
            <p className="text-sm text-gray-500">Add a new candidate to your pipeline</p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Job Profile Selector */}
          <div className="space-y-2">
            <label htmlFor="job-profile" className="block text-sm font-medium text-gray-700">
              Assign to Job Profile <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <select
                  id="job-profile"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-3 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
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
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
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
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
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
                  ? "border-indigo-500 bg-indigo-50" 
                  : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
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
              <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-gray-900/5 mb-3">
                <Upload className={`h-6 w-6 ${isDragging ? "text-indigo-600" : "text-gray-400"}`} />
              </div>
              <p className="text-sm font-medium text-gray-900">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-xs text-gray-500">
                PDF, DOCX, or TXT (max 10MB)
              </p>
            </div>
          ) : (
            /* File Preview */
            <div className="relative flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !selectedJobId || uploading || jobs.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {uploading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                </>
            ) : (
                "Upload & Analyze"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
