"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { STATIONS, ACHIEVEMENTS } from "@/lib/constants";
import { useApp, type CompleteRideResult } from "@/lib/context/AppContext";
import { getLevelByDistance } from "@/lib/levels";
import { calcCarbonSavedKg } from "@/lib/carbon";
import { haversineDistanceMeters, interpolateAlongPath, type LatLng } from "@/lib/distance";
import { getRideHighlights, getStationCoords } from "@/lib/stationHighlights";
import {
  fetchCyclingRoute,
  getOfficialCoastalRouteSegment,
  getOfficialJianRouteSegment,
} from "@/lib/directions";
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

function formatDistanceLabel(distanceM: number) {
  if (distanceM >= 1000) return `${(distanceM / 1000).toFixed(1)} km`;
  return `${Math.round(distanceM)} 公尺`;
}

export default function HomePage() {
  const { nickname, totalDistanceKm, carbonSavedKg, points, completeRide } = useApp();
  const level = getLevelByDistance(totalDistanceKm);

  const [phase, setPhase] = useState<Phase>("idle");
  const [startStation, setStartStation] = useState("");
  const [endStation, setEndStation] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveDistanceKm, setLiveDistanceKm] = useState(0);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [settleResult, setSettleResult] = useState<CompleteRideResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [arrivalToast, setArrivalToast] = useState<{ id: string; name: string } | null>(null);
  // undefined = 還在抓路線、null = 抓失敗（地圖維持直線）、陣列 = 拿到真實貼路網的路線
  const [routeCoords, setRouteCoords] = useState<LatLng[] | null | undefined>(undefined);
  // 這趟路線是不是套用了精度較低的山線官方路廊資料，只影響地圖上的線條樣式，不影響邏輯判斷
  const [isLowConfidenceRoute, setIsLowConfidenceRoute] = useState(false);
  // 目前位置最近的「還沒抵達」加分站，給沉浸式導航頂部卡片顯示用；跟 allHighlightsVisited
  // 一起在下面的抵達判定 effect 裡算，不要在 render 階段直接讀 visitedHighlightIdsRef.current
  // （React 的 refs 規則不允許在 render 裡讀 ref 值）。
  const [nextHighlight, setNextHighlight] = useState<{ name: string; distanceM: number } | null>(null);
  const [allHighlightsVisited, setAllHighlightsVisited] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const simulateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visitedHighlightIdsRef = useRef<Set<string>>(new Set());
  const lastSpeedSampleRef = useRef<{ coords: LatLng; t: number } | null>(null);
  const routeFetchTokenRef = useRef(0);

  const highlights = useMemo(
    () => (startStation && endStation ? getRideHighlights(startStation, endStation) : []),
    [startStation, endStation]
  );

  // 用最近一次座標更新換算移動速度：真實 GPS 沒有 speed 欄位、或快速模擬時都靠這個 fallback，
  // 用指數移動平均稍微平滑一下，避免每次取樣間隔誤差讓數字跳動太劇烈。
  function updateComputedSpeed(next: LatLng) {
    const now = performance.now();
    const last = lastSpeedSampleRef.current;
    if (last) {
      const dtSec = (now - last.t) / 1000;
      if (dtSec > 0.05) {
        const distM = haversineDistanceMeters(last.coords, next);
        const kmh = (distM / dtSec) * 3.6;
        setSpeedKmh((prev) => prev * 0.4 + kmh * 0.6);
      }
    }
    lastSpeedSampleRef.current = { coords: next, t: now };
  }

  // 全螢幕導航模式時鎖住背景捲動
  useEffect(() => {
    if (phase !== "riding") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [phase]);

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

  // GPS：能拿到就顯示並拿來比對加分站點距離跟即時時速，拿不到權限就安靜降級，不影響 demo 流程
  useEffect(() => {
    if (phase !== "riding" || simulating || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(next);
          if (typeof pos.coords.speed === "number" && pos.coords.speed >= 0) {
            setSpeedKmh(pos.coords.speed * 3.6);
            lastSpeedSampleRef.current = { coords: next, t: performance.now() };
          } else {
            updateComputedSpeed(next);
          }
        },
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
  // 進入 80 公尺內視為抵達，同一趟騎乘每個加分站點只觸發一次。同一個 effect 裡順便重新算一次
  // 「下一個加分站」存進 state，給頂部卡片顯示用（不能直接在 render 時讀 visitedHighlightIdsRef.current）。
  useEffect(() => {
    if (phase !== "riding" || highlights.length === 0) {
      // coords/highlights/phase 是外部狀態變化，這裡是對變化的反應，不是連鎖 setState。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNextHighlight(null);
      setAllHighlightsVisited(false);
      return;
    }

    if (coords) {
      for (const h of highlights) {
        if (visitedHighlightIdsRef.current.has(h.id)) continue;
        const dist = haversineDistanceMeters(coords, { lat: h.lat, lng: h.lng });
        if (dist <= ARRIVAL_RADIUS_M) {
          visitedHighlightIdsRef.current.add(h.id);
          setArrivalToast({ id: h.id, name: h.name });
          break;
        }
      }
    }

    const unvisited = highlights.filter((h) => !visitedHighlightIdsRef.current.has(h.id));
    if (unvisited.length === 0) {
      setNextHighlight(null);
      setAllHighlightsVisited(true);
      return;
    }
    setAllHighlightsVisited(false);
    if (!coords) {
      setNextHighlight(null);
      return;
    }
    let closest: { name: string; distanceM: number } | null = null;
    for (const h of unvisited) {
      const distanceM = haversineDistanceMeters(coords, { lat: h.lat, lng: h.lng });
      if (!closest || distanceM < closest.distanceM) closest = { name: h.name, distanceM };
    }
    setNextHighlight(closest);
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
      setSpeedKmh(0);
      setRouteCoords(undefined);
      lastSpeedSampleRef.current = null;
    }
  }

  function handleGoClick() {
    if (!startStation || !endStation) return;
    visitedHighlightIdsRef.current = new Set();
    lastSpeedSampleRef.current = null;
    setElapsedSeconds(0);
    setCoords(null);
    setSpeedKmh(0);
    setLiveDistanceKm(0);
    setRouteCoords(undefined);
    setIsLowConfidenceRoute(false);
    setPhase("riding");

    const startCoords = getStationCoords(startStation);
    const endCoords = getStationCoords(endStation);
    const token = ++routeFetchTokenRef.current;
    if (startCoords && endCoords) {
      // 海線（朝金定置漁場～太平洋公園）優先用 TDX 官方實測軌跡；山線（吉安火車站～白鮑溪沿線）
      // 優先用另一份精度較低的 TDX 官方路廊參考軌跡；兩者都涵蓋不到這兩站（例如跨海線/山線的
      // 組合）才 fallback 回 Mapbox Directions API。
      const officialCoastalGeometry = getOfficialCoastalRouteSegment(startStation, endStation);
      const officialJianGeometry = officialCoastalGeometry
        ? null
        : getOfficialJianRouteSegment(startStation, endStation);
      const officialGeometry = officialCoastalGeometry ?? officialJianGeometry;

      if (officialGeometry) {
        setRouteCoords(officialGeometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
        setIsLowConfidenceRoute(!!officialJianGeometry);
      } else {
        fetchCyclingRoute([startCoords, endCoords]).then((geometry) => {
          if (routeFetchTokenRef.current !== token) return; // 這趟騎乘已經結束/換了下一趟，這個結果過期了
          setRouteCoords(geometry ? geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) : null);
        });
      }
    }
  }

  function handleEndRide() {
    const distance = Math.max(0.1, Number(liveDistanceKm.toFixed(2)));
    finalizeRide(distance);
  }

  function handleQuickSimulate() {
    const startCoords = getStationCoords(startStation);
    const endCoords = getStationCoords(endStation);
    if (!startCoords || !endCoords) return;

    // 有真實路網路線就沿著它走，還在抓或抓失敗就退回起訖兩點的直線
    const path = routeCoords && routeCoords.length >= 2 ? routeCoords : [startCoords, endCoords];

    setSimulating(true);
    const steps = 15;
    let step = 0;
    simulateTimerRef.current = setInterval(() => {
      step += 1;
      const next = interpolateAlongPath(path, step / steps);
      setCoords(next);
      updateComputedSpeed(next);
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
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-6">
          <div
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-lg"
            style={{ animation: "toast-pop 2.6s ease-in-out" }}
          >
            🌟 抵達{arrivalToast.name}！+10 分
          </div>
        </div>
      )}

      {phase === "idle" && (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-700">Ecomiles</h1>
          <p className="mt-1 text-sm text-slate-500">嗨，{nickname} 👋 準備好騎一趟了嗎？</p>
          {errorMsg && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-500">{errorMsg}</p>
          )}

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

          <div className="mt-8 grid w-full grid-cols-3 gap-3">
            <StatCard label="累積里程" value={displayDistanceKm.toFixed(2)} unit="km" />
            <StatCard label="累積減碳量" value={displayCarbonKg.toFixed(3)} unit="kg" />
            <StatCard label="目前等級" value={`${level.icon}`} unit={level.name} isText />
          </div>
        </>
      )}

      {/* z-[55]：蓋過 AiGuideFab（z-50），但還是要讓 arrivalToast（z-[60]）蓋在最上面 */}
      {phase === "riding" && (
        <div className="fixed inset-0 z-[55] bg-slate-900">
          <div className="absolute inset-0">
            <RideMap
              startStation={startStation}
              endStation={endStation}
              userCoords={coords}
              routeCoords={routeCoords}
              isLowConfidenceRoute={isLowConfidenceRoute}
            />
          </div>

          {/* 頂部：左邊深色卡片顯示下一個加分站距離、右上角深色卡片顯示即時時速 */}
          <div
            className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <div className="flex flex-1 items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2.5 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <span className="text-lg">🎯</span>
              {nextHighlight ? (
                <span className="truncate text-sm font-medium text-slate-100">
                  下一站 {nextHighlight.name}｜約 {formatDistanceLabel(nextHighlight.distanceM)}
                </span>
              ) : highlights.length === 0 ? (
                <span className="text-sm text-slate-400">這趟沒有加分站點</span>
              ) : allHighlightsVisited ? (
                <span className="text-sm font-medium text-emerald-400">加分站點已全部抵達 🎉</span>
              ) : (
                <span className="text-sm text-slate-400">定位中…</span>
              )}
            </div>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-slate-900/90 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <span className="text-lg font-extrabold leading-none text-white">
                {speedKmh.toFixed(0)}
              </span>
              <span className="mt-0.5 text-[9px] text-slate-400">km/h</span>
              <span className="mt-0.5 font-mono text-[9px] text-slate-500">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>

          {/* 快速模擬按鈕：浮在底部資訊列上方 */}
          <div
            className="absolute inset-x-4 z-10"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
          >
            <button
              onClick={handleQuickSimulate}
              disabled={simulating}
              className="w-full rounded-full border-2 border-dashed border-amber-400/70 bg-slate-900/90 py-3 text-sm font-semibold text-amber-400 shadow-lg backdrop-blur transition-colors hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {simulating ? "模擬中…" : "快速模擬（demo 用）"}
            </button>
          </div>

          {/* 底部：里程／點數／減碳三欄深色卡片 + 結束騎乘按鈕 */}
          <div
            className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 px-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          >
            <div className="flex flex-1 items-center justify-around rounded-full bg-slate-900/90 px-4 py-3 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <div className="text-center">
                <p className="text-[10px] text-slate-400">本次里程</p>
                <p className="text-sm font-bold text-white">{liveDistanceKm.toFixed(2)} km</p>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] text-slate-400">累積點數</p>
                <p className="text-sm font-bold text-white">{points} 點</p>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] text-slate-400">節省碳量</p>
                <p className="text-sm font-bold text-emerald-400">{displayCarbonKg.toFixed(3)} kg</p>
              </div>
            </div>
            <button
              onClick={handleEndRide}
              disabled={simulating}
              aria-label="結束騎乘"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900/90 text-lg font-bold text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
