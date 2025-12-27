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
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="range" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
          <Tooltip 
             contentStyle={{ fontSize: 11, borderRadius: "6px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
             cursor={{ fill: "#f9fafb" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
          <Bar dataKey="accepted" name="Accepted" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
          <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
          <Bar dataKey="undecided" name="Undecided" stackId="a" fill="#9ca3af" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
