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
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: 'Volume', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#6b7280' } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} label={{ value: 'Avg Score', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#6b7280' } }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
          <Bar yAxisId="left" dataKey="count" name="Candidates" barSize={20} fill="#e0e7ff" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Avg Score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
