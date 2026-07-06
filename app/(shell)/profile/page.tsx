"use client";

import { useRouter } from "next/navigation";
import { ACHIEVEMENTS, STATIONS } from "@/lib/constants";
import { useApp } from "@/lib/context/AppContext";
import { getLevelByDistance } from "@/lib/levels";

const CARBON_CREDIT_PRICE_PER_TONNE = 3000; // NT$/公噸，僅示意用參考行情

export default function ProfilePage() {
  const router = useRouter();
  const {
    nickname,
    totalDistanceKm,
    totalCarbonKg,
    unlockedAchievements,
    redemptions,
    visitedStations,
    logout,
  } = useApp();
  const level = getLevelByDistance(totalDistanceKm);
  const theoreticalValueNT = Math.round(
    (totalCarbonKg / 1000) * CARBON_CREDIT_PRICE_PER_TONNE
  );

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 pt-10">
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-md"
          style={{ backgroundColor: `${level.color}22`, border: `3px solid ${level.color}` }}
        >
          {level.icon}
        </div>
        <h1 className="text-lg font-bold text-slate-800">{nickname}</h1>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${level.color}22`, color: level.color }}>
          {level.name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-slate-400">累積里程</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{totalDistanceKm.toFixed(1)} km</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-slate-400">累積減碳量</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{totalCarbonKg.toFixed(2)} kg</p>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 p-4 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-xs text-slate-400">理論碳權價值</p>
        <p className="mt-1 text-2xl font-bold text-emerald-700">
          理論價值 NT$ {theoreticalValueNT.toLocaleString("zh-TW")}元
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          僅為台灣碳權交易平台市場行情換算示意，非正式可交易碳權
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">成就</h2>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedAchievements.includes(a.code);
            return (
              <div
                key={a.code}
                className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center shadow-sm ring-1 ${
                  unlocked
                    ? "bg-white/80 ring-black/5"
                    : "bg-slate-100 text-slate-400 ring-black/5 grayscale"
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-semibold">{a.name}</span>
                <span className="text-[10px] text-slate-400">{a.description}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">集點站徽章</h2>
          <span className="text-xs text-slate-400">
            造訪進度 {visitedStations.length}/{STATIONS.length}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {STATIONS.map((s) => {
            const visited = visitedStations.includes(s);
            return (
              <div
                key={s}
                title={s}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl p-1.5 text-center ${
                  visited
                    ? "bg-emerald-100 ring-1 ring-emerald-300"
                    : "bg-slate-100 text-slate-300 ring-1 ring-black/5"
                }`}
              >
                <span className="text-base">{visited ? "🚩" : "📍"}</span>
                <span className="line-clamp-1 text-[8px] leading-tight">{s}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">兌換紀錄</h2>
        {redemptions.length === 0 ? (
          <p className="rounded-2xl bg-white/80 p-4 text-center text-xs text-slate-400 shadow-sm ring-1 ring-black/5">
            尚無兌換紀錄
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {redemptions.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-black/5"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.rewardName}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(r.redeemedAt).toLocaleString("zh-TW")}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold tracking-wider text-emerald-600">
                  {r.code}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={handleLogout}
        className="mb-4 w-full rounded-full bg-white py-3 text-sm font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
      >
        登出
      </button>
    </div>
  );
}
