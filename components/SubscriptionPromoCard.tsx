export default function SubscriptionPromoCard() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 p-4 text-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
          推薦方案
        </span>
        <span className="text-2xl">👑</span>
      </div>
      <p className="mt-2 text-base font-bold">低碳玩家方案</p>
      <p className="text-sm text-white/90">NT$99 / 月</p>
      <ul className="mt-2 space-y-0.5 text-[11px] text-white/85">
        <li>・專屬主題路線每月更新</li>
        <li>・點數加成、優先兌換資格</li>
        <li>・低碳挑戰賽專屬排行榜</li>
      </ul>
      <div className="mt-3 w-full rounded-full bg-white/90 py-2 text-center text-xs font-semibold text-emerald-600">
        即將開放訂閱
      </div>
    </div>
  );
}
