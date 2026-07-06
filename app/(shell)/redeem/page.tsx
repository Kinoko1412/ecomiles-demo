"use client";

import { useState } from "react";
import { REWARDS } from "@/lib/constants";
import { useApp } from "@/lib/context/AppContext";
import Modal from "@/components/Modal";

export default function RedeemPage() {
  const { points, rewardsStock, redeemReward } = useApp();
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [redeemedName, setRedeemedName] = useState<string | null>(null);
  const [errorReward, setErrorReward] = useState<string | null>(null);

  function handleRedeem(rewardId: string, rewardName: string) {
    const r = redeemReward(rewardId);
    if (r.success) {
      setRedeemedName(rewardName);
      setRedeemedCode(r.code);
      setErrorReward(null);
    } else {
      setErrorReward(rewardId);
      setTimeout(() => setErrorReward(null), 1500);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-700">兌換獎品</h1>
        <div className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
          {points} 點
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {REWARDS.map((reward) => {
          const stock = rewardsStock[reward.id] ?? 0;
          const soldOut = stock <= 0;
          const insufficientPoints = points < reward.cost;

          return (
            <div
              key={reward.id}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white/80 p-4 text-center shadow-sm ring-1 ring-black/5"
            >
              <span className="text-4xl">{reward.icon}</span>
              <span className="text-sm font-semibold text-slate-800">{reward.name}</span>
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
        })}
      </div>

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
