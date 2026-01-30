"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getClientFirestore } from "@/lib/firebase";
import { collection, getCountFromServer, getDocs, query, where, Timestamp } from "firebase/firestore";
import { Users, CreditCard, FileText, TrendingUp } from "lucide-react";

type DayUsage = { date: string; tokens: number };

const TokenUsageChart = dynamic(async () => {
  const m = await import("recharts");
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = m;
  const Chart = ({ data }: { data: (DayUsage & { label: string })[] }) => (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="usageGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.15)" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ stroke: "rgba(34,211,238,0.4)", strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_0_20px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100 dark:shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                <div className="text-slate-500 dark:text-slate-400">{label}</div>
                <div className="mt-1 text-sm font-semibold text-cyan-600 dark:text-cyan-300">{payload[0].value} tokens</div>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="tokens" stroke="#22d3ee" strokeWidth={2} fill="url(#usageGlow)" />
      </AreaChart>
    </ResponsiveContainer>
  );
  return Chart;
}, { ssr: false });

export default function AdminOverviewPage() {
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [activeSubs, setActiveSubs] = useState<number>(0);
  const [totalCvs, setTotalCvs] = useState<number>(0);
  const [usage, setUsage] = useState<DayUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [range, setRange] = useState<"7d" | "1m" | "ytd">("7d");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const db = getClientFirestore();
      const usersRef = collection(db, "users");
      const cvsRef = collection(db, "cvs");
      const usageRef = collection(db, "usage_logs");

      try {
        const usersCount = await getCountFromServer(usersRef);
        setTotalUsers(usersCount.data().count);
      } catch (_) {}

      try {
        const proSnap = await getDocs(query(usersRef, where("plan", "==", "pro")));
        setActiveSubs(proSnap.size);
      } catch (_) {}

      try {
        const cvsCount = await getCountFromServer(cvsRef);
        setTotalCvs(cvsCount.data().count);
      } catch (_) {}

      try {
        const now = new Date();
        let start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (range === "1m") start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (range === "ytd") start = new Date(now.getFullYear(), 0, 1);
        const startTs = Timestamp.fromDate(start);
        const snap = await getDocs(query(usageRef, where("timestamp", ">=", startTs)));
        const byDay: Record<string, number> = {};
        snap.forEach((d) => {
          const t = d.data()?.timestamp;
          let dt: Date | null = null;
          if (t && typeof t.toDate === "function") dt = t.toDate();
          if (!dt) dt = new Date();
          const key = dt.toISOString().slice(0, 10);
          const val = Number(d.data()?.tokens_used || 0);
          byDay[key] = (byDay[key] || 0) + val;
        });
        const days: DayUsage[] = [];
        const totalDays = range === "1m" ? 30 : range === "ytd" ? Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) : 7;
        for (let i = totalDays - 1; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().slice(0, 10);
          days.push({ date: key, tokens: byDay[key] || 0 });
        }
        setUsage(days);
      } catch (_) {}
      setLoading(false);
    })();
  }, [range]);

  const cards = useMemo(() => [
    { title: "Total Users", value: totalUsers, icon: Users, trend: "+12% from last week", color: "from-cyan-500/20 to-cyan-400/5" },
    { title: "Active Subscriptions", value: activeSubs, icon: CreditCard, trend: "+5% from last week", color: "from-violet-500/20 to-violet-400/5" },
    { title: "Total CVs Analyzed", value: totalCvs, icon: FileText, trend: "+18% from last week", color: "from-indigo-500/20 to-indigo-400/5" },
  ], [totalUsers, activeSubs, totalCvs]);

  const chartData = useMemo(() => usage.map((d) => {
    const [y, m, day] = d.date.split("-");
    return { ...d, label: `${day}/${m}` };
  }), [usage]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Overview</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Live system pulse and AI usage.</p>
        </div>
        <button className="rounded-xl border border-slate-200/60 bg-white/70 px-4 py-2 text-xs text-slate-700 hover:bg-slate-100/80 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className={`relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 bg-gradient-to-br ${c.color} p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5`}>
              <div className="absolute right-4 top-4 rounded-xl bg-slate-100/80 p-2 dark:bg-white/5">
                <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-200" />
              </div>
              <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{c.title}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{loading ? "…" : c.value}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{c.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_40px_rgba(56,189,248,0.08)]">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">Token Usage</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">AI consumption & cost signals</p>
          </div>
          <div className="flex items-center gap-2">
            {[
              { id: "7d", label: "7D" },
              { id: "1m", label: "1M" },
              { id: "ytd", label: "YTD" }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id as "7d" | "1m" | "ytd")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  range === r.id
                    ? "bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-400/40 dark:bg-cyan-500/20 dark:text-cyan-200"
                    : "border border-slate-200/60 text-slate-500 hover:text-slate-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <TokenUsageChart data={chartData} />
        </div>
      </div>
    </div>
  );
}
