"use client";
import { Sparkles } from "lucide-react";

interface AiInsightsPanelProps {
  insights: string[];
  loading?: boolean;
}

export default function AiInsightsPanel({ insights, loading }: AiInsightsPanelProps) {
  if (loading) {
    return <div className="h-24 w-full animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5" />;
  }

  if (!insights.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-900/10">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 shadow-[0_0_18px_rgba(99,102,241,0.35)] dark:bg-indigo-500/20 dark:shadow-[0_0_18px_rgba(99,102,241,0.5)]">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-200" />
        </span>
        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">AI Insights</h3>
      </div>
      <ul className="space-y-1">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-100">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-300" />
            <span>
              {insight.split(/(\d+%?)/).map((part, index) => (
                <span key={`${i}-${index}`} className={/^\d+%?$/.test(part) ? "font-semibold text-indigo-700 dark:text-cyan-300" : ""}>
                  {part}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
