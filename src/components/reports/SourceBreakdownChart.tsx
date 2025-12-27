"use client";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface SourceBreakdownChartProps {
  data: Record<string, number>;
  pct: Record<string, number>;
}

const COLORS = ["#6366f1", "#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function SourceBreakdownChart({ data, pct }: SourceBreakdownChartProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  })).filter(item => item.value > 0);

  return (
    <div className="mt-4 flex items-center gap-6">
      <div className="h-40 w-40">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 text-[11px]">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span 
              className="inline-block h-2 w-2 rounded" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }} 
            /> 
            {entry.name} 
            <span className="text-gray-600">{pct[entry.name]}%</span>
          </div>
        ))}
        <div className="pt-2 text-[10px] text-gray-500">
          {chartData.map(d => d.name).join(" vs ")}
        </div>
      </div>
    </div>
  );
}
