"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import TicketChatView from "@/components/TicketChatView";
import { createTicket, listenToUserTickets, type Ticket as SupportTicket, type TicketPriority, type TicketStatus } from "@/services/supportService";
import { ensureUid } from "@/lib/firebase";

const NewTicketModal = dynamic(() => import("@/components/support/NewTicketModal"), { ssr: false });

const statusOptions: Array<{ label: string; value: "all" | TicketStatus }> = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Closed", value: "closed" }
];

const priorityOptions: Array<{ label: string; value: TicketPriority }> = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" }
];

export default function SupportPage() {
  const [userId, setUserId] = useState<string>("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    ensureUid().then(setUserId).catch(() => setUserId(""));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = listenToUserTickets(userId, setTickets, filter === "all" ? undefined : filter);
    return () => { try { unsub(); } catch {} };
  }, [userId, filter]);

  useEffect(() => {
    if (!tickets.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !tickets.find((t) => t.id === selectedId)) {
      setSelectedId(tickets[0].id);
    }
  }, [tickets, selectedId]);

  const selectedTicket = useMemo(() => tickets.find((t) => t.id === selectedId) || null, [tickets, selectedId]);

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setCreating(true);
    try {
      const id = await createTicket(subject.trim(), message.trim(), priority);
      setSubject("");
      setMessage("");
      setPriority("medium");
      setModalOpen(false);
      setSelectedId(id);
      toast.success("Ticket created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  const statusStyles: Record<TicketStatus, string> = {
    open: "border border-emerald-400/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    in_progress: "border border-amber-400/40 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)]",
    closed: "border border-slate-500/40 text-slate-300 shadow-[0_0_12px_rgba(148,163,184,0.25)]"
  };

  const priorityStyles: Record<TicketPriority, string> = {
    low: "border border-emerald-400/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    medium: "border border-amber-400/40 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)]",
    high: "border border-rose-400/40 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.35)]"
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Support</h1>
        <p className="text-sm text-slate-400">Chat with our support team in real time.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-slate-200 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">My Tickets</div>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.55)] transition hover:from-violet-500 hover:to-indigo-500"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-full border border-white/10 px-3 py-1 text-xs font-medium transition ${
                  filter === opt.value ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {tickets.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
                No tickets yet
              </div>
            ) : null}
            {tickets.map((t) => {
              const isSelected = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-white/10 bg-white/5 text-white border-l-4 border-indigo-500"
                      : "border-white/10 bg-transparent text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`text-sm font-semibold ${isSelected ? "text-white" : "text-slate-200"}`}>
                      {t.subject || "Untitled Ticket"}
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${statusStyles[t.status]}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                    <Ticket className="h-3 w-3" />
                    <span>Priority: {t.priority}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex h-[70vh] flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-5 py-4 text-slate-100 shadow-[0_0_24px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{selectedTicket?.subject || "Select a ticket"}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {selectedTicket ? `Ticket ID: ${selectedTicket.id}` : "Start a new ticket to chat with support"}
                </div>
              </div>
              {selectedTicket ? (
                <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-wide ${priorityStyles[selectedTicket.priority]}`}>
                  {selectedTicket.priority} priority
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <TicketChatView ticketId={selectedId} viewerRole="user" theme="dark" disabled={selectedTicket?.status === "closed"} />
          </div>
        </div>
      </div>

      {modalOpen ? (
        <NewTicketModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
          creating={creating}
          subject={subject}
          onSubjectChange={setSubject}
          message={message}
          onMessageChange={setMessage}
          priority={priority}
          onPriorityChange={setPriority}
          priorityOptions={priorityOptions}
        />
      ) : null}
    </div>
  );
}
