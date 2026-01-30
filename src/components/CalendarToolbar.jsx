"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarToolbar(props) {
  const { date, view, label, onNavigate, onView } = props;

  const goToBack = () => {
    onNavigate("PREV");
  };

  const goToNext = () => {
    onNavigate("NEXT");
  };

  const goToCurrent = () => {
    onNavigate("TODAY");
  };

  const goToView = (viewName) => {
    onView(viewName);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={goToCurrent}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-transparent dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
        >
          Today
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={goToBack}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-transparent dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-transparent dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{label}</h2>
      </div>

      <div className="flex rounded-lg bg-slate-100 p-1 transition-colors dark:bg-slate-800">
        {["month", "week", "day"].map((viewName) => {
          const isActive = view === viewName;

          return (
            <button
              key={viewName}
              onClick={() => goToView(viewName)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                isActive
                  ? "rounded-md bg-indigo-600 text-white shadow-md"
                  : "text-slate-600 hover:bg-gray-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              }`}
            >
              {viewName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
