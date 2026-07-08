"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { THEME_ROUTES, buildGoogleMapsDirUrl, SINGLE_ROUTE_UNLOCK_PRICE_NT } from "@/lib/themeRoutes";
import { useApp } from "@/lib/context/AppContext";
import CarbonMilestoneChart from "@/components/CarbonMilestoneChart";
import SubscriptionTierCards from "@/components/SubscriptionTierCards";
import SingleRouteUnlockCard from "@/components/SingleRouteUnlockCard";

const PERKS = [
  { icon: "🗺️", title: "更多客製化行程", desc: "解鎖精選主題路線的完整站點與延伸玩法" },
  { icon: "🏷️", title: "專屬暱稱", desc: "個人頁與排行榜顯示會員專屬標示" },
  { icon: "🎁", title: "特約商家好禮", desc: "沿線店家折扣與限定小禮，持續更新" },
];

type DemoState = "browse" | "thankyou" | "unlocked";

function UnlockPageContent() {
  const routeId = useSearchParams().get("routeId");
  const route = THEME_ROUTES.find((r) => r.id === routeId) ?? THEME_ROUTES[0];
  const [demoState, setDemoState] = useState<DemoState>("browse");
  const { recordPurchase } = useApp();

  async function handleUnlock() {
    setDemoState("thankyou");
    try {
      await recordPurchase("single_route_unlock", route.id, SINGLE_ROUTE_UNLOCK_PRICE_NT);
    } catch {
      // demo 用途，即使寫入失敗也不影響已經看到的「感謝贊助」畫面
    }
  }

  if (demoState === "thankyou") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 text-center text-white">
        <span className="text-6xl">💚</span>
        <h1 className="mt-4 text-xl font-bold">感謝您的贊助！</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-400">
          已為您解鎖「{route.name}」，NT${SINGLE_ROUTE_UNLOCK_PRICE_NT}{" "}
          將用於支持沿線店家與低碳騎行推廣
        </p>
        <button
          type="button"
          onClick={() => setDemoState("unlocked")}
          className="mt-6 w-full max-w-xs rounded-full bg-white py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
        >
          查看完整行程 →
        </button>
        <p className="mt-3 text-[11px] text-slate-500">此畫面為 demo 展示，尚未串接金流</p>
      </div>
    );
  }

  if (demoState === "unlocked") {
    return (
      <div className="min-h-screen bg-slate-900 px-6 pt-10 pb-10 text-white">
        <Link href="/route" className="text-sm text-slate-400 hover:text-slate-200">
          ‹ 返回路線
        </Link>

        <div className="mx-auto mt-6 max-w-md">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">{route.name}</h1>
            <span className="text-2xl">{route.icon}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{route.blurb}</p>

          <div className="relative mt-6 pl-1">
            <div className="absolute left-6 top-2 bottom-6 w-0.5 -translate-x-1/2 bg-sky-300" />
            <div className="flex flex-col gap-3">
              {route.stops.map((stop, i) => {
                const checkpoint = route.rewardCheckpoints.find(
                  (c) => c.stopName === stop.name
                );
                return (
                  <div key={stop.name} className="flex items-center gap-3">
                    <div className="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white shadow-md ring-4 ring-white">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                      <p className="text-sm font-semibold text-white">{stop.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {stop.time}
                        {stop.deltaKm > 0 && <> ・ +{stop.deltaKm} km</>}
                      </p>
                      {checkpoint && (
                        <p className="mt-0.5 text-[11px] text-emerald-400">
                          {checkpoint.icon}{" "}
                          {checkpoint.options
                            ? checkpoint.options.join(" 或 ")
                            : checkpoint.reward}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <a
            href={buildGoogleMapsDirUrl(route)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-100"
          >
            在 Google Maps 開啟 ↗
          </a>

          <Link
            href="/route"
            className="mt-6 block w-full rounded-full bg-white/10 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
          >
            返回路線列表
          </Link>
        </div>
      </div>
    );
  }

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

      {route.demoHtmlPath && (
        <div className="mx-auto mt-4 max-w-md">
          <a
            href={encodeURI(route.demoHtmlPath)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-full border border-white/20 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/5"
          >
            📄 查看示範行程
          </a>
        </div>
      )}

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
          訂閱解鎖後，實際出發騎乘時，抵達獎勵站點將依累積減碳量發放額外獎勵
        </p>
      </div>

      <div className="mx-auto mt-3 max-w-md">
        <CarbonMilestoneChart route={route} />
      </div>

      <div className="mx-auto mt-3 max-w-md">
        <SingleRouteUnlockCard route={route} onUnlock={handleUnlock} />
      </div>

      <div className="mx-auto mt-3 max-w-md">
        <SubscriptionTierCards
          onSubscribe={(plan) => {
            recordPurchase("subscription_standard", null, plan.priceNT).catch(() => {});
          }}
        />
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
