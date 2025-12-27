"use client";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface SourceBreakdownChartProps {
  data: {
    Upload: number;
    Outlook: number;
    Other: number;
  };
  pct: (v: number) => number;
}

export default function SourceBreakdownChart({ data, pct }: SourceBreakdownChartProps) {
  const chartData = [
    { name: "Upload", value: data.Upload },
    { name: "Outlook", value: data.Outlook },
    { name: "Other", value: data.Other },
  ];

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
              {["#6366f1", "#22c55e", "#a78bfa"].map((c, i) => (
                <Cell key={i} fill={c} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 text-[11px]">
        <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded bg-indigo-600" /> Upload <span className="text-gray-600">{pct(data.Upload)}%</span></div>
        <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded bg-green-500" /> Outlook <span className="text-gray-600">{pct(data.Outlook)}%</span></div>
        <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded bg-purple-400" /> Other <span className="text-gray-600">{pct(data.Other)}%</span></div>
        <div className="pt-2 text-[10px] text-gray-500">Uploaded vs Outlook vs Other</div>
      </div>
    </div>
  );
}
