/**
 * 手動驗證腳本：印出 14 站在不同距離預算下的路線推薦結果，人工檢查合不合理。
 * 執行方式：npx tsx scripts/dev-tests/test-route-scoring.mts
 */
import { STATIONS } from "../../lib/constants";
import { recommendBestRoute, STATION_DISTANCES_KM } from "../../lib/routeScoring";

console.log("站間距離 (km):", STATION_DISTANCES_KM.map((d) => d.toFixed(2)).join(", "));
console.log("");

const currentMonth = new Date().getMonth() + 1;
console.log(`目前月份: ${currentMonth}`);
console.log("");

for (const maxDistanceKm of [10, 20]) {
  console.log(`==================== 預算 ${maxDistanceKm} 公里 ====================`);
  STATIONS.forEach((name, i) => {
    const stationIndex = i + 1;
    const result = recommendBestRoute({ currentStationIndex: stationIndex, maxDistanceKm, currentMonth });
    if (!result) {
      console.log(`[${stationIndex}] ${name}: 無結果`);
      return;
    }
    const startName = STATIONS[result.startIndex - 1];
    const endName = STATIONS[result.endIndex - 1];
    const detourNote =
      result.detours.length > 0
        ? ` | 隱藏熱點: ${result.detours.map((d) => `${d.nearestStation}(${d.distanceToNearestStationM}m)`).join(",")}`
        : "";
    console.log(
      `[${stationIndex}] ${name} -> 推薦 ${startName} → ${endName}｜距離 ${result.totalDistanceKm.toFixed(
        1
      )}km｜總分 ${result.totalScore.toFixed(2)}${detourNote}`
    );
  });
  console.log("");
}
