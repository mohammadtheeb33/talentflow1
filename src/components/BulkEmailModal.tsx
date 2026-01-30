"use client";
import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, ChevronLeft, ChevronRight, Send, Wand2, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { CV as CandidateItem } from "@/types/cv";
import { generateEmail, EmailDraft } from "@/services/aiEmailGenerator";
import { sendOutlookEmail, validateOutlookScopes } from "@/services/outlookEmailService";
import { getClientFirestore, getClientAuth } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: CandidateItem[];
  emailType: "accepted" | "rejected";
  onSuccess: () => void;
}

type Draft = {
  candidateId: string;
  candidateName: string;
  email: string;
  subject: string;
  body: string;
  status: "pending" | "generated" | "sending" | "sent" | "error";
  error?: string;
};

export function BulkEmailModal({ isOpen, onClose, candidates, emailType, onSuccess }: BulkEmailModalProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Initialize drafts placeholder
  useEffect(() => {
    if (isOpen && candidates.length > 0) {
      setDrafts(
        candidates.map((c) => ({
          candidateId: c.id,
          candidateName: c.name || "Candidate",
          email: c.email || c.parsed?.email || "",
          subject: "",
          body: "",
          status: "pending",
        }))
      );
      setCurrentIndex(0);
      setGenerating(false);
      setSending(false);
      setProgress(0);
      setPermissionError(null);

      // Check permissions
      const auth = getClientAuth();
      const uid = auth.currentUser?.uid;
      if (uid) {
        validateOutlookScopes(uid).then((res) => {
          if (!res.valid) {
             setPermissionError(res.error || "Missing Outlook permissions");
          }
        });
      }
    }
  }, [isOpen, candidates]);

  // Auto-generate on open (optional, or wait for user click)
  useEffect(() => {
    if (isOpen && drafts.length > 0 && !generating && drafts[0].status === "pending") {
      handleGenerateAll();
    }
  }, [isOpen, drafts.length]); // Dependencies carefully chosen to run once

  const handleGenerateAll = async () => {
    setGenerating(true);
    const newDrafts = [...drafts];
    
    for (let i = 0; i < newDrafts.length; i++) {
      const draft = newDrafts[i];
      // Skip if already generated or processed
      if (draft.status !== "pending") continue;

      try {
        const candidate = candidates.find(c => c.id === draft.candidateId);
        const jobTitle = candidate?.jobTitle || "the position";
        
        const certs = Array.isArray(candidate?.parsed?.certifications) ? candidate?.parsed?.certifications : [];
        const courses = typeof candidate?.parsed?.courses === 'string' ? candidate?.parsed?.courses : "";

        const result = await generateEmail(
            draft.candidateName,
            jobTitle,
            emailType,
            "TalentFlow",
            certs,
            courses
        );
        
        newDrafts[i] = {
          ...draft,
          subject: result.subject,
          body: result.body,
          status: "generated"
        };
        
        // Update state incrementally to show progress
        setDrafts([...newDrafts]);
        setProgress(Math.round(((i + 1) / newDrafts.length) * 100));
      } catch (e) {
        console.error("Generation error", e);
        newDrafts[i] = { ...draft, status: "error", error: "Generation failed" };
        setDrafts([...newDrafts]);
      }
    }
    setGenerating(false);
  };

  const handleSendAll = async () => {
    setSending(true);
    const newDrafts = [...drafts];
    let successCount = 0;

    for (let i = 0; i < newDrafts.length; i++) {
      const draft = newDrafts[i];
      if (draft.status !== "generated" && draft.status !== "error") continue; // Retry errors? Or skip?
      // Only send valid generated drafts
      if (!draft.body || !draft.email) {
          newDrafts[i].status = "error";
          newDrafts[i].error = "Missing body or email";
          setDrafts([...newDrafts]);
          continue;
      }

      newDrafts[i].status = "sending";
      setDrafts([...newDrafts]);

      try {
        await sendOutlookEmail(draft.email, draft.subject, draft.body);
        newDrafts[i].status = "sent";
        successCount++;
        
        // Update candidate status in DB
        try {
            const db = getClientFirestore();
            await updateDoc(doc(db, "cvs", draft.candidateId), {
                emailStatus: "sent",
                emailType: emailType,
                emailSentAt: new Date(),
                emailError: null
            });
        } catch (dbError) {
            console.error("Failed to update Firestore", dbError);
        }
        
      } catch (e: any) {
        console.error("Sending error", e);
        newDrafts[i].status = "error";
        newDrafts[i].error = e.message || "Failed to send";
        
        // Record error in DB
        try {
            const db = getClientFirestore();
            await updateDoc(doc(db, "cvs", draft.candidateId), {
                emailStatus: "error",
                emailType: emailType,
                emailError: e.message || "Failed to send"
            });
        } catch (_) {}
      }
      
      setDrafts([...newDrafts]);
      setProgress(Math.round(((i + 1) / newDrafts.length) * 100));
    }

    setSending(false);
    if (successCount > 0) {
      toast.success(`Successfully sent ${successCount} emails.`);
      onSuccess(); // Trigger parent refresh
      // Don't close immediately so they can see results
    } else {
      toast.error("Failed to send emails.");
    }
  };

  const currentDraft = drafts[currentIndex];

  const updateCurrentDraft = (field: "subject" | "body", value: string) => {
    const newDrafts = [...drafts];
    newDrafts[currentIndex] = { ...newDrafts[currentIndex], [field]: value };
    setDrafts(newDrafts);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => { if (!sending) onClose(); }}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${emailType === 'accepted' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        Bulk Email ({emailType === 'accepted' ? 'Interview Invitation' : 'Rejection'})
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        Review and edit AI-generated emails for {drafts.length} candidates.
                      </p>
                    </div>
                  </div>
                  <button onClick={onClose} disabled={sending} className="rounded-full p-1 hover:bg-gray-100">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="mt-4 grid grid-cols-12 gap-6 h-[500px]">
                  
                  {/* Left Sidebar: List of Candidates */}
                  <div className="col-span-4 border-r pr-4 overflow-y-auto">
                    <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Recipients</h4>
                    <div className="space-y-2">
                      {drafts.map((draft, idx) => (
                        <button
                          key={draft.candidateId}
                          onClick={() => setCurrentIndex(idx)}
                          className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                            idx === currentIndex 
                              ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium truncate">{draft.candidateName}</span>
                            {draft.status === "sent" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {draft.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                            {draft.status === "sending" && <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{draft.email}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Side: Editor */}
                  <div className="col-span-8 flex flex-col h-full">
                    {currentDraft ? (
                      <>
                        <div className="mb-4 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700">To</label>
                            <input 
                              type="text" 
                              value={currentDraft.email} 
                              readOnly 
                              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700">Subject</label>
                            <input 
                              type="text" 
                              value={currentDraft.subject} 
                              onChange={(e) => updateCurrentDraft("subject", e.target.value)}
                              disabled={sending || currentDraft.status === "sent"}
                              className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Message Body (HTML)</label>
                          {generating && currentDraft.status === "pending" ? (
                             <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                               <div className="text-center">
                                 <Wand2 className="mx-auto h-8 w-8 animate-pulse text-indigo-400" />
                                 <p className="mt-2 text-sm text-gray-500">AI is drafting this email...</p>
                               </div>
                             </div>
                          ) : (
                            <textarea
                              value={currentDraft.body}
                              onChange={(e) => updateCurrentDraft("body", e.target.value)}
                              disabled={sending || currentDraft.status === "sent"}
                              className="h-full w-full rounded-md border-gray-300 p-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                              placeholder="Email content..."
                            />
                          )}
                        </div>
                        
                        {currentDraft.error && (
                            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {currentDraft.error}
                            </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">
                        Select a candidate to preview
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    {(generating || sending) && (
                        <div className="w-48 bg-gray-200 rounded-full h-2.5">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                    <span className="text-xs text-gray-500">
                        {sending ? "Sending..." : generating ? "Generating drafts..." : `${drafts.filter(d => d.status === 'generated').length} ready to send`}
                    </span>
                  </div>
                  
                  <div className="flex gap-3 items-center">
                    {permissionError && (
                        <span className="text-xs text-red-600 flex items-center gap-1 font-medium bg-red-50 px-2 py-1 rounded border border-red-100">
                            <AlertCircle className="h-3 w-3" />
                            {permissionError}
                        </span>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={onClose}
                      disabled={sending}
                    >
                      {drafts.some(d => d.status === 'sent') ? "Close" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleSendAll}
                      disabled={generating || sending || !!permissionError || drafts.every(d => d.status === 'sent')}
                    >
                      <Send className="h-4 w-4" />
                      {sending ? "Sending..." : "Send All Emails"}
                    </button>
                  </div>
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
