"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/context/AppContext";
import { ACHIEVEMENTS } from "@/lib/constants";

// 跟 app/(shell)/page.tsx 的 arrivalToast 共用同一組 z-index 慣例：
// z-[60] 蓋過騎乘中畫面（z-[55]）跟 AiGuideFab（z-50），簽到獎勵不管使用者在哪個畫面都看得到。
export default function DailyCheckinToast() {
  const { checkinToast, clearCheckinToast } = useApp();

  useEffect(() => {
    if (!checkinToast) return;
    const t = setTimeout(clearCheckinToast, 3200);
    return () => clearTimeout(t);
  }, [checkinToast, clearCheckinToast]);

  if (!checkinToast) return null;

  const newAchievementDefs = checkinToast.newAchievements
    .map((code) => ACHIEVEMENTS.find((a) => a.code === code))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-6">
      <div
        className="flex flex-col items-center gap-1 rounded-2xl bg-orange-500 px-5 py-3 text-center text-white shadow-lg"
        style={{ animation: "toast-pop 3.2s ease-in-out" }}
      >
        <span className="text-sm font-semibold">
          🔥 連續簽到 {checkinToast.streakDays} 天！+{checkinToast.pointsEarned} 點
        </span>
        {newAchievementDefs.map((a) => (
          <span key={a.code} className="text-xs text-orange-50">
            解鎖成就 {a.icon} {a.name}
          </span>
        ))}
      </div>
    </div>
  );
}
