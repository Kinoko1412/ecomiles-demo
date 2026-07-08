import { SINGLE_ROUTE_UNLOCK_PRICE_NT, sumRouteCost, type ThemeRoute } from "@/lib/themeRoutes";

export default function SingleRouteUnlockCard({
  route,
  onUnlock,
}: {
  route: ThemeRoute;
  onUnlock?: () => void;
}) {
  const costSubtotal = sumRouteCost(route);

  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <p className="text-xs font-semibold text-slate-400">單次解鎖・完整體驗</p>
      <p className="mt-1 text-sm font-semibold text-white">{route.name}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        NT${SINGLE_ROUTE_UNLOCK_PRICE_NT}
        <span className="text-xs font-normal text-slate-400"> / 單次・每人</span>
      </p>

      <div className="mt-3 rounded-xl bg-black/20 p-3">
        <p className="text-[11px] font-semibold text-slate-300">費用明細（每人）</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {route.costBreakdown.map((item) => (
            <li key={item.label} className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{item.label}</span>
              <span>NT${item.amountNT}</span>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-[11px] font-semibold text-slate-300">
          <span>變動成本小計</span>
          <span>NT${costSubtotal}</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
          以上為單條行程的實支變動成本，其餘價差用於平台推廣與維運
        </p>
      </div>

      <button
        type="button"
        onClick={onUnlock}
        className="mt-3 w-full rounded-full bg-white py-2 text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
      >
        單次解鎖
      </button>
    </div>
  );
}
