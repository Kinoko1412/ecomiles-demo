"use client";

import { useState } from "react";
import SubscriptionTierCards from "@/components/SubscriptionTierCards";

export default function SubscriptionPromoCard() {
  const [showPlans, setShowPlans] = useState(false);

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 p-4 text-white shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
            推薦方案
          </span>
          <span className="text-2xl">👑</span>
        </div>
        <p className="mt-2 text-base font-bold">低碳玩家方案</p>
        <p className="text-sm text-white/90">NT$199 / 月起</p>
        <ul className="mt-2 space-y-0.5 text-[11px] text-white/85">
          <li>・專屬主題路線每月更新</li>
          <li>・點數加成、優先兌換資格</li>
          <li>・低碳挑戰賽專屬排行榜</li>
        </ul>
        <button
          type="button"
          onClick={() => setShowPlans(true)}
          className="mt-3 w-full rounded-full bg-white/90 py-2 text-center text-xs font-semibold text-emerald-600 transition-colors hover:bg-white"
        >
          訂閱加入會員
        </button>
      </div>

      {showPlans && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-6"
          onClick={() => setShowPlans(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900 p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">選擇訂閱方案</p>
              <button
                type="button"
                onClick={() => setShowPlans(false)}
                aria-label="關閉"
                className="text-slate-400 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>
            <SubscriptionTierCards />
            <p className="mt-3 text-center text-[11px] text-slate-500">
              此畫面為 demo 展示，尚未串接金流
            </p>
          </div>
        </div>
      )}
    </>
  );
}
