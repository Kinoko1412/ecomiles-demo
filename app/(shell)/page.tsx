"use client";

import { useEffect, useRef, useState } from "react";
import { STATIONS, ACHIEVEMENTS } from "@/lib/constants";
import { useApp, type CompleteRideResult } from "@/lib/context/AppContext";
import { getLevelByDistance } from "@/lib/levels";
import Modal from "@/components/Modal";

type Phase = "idle" | "riding" | "select-end";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function HomePage() {
  const { nickname, totalDistanceKm, totalCarbonKg, completeRide } = useApp();
  const level = getLevelByDistance(totalDistanceKm);

  const [phase, setPhase] = useState<Phase>("idle");
  const [startStation, setStartStation] = useState("");
  const [endStation, setEndStation] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [settleResult, setSettleResult] = useState<CompleteRideResult | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // 計時器：只在騎乘中累加秒數
  useEffect(() => {
    if (phase !== "riding") return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // GPS：能拿到就顯示，拿不到權限就安靜降級，不影響 demo 流程
  useEffect(() => {
    if (phase !== "riding" || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // 定位失敗或被拒絕：安靜忽略
        },
        { enableHighAccuracy: false, maximumAge: 5000, timeout: 5000 }
      );
    } catch {
      // 部分瀏覽器/環境沒有 geolocation 支援，忽略即可
    }
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [phase]);

  function finalizeRide(distanceKm: number) {
    const r = completeRide(distanceKm);
    setSettleResult(r);
    setPhase("idle");
    setStartStation("");
    setEndStation("");
    setElapsedSeconds(0);
    setCoords(null);
  }

  function handleGoClick() {
    if (!startStation) return;
    setElapsedSeconds(0);
    setCoords(null);
    setPhase("riding");
  }

  function handleEndRide() {
    setPhase("select-end");
  }

  function handleConfirmEnd() {
    const speedKmH = 12 + Math.random() * 6; // 12~18 km/h 的合理估算速度
    let distance = (elapsedSeconds / 3600) * speedKmH;
    distance = Math.min(15, Math.max(0.3, distance));
    distance = Number(distance.toFixed(1));
    finalizeRide(distance);
  }

  function handleQuickSimulate() {
    setSimulating(true);
    setTimeout(() => {
      const distance = Number((2 + Math.random() * 6).toFixed(1));
      const candidates = STATIONS.filter((s) => s !== startStation);
      const randomEnd = candidates[Math.floor(Math.random() * candidates.length)];
      setEndStation(randomEnd);
      setSimulating(false);
      finalizeRide(distance);
    }, 3000);
  }

  const goDisabled = phase === "idle" && !startStation;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-emerald-700">Ecomiles</h1>
      <p className="mt-1 text-sm text-slate-500">嗨，{nickname} 👋 準備好騎一趟了嗎？</p>

      <button
        onClick={handleGoClick}
        disabled={phase !== "idle" || goDisabled}
        className="group relative my-8 flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-3xl font-extrabold text-white shadow-xl transition-transform active:scale-95 disabled:cursor-default disabled:active:scale-100"
        style={{
          animation:
            phase === "idle" && !goDisabled
              ? "pulse-ring 2.2s cubic-bezier(0.4,0,0.6,1) infinite"
              : undefined,
          opacity: goDisabled ? 0.5 : 1,
        }}
      >
        {phase === "idle" ? (
          <span className="flex flex-col items-center gap-1">
            <span className="text-4xl">🚴</span>
            GO
          </span>
        ) : (
          <span className="font-mono text-4xl">{formatTime(elapsedSeconds)}</span>
        )}
      </button>

      {phase === "idle" && (
        <div className="w-full">
          <select
            value={startStation}
            onChange={(e) => setStartStation(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400"
          >
            <option value="">選擇出發站</option>
            {STATIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {phase === "riding" && (
        <div className="flex w-full flex-col items-center gap-4">
          <div className="relative h-2 w-full rounded-full bg-emerald-100">
            <span
              className="absolute -top-3 text-2xl"
              style={{ animation: "ride-move 3s ease-in-out infinite" }}
            >
              🚴
            </span>
          </div>
          <div className="rounded-xl bg-white/70 px-4 py-2 text-xs text-slate-400 ring-1 ring-black/5">
            {coords
              ? `目前定位：${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
              : "定位中…（demo 中無定位權限也沒關係）"}
          </div>
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={handleEndRide}
              disabled={simulating}
              className="w-full rounded-full bg-slate-900 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              結束騎乘
            </button>
            <button
              onClick={handleQuickSimulate}
              disabled={simulating}
              className="w-full rounded-full border-2 border-dashed border-amber-400 bg-amber-50 py-3 text-sm font-semibold text-amber-600 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {simulating ? "模擬中…" : "快速模擬（demo 用）"}
            </button>
          </div>
        </div>
      )}

      {phase === "select-end" && (
        <div className="flex w-full flex-col gap-3">
          <select
            value={endStation}
            onChange={(e) => setEndStation(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400"
          >
            <option value="">選擇還車站</option>
            {STATIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={handleConfirmEnd}
            disabled={!endStation}
            className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            確認還車
          </button>
        </div>
      )}

      <div className="mt-8 grid w-full grid-cols-3 gap-3">
        <StatCard label="累積里程" value={totalDistanceKm.toFixed(1)} unit="km" />
        <StatCard label="累積減碳量" value={totalCarbonKg.toFixed(2)} unit="kg" />
        <StatCard label="目前等級" value={`${level.icon}`} unit={level.name} isText />
      </div>

      <Modal open={!!settleResult} onClose={() => setSettleResult(null)}>
        <div className="text-5xl">🎉</div>
        <h2 className="mt-2 text-lg font-bold text-emerald-700">騎乘完成！</h2>
        {settleResult && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ResultCard label="本次里程" value={settleResult.distanceKm.toFixed(1)} unit="km" />
            <ResultCard
              label="本次減碳量"
              value={settleResult.carbonSavedKg.toFixed(2)}
              unit="kg"
            />
            <ResultCard label="獲得點數" value={`+${settleResult.earnedPoints}`} unit="點" />
          </div>
        )}
        {settleResult?.leveledUp && (
          <p className="mt-3 text-sm text-slate-600">
            等級升級為 <span className="font-semibold">{settleResult.newLevelName}</span>！
          </p>
        )}
        {settleResult && settleResult.newAchievements.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {settleResult.newAchievements.map((code) => {
              const def = ACHIEVEMENTS.find((a) => a.code === code);
              if (!def) return null;
              return (
                <p key={code} className="text-sm text-slate-600">
                  解鎖成就 {def.icon} <span className="font-semibold">{def.name}</span>
                </p>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  isText,
}: {
  label: string;
  value: string;
  unit: string;
  isText?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/80 px-2 py-4 text-center shadow-sm ring-1 ring-black/5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`mt-1 font-bold text-slate-800 ${isText ? "text-2xl" : "text-lg"}`}>
        {value}
      </span>
      <span className="text-[11px] text-slate-400">{unit}</span>
    </div>
  );
}

function ResultCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-slate-50 px-1 py-2 text-center">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="mt-0.5 text-sm font-bold text-slate-800">{value}</span>
      <span className="text-[9px] text-slate-400">{unit}</span>
    </div>
  );
}
