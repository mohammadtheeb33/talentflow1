"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { FunnelData } from "@/services/analyticsService";

interface HiringFunnelChartProps {
  data: FunnelData[];
}

export default function HiringFunnelChart({ data }: HiringFunnelChartProps) {
  if (!data || data.length === 0) return <div className="h-64 w-full flex items-center justify-center text-gray-400 text-xs">No data available</div>;

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
          <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fontWeight: 500 }} width={80} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload as FunnelData;
                return (
                  <div className="rounded-lg border bg-white p-2 shadow-lg text-xs">
                    <p className="font-semibold text-gray-900">{d.stage}</p>
                    <p className="text-gray-600">Count: <span className="font-medium">{d.count}</span></p>
                    <p className="text-gray-500">Conversion: {d.conversion}%</p>
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
