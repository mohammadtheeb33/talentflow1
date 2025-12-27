"use client";

import { useEffect, useState } from "react";
import { getClientFirestore } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { Loader2, DollarSign, Activity, FileText, Database } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface AiUsageLog {
  id: string;
  userId: string;
  cvId: string;
  type: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  timestamp: Timestamp;
}

interface Stats {
  totalSpend: number;
  totalScans: number;
  totalTokens: number;
  avgCostPerScan: number;
}

export default function CostTrackerPage() {
  const [logs, setLogs] = useState<AiUsageLog[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSpend: 0, totalScans: 0, totalTokens: 0, avgCostPerScan: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const db = getClientFirestore();
        const ref = collection(db, "ai_usage_logs");
        // For dashboard summary, we might want a separate aggregation query or just fetch latest N records
        // For now, let's fetch a reasonable batch to show the table and calculate "recent" stats
        // In a real production app with millions of records, you'd want aggregation counters.
        const q = query(ref, orderBy("timestamp", "desc"), limit(100));
        
        const snapshot = await getDocs(q);
        const fetchedLogs: AiUsageLog[] = [];
        let spend = 0;
        let tokens = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const log = {
            id: doc.id,
            ...data
          } as AiUsageLog;
          fetchedLogs.push(log);
          spend += (log.totalCost || 0);
          tokens += (log.inputTokens || 0) + (log.outputTokens || 0);
        });

        setLogs(fetchedLogs);
        
        // Calculate stats based on this batch (or ideally fetching a global stats doc)
        const count = fetchedLogs.length;
        setStats({
          totalSpend: spend,
          totalScans: count,
          totalTokens: tokens,
          avgCostPerScan: count > 0 ? spend / count : 0
        });

      } catch (error) {
        console.error("Failed to fetch usage logs:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/30">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Dashboard</span>
            <span>/</span>
            <span className="font-semibold text-gray-900">AI Cost & Usage Tracker</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
            
            {/* Title Section */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">AI Cost Analysis</h1>
                <p className="mt-1 text-sm text-gray-500">Monitor unit economics and token usage across all AI operations.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard 
                    title="Total Spend" 
                    value={`$${stats.totalSpend.toFixed(4)}`} 
                    icon={DollarSign} 
                    subtext="Based on loaded records"
                />
                <SummaryCard 
                    title="Total Scans" 
                    value={stats.totalScans.toLocaleString()} 
                    icon={Activity} 
                    subtext="Operations logged"
                />
                <SummaryCard 
                    title="Avg Cost / Scan" 
                    value={`$${stats.avgCostPerScan.toFixed(4)}`} 
                    icon={FileText} 
                    subtext="Unit economics"
                />
                <SummaryCard 
                    title="Total Tokens" 
                    value={(stats.totalTokens / 1000).toFixed(1) + "k"} 
                    icon={Database} 
                    subtext="Input + Output"
                />
            </div>

            {/* Usage Table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Recent Usage Logs</h2>
                    <span className="text-xs text-gray-500">Last {logs.length} records</span>
                </div>
                
                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-gray-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Date</th>
                                    <th className="px-6 py-3 font-medium">CV ID</th>
                                    <th className="px-6 py-3 font-medium">Type</th>
                                    <th className="px-6 py-3 font-medium">Model</th>
                                    <th className="px-6 py-3 font-medium text-right">Input</th>
                                    <th className="px-6 py-3 font-medium text-right">Output</th>
                                    <th className="px-6 py-3 font-medium text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                                            No usage logs found yet.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                                                {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "-"}
                                            </td>
                                            <td className="px-6 py-3 font-mono text-xs text-gray-500 truncate max-w-[120px]" title={log.cvId}>
                                                {log.cvId.slice(0, 8)}...
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                                                    log.type === 'cv_scan' ? "bg-blue-50 text-blue-700 ring-blue-600/20" : 
                                                    log.type === 'cv_parse' ? "bg-purple-50 text-purple-700 ring-purple-600/20" :
                                                    "bg-gray-50 text-gray-600 ring-gray-500/10"
                                                )}>
                                                    {log.type === 'cv_scan' ? 'Scan' : log.type === 'cv_parse' ? 'Parse' : log.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-600 text-xs">
                                                {log.model}
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-600 font-mono text-xs">
                                                {log.inputTokens?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-600 font-mono text-xs">
                                                {log.outputTokens?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-gray-900 font-mono text-xs">
                                                ${log.totalCost?.toFixed(6)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Simple Pagination Footer */}
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                    <button disabled className="text-sm text-gray-400 cursor-not-allowed">Previous</button>
                    <span className="text-xs text-gray-500">Page 1</span>
                    <button disabled className="text-sm text-gray-400 cursor-not-allowed">Next</button>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, subtext }: { title: string, value: string, icon: any, subtext: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
                </div>
                <div className="rounded-full bg-zinc-50 p-3">
                    <Icon className="h-5 w-5 text-gray-400" />
                </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">{subtext}</p>
        </div>
    );
}
