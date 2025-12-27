"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface ScoreHistogramProps {
  bins: number[];
}

export default function ScoreHistogram({ bins }: ScoreHistogramProps) {
  return (
    <div className="mt-4 h-40 w-full">
      <ResponsiveContainer>
        <BarChart data={bins.map((v, i) => ({ bucket: `${i * 10}`, count: v }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIndigoPurple" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="count" fill="url(#gradIndigoPurple)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
