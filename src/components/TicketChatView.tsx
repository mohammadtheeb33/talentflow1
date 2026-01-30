"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listenToTicketMessages, sendMessage, type TicketMessage, type SenderRole } from "@/services/supportService";
import { Loader2, Send } from "lucide-react";

type TicketChatViewProps = {
  ticketId?: string | null;
  viewerRole: SenderRole;
  disabled?: boolean;
  theme?: "light" | "dark";
};

export default function TicketChatView({ ticketId, viewerRole, disabled, theme = "dark" }: TicketChatViewProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isLight = theme === "light";

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = listenToTicketMessages(ticketId, (data) => {
      setMessages(data);
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = useMemo(() => {
    return Boolean(ticketId) && text.trim().length > 0 && !sending && !disabled;
  }, [ticketId, text, sending, disabled]);

  const handleSend = async () => {
    if (!ticketId || !canSend) return;
    const body = text.trim();
    setText("");
    setSending(true);
    try {
      await sendMessage(ticketId, body, viewerRole);
    } finally {
      setSending(false);
    }
  };

  if (!ticketId) {
    return (
      <div className={`flex h-full items-center justify-center rounded-2xl border p-6 text-sm ${isLight ? "border-gray-200 bg-white text-gray-500" : "border-white/10 bg-slate-900/40 text-slate-300 backdrop-blur-xl"}`}>
        Select a ticket to start the conversation
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col rounded-2xl border ${isLight ? "border-gray-200 bg-white" : "border-white/10 bg-slate-900/40 backdrop-blur-xl"}`}>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {loading ? (
          <div className={`flex items-center gap-2 text-sm ${isLight ? "text-gray-500" : "text-slate-400"}`}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading messages...
          </div>
        ) : null}
        {messages.map((msg) => {
          const mine = msg.senderRole === viewerRole;
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                  mine
                    ? isLight
                      ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none"
                      : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-none"
                    : isLight
                      ? "bg-gray-100 text-gray-800 rounded-2xl rounded-tl-none"
                      : "bg-slate-800 text-slate-200 rounded-2xl rounded-tl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className={`p-4 ${isLight ? "border-t border-gray-200" : "pt-2"}`}>
        <div className={`flex items-center gap-3 border px-4 py-2 ${isLight ? "rounded-xl border-gray-200 bg-gray-50" : "rounded-full border-slate-700/60 bg-slate-950/50 shadow-[0_0_18px_rgba(15,23,42,0.45)]"}`}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            rows={1}
            disabled={disabled}
            className={`w-full resize-none bg-transparent text-sm outline-none ${isLight ? "text-gray-800 placeholder:text-gray-400" : "text-slate-200 placeholder:text-slate-500"}`}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`inline-flex h-10 w-10 items-center justify-center ${isLight ? "rounded-lg bg-indigo-600 text-white" : "rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_14px_rgba(99,102,241,0.45)] hover:from-violet-500 hover:to-indigo-500"} transition disabled:opacity-40`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
