"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { ScoreBin } from "@/services/analyticsService";

interface ScoreDecisionChartProps {
  data: ScoreBin[];
}

export default function ScoreDecisionChart({ data }: ScoreDecisionChartProps) {
  return (
    <div className="mt-4 h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--report-grid)" opacity={0.25} />
          <XAxis dataKey="range" tick={{ fontSize: 11, fill: "var(--report-axis)" }} tickLine={false} axisLine={{ stroke: "var(--report-grid)", opacity: 0.6 }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--report-axis)" }} tickLine={false} axisLine={{ stroke: "var(--report-grid)", opacity: 0.6 }} allowDecimals={false} />
          <Tooltip 
             contentStyle={{ fontSize: 11, borderRadius: "8px", border: "1px solid var(--report-tooltip-border)", background: "var(--report-tooltip-bg)", color: "var(--report-tooltip-text)", boxShadow: "var(--report-tooltip-shadow)" }}
             cursor={{ fill: "rgba(148,163,184,0.06)" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "var(--report-axis)" }} />
          <Bar dataKey="accepted" name="Accepted" stackId="a" fill="#8b5cf6" radius={[0, 0, 4, 4]} />
          <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#ec4899" radius={[0, 0, 0, 0]} />
          <Bar dataKey="undecided" name="Undecided" stackId="a" fill="#22d3ee" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
