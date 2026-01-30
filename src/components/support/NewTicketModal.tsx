"use client";

import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";
import type { TicketPriority } from "@/services/supportService";

type NewTicketModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  creating: boolean;
  subject: string;
  onSubjectChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  priority: TicketPriority;
  onPriorityChange: (value: TicketPriority) => void;
  priorityOptions: Array<{ label: string; value: TicketPriority }>;
};

export default function NewTicketModal({
  open,
  onClose,
  onCreate,
  creating,
  subject,
  onSubjectChange,
  message,
  onMessageChange,
  priority,
  onPriorityChange,
  priorityOptions,
}: NewTicketModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">New Ticket</Dialog.Title>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Subject</label>
              <input
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Priority</label>
              <div className="mt-2 flex gap-2">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onPriorityChange(opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      priority === opt.value ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Message</label>
              <textarea
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button
              onClick={onCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
