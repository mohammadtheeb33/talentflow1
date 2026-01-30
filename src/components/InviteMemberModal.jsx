import React, { useEffect, useState } from 'react';
import { X, Mail, UserPlus, Shield } from 'lucide-react';
import { inviteUser, ROLES } from '@/lib/auth';
import { toast } from 'sonner';
import { getClientAuth } from '@/lib/firebase';
import { sendInviteEmail } from '@/lib/functions';

export default function InviteMemberModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("hr");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setPermissionError(null);
      return;
    }
    const auth = getClientAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setPermissionError("Please sign in again.");
      return;
    }
    setPermissionError(null);
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await inviteUser(email, role);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const roleLabel = role === ROLES.ADMIN ? "Admin" : role === ROLES.HR ? "HR" : "Interviewer";
      const subject = "You're invited to join the team";
      const body = `
        <p>You have been invited to join the team.</p>
        <p>Role: <strong>${roleLabel}</strong></p>
        <p>Sign in here: <a href="${origin}/login">${origin}/login</a></p>
      `;
      await sendInviteEmail(email, subject, body);
      toast.success("Invitation sent successfully");
      setEmail("");
      setRole("hr");
      onClose();
    } catch (error) {
      console.error("Failed to invite user:", error);
      toast.error(error?.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-100 rounded-full">
                <UserPlus className="h-5 w-5 text-indigo-600" />
             </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
                <p className="text-sm text-gray-500">Add a new member to your team.</p>
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
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {permissionError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {permissionError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none bg-white"
                >
                  <option value={ROLES.ADMIN}>Admin (Full Access)</option>
                  <option value={ROLES.HR}>HR (Manage Candidates & Jobs)</option>
                  <option value={ROLES.INTERVIEWER}>Interviewer (View & Rate only)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
