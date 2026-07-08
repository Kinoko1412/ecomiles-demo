import { createClient } from "@/utils/supabase/server";
import YearlyPopularityTrendSection from "@/components/charts/YearlyPopularityTrendSection";
import { THEME_ROUTES } from "@/lib/themeRoutes";

type GlobalStats = {
  rideCount: number;
  totalDistanceKm: number;
  totalCarbonKg: number;
  stationCounts: { station: string; count: number }[];
};

type RevenueStats = {
  totalRevenueNt: number;
  kindBreakdown: { kind: string; count: number; revenue_nt: number }[];
  routeBreakdown: { route_id: string; count: number; revenue_nt: number }[];
  recentPurchases: {
    kind: string;
    route_id: string | null;
    amount_nt: number;
    purchased_at: string;
    display_name: string | null;
  }[];
};

const KIND_LABELS: Record<string, string> = {
  single_route_unlock: "單次解鎖",
  subscription_standard: "低碳玩家方案",
  subscription_premium: "減碳環保超人方案",
};

function routeName(routeId: string | null) {
  if (!routeId) return "—";
  return THEME_ROUTES.find((r) => r.id === routeId)?.name ?? routeId;
}

export default async function GovDashboardPage() {
  const supabase = await createClient();
  const [{ data: globalData }, { data: revenueData }] = await Promise.all([
    supabase.rpc("get_global_stats"),
    supabase.rpc("get_revenue_stats"),
  ]);

  const stats: GlobalStats = (globalData as unknown as GlobalStats) ?? {
    rideCount: 0,
    totalDistanceKm: 0,
    totalCarbonKg: 0,
    stationCounts: [],
  };
  const revenue: RevenueStats = (revenueData as unknown as RevenueStats) ?? {
    totalRevenueNt: 0,
    kindBreakdown: [],
    routeBreakdown: [],
    recentPurchases: [],
  };

  const rideCount = stats.rideCount;
  const totalDistanceKm = Number(stats.totalDistanceKm);
  const carbonSavedKg = Number(stats.totalCarbonKg);
  const carbonSavedTonnes = carbonSavedKg / 1000;
  const ranked = stats.stationCounts;
  const maxCount = Math.max(1, ...ranked.map((r) => r.count));

  return (
    <div className="px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ecomiles 內部營運後台</h1>
          <p className="mt-1 text-xs text-slate-400">內部檢視頁面，未列入使用者導覽，僅供內部營運參考</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-xs text-slate-400">累積營收（訂閱＋單次解鎖）</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">
            NT$ {revenue.totalRevenueNt.toLocaleString("zh-TW")}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            數字來自 purchases 表的真實寫入紀錄；demo 尚未串接金流，是使用者按下「立即訂閱」／「單次解鎖」時寫入的
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">營收來源分佈</h2>
          <div className="flex flex-col gap-2">
            {revenue.kindBreakdown.length === 0 && (
              <p className="text-xs text-slate-400">尚無購買紀錄</p>
            )}
            {revenue.kindBreakdown.map((k) => (
              <div key={k.kind} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {KIND_LABELS[k.kind] ?? k.kind}
                  <span className="ml-1.5 text-xs text-slate-400">× {k.count}</span>
                </span>
                <span className="font-semibold text-emerald-700">
                  NT$ {k.revenue_nt.toLocaleString("zh-TW")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {revenue.routeBreakdown.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">單次解鎖・依路線</h2>
            <div className="flex flex-col gap-2">
              {revenue.routeBreakdown.map((r) => (
                <div key={r.route_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {routeName(r.route_id)}
                    <span className="ml-1.5 text-xs text-slate-400">× {r.count}</span>
                  </span>
                  <span className="font-semibold text-emerald-700">
                    NT$ {r.revenue_nt.toLocaleString("zh-TW")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {revenue.recentPurchases.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">最新購買紀錄</h2>
            <div className="flex flex-col gap-2">
              {revenue.recentPurchases.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {p.display_name ?? "使用者"}・{KIND_LABELS[p.kind] ?? p.kind}
                    {p.route_id && <>（{routeName(p.route_id)}）</>}
                  </span>
                  <span className="text-slate-700">NT$ {p.amount_nt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
