"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { STATIONS, ACHIEVEMENTS } from "@/lib/constants";
import { useApp, type CompleteRideResult } from "@/lib/context/AppContext";
import { getLevelByDistance } from "@/lib/levels";
import { calcCarbonSavedKg } from "@/lib/carbon";
import { haversineDistanceMeters, interpolateLatLng, type LatLng } from "@/lib/distance";
import { getRideHighlights, getStationCoords } from "@/lib/stationHighlights";
import Modal from "@/components/Modal";

// mapbox-gl 在模組頂層就會摸 window/document，SSR 階段的 Node 環境沒有這些東西，
// 一定要用 next/dynamic + ssr:false 讓它只在瀏覽器端載入。
const RideMap = dynamic(() => import("@/components/map/RideMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
      地圖載入中…
    </div>
  ),
});

type Phase = "idle" | "riding";

const ARRIVAL_RADIUS_M = 80;

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function HomePage() {
  const { nickname, totalDistanceKm, carbonSavedKg, completeRide } = useApp();
  const level = getLevelByDistance(totalDistanceKm);

  const [phase, setPhase] = useState<Phase>("idle");
  const [startStation, setStartStation] = useState("");
  const [endStation, setEndStation] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveDistanceKm, setLiveDistanceKm] = useState(0);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [settleResult, setSettleResult] = useState<CompleteRideResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [arrivalToast, setArrivalToast] = useState<{ id: string; name: string } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const simulateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visitedHighlightIdsRef = useRef<Set<string>>(new Set());

  const highlights = useMemo(
    () => (startStation && endStation ? getRideHighlights(startStation, endStation) : []),
    [startStation, endStation]
  );

  // 計時器：只在騎乘中累加秒數
  useEffect(() => {
    if (phase !== "riding") return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // 即時里程：騎乘中每 0.5 秒累加一小段距離，讓畫面上的里程/減碳量持續跳動，模擬真實騎行
  useEffect(() => {
    if (phase !== "riding" || simulating) return;
    const tick = setInterval(() => {
      setLiveDistanceKm((d) => d + (0.03 + Math.random() * 0.09));
    }, 500);
    return () => clearInterval(tick);
  }, [phase, simulating]);

  // GPS：能拿到就顯示並拿來比對加分站點距離，拿不到權限就安靜降級，不影響 demo 流程
  useEffect(() => {
    if (phase !== "riding" || simulating || typeof navigator === "undefined" || !navigator.geolocation) {
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
  }, [phase, simulating]);

  // 加分站點抵達判定：不論座標是真實 GPS 還是快速模擬內插出來的，統一在這裡用 Haversine 比對，
  // 進入 80 公尺內視為抵達，同一趟騎乘每個加分站點只觸發一次。
  useEffect(() => {
    if (phase !== "riding" || !coords || highlights.length === 0) return;
    for (const h of highlights) {
      if (visitedHighlightIdsRef.current.has(h.id)) continue;
      const dist = haversineDistanceMeters(coords, { lat: h.lat, lng: h.lng });
      if (dist <= ARRIVAL_RADIUS_M) {
        visitedHighlightIdsRef.current.add(h.id);
        // coords 來自 GPS watchPosition／模擬內插的外部狀態變化，這裡是對該變化的反應，
        // 不是重複觸發的連鎖 setState。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setArrivalToast({ id: h.id, name: h.name });
        break;
      }
    }
  }, [coords, highlights, phase]);

  useEffect(() => {
    if (!arrivalToast) return;
    const t = setTimeout(() => setArrivalToast(null), 2600);
    return () => clearTimeout(t);
  }, [arrivalToast]);

  useEffect(() => {
    return () => {
      if (simulateTimerRef.current) clearInterval(simulateTimerRef.current);
    };
  }, []);

  async function finalizeRide(distanceKm: number) {
    setErrorMsg(null);
    try {
      const r = await completeRide(distanceKm, startStation, endStation);
      setSettleResult(r);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "騎乘結算失敗，請稍後再試");
    } finally {
      setPhase("idle");
      setStartStation("");
      setEndStation("");
      setElapsedSeconds(0);
      setCoords(null);
      setLiveDistanceKm(0);
    }
  }

  function handleGoClick() {
    if (!startStation || !endStation) return;
    visitedHighlightIdsRef.current = new Set();
    setElapsedSeconds(0);
    setCoords(null);
    setLiveDistanceKm(0);
    setPhase("riding");
  }

  function handleEndRide() {
    const distance = Math.max(0.1, Number(liveDistanceKm.toFixed(2)));
    finalizeRide(distance);
  }

  function handleQuickSimulate() {
    const startCoords = getStationCoords(startStation);
    const endCoords = getStationCoords(endStation);
    if (!startCoords || !endCoords) return;

    setSimulating(true);
    const steps = 15;
    let step = 0;
    simulateTimerRef.current = setInterval(() => {
      step += 1;
      setCoords(interpolateLatLng(startCoords, endCoords, step / steps));
      if (step >= steps) {
        if (simulateTimerRef.current) clearInterval(simulateTimerRef.current);
        simulateTimerRef.current = null;
        const distance = Number((2 + Math.random() * 6).toFixed(1));
        setSimulating(false);
        finalizeRide(distance);
      }
    }, 200);
  }

  const goDisabled = !startStation || !endStation || startStation === endStation;
  const displayDistanceKm = totalDistanceKm + (phase === "riding" ? liveDistanceKm : 0);
  const displayCarbonKg = carbonSavedKg + (phase === "riding" ? calcCarbonSavedKg(liveDistanceKm) : 0);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-10">
      {arrivalToast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-6">
          <div
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-lg"
            style={{ animation: "toast-pop 2.6s ease-in-out" }}
          >
            🌟 抵達{arrivalToast.name}！+10 分
          </div>
        </div>
      )}

      <h1 className="text-3xl font-extrabold tracking-tight text-emerald-700">Ecomiles</h1>
      <p className="mt-1 text-sm text-slate-500">嗨，{nickname} 👋 準備好騎一趟了嗎？</p>
      {errorMsg && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-500">{errorMsg}</p>
      )}

      {phase === "idle" && (
        <>
          <button
            onClick={handleGoClick}
            disabled={goDisabled}
            className="group relative my-8 flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-3xl font-extrabold text-white shadow-xl transition-transform active:scale-95 disabled:cursor-default disabled:active:scale-100"
            style={{
              animation: !goDisabled ? "pulse-ring 2.2s cubic-bezier(0.4,0,0.6,1) infinite" : undefined,
              opacity: goDisabled ? 0.5 : 1,
            }}
          >
            <span className="flex flex-col items-center gap-1">
              <span className="text-4xl">🚴</span>
              GO
            </span>
          </button>

          <div className="flex w-full flex-col gap-3">
            <select
              value={startStation}
              onChange={(e) => setStartStation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400"
            >
              <option value="">選擇出發站</option>
              {STATIONS.map((s) => (
                <option key={s} value={s} disabled={s === endStation}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={endStation}
              onChange={(e) => setEndStation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400"
            >
              <option value="">選擇目的站</option>
              {STATIONS.map((s) => (
                <option key={s} value={s} disabled={s === startStation}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {phase === "riding" && (
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <div className="h-72 w-full overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5">
            <RideMap startStation={startStation} endStation={endStation} userCoords={coords} />
          </div>

          <span className="font-mono text-3xl font-extrabold text-slate-800">
            {formatTime(elapsedSeconds)}
          </span>
          <p className="text-sm font-semibold text-emerald-600">
            本次里程 {liveDistanceKm.toFixed(2)} km
          </p>

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

      <div className="mt-8 grid w-full grid-cols-3 gap-3">
        <StatCard label="累積里程" value={displayDistanceKm.toFixed(2)} unit="km" />
        <StatCard label="累積減碳量" value={displayCarbonKg.toFixed(3)} unit="kg" />
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
