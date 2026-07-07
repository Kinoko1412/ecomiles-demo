import photoMonthlyPatternData from "@/data/photo-monthly-pattern.json";
import hiddenHotspotsData from "@/data/hidden-hotspots.json";
import { STATIONS } from "@/lib/constants";
import { getStationCoords, getStationDirectoryPlaces } from "@/lib/stationHighlights";
import { haversineDistanceMeters } from "@/lib/distance";
import { recommendBestRoute } from "@/lib/routeScoring";

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

const MONTHLY_PATTERN = photoMonthlyPatternData as Record<string, PhotoMonthlyPatternEntry>;
const HIDDEN_HOTSPOTS = hiddenHotspotsData as HiddenHotspot[];

// 使用者沒有在對話裡指定「想騎多遠」，這裡先用一趟 demo 情境下合理的單趟里程當預設值，
// 之後如果前端加了「今天想騎多久/多遠」的輸入，這裡應該改成吃使用者實際給的值。
const DEFAULT_RECOMMEND_DISTANCE_KM = 15;

// 這裡刻意不透過 getPhotoPopularity()：那支函式在附近總量是 0 時會回傳 null（給徽章顯示邏輯用，
// 「沒資料就不顯示」），但排行榜要對全部 14 站都給名次，即使某站附近總量是 0、當月仍可能有
// 非零的打卡數（例如吉安火車站、白鮑溪沿線），所以直接讀 photo-monthly-pattern.json 這份原始資料。
export function buildAssistantContext(params: { lat?: number; lng?: number }): string {
  const currentMonth = new Date().getMonth() + 1;
  const lines: string[] = [];

  const ranked = STATIONS.map((name, i) => {
    const key = String(i + 1);
    const monthly = MONTHLY_PATTERN[key];
    const thisMonthCount = monthly?.monthlyCounts[currentMonth - 1] ?? 0;
    const isPeakMonth = monthly ? currentMonth === monthly.peakMonth : false;
    return { name, thisMonthCount, isPeakMonth };
  }).sort((a, b) => b.thisMonthCount - a.thisMonthCount);

  lines.push("【本月人氣排行】");
  ranked.forEach((r, i) => {
    const peakNote = r.isPeakMonth ? "，本站全年高峰月" : "";
    lines.push(`${i + 1}. ${r.name}（本月 ${r.thisMonthCount} 張歷史打卡${peakNote}）`);
  });

  let nearestStations: string[] = [];
  if (typeof params.lat === "number" && typeof params.lng === "number") {
    const userCoords = { lat: params.lat, lng: params.lng };
    const withDistance = STATIONS.map((name, i) => {
      const coords = getStationCoords(name);
      return coords ? { name, index: i + 1, distanceM: haversineDistanceMeters(userCoords, coords) } : null;
    })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 3);

    nearestStations = withDistance.map((s) => s.name);

    lines.push("", "【使用者最近的站】");
    withDistance.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name}（距離約 ${(s.distanceM / 1000).toFixed(1)} 公里）`);
    });

    // 用離使用者最近的站當作路線推薦的出發點，交給 lib/routeScoring.ts 的演算法算出這次
    // 該推薦哪一段路線，讓 DeepSeek 只負責把結果講得親切，不用自己編路線。
    const nearestStation = withDistance[0];
    if (nearestStation) {
      const recommendation = recommendBestRoute({
        currentStationIndex: nearestStation.index,
        maxDistanceKm: DEFAULT_RECOMMEND_DISTANCE_KM,
        currentMonth,
      });
      if (recommendation) {
        lines.push("", "【路線推薦（已由後端演算法算好）】");
        lines.push(
          `建議從「${STATIONS[recommendation.startIndex - 1]}」騎到「${STATIONS[recommendation.endIndex - 1]}」，` +
            `總距離約 ${recommendation.totalDistanceKm.toFixed(1)} 公里，路線總分 ${recommendation.totalScore.toFixed(2)}`
        );
        lines.push("沿途各站分數：");
        recommendation.breakdown.forEach((b) => {
          lines.push(`  - ${STATIONS[b.stationIndex - 1]}：${b.score.toFixed(2)} 分`);
        });
        if (recommendation.detours.length > 0) {
          lines.push("沿途隱藏熱點：");
          recommendation.detours.forEach((d) => {
            lines.push(
              `  - 靠近「${d.nearestStation}」約 ${d.distanceToNearestStationM} 公尺處，歷史上有 ${d.photoCount} 張打卡照片`
            );
          });
        }
      }
    }
  }

  if (nearestStations.length > 0) {
    const nearbyHotspots = HIDDEN_HOTSPOTS.filter((h) => nearestStations.includes(h.nearestStation));
    if (nearbyHotspots.length > 0) {
      lines.push("", "【隱藏熱點】");
      nearbyHotspots.forEach((h) => {
        lines.push(
          `- 靠近「${h.nearestStation}」約 ${h.distanceToNearestStationM} 公尺處，歷史上有 ${h.photoCount} 張打卡照片（範例：${h.sampleTitle}）`
        );
      });
    }
  }

  lines.push("", "【推薦商家】");
  ranked.slice(0, 3).forEach((r) => {
    const places = getStationDirectoryPlaces(r.name).slice(0, 3);
    if (places.length === 0) return;
    lines.push(`${r.name}附近：`);
    places.forEach((p) => {
      const ratingNote = p.rating ? `評分 ${p.rating.toFixed(1)}` : "尚無評分";
      lines.push(`  - ${p.name}（${ratingNote}）`);
    });
  });

  return lines.join("\n");
}
