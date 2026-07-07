import { STATIONS } from "@/lib/constants";
import { getStationCoords, getStationSegment } from "@/lib/stationHighlights";
import { haversineDistanceMeters } from "@/lib/distance";
import photoPopularityData from "@/data/photo-popularity.json";
import photoMonthlyPatternData from "@/data/photo-monthly-pattern.json";
import hiddenHotspotsData from "@/data/hidden-hotspots.json";

type PhotoPopularityEntry = { station: string; segment: "coastal" | "jian"; photoCount500m: number };
type PhotoMonthlyPatternEntry = {
  station: string;
  segment: "coastal" | "jian";
  monthlyCounts: number[];
  peakMonth: number;
};
type HiddenHotspot = {
  lat: number;
  lng: number;
  photoCount: number;
  nearestStation: string;
  distanceToNearestStationM: number;
  sampleTitle: string;
};

const PHOTO_POPULARITY = photoPopularityData as Record<string, PhotoPopularityEntry>;
const PHOTO_MONTHLY_PATTERN = photoMonthlyPatternData as Record<string, PhotoMonthlyPatternEntry>;
const HIDDEN_HOTSPOTS = hiddenHotspotsData as HiddenHotspot[];

// 以下權重都是起始值，之後拿到真實使用者行為資料（例如站點停留時間、兌換轉換率）後應該重新校準，
// 不是理論算出來的最終答案。
const POPULARITY_WEIGHT = 0.4;
const SEASONAL_WEIGHT = 0.3;
const CROWDING_PENALTY_WEIGHT = 0.2;
const COASTAL_POLICY_BONUS = 1.0;
const JIAN_POLICY_BONUS = 1.2; // 政策上想引導人潮往山線分流，山線站點加權加成
const CROWDING_THRESHOLD = 1.5; // 當月人次超過全年月均的 1.5 倍才開始扣分，避免熱門月份被過度懲罰
const DISTANCE_PENALTY_WEIGHT = 0.1; // 區間總距離的懲罰係數，避免無腦推薦「距離無限長」的區間
// 隱藏熱點要離最近站多近才算「順路detour」。原本設 400 公尺，但實際資料裡最近的一筆是
// 445 公尺，卡在門檻外一點點導致這個欄位永遠是空的，所以放寬到 500 公尺讓機制真的會觸發。
const HOTSPOT_DETOUR_MAX_DISTANCE_M = 500;

/**
 * 14 站相鄰站點間的距離（公里），index i 代表 STATIONS[i] 與 STATIONS[i+1] 之間的距離
 * （共 13 段，長度比 STATIONS 少 1）。用 Haversine 直線距離算，是 MVP 近似值 —— 之後若要更準確，
 * 可以換成呼叫 Mapbox Directions API 量出沿路網的真實距離，這裡先不這麼做是因為要窮舉大量
 * 區間組合，即時打 API 太慢也太貴。
 */
export const STATION_DISTANCES_KM: number[] = STATIONS.slice(0, -1).map((name, i) => {
  const a = getStationCoords(name);
  const b = getStationCoords(STATIONS[i + 1]);
  if (!a || !b) return 0;
  return haversineDistanceMeters(a, b) / 1000;
});

