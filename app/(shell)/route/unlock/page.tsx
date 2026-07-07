"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { calcCarbonSavedKg } from "@/lib/carbon";
import { THEME_ROUTES } from "@/lib/themeRoutes";
import CarbonMilestoneChart from "@/components/CarbonMilestoneChart";
import SubscriptionTierCards from "@/components/SubscriptionTierCards";
import SingleRouteUnlockCard from "@/components/SingleRouteUnlockCard";

const PERKS = [
  { icon: "🗺️", title: "更多客製化行程", desc: "解鎖精選主題路線的完整站點與延伸玩法" },
  { icon: "🏷️", title: "專屬暱稱", desc: "個人頁與排行榜顯示會員專屬標示" },
  { icon: "🎁", title: "特約商家好禮", desc: "沿線店家折扣與限定小禮，持續更新" },
];

function UnlockPageContent() {
  const routeId = useSearchParams().get("routeId");
  const route = THEME_ROUTES.find((r) => r.id === routeId) ?? THEME_ROUTES[0];
  const totalCarbonKg = calcCarbonSavedKg(route.totalDistanceKm);

  return (
    <div className="min-h-screen bg-slate-900 px-6 pt-10 text-white">
      <Link href="/route" className="text-sm text-slate-400 hover:text-slate-200">
        ‹ 返回路線
      </Link>

      <div className="mx-auto flex max-w-md flex-col items-center gap-2 pt-8 text-center">
        <span className="text-5xl">👑</span>
        <h1 className="text-xl font-bold text-white">訂閱解鎖所有路線</h1>
        <p className="text-sm text-slate-400">訂閱期間即可解鎖所有精選路線與會員專屬功能</p>
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
        {PERKS.map((p) => (
          <div
            key={p.title}
            className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
          >
            <span className="text-2xl">{p.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{p.title}</p>
              <p className="text-xs text-slate-400">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-md">
        <p className="text-center text-xs leading-relaxed text-slate-400">
          訂閱解鎖後，實際出發騎乘時，每達成 1/3 進度，將依累積減碳量發放額外獎勵
        </p>
      </div>

      <div className="mx-auto mt-3 max-w-md">
        <CarbonMilestoneChart totalCarbonKg={totalCarbonKg} />
      </div>

      <div className="mx-auto mt-3 max-w-md">
        <SingleRouteUnlockCard route={route} />
      </div>

      <div className="mx-auto mt-3 max-w-md">
        <SubscriptionTierCards />
      </div>

      <div className="mx-auto mb-10 mt-3 max-w-md">
        <p className="text-center text-[11px] text-slate-500">此畫面為 demo 展示，尚未串接金流</p>
      </div>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={null}>
      <UnlockPageContent />
    </Suspense>
  );
}
