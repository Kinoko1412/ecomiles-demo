import { NextResponse } from "next/server";
import { getHualienWeather } from "@/lib/weather";

// getHualienWeather() 需要讀寫本地快取檔案（fs），只能在伺服器端跑，這也是為什麼首頁
// 的天氣卡片是打這支 Route Handler、而不是直接在 client component 裡呼叫 lib/weather.ts。
export async function GET() {
  const weather = await getHualienWeather();
  return NextResponse.json({ weather });
}
