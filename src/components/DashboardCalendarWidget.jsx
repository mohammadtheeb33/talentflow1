import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
import { getClientFirestore, getClientAuth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { startOfDay, endOfDay } from 'date-fns';

export default function DashboardCalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    let unsubscribeEvents;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeEvents) {
        unsubscribeEvents();
        unsubscribeEvents = undefined;
      }
      if (!user) {
        setEvents([]);
        setLoading(false);
        return;
      }
      const db = getClientFirestore();
      const q = query(collection(db, 'events'), where('uid', '==', user.uid));
      unsubscribeEvents = onSnapshot(
        q,
        (snapshot) => {
          const rows = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const start = data.start?.toDate
              ? data.start.toDate()
              : data.start?.seconds
                ? new Date(data.start.seconds * 1000)
                : new Date(data.start);
            const end = data.end?.toDate
              ? data.end.toDate()
              : data.end?.seconds
                ? new Date(data.end.seconds * 1000)
                : new Date(data.end);
            if (!start || Number.isNaN(start.getTime())) return;
            rows.push({
              id: docSnap.id,
              title: data.title,
              type: data.type,
              candidateName: data.candidateName,
              start,
              end,
            });
          });
          const today = new Date();
          const dayStart = startOfDay(today);
          const dayEnd = endOfDay(today);
          const todays = rows.filter((evt) => evt.start >= dayStart && evt.start <= dayEnd);
          todays.sort((a, b) => a.start.getTime() - b.start.getTime());
          setEvents(todays);
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      if (unsubscribeEvents) unsubscribeEvents();
      unsubscribeAuth();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full animate-pulse flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-5 w-24 rounded bg-slate-200 dark:bg-white/10"></div>
          <div className="h-5 w-32 rounded bg-slate-200 dark:bg-white/10"></div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-white/10"></div>
        </div>
      </div>
    );
  }

  const hasEvents = events.length > 0;

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all dark:border-white/10 dark:bg-slate-900/40 dark:backdrop-blur-xl dark:shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          Calendar
        </h3>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!hasEvents ? (
          <div className="flex flex-col items-center justify-center py-8 text-center h-full">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
              <CheckCircle className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </div>
            <p className="font-medium text-slate-900 dark:text-white">No events</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your schedule is clear.</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-1">
            {events.map((event) => {
                let date;
                if (event.start?.toDate) {
                    date = event.start.toDate();
                } else if (event.start?.seconds) {
                    date = new Date(event.start.seconds * 1000);
                } else {
                    date = new Date(event.start);
                }
                
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isInterview = event.type === 'interview' || (event.title || '').toLowerCase().includes('interview');
                
              return (
                <div key={event.id} className="group flex items-center gap-4 rounded-2xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/5">
                  <div className="flex min-w-[65px] flex-col items-center">
                    <span className="text-sm font-semibold text-slate-600 transition group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200">{timeStr}</span>
                  </div>
                  <div className={`h-8 w-1 rounded-full ${isInterview ? "bg-purple-400" : "bg-cyan-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{event.title}</p>
                    {event.candidateName && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">with {event.candidateName}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
