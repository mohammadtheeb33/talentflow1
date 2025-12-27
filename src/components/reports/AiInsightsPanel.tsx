"use client";
import { Sparkles } from "lucide-react";

interface AiInsightsPanelProps {
  insights: string[];
  loading?: boolean;
}

export default function AiInsightsPanel({ insights, loading }: AiInsightsPanelProps) {
  if (loading) {
    return <div className="h-24 w-full animate-pulse rounded-lg bg-gray-100" />;
  }

  if (!insights.length) return null;

  return (
    <section className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-indigo-900">AI Insights</h3>
      </div>
      <ul className="space-y-1">
        {insights.map((insight, i) => (
          <li key={i} className="text-xs text-indigo-800 flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 rounded-full bg-indigo-400 flex-shrink-0" />
            {insight}
          </li>
        ))}
      </ul>
    </section>
  );
}
