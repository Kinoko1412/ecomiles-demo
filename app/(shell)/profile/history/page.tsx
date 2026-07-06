"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/lib/context/AppContext";
import BackHeader from "@/components/BackHeader";
import Modal from "@/components/Modal";

/** demo 用的簡單 count-up 動畫：掛載或數值變動時，從 0 用 ease-out 曲線跳到目標值 */
function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    let frame: number;

    function tick(timestamp: number) {
      if (start === null) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

const TOTAL_RIDERS = 12830;
const RANK_SENSITIVITY = 500;
const RECENT_DAYS = 7;
const RECENT_RIDES_LIMIT = 10;

// demo 模擬排名：沒有真的後端排行榜資料，用固定公式換算出一個「感覺合理」的名次，
// 邏輯只保證「減碳量越多，排名數字越小」，TOTAL_RIDERS 跟 RANK_SENSITIVITY 都只是示意用的假設值。
function calcSimulatedRank(carbonSavedKg: number) {
  return Math.max(1, TOTAL_RIDERS - Math.floor(carbonSavedKg * RANK_SENSITIVITY));
}

function dayLabel(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function CarbonPassbookPage() {
  const { rides, carbonSavedKg } = useApp();
  const [shareOpen, setShareOpen] = useState(false);

  const animatedCarbon = useCountUp(carbonSavedKg);
  const rank = calcSimulatedRank(carbonSavedKg);

  const now = new Date();
  const monthlyCarbon = rides
    .filter((r) => {
      const d = new Date(r.timestamp);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, r) => sum + r.carbonSavedKg, 0);

  const last7Days = Array.from({ length: RECENT_DAYS }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (RECENT_DAYS - 1 - i));
    return d;
  });
  const chartData = last7Days.map((date) => {
    const carbon = rides
      .filter((r) => new Date(r.timestamp).toDateString() === date.toDateString())
      .reduce((sum, r) => sum + r.carbonSavedKg, 0);
    return { day: dayLabel(date), carbon: Number(carbon.toFixed(3)) };
  });

  const recentRides = rides.slice(0, RECENT_RIDES_LIMIT);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10 pb-6">
      <BackHeader href="/profile" title="我的減碳存摺" />

      <div className="rounded-3xl bg-gradient-to-br from-emerald-400 to-sky-500 p-6 text-center text-white shadow-lg">
        <p className="text-xs text-emerald-50/90">累積減碳量</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {animatedCarbon.toFixed(2)} <span className="text-lg font-semibold">kg</span>
        </p>
        <div className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold backdrop-blur-sm">
          全站排名 #{rank.toLocaleString("zh-TW")} / {TOTAL_RIDERS.toLocaleString("zh-TW")} 位騎士
        </div>
      </div>

      <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-xs text-slate-400">本月減碳量</p>
        <p className="mt-1 text-2xl font-bold text-emerald-700">{monthlyCarbon.toFixed(2)} kg</p>
      </div>

      <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">近 7 天減碳趨勢</h2>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => [`${value} kg`, "減碳量"]} />
              <Bar dataKey="carbon" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">最近騎乘紀錄</h2>
        {recentRides.length === 0 ? (
          <p className="rounded-2xl bg-white/80 p-4 text-center text-xs text-slate-400 shadow-sm ring-1 ring-black/5">
            尚無騎乘紀錄
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentRides.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    {r.startStation} → {r.endStation}
                  </p>
                  <span className="text-xs font-semibold text-emerald-600">
                    {r.carbonSavedKg.toFixed(2)} kg
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {new Date(r.timestamp).toLocaleString("zh-TW")}・{r.distanceKm.toFixed(2)} km
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => setShareOpen(true)}
        className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-700"
      >
        分享我的減碳成果
      </button>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)}>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-500 p-6 text-center text-white">
          <p className="text-xs text-emerald-50/90">我的減碳存摺</p>
          <p className="mt-1 text-3xl font-extrabold">{carbonSavedKg.toFixed(2)} kg</p>
          <p className="mt-2 text-xs">
            全站排名 #{rank.toLocaleString("zh-TW")} / {TOTAL_RIDERS.toLocaleString("zh-TW")}
          </p>
          <p className="mt-1 text-xs">本月減碳 {monthlyCarbon.toFixed(2)} kg</p>
        </div>
        <p className="mt-3 text-xs text-slate-400">截圖這張卡片就可以分享囉！</p>
      </Modal>
    </div>
  );
}