/** 兩個相鄰站點（1-based 站號，|a-b| 必須等於 1）之間的距離，公里 */
function adjacentDistanceKm(stationIndexA: number, stationIndexB: number): number {
  const lo = Math.min(stationIndexA, stationIndexB);
  return STATION_DISTANCES_KM[lo - 1] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 單一站點的人氣加權分數。stationIndex 是 1~14 的站號（跟 getStationsBySegment 回傳的 index
 * 一致），currentMonth 是 1~12。資料缺漏（例如站號超出範圍）回傳 0 分，不拋錯，方便窮舉時直接加總。
 *
 * score = (0.4*popularityNorm + 0.3*seasonalRelevance) * policyBonus - 0.2*crowdingPenalty
 */
export function getStationScore(stationIndex: number, currentMonth: number): number {
  const key = String(stationIndex);
  const popularity = PHOTO_POPULARITY[key];
  const monthly = PHOTO_MONTHLY_PATTERN[key];
  if (!popularity || !monthly) return 0;

  const maxPhotoCount500m = Math.max(
    ...Object.values(PHOTO_POPULARITY).map((p) => p.photoCount500m),
    0
  );
  const popularityNorm =
    maxPhotoCount500m > 0
      ? Math.log(1 + popularity.photoCount500m) / Math.log(1 + maxPhotoCount500m)
      : 0;

  const monthlyCounts = monthly.monthlyCounts;
  const thisMonthCount = monthlyCounts[currentMonth - 1] ?? 0;
  const maxMonthlyCount = Math.max(...monthlyCounts, 0);
  const seasonalRelevance = maxMonthlyCount > 0 ? thisMonthCount / maxMonthlyCount : 0;

  const segment = getStationSegment(STATIONS[stationIndex - 1]);
  const policyBonus = segment === "jian" ? JIAN_POLICY_BONUS : COASTAL_POLICY_BONUS;

  const monthlyAvg = average(monthlyCounts);
  const crowdingPenalty =
    monthlyAvg > 0 ? Math.max(0, thisMonthCount / monthlyAvg - CROWDING_THRESHOLD) : 0;

  return (
    (POPULARITY_WEIGHT * popularityNorm + SEASONAL_WEIGHT * seasonalRelevance) * policyBonus -
    CROWDING_PENALTY_WEIGHT * crowdingPenalty
  );
}

export type RouteDetour = HiddenHotspot & { nearestStationIndex: number };

export type RecommendBestRouteResult = {
  startIndex: number;
  endIndex: number;
  totalScore: number;
  totalDistanceKm: number;
  breakdown: { stationIndex: number; score: number }[];
  detours: RouteDetour[];
};

type CandidateInterval = { lo: number; hi: number; distanceKm: number };

/**
 * 從使用者目前所在站（currentStationIndex，1~14）出發，往前（遞增站號）或往後（遞減站號）
 * 窮舉所有累積距離不超過 maxDistanceKm 的候選區間，用 IntervalScore 排序取最高分那組。
 *
 * IntervalScore = 區間內每站 score 加總 - 0.1 * 區間總距離
 */
export function recommendBestRoute(params: {
  currentStationIndex: number;
  maxDistanceKm: number;
  currentMonth: number;
}): RecommendBestRouteResult | null {
  const { currentStationIndex, maxDistanceKm, currentMonth } = params;
  if (currentStationIndex < 1 || currentStationIndex > STATIONS.length) return null;

  const candidates: CandidateInterval[] = [
    { lo: currentStationIndex, hi: currentStationIndex, distanceKm: 0 },
  ];

  // 往後（站號遞增）方向窮舉
  let cumulative = 0;
  for (let end = currentStationIndex + 1; end <= STATIONS.length; end++) {
    cumulative += adjacentDistanceKm(end - 1, end);
    if (cumulative > maxDistanceKm) break;
    candidates.push({ lo: currentStationIndex, hi: end, distanceKm: cumulative });
  }

  // 往前（站號遞減）方向窮舉
  cumulative = 0;
  for (let start = currentStationIndex - 1; start >= 1; start--) {
    cumulative += adjacentDistanceKm(start, start + 1);
    if (cumulative > maxDistanceKm) break;
    candidates.push({ lo: start, hi: currentStationIndex, distanceKm: cumulative });
  }

  let best: { interval: CandidateInterval; intervalScore: number; breakdown: { stationIndex: number; score: number }[] } | null = null;

  for (const candidate of candidates) {
    const breakdown: { stationIndex: number; score: number }[] = [];
    let sumScores = 0;
    for (let i = candidate.lo; i <= candidate.hi; i++) {
      const score = getStationScore(i, currentMonth);
      breakdown.push({ stationIndex: i, score });
      sumScores += score;
    }
    const intervalScore = sumScores - DISTANCE_PENALTY_WEIGHT * candidate.distanceKm;
    if (!best || intervalScore > best.intervalScore) {
      best = { interval: candidate, intervalScore, breakdown };
    }
  }

  if (!best) return null;

  // 區間端點哪個是「起點」取決於使用者實際出發方向：往站號遞增方向走，起點就是 currentStationIndex；
  // 往站號遞減方向走，起點一樣是 currentStationIndex，終點是站號較小的那端。
  const startIndex = currentStationIndex;
  const endIndex = best.interval.lo === currentStationIndex ? best.interval.hi : best.interval.lo;

  const detours = HIDDEN_HOTSPOTS.filter((h) => h.distanceToNearestStationM < HOTSPOT_DETOUR_MAX_DISTANCE_M)
    .map((h) => {
      const idx = STATIONS.findIndex((name) => name === h.nearestStation) + 1;
      return idx > 0 ? { ...h, nearestStationIndex: idx } : null;
    })
    .filter((h): h is RouteDetour => h !== null && h.nearestStationIndex >= best!.interval.lo && h.nearestStationIndex <= best!.interval.hi);

  return {
    startIndex,
    endIndex,
    totalScore: best.intervalScore,
    totalDistanceKm: best.interval.distanceKm,
    breakdown: best.breakdown,
    detours,
  };
}
