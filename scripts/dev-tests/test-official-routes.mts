/**
 * 手動驗證腳本：確認海線/山線官方路廊的裁切邏輯（含反方向、混合 segment fallback）行為正確。
 * 執行方式：npx tsx scripts/dev-tests/test-official-routes.mts
 */
import { getOfficialCoastalRouteSegment, getOfficialJianRouteSegment } from "../../lib/directions";

function summarize(label: string, geom: ReturnType<typeof getOfficialJianRouteSegment>) {
  if (!geom) {
    console.log(`${label}: null (fallback to Directions API)`);
    return;
  }
  console.log(
    `${label}: ${geom.coordinates.length} 點, 頭=${JSON.stringify(geom.coordinates[0])}, 尾=${JSON.stringify(
      geom.coordinates[geom.coordinates.length - 1]
    )}`
  );
}

console.log("--- 海線: 七星潭風景區 -> 太平洋公園 ---");
summarize("coastal", getOfficialCoastalRouteSegment("七星潭風景區", "太平洋公園"));

console.log("--- 山線: 吉安農會 -> 白鮑溪沿線 ---");
summarize("jian", getOfficialJianRouteSegment("吉安農會", "白鮑溪沿線"));
console.log("--- 山線: 白鮑溪沿線 -> 吉安農會（反方向）---");
summarize("jian-reverse", getOfficialJianRouteSegment("白鮑溪沿線", "吉安農會"));

console.log("--- 混合: 吉安農會（山線）-> 太平洋公園（海線）應為 null ---");
summarize("jian-fn-mixed", getOfficialJianRouteSegment("吉安農會", "太平洋公園"));
summarize("coastal-fn-mixed", getOfficialCoastalRouteSegment("吉安農會", "太平洋公園"));
