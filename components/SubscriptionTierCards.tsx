import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

export default function SubscriptionTierCards() {
  return (
    <div className="flex flex-col gap-3">
      {SUBSCRIPTION_PLANS.map((plan) => {
        const isPremium = plan.id === "premium";
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
            <div
              className={`mt-3 w-full rounded-full py-2 text-center text-sm font-semibold ${
                isPremium ? "bg-amber-400 text-amber-950" : "bg-white text-slate-900"
              }`}
            >
              立即訂閱
            </div>
          </div>
        );
      })}
    </div>
  );
}
