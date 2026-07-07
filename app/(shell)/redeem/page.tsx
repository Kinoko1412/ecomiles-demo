"use client";

import { useState } from "react";
import { useApp, type RewardWithStock } from "@/lib/context/AppContext";
import Modal from "@/components/Modal";
import RedeemTabs from "@/components/RedeemTabs";

export default function RedeemPage() {
  const { points, rewards, rewardsStock, redeemReward } = useApp();
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [redeemedName, setRedeemedName] = useState<string | null>(null);
  const [errorReward, setErrorReward] = useState<string | null>(null);

  async function handleRedeem(rewardId: string, rewardName: string) {
    try {
      const r = await redeemReward(rewardId);
      if (r.success) {
        setRedeemedName(rewardName);
        setRedeemedCode(r.code);
        setErrorReward(null);
      } else {
        setErrorReward(rewardId);
        setTimeout(() => setErrorReward(null), 1500);
      }
    } catch {
      setErrorReward(rewardId);
      setTimeout(() => setErrorReward(null), 1500);
    }
  }

  const sustainableRewards = rewards.filter((r) => !r.lotteryOnly && r.id !== "r6");
  const storeRewards = rewards.filter((r) => r.id === "r6");

  function renderCard(reward: RewardWithStock) {
    const stock = rewardsStock[reward.id] ?? 0;
    const soldOut = stock <= 0;
    const insufficientPoints = points < reward.cost;
    const isGrandPrize = reward.id === "r5";

    return (
      <div
        key={reward.id}
        className={`flex flex-col items-center gap-1.5 rounded-2xl p-4 text-center shadow-sm ring-1 ${
          isGrandPrize
            ? "col-span-2 bg-gradient-to-br from-amber-50 to-emerald-50 ring-amber-300"
            : "bg-white/80 ring-black/5"
        }`}
      >
        {isGrandPrize && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
            大獎
          </span>
        )}
        <span className="text-4xl">{reward.icon}</span>
        <span className="text-sm font-semibold text-slate-800">{reward.name}</span>
        <span className="text-[10px] leading-snug text-slate-400">{reward.blurb}</span>
        <span className="text-xs text-slate-400">{reward.cost} 點</span>
        <span className="text-[11px] text-slate-400">剩餘 {stock} 份</span>
        <button
          onClick={() => handleRedeem(reward.id, reward.name)}
          disabled={soldOut || insufficientPoints}
          className={`mt-1 w-full rounded-full py-2 text-xs font-semibold transition-colors ${
            soldOut
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : insufficientPoints
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : errorReward === reward.id
              ? "bg-red-100 text-red-500"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          {soldOut ? "已兌換完畢" : insufficientPoints ? "點數不足" : "兌換"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10">
      <RedeemTabs />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-700">兌換獎品</h1>
        <div className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
          {points} 點
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">🌱 永續好禮</h2>
        <div className="grid grid-cols-2 gap-4">{sustainableRewards.map(renderCard)}</div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">點數商店</h2>
        <div className="grid grid-cols-2 gap-4">{storeRewards.map(renderCard)}</div>
      </section>

      <Modal open={!!redeemedCode} onClose={() => setRedeemedCode(null)}>
        <div className="text-5xl">🎁</div>
        <h2 className="mt-2 text-lg font-bold text-emerald-700">兌換成功！</h2>
        <p className="mt-1 text-sm text-slate-600">{redeemedName}</p>
        <p className="mt-3 rounded-xl bg-slate-100 py-3 font-mono text-xl font-bold tracking-widest text-slate-800">
          {redeemedCode}
        </p>
        <p className="mt-2 text-xs text-slate-400">請截圖此序號至現場兌換櫃檯</p>
      </Modal>
    </div>
  );
}
