/**
 * 手動驗證腳本：測試 lib/weather.ts 的正常抓取路徑跟快取 fallback 行為。
 * 執行方式：npx tsx scripts/dev-tests/test-weather.mts
 */
import { readFileSync } from "fs";

// 手動載入 .env.local（專案沒有裝 dotenv，不為了一次性測試腳本新增依賴）
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const { getHualienWeather } = await import("../../lib/weather");

console.log("=== 正常抓取 ===");
const result1 = await getHualienWeather();
console.log(JSON.stringify(result1, null, 2));
