"use client";

import Link from "next/link";

const PERKS = [
  { icon: "🗺️", title: "更多客製化行程", desc: "解鎖精選主題路線的完整站點與延伸玩法" },
  { icon: "🏷️", title: "專屬暱稱", desc: "個人頁與排行榜顯示會員專屬標示" },
  { icon: "🎁", title: "特約商家好禮", desc: "沿線店家折扣與限定小禮，持續更新" },
];

export default function UnlockPage() {
  return (
    <div className="min-h-screen bg-slate-900 px-6 pt-10 text-white">
      <Link href="/route" className="text-sm text-slate-400 hover:text-slate-200">
        ‹ 返回路線
      </Link>

      <div className="mx-auto flex max-w-md flex-col items-center gap-2 pt-8 text-center">
        <span className="text-5xl">👑</span>
        <h1 className="text-xl font-bold text-white">解鎖完整行程</h1>
        <p className="text-sm text-slate-400">花 NT$99 解鎖精選路線全部內容與會員專屬功能</p>
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

      <div className="mx-auto mt-8 max-w-md rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-4 text-center shadow-lg">
        <p className="text-xs font-semibold text-amber-900">單次解鎖</p>
        <p className="mt-0.5 text-2xl font-bold text-amber-950">NT$99</p>
      </div>

      <div className="mx-auto mb-10 mt-4 max-w-md">
        <div className="w-full rounded-full bg-white py-3 text-center text-sm font-semibold text-slate-900">
          立即解鎖
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">此畫面為 demo 展示，尚未串接金流</p>
      </div>
    </div>
  );
}
