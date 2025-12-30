"use client";
import { JobAnalytics } from "@/services/analyticsService";

interface JobAnalyticsTableProps {
  data: JobAnalytics[];
}

export default function JobAnalyticsTable({ data }: JobAnalyticsTableProps) {
  if (!data || data.length === 0) return <div className="p-8 text-center text-sm text-gray-500">No data available.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-t border-b bg-gray-50 text-xs text-gray-600">
          <tr>
            <th className="px-4 py-3 font-medium">Job Title</th>
            <th className="px-4 py-3 font-medium text-right">Candidates</th>
            <th className="px-4 py-3 font-medium text-right">Job Health</th>
            <th className="px-4 py-3 font-medium text-right">Median Score</th>
            <th className="px-4 py-3 font-medium text-right">HR Acceptance Rate</th>
            <th className="px-4 py-3 font-medium text-right">ATS Pass Rate</th>
            <th className="px-4 py-3 font-medium text-right">Accepted</th>
            <th className="px-4 py-3 font-medium text-right">Rejected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row) => (
            <tr key={row.jobTitle} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 font-medium text-gray-900">{row.jobTitle}</td>
              <td className="px-4 py-3 text-right text-gray-600">{row.total}</td>
              <td className="px-4 py-3 text-right">
                {row.jobHealthScore === "N/A" ? (
                  <span className="text-xs text-gray-500">N/A</span>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-medium text-gray-700">{row.jobHealthScore}</span>
                    <div className="h-1.5 w-16 rounded-full bg-gray-200">
                      <div 
                        className={`h-1.5 rounded-full ${
                          (row.jobHealthScore as number) >= 70 ? "bg-green-500" :
                          (row.jobHealthScore as number) >= 50 ? "bg-yellow-500" :
                          "bg-red-500"
                        }`} 
                        style={{ width: `${Math.min(100, row.jobHealthScore as number)}%` }} 
                      />
                    </div>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {row.medianScore === "N/A" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    N/A
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    (row.medianScore as number) >= 70 ? "bg-green-100 text-green-800" :
                    (row.medianScore as number) >= 50 ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {row.medianScore}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {row.acceptanceRate === "N/A" ? <span className="text-gray-500">N/A</span> : `${row.acceptanceRate}%`}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {row.atsPassRate === "N/A" ? <span className="text-gray-500">N/A</span> : `${row.atsPassRate}%`}
              </td>
              <td className="px-4 py-3 text-right text-emerald-600 font-medium">{row.accepted}</td>
              <td className="px-4 py-3 text-right text-red-600 font-medium">{row.rejected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
