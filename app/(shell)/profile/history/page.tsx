"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/lib/context/AppContext";
import BackHeader from "@/components/BackHeader";

export default function RideHistoryPage() {
  const { rides } = useApp();

  // rides 是新到舊排序，圖表需要照時間先後累加，所以要反轉
  const chartData = [...rides].reverse().reduce<
    { index: number; cumulativeCarbon: number }[]
  >((acc, r, i) => {
    const previousCumulative = acc[i - 1]?.cumulativeCarbon ?? 0;
    acc.push({
      index: i + 1,
      cumulativeCarbon: Number((previousCumulative + r.carbonSavedKg).toFixed(3)),
    });
    return acc;
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10">
      <BackHeader href="/profile" title="減碳活動紀錄" />

      <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-xs text-slate-400">總騎乘次數</p>
        <p className="mt-1 text-2xl font-bold text-emerald-700">{rides.length} 次</p>
      </div>

      {rides.length >= 2 && (
        <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">累積減碳量趨勢</h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="index"
                  tick={{ fontSize: 10 }}
                  label={{ value: "第幾趟", position: "insideBottom", offset: -4, fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [`${value} kg`, "累積減碳量"]}
                  labelFormatter={(label) => `第 ${label} 趟`}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeCarbon"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">騎乘紀錄</h2>
        {rides.length === 0 ? (
          <p className="rounded-2xl bg-white/80 p-4 text-center text-xs text-slate-400 shadow-sm ring-1 ring-black/5">
            尚無騎乘紀錄
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rides.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    {r.startStation} → {r.endStation}
                  </p>
                  <span className="text-xs font-semibold text-emerald-600">
                    +{r.earnedPoints} 點
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {new Date(r.timestamp).toLocaleString("zh-TW")}
                </p>
                <div className="mt-1.5 flex gap-4 text-xs text-slate-500">
                  <span>里程 {r.distanceKm.toFixed(2)} km</span>
                  <span>減碳 {r.carbonSavedKg.toFixed(3)} kg</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
