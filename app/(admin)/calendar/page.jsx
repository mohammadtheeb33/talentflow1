"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { Plus } from "lucide-react";
import { getClientFirestore, getClientAuth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

// Setup the localizer
const locales = {
  "en-US": enUS,
};

const CalendarToolbar = dynamic(() => import("@/components/CalendarToolbar"), { ssr: false });
const EventModal = dynamic(() => import("@/components/EventModal").then((mod) => mod.EventModal), { ssr: false });
const CalendarClient = dynamic(async () => {
  const rbc = await import("react-big-calendar");
  await import("react-big-calendar/lib/css/react-big-calendar.css");
  const { Calendar, dateFnsLocalizer } = rbc;
  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
  });

  return function CalendarClientView(props) {
    return <Calendar localizer={localizer} {...props} />;
  };
}, { ssr: false, loading: () => <div className="h-full w-full rounded-2xl bg-slate-100 animate-pulse dark:bg-white/5" /> });

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [uid, setUid] = useState(null);

  const [date, setDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Fix Navigation Logic
  const onNavigate = useCallback((newDate) => setDate(newDate), [setDate]);
  const onView = useCallback((newView) => setView(newView), [setView]);

  useEffect(() => {
    try {
      const auth = getClientAuth();
      const u = auth.currentUser;
      if (!u) return;
      setUid(u.uid);
      const db = getClientFirestore();
      const q = query(collection(db, "events"), where("uid", "==", u.uid));
      const unsub = onSnapshot(q, (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data();
          const start = data.start?.seconds ? new Date(data.start.seconds * 1000) : new Date(data.start);
          const end = data.end?.seconds ? new Date(data.end.seconds * 1000) : new Date(data.end);
          rows.push({ id: d.id, title: data.title, type: data.type, start, end });
        });
        rows.sort((a, b) => a.start.getTime() - b.start.getTime());
        setEvents(rows);
      });
      return () => unsub();
    } catch (_) {
      setEvents([]);
    }
  }, []);

  // Handle slot selection (clicking on a date/time)
  const handleSelectSlot = (slotInfo) => {
    setSelectedSlot(slotInfo);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  // Handle event selection (clicking on an existing event)
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  const handleSaveEvent = (eventData) => {
    try {
      const db = getClientFirestore();
      if (eventData.id && typeof eventData.id === "string") {
        updateDoc(doc(db, "events", eventData.id), {
          title: eventData.title,
          type: eventData.type,
          start: eventData.start,
          end: eventData.end,
          updatedAt: serverTimestamp(),
        });
      } else if (uid) {
        addDoc(collection(db, "events"), {
          uid,
          title: eventData.title,
          type: eventData.type,
          start: eventData.start,
          end: eventData.end,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        setEvents((prev) => [
          ...prev,
          { ...eventData, id: Math.random().toString(36).substr(2, 9) },
        ]);
      }
    } catch (_) {}
  };

  const handleDeleteEvent = (eventId) => {
    if (!eventId) return;
    try {
      if (typeof eventId === "string") {
        const db = getClientFirestore();
        deleteDoc(doc(db, "events", eventId));
      }
      setEvents((prev) => prev.filter((evt) => evt.id !== eventId));
    } catch (_) {}
    setSelectedEvent(null);
    setSelectedSlot(null);
    setIsModalOpen(false);
  };

  const eventPropGetter = () => ({
    className: "modern-calendar-event",
  });

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 transition-colors p-6">
      <div className="h-[800px] p-6 rounded-2xl transition-all duration-300 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/40 dark:border-white/10 dark:backdrop-blur-xl dark:shadow-none flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Work Calendar</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your schedule and interviews</p>
          </div>
          <button
            onClick={() => {
              setSelectedEvent(null);
              setSelectedSlot(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(99,102,241,0.45)] transition hover:from-violet-500 hover:to-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
          <CalendarClient
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            views={["month", "week", "day"]}
            defaultView="month"
            date={date}
            onNavigate={onNavigate}
            view={view}
            onView={onView}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
            components={{
              toolbar: CalendarToolbar,
            }}
            className="modern-calendar h-full"
          />
        </div>
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialEvent={selectedEvent}
        selectedSlot={selectedSlot}
      />
    </div>
  );
}
