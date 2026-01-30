"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";

export function EventModal({ isOpen, onClose, onSave, onDelete, initialEvent, selectedSlot }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Meeting");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // Initialize form when modal opens or props change
  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setType(initialEvent.type || "Meeting");
      setStart(formatDateTime(initialEvent.start));
      setEnd(formatDateTime(initialEvent.end));
    } else if (selectedSlot) {
      setTitle("");
      setType("Meeting");
      setStart(formatDateTime(selectedSlot.start));
      setEnd(formatDateTime(selectedSlot.end));
    } else {
      // Default fallback
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      setStart(formatDateTime(now));
      setEnd(formatDateTime(oneHourLater));
    }
  }, [isOpen, initialEvent, selectedSlot]);

  // Helper to format Date object to "YYYY-MM-DDThh:mm" for datetime-local input
  const formatDateTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: initialEvent?.id, // undefined if new
      title,
      type,
      start: new Date(start),
      end: new Date(end),
    });
    onClose();
  };

  const handleDelete = () => {
    if (!initialEvent?.id) return;
    const confirmed = window.confirm("Are you sure you want to delete this event?");
    if (!confirmed) return;
    onDelete?.(initialEvent.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* The backdrop, rendered as a fixed sibling to the panel container */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full rounded-xl bg-white p-6 shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {initialEvent ? "Edit Event" : "Add Event"}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title
              </label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g. Interview with Omar"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="Meeting">Meeting</option>
                <option value="Interview">Interview</option>
                <option value="Call">Call</option>
                <option value="Deadline">Deadline</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              {initialEvent?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
