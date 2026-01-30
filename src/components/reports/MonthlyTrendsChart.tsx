"use client";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { MonthlyTrend } from "@/services/analyticsService";

interface MonthlyTrendsChartProps {
  data: MonthlyTrend[];
}

export default function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  return (
    <div className="mt-4 h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--report-grid)" strokeOpacity={0.25} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--report-axis)" }} tickLine={false} axisLine={{ stroke: "var(--report-grid)", strokeOpacity: 0.6 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--report-axis)" }} tickLine={false} axisLine={false} label={{ value: "Volume", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--report-axis)" } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--report-axis)" }} tickLine={false} axisLine={false} domain={[0, 100]} label={{ value: "Avg Score", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "var(--report-axis)" } }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: "8px", border: "1px solid var(--report-tooltip-border)", background: "var(--report-tooltip-bg)", color: "var(--report-tooltip-text)", boxShadow: "var(--report-tooltip-shadow)" }} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "var(--report-axis)" }} />
          <Bar yAxisId="left" dataKey="count" name="Candidates" barSize={20} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Avg Score" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3, fill: "#22d3ee" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
