"use client";
import { JobAnalytics } from "@/services/analyticsService";

interface JobAnalyticsTableProps {
  data: JobAnalytics[];
}

export default function JobAnalyticsTable({ data }: JobAnalyticsTableProps) {
  if (!data || data.length === 0) return <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No data available.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Job Title</th>
            <th className="px-4 py-3 text-right">Candidates</th>
            <th className="px-4 py-3 text-right">Job Health</th>
            <th className="px-4 py-3 text-right">Median Score</th>
            <th className="px-4 py-3 text-right">HR Acceptance Rate</th>
            <th className="px-4 py-3 text-right">ATS Pass Rate</th>
            <th className="px-4 py-3 text-right">Accepted</th>
            <th className="px-4 py-3 text-right">Rejected</th>
          </tr>
        </thead>
        <tbody className="text-slate-900 dark:text-slate-200">
          {data.map((row) => (
            <tr key={row.jobTitle} className="border-b border-slate-100 bg-white hover:bg-slate-50 last:border-b-0 dark:border-white/5 dark:bg-transparent dark:hover:bg-white/5">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.jobTitle}</td>
              <td className="px-4 py-3 text-right">{row.total}</td>
              <td className="px-4 py-3 text-right">
                {row.jobHealthScore === "N/A" ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">N/A</span>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.jobHealthScore}</span>
                    <div className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-800/70">
                      <div 
                        className={`h-1.5 rounded-full ${
                          (row.jobHealthScore as number) >= 70 ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]" :
                          (row.jobHealthScore as number) >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" :
                          "bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.55)]"
                        }`} 
                        style={{ width: `${Math.min(100, row.jobHealthScore as number)}%` }} 
                      />
                    </div>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {row.medianScore === "N/A" ? (
                  <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    N/A
                  </span>
                ) : (
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    (row.medianScore as number) >= 70 ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" :
                    (row.medianScore as number) >= 50 ? "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" :
                    "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                  }`}>
                    {row.medianScore}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {row.acceptanceRate === "N/A" ? <span className="text-slate-500 dark:text-slate-400">N/A</span> : `${row.acceptanceRate}%`}
              </td>
              <td className="px-4 py-3 text-right">
                {row.atsPassRate === "N/A" ? <span className="text-slate-500 dark:text-slate-400">N/A</span> : `${row.atsPassRate}%`}
              </td>
              <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-300">{row.accepted}</td>
              <td className="px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-300">{row.rejected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
