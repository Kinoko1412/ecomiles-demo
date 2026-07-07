"use client";

import { useEffect, useState } from "react";

type Weather = {
  temp: number;
  windSpeed: number;
  rainChance: number;
  description: string;
  updatedAt: string;
} | null;

type Status = "loading" | "ready" | "unavailable";

// 風速超過這個門檻（km/h）就用醒目樣式提醒使用者評估騎乘風險。30 km/h 大約是蒲福風級
// 5 級（清風/強風交界），對騎腳踏車來說已經算有感的側風。
const WIND_WARNING_THRESHOLD_KMH = 30;

function formatUpdatedLabel(updatedAt: string): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "剛剛更新";
  if (diffMin < 60) return `${diffMin} 分鐘前更新`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小時前更新`;
  return "資料已過期";
}

export default function WeatherCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [weather, setWeather] = useState<Weather>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/weather")
      .then((res) => res.json())
      .then((data: { weather: Weather }) => {
        if (!active) return;
        if (data.weather) {
          setWeather(data.weather);
          setStatus("ready");
        } else {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  const isWindy = !!weather && weather.windSpeed >= WIND_WARNING_THRESHOLD_KMH;

  return (
    <div className="w-full rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">🌤️ 花蓮天氣</span>
        {status === "ready" && weather && (
          <span className="text-[10px] text-slate-300">{formatUpdatedLabel(weather.updatedAt)}</span>
        )}
      </div>

      {status === "loading" && (
        <div className="mt-2 h-8 w-2/3 animate-pulse rounded-md bg-slate-100" />
      )}

      {status === "unavailable" && (
        <p className="mt-1.5 text-sm text-slate-400">天氣資訊暫時無法取得</p>
      )}

      {status === "ready" && weather && (
        <>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-slate-800">{weather.temp}°C</span>
            <span className="text-sm text-slate-500">{weather.description}</span>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span>💨 風速 {weather.windSpeed} km/h</span>
            <span>☔ 降雨機率 {weather.rainChance}%</span>
          </div>
          {isWindy && (
            <div className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600">
              ⚠️ 風勢較大，請評估騎乘
            </div>
          )}
        </>
      )}
    </div>
  );
}
