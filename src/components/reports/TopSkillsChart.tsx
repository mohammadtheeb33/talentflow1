"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface TopSkillsChartProps {
  items: { skill: string; count: number }[];
}

export default function TopSkillsChart({ items }: TopSkillsChartProps) {
  if (items.length === 0) {
    return <div className="mt-4 h-48 w-full flex items-center justify-center text-[11px] text-gray-500">No skill data available.</div>;
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
          <YAxis type="category" dataKey="skill" tick={{ fontSize: 11 }} width={120} />
          <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="count" fill="url(#gradIndigoPurple2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
