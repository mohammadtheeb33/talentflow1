"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface TopSkillsChartProps {
  items: { skill: string; count: number }[];
}

export default function TopSkillsChart({ items }: TopSkillsChartProps) {
  if (items.length === 0) {
    return <div className="mt-4 flex h-48 w-full items-center justify-center text-[11px] text-slate-500">No skill data available.</div>;
  }

  return (
    <div className="mt-4 h-48 w-full">
      <ResponsiveContainer>
        <BarChart
          layout="vertical"
          data={items}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="gradIndigoPurple2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="skill" tick={{ fontSize: 11, fill: "var(--report-axis)" }} width={120} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} contentStyle={{ fontSize: 11, borderRadius: "8px", border: "1px solid var(--report-tooltip-border)", background: "var(--report-tooltip-bg)", color: "var(--report-tooltip-text)", boxShadow: "var(--report-tooltip-shadow)" }} />
          <Bar dataKey="count" fill="url(#gradIndigoPurple2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
