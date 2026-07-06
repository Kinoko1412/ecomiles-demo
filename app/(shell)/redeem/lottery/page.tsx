"use client";

import { useState } from "react";
import { LOTTERY_COST_POINTS, LOTTERY_TIERS, REWARDS } from "@/lib/constants";
import { useApp, type DrawLotteryResult } from "@/lib/context/AppContext";
import Modal from "@/components/Modal";
import RedeemTabs from "@/components/RedeemTabs";

const TIER_LABELS: Record<string, string> = {
  none: "銘謝惠顧",
  small: "小獎",
  medium: "中獎",
  grand: "大獎",
};

export default function LotteryPage() {
  const { points, rewardsStock, drawLottery } = useApp();
  const [drawing, setDrawing] = useState(false);
  const [insufficient, setInsufficient] = useState(false);
  const [result, setResult] = useState<DrawLotteryResult | null>(null);

  function handleDraw() {
    if (points < LOTTERY_COST_POINTS) {
      setInsufficient(true);
      setTimeout(() => setInsufficient(false), 1500);
      return;
    }
    setDrawing(true);
    setTimeout(() => {
      const r = drawLottery();
      setDrawing(false);
      setResult(r);
    }, 1000);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10">
      <RedeemTabs />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-700">幸運抽獎</h1>
        <div className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
          {points} 點
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 p-6 text-center shadow-sm ring-1 ring-black/5">
        <span className="text-5xl">🎰</span>
        <p className="text-sm text-slate-500">每次抽獎消耗 {LOTTERY_COST_POINTS} 點</p>
        <button
          onClick={handleDraw}
          disabled={drawing}
          className={`w-full rounded-full py-3 text-base font-semibold text-white shadow-md transition-colors disabled:cursor-not-allowed ${
            insufficient
              ? "bg-red-400"
              : drawing
              ? "animate-pulse bg-emerald-400"
              : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          {insufficient ? "點數不足" : drawing ? "抽獎中…" : "抽獎"}
        </button>
      </div>

      <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">獎項機率與剩餘數量</h2>
        <div className="flex flex-col gap-2">
          {LOTTERY_TIERS.map((t) => {
            const reward = t.rewardId ? REWARDS.find((r) => r.id === t.rewardId) : null;
            const stock = t.rewardId ? rewardsStock[t.rewardId] ?? 0 : null;
            return (
              <div
                key={t.tier}
                className="flex items-center justify-between text-xs text-slate-500"
              >
                <span>
                  {reward ? `${reward.icon} ` : "🙏 "}
                  {t.label}
                  {reward ? `（${reward.name}）` : ""}
                </span>
                <span>
                  {(t.probability * 100).toFixed(0)}%
                  {stock !== null ? `・剩餘 ${stock} 份` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={!!result} onClose={() => setResult(null)}>
        {result?.success ? (
          <>
            <div className="text-5xl">{result.tier === "none" ? "🙏" : "🎉"}</div>
            <h2 className="mt-2 text-lg font-bold text-emerald-700">
              {TIER_LABELS[result.tier]}
            </h2>
            {result.tier !== "none" && result.prizeName && (
              <>
                <p className="mt-1 text-sm text-slate-600">{result.prizeName}</p>
                <p className="mt-3 rounded-xl bg-slate-100 py-3 font-mono text-xl font-bold tracking-widest text-slate-800">
                  {result.code}
                </p>
                <p className="mt-2 text-xs text-slate-400">請截圖此序號至現場兌換櫃檯</p>
              </>
            )}
            {result.stockOut && (
              <p className="mt-2 text-xs text-amber-600">
                本次獎品剛好兌換完畢，已依銘謝惠顧處理（點數仍依規則扣除）
              </p>
            )}
            {result.tier === "none" && !result.stockOut && (
              <p className="mt-1 text-sm text-slate-500">再接再厲，下次好運一定會來！</p>
            )}
          </>
        ) : (
          <>
            <div className="text-5xl">😥</div>
            <h2 className="mt-2 text-lg font-bold text-emerald-700">點數不足</h2>
            <p className="mt-1 text-sm text-slate-500">
              抽獎需要 {LOTTERY_COST_POINTS} 點，快去騎車累積更多點數吧！
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
