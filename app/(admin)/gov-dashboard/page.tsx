import { createClient } from "@/utils/supabase/server";
import YearlyPopularityTrendSection from "@/components/charts/YearlyPopularityTrendSection";

const CARBON_CREDIT_PRICE_PER_TONNE = 3000; // NT$/公噸，僅示意用台灣碳權交易平台現行行情

type GlobalStats = {
  rideCount: number;
  totalDistanceKm: number;
  totalCarbonKg: number;
  stationCounts: { station: string; count: number }[];
};

export default async function GovDashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_global_stats");
  const stats: GlobalStats = (data as unknown as GlobalStats) ?? {
    rideCount: 0,
    totalDistanceKm: 0,
    totalCarbonKg: 0,
    stationCounts: [],
  };

  const rideCount = stats.rideCount;
  const totalDistanceKm = Number(stats.totalDistanceKm);
  const carbonSavedKg = Number(stats.totalCarbonKg);
  const carbonSavedTonnes = carbonSavedKg / 1000;
  const theoreticalValueNT = Math.round(carbonSavedTonnes * CARBON_CREDIT_PRICE_PER_TONNE);
  const ranked = stats.stationCounts;
  const maxCount = Math.max(1, ...ranked.map((r) => r.count));

  return (
    <div className="px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ecomiles 政府儀表板</h1>
          <p className="mt-1 text-xs text-slate-400">
            內部檢視頁面，未列入使用者導覽，僅供花蓮縣政府端參考
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-slate-400">累積騎乘人次</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{rideCount} 次</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-slate-400">累積里程</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {totalDistanceKm.toFixed(1)} km
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-slate-400">全站累積減碳量</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {carbonSavedKg.toFixed(2)} kg ／ {carbonSavedTonnes.toFixed(4)} 公噸
          </p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-slate-400">理論碳權市場價值</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            NT$ {theoreticalValueNT.toLocaleString("zh-TW")} 元
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            僅為台灣碳權交易平台現行行情換算示意，非正式可交易碳權
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">14 站使用熱度排行</h2>
          <div className="flex flex-col gap-2">
            {ranked.map((r, i) => (
              <div key={r.station} className="flex items-center gap-3">
                <span className="w-5 text-xs font-semibold text-slate-400">{i + 1}</span>
                <span className="w-28 shrink-0 truncate text-xs text-slate-700">{r.station}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${(r.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-slate-500">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">歷年打卡照片熱度趨勢</h2>
          <YearlyPopularityTrendSection />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            資料來源：Flickr公開地理標記照片（2017~2026），僅供趨勢參考，非官方觀光統計
          </p>
        </div>
      </div>
    </div>
  );
}
