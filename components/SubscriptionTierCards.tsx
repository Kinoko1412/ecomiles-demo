"use client";

import { useState } from "react";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscriptionPlans";

export default function SubscriptionTierCards({
  onSubscribe,
}: {
  onSubscribe?: (plan: SubscriptionPlan) => void;
}) {
  const [subscribedId, setSubscribedId] = useState<string | null>(null);

  function handleClick(plan: SubscriptionPlan) {
    setSubscribedId(plan.id);
    onSubscribe?.(plan);
  }

  return (
    <div className="flex flex-col gap-3">
      {SUBSCRIPTION_PLANS.map((plan) => {
        const isPremium = plan.id === "premium";
        const isSubscribed = subscribedId === plan.id;
        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl p-4 ring-1 ${
              isPremium
                ? "bg-gradient-to-br from-amber-500/20 to-amber-900/10 ring-amber-400/40"
                : "bg-white/5 ring-white/10"
            }`}
          >
            {isPremium && plan.badge && (
              <span className="absolute -top-2 right-4 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                稱號・{plan.badge}
              </span>
            )}
            <p className="text-sm font-semibold text-white">{plan.name}</p>
            <p className="mt-0.5 text-2xl font-bold text-amber-400">
              NT${plan.priceNT}
              <span className="text-xs font-normal text-slate-400"> / 月</span>
            </p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-300">
              {plan.perks.map((perk) => (
                <li key={perk}>・{perk}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleClick(plan)}
              disabled={isSubscribed}
              className={`mt-3 w-full rounded-full py-2 text-center text-sm font-semibold transition-colors ${
                isSubscribed
                  ? "cursor-default bg-emerald-400 text-emerald-950"
                  : isPremium
                  ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                  : "bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              {isSubscribed ? "✓ 已訂閱" : "立即訂閱"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
