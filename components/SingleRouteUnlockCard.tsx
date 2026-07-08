import { SINGLE_ROUTE_UNLOCK_PRICE_NT, type ThemeRoute } from "@/lib/themeRoutes";

export default function SingleRouteUnlockCard({
  route,
  onUnlock,
}: {
  route: ThemeRoute;
  onUnlock?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <p className="text-xs font-semibold text-slate-400">單次解鎖・小資嚐鮮</p>
      <p className="mt-1 text-sm font-semibold text-white">{route.name}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        NT${SINGLE_ROUTE_UNLOCK_PRICE_NT}
        <span className="text-xs font-normal text-slate-400"> / 單次</span>
      </p>
      <p className="mt-1 text-[11px] text-slate-400">先體驗這一趟，喜歡再升級訂閱</p>
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
