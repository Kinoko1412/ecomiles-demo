/**
 * 手動驗證腳本：強制讓 CWA API 呼叫失敗（改用會 404 的假網址），確認會正確退回快取檔案。
 * 執行方式：npx tsx scripts/dev-tests/test-weather-fallback.mts
 * 注意：要先跑過一次 test-weather.mts，讓 data/.cache/weather.json 存在，這個腳本才有東西可退回。
 */
import { readFileSync, existsSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

console.log("快取檔案存在嗎？", existsSync("data/.cache/weather.json"));

// 模擬「斷網/API掛掉」：把 global.fetch 換成一個永遠失敗的版本，
// 這樣 lib/weather.ts 內部呼叫 CWA API 時一定會走到 catch，退回讀快取。
const originalFetch = global.fetch;
global.fetch = (() => {
  throw new Error("模擬斷網：ECONNREFUSED（測試用，非真實錯誤）");
}) as typeof fetch;

const { getHualienWeather } = await import("../../lib/weather");

console.log("\n=== 強制斷網情境 ===");
const result = await getHualienWeather();
console.log(JSON.stringify(result, null, 2));
console.log(result ? "✅ 成功退回快取資料" : "❌ 連快取都沒有，回傳 null");

global.fetch = originalFetch;
