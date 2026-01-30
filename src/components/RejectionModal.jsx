import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const REJECTION_REASONS = [
  "Lacking required skills",
  "Insufficient experience",
  "Salary expectations mismatch",
  "Cultural fit",
  "Other"
];

export default function RejectionModal({ isOpen, onClose, onConfirm }) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalReason = selectedReason === "Other" ? customReason : selectedReason;
    if (finalReason.trim()) {
      onConfirm(finalReason);
      // Reset state
      setSelectedReason("");
      setCustomReason("");
    }
  };

  const isConfirmDisabled = !selectedReason || (selectedReason === "Other" && !customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
             </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-900">Reject Candidate</h3>
                <p className="text-sm text-gray-500">Please select a reason for rejection.</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {REJECTION_REASONS.map((reason) => (
              <label 
                key={reason}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedReason === reason 
                    ? 'border-red-200 bg-red-50/50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="rejectionReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">{reason}</span>
              </label>
            ))}
          </div>

          {selectedReason === "Other" && (
            <div className="mt-3 animate-in slide-in-from-top-2">
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please specify the reason..."
                className="w-full min-h-[100px] p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-200"
          >
            Reject Candidate
          </button>
        </div>
      </div>
    </div>
  );
}
