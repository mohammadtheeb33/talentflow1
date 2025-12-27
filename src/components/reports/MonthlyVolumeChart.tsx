"use client";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

interface MonthlyVolumeChartProps {
  points: number[];
}

export default function MonthlyVolumeChart({ points }: MonthlyVolumeChartProps) {
  return (
    <div className="mt-4 h-40 w-full">
      <ResponsiveContainer>
        <LineChart
          data={points.map((v, i) => ({ m: i + 1, count: v }))}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="m" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
