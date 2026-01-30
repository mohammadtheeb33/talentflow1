"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { FunnelData } from "@/services/analyticsService";

interface HiringFunnelChartProps {
  data: FunnelData[];
}

export default function HiringFunnelChart({ data }: HiringFunnelChartProps) {
  if (!data || data.length === 0) return <div className="flex h-64 w-full items-center justify-center text-xs text-slate-500">No data available</div>;

  return (
    <div className="mt-4 h-64 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          barCategoryGap={2}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fontWeight: 500, fill: "var(--report-axis)" }} width={90} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload as FunnelData;
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <p className="font-semibold text-slate-900 dark:text-white">{d.stage}</p>
                    <p className="text-slate-600 dark:text-slate-300">Count: <span className="font-medium text-slate-900 dark:text-white">{d.count}</span></p>
                    <p className="text-slate-500 dark:text-slate-400">Conversion: <span className="text-indigo-600 dark:text-cyan-300">{d.conversion}%</span></p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
            <LabelList dataKey="count" position="right" fontSize={11} fontWeight={600} formatter={(v: number) => v > 0 ? v : ""} />
            <LabelList dataKey="conversion" position="insideRight" fontSize={10} fill="#fff" formatter={(v: number) => v > 0 ? `${v}%` : ""} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
