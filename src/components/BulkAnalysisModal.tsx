"use client";
import { Fragment, useEffect, useState, useRef } from 'react';
import { useRouter } from "next/navigation";
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, BeakerIcon, PlayIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { getClientFirestore } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { processBatchScoring, scoreSingleCv } from "@/services/bulkScoringService";

interface BulkAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds?: string[]; // IDs passed when mode is "selection"
}

export function BulkAnalysisModal({ isOpen, onClose, selectedIds = [] }: BulkAnalysisModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"selection" | "date_range">("selection");
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [dateRangeOption, setDateRangeOption] = useState("7d");
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<{ id?: string; msg: string; type: "info" | "success" | "error" | "pending" }[]>([]);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        // Reset state
        setLogs([]);
        setProgress({ processed: 0, total: 0 });
        setProcessing(false);
        // Default mode based on selection
        if (selectedIds.length > 0) {
            setMode("selection");
        } else {
            setMode("date_range");
        }
        
        // Fetch jobs
        const fetchJobs = async () => {
            const db = getClientFirestore();
            const q = query(collection(db, "jobProfiles"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const jobsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setJobs(jobsList);
            if (jobsList.length > 0) setSelectedJobId(jobsList[0].id);
        };
        fetchJobs();
    }
  }, [isOpen, selectedIds]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = async () => {
    if (!selectedJobId) {
        alert("Please select a target job profile.");
        return;
    }
    
    setProcessing(true);
    setLogs([]); // Reset logs
    setProgress({ processed: 0, total: 0 });
    try {
        const db = getClientFirestore();
        let idsToProcess: string[] = [];
        if (mode === "selection") {
          idsToProcess = selectedIds;
        } else {
          const now = new Date();
          const start = new Date();
          if (dateRangeOption === "7d") start.setDate(now.getDate() - 7);
          else if (dateRangeOption === "30d") start.setDate(now.getDate() - 30);
          else if (dateRangeOption === "all") start.setFullYear(2000);
          const q = query(
            collection(db, "cvs"),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<=", Timestamp.fromDate(now)),
            orderBy("createdAt", "desc")
          );
          const snap = await getDocs(q);
          idsToProcess = snap.docs.map(d => d.id);
        }

        const selectedJob = jobs.find(j => j.id === selectedJobId);
        const jobTitle = selectedJob ? (selectedJob.title || selectedJob.id) : selectedJobId;

        const total = idsToProcess.length;
        setProgress({ processed: 0, total });

        // 1. Prepare Queue
        const queue = [...idsToProcess];

        for (let i = 0; i < queue.length; i++) {
            const cvId = queue[i];
            
            // Log: Processing...
            setLogs(prev => [...prev, { id: cvId, msg: `Processing CV (${cvId.slice(0, 6)}...)...`, type: 'pending' }]);

            try {
                // 2. Score Single CV (Using Service Helper instead of axios)
                const result = await scoreSingleCv(cvId, selectedJobId, jobTitle);

                // Success
                if (result.status === "skipped") {
                    setLogs(prev => prev.map(log => 
                        log.id === cvId ? { ...log, msg: `⚠️ ${result.message}`, type: 'info' } : log
                    ));
                } else {
                    setLogs(prev => prev.map(log => 
                        log.id === cvId ? { ...log, msg: `✅ Scored: ${Math.round(result.score)}%`, type: 'success' } : log
                    ));
                }
                
                setProgress(prev => ({ ...prev, processed: i + 1 }));

            } catch (error: any) {
                // Failure
                console.error(error);
                const isRateLimit = error.message?.includes("429") || error.message?.includes("Rate Limited");
                setLogs(prev => prev.map(log => 
                    log.id === cvId ? { ...log, msg: `❌ Failed: ${isRateLimit ? 'Server Busy (Rate Limit)' : error.message}`, type: 'error' } : log
                ));
            }

            // 3. Mandatory Delay (2 seconds)
            if (i < queue.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        setLogs(prev => [...prev, { msg: "Finalizing...", type: "info" }]);
        await new Promise(resolve => setTimeout(resolve, 1000));
        router.refresh();
        onClose();

        // Optional: Toast or final message handled by parent/refresh
    } catch (e: any) {
        setLogs(prev => [...prev, { msg: `Critical Error: ${e.message}`, type: "error" }]);
    } finally {
        setProcessing(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={processing ? () => {} : onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                
                {/* Header */}
                <div className="sm:flex sm:items-start border-b border-gray-100 pb-4 mb-4">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                    <BeakerIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Bulk Analysis System
                    </Dialog.Title>
                    <p className="text-sm text-gray-500">
                      Score multiple candidates against a specific job profile using AI.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={onClose}
                    disabled={processing}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Body */}
                <div className="space-y-6">
                    
                    {/* Job Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Target Job Profile</label>
                        <select
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                            disabled={processing}
                            className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm border"
                        >
                            {jobs.map(job => (
                                <option key={job.id} value={job.id}>{job.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mode Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Scope</label>
                        <div className="flex gap-4">
                            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${mode === 'selection' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-200'}`}>
                                <input 
                                    type="radio" 
                                    name="mode" 
                                    value="selection" 
                                    checked={mode === 'selection'} 
                                    onChange={() => setMode('selection')}
                                    disabled={processing}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-900">
                                    Selected ({selectedIds.length})
                                </span>
                            </label>
                            
                            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${mode === 'date_range' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-200'}`}>
                                <input 
                                    type="radio" 
                                    name="mode" 
                                    value="date_range" 
                                    checked={mode === 'date_range'} 
                                    onChange={() => setMode('date_range')}
                                    disabled={processing}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-900">
                                    By Date Range
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Date Range Options (only if date_range mode) */}
                    {mode === 'date_range' && (
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700">Select Range</label>
                            <select
                                value={dateRangeOption}
                                onChange={(e) => setDateRangeOption(e.target.value)}
                                disabled={processing}
                                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm border"
                            >
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="all">All Time (Careful!)</option>
                            </select>
                        </div>
                    )}

                    {/* Terminal / Progress */}
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Execution Log</label>
                            {progress.total > 0 && (
                                <span className="text-xs font-mono text-gray-500">
                                    {progress.processed} / {progress.total}
                                </span>
                            )}
                        </div>
                        <div className="bg-gray-900 rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs">
                            {logs.length === 0 ? (
                                <div className="text-gray-500 flex items-center gap-2">
                                    <CommandLineIcon className="h-4 w-4" />
                                    <span>Ready to start...</span>
                                </div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className={`mb-1 ${
                                        log.type === 'error' ? 'text-red-400' : 
                                        log.type === 'success' ? 'text-green-400' : 
                                        log.type === 'pending' ? 'text-yellow-400' :
                                        'text-gray-300'
                                    }`}>
                                        <span className="opacity-50 mr-2">{new Date().toLocaleTimeString()}</span>
                                        {log.msg}
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="mt-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto ${
                        processing 
                        ? 'bg-indigo-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                    }`}
                    onClick={handleStart}
                    disabled={processing}
                  >
                    {processing ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <PlayIcon className="h-4 w-4" />
                            Start Analysis
                        </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={onClose}
                    disabled={processing}
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
