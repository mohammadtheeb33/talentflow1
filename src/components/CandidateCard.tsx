import React, { memo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, Trash2, Mail, Calendar, MapPin, Briefcase, Info } from "lucide-react";
import { updateHiringStatus, HiringStatus } from "@/services/hiringService";
import { deleteDoc, doc } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";
import { toast } from "sonner";
import { CV } from "@/types/cv";

interface CandidateCardProps {
  candidate: CV;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onDeleted?: (id: string) => void;
  onRejectClick?: (id: string) => void;
  jobTitle?: string;
}

// Helper to extract initials
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Helper to format score
function formatScore(score: any): number {
  if (typeof score === "number") return Math.round(score);
  if (typeof score === "string") {
    const match = score.match(/(\d+(\.\d+)?)/);
    return match ? Math.round(parseFloat(match[0])) : 0;
  }
  return 0;
}

// Robust Name Extraction Logic
const getDisplayName = (candidate: CV) => {
    // 1. First Priority: Full Human Name 
    // Check standard fields used by Manual Upload & Parsers
    if (candidate.firstName && candidate.lastName) {
        return `${candidate.firstName} ${candidate.lastName}`;
    }
    if (candidate.fullName) return candidate.fullName;
    
    // 2. Parsed / Extracted Names (Common in Manual Uploads)
    if (candidate.parsed?.name) return candidate.parsed.name;
    if (candidate.extractedContact?.name) return candidate.extractedContact.name;

    // 3. Outlook Display Name
    if (candidate.displayName) return candidate.displayName;

    // 4. 'name' field handling
    // We check if 'name' is just a filename. If so, we treat it as a fallback.
    const nameField = candidate.name;
    const isNameFieldFilename = nameField && (
        nameField === candidate.filename || 
        nameField === candidate.originalName ||
        nameField === candidate.filename?.replace(/\.[^/.]+$/, "") ||
        nameField === candidate.originalName?.replace(/\.[^/.]+$/, "")
    );

    // If 'name' exists and is NOT just a filename, use it (it might be a manual edit)
    if (nameField && !isNameFieldFilename) {
        return nameField;
    }

    // 5. Email Username (Better than filename)
    // If no name is found, extract name from email (e.g. "ahmed" from "ahmed@gmail.com")
    if (candidate.email) {
        return candidate.email.split('@')[0];
    }
    if (candidate.parsed?.email) return candidate.parsed.email.split('@')[0];
    if (candidate.extractedContact?.email) return candidate.extractedContact.email.split('@')[0];

    // 6. Last Resort: Filename or Fallback
    if (nameField) return nameField; // Use the filename-like name if nothing else exists
    if (candidate.filename) return candidate.filename;
    if (candidate.originalName) return candidate.originalName;

    return "Unnamed Candidate";
};

// Helper to safely parse date
function getValidDate(val: any): Date {
  if (!val) return new Date();
  // Firestore Timestamp (seconds)
  if (typeof val === 'object' && 'seconds' in val) {
    return new Date(val.seconds * 1000);
  }
  // Already a Date
  if (val instanceof Date) return val;
  // String or Number (timestamp)
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  
  return new Date();
}

export const CandidateCard = memo(function CandidateCard({
  candidate,
  isSelected,
  onSelect,
  onDeleted,
  jobTitle,
  onRejectClick,
}: CandidateCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<HiringStatus>((candidate.hiringStatus as HiringStatus) || "undecided");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setStatus((candidate.hiringStatus as HiringStatus) || "undecided");
  }, [candidate.hiringStatus]);

  const displayName = getDisplayName(candidate);
  const initials = getInitials(displayName);
  const score = formatScore(candidate.score || candidate.matchScore);
  
  // Date formatting
  const dateValue = getValidDate(candidate.submittedAt || candidate.createdAt);
    
  const timeAgo = formatDistanceToNow(dateValue, { addSuffix: true });

  const handleStatusChange = async (newStatus: HiringStatus) => {
    const oldStatus = status;
    setStatus(newStatus);
    try {
      await updateHiringStatus(candidate.id, newStatus);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      setStatus(oldStatus);
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this candidate?")) return;
    setIsDeleting(true);
    try {
      const db = getClientFirestore();
      await deleteDoc(doc(db, "cvs", candidate.id));
      if (onDeleted) onDeleted(candidate.id);
      toast.success("Candidate deleted");
    } catch (error) {
      setIsDeleting(false);
      toast.error("Failed to delete candidate");
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("input")
    ) {
      return;
    }
    router.push(`/candidates/${candidate.id}`);
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-white border rounded-lg shadow-sm transition-all hover:shadow-md cursor-pointer ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-gray-200'}`}
    >
      
      {/* Checkbox */}
      <div className="absolute left-4 top-4 sm:relative sm:left-auto sm:top-auto flex items-center h-full">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(candidate.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
        />
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0 ml-8 sm:ml-0">
        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
          {initials}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {displayName}
          </h3>
          {/* Status Badge */}
          {status === "accepted" && (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              Hired
            </span>
          )}
          {status === "rejected" && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
              Rejected
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
          {status === "rejected" && candidate.rejectionReason && (
             <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                 <Info className="h-3.5 w-3.5" />
                 <span className="text-xs font-medium">Reason: {candidate.rejectionReason}</span>
             </div>
          )}
           {jobTitle && (
             <div className="flex items-center gap-1">
               <Briefcase className="h-3.5 w-3.5" />
               <span>{jobTitle}</span>
             </div>
           )}
           <div className="flex items-center gap-1">
             <Calendar className="h-3.5 w-3.5" />
             <span>Applied {timeAgo}</span>
           </div>
           {candidate.email && (
             <div className="flex items-center gap-1">
               <Mail className="h-3.5 w-3.5" />
               <span className="truncate max-w-[150px]">{candidate.email}</span>
             </div>
           )}
        </div>
      </div>

      {/* Right Side: Score & Actions */}
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-4 sm:mt-0 pl-12 sm:pl-0">
        {/* Match Score */}
        <div className="flex flex-col items-end">
          <div className={`text-lg font-bold ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}%
          </div>
          <span className="text-xs text-gray-400">Match Score</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 border-l pl-4 border-gray-100">
           <button
             onClick={() => handleStatusChange("accepted")}
             className={`p-1.5 rounded-full transition-colors ${status === 'accepted' ? 'bg-green-100 text-green-700' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
             title="Accept Candidate"
           >
             <CheckCircle2 className="h-5 w-5" />
           </button>
           
           <button
             onClick={() => onRejectClick ? onRejectClick(candidate.id) : handleStatusChange("rejected")}
             className={`p-1.5 rounded-full transition-colors ${status === 'rejected' ? 'bg-red-100 text-red-700' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'}`}
             title="Reject Candidate"
           >
             <XCircle className="h-5 w-5" />
           </button>

           <button
             onClick={handleDelete}
             disabled={isDeleting}
             className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
             title="Delete"
           >
             <Trash2 className="h-5 w-5" />
           </button>
        </div>
      </div>
    </div>
  );
});
