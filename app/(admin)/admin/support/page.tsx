"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import TicketChatView from "@/components/TicketChatView";
import { listenToAllTickets, updateTicketStatus, type Ticket as SupportTicket, type TicketStatus } from "@/services/supportService";

const statusOptions: TicketStatus[] = ["open", "in_progress", "closed"];

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsub = listenToAllTickets(setTickets);
    return () => { try { unsub(); } catch {} };
  }, []);

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

  const handleStatusChange = async (status: TicketStatus) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await updateTicketStatus(selectedTicket.id, status);
      toast.success("Status updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Support Center</h2>
        <p className="text-sm text-slate-400">Monitor and respond to user tickets in real time.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-4">
          <div className="text-sm font-semibold text-slate-200">All Tickets</div>
          <div className="mt-4 space-y-3">
            {tickets.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
                No tickets yet
              </div>
            ) : null}
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selectedId === t.id
                    ? "border-cyan-500/50 bg-slate-950/70"
                    : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                }`}
              >
                <div className="text-sm font-semibold text-slate-100">{t.subject || "Untitled Ticket"}</div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{t.userEmail || t.userId}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{t.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-[70vh] flex-col gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">{selectedTicket?.subject || "Select a ticket"}</div>
                <div className="text-xs text-slate-400">
                  {selectedTicket ? `User: ${selectedTicket.userEmail || selectedTicket.userId}` : "Pick a ticket from the list"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedTicket?.status || "open"}
                  onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                  disabled={!selectedTicket || updating}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <TicketChatView ticketId={selectedId} viewerRole="admin" disabled={selectedTicket?.status === "closed"} />
          </div>
        </div>
      </div>
    </div>
  );
}
