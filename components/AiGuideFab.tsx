"use client";

import { useEffect, useState } from "react";
import AiGuideChat from "@/components/AiGuideChat";

const TOOLTIP_SEEN_KEY = "ai-fab-tooltip-seen";

export default function AiGuideFab() {
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // 讀 localStorage 判斷是不是第一次造訪：跟專案裡其他「掛載時讀 localStorage 決定要不要
  // setState」的地方一樣，故意留在 useEffect 裡而不是改成 lazy useState initializer，
  // 避免 SSR 輸出跟 client 第一次 render 的內容對不起來（hydration mismatch）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(TOOLTIP_SEEN_KEY);
    if (seen) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowTooltip(true);
    const timer = setTimeout(() => {
      setShowTooltip(false);
      window.localStorage.setItem(TOOLTIP_SEEN_KEY, "1");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  function handleClick() {
    setOpen(true);
    if (showTooltip) {
      setShowTooltip(false);
      window.localStorage.setItem(TOOLTIP_SEEN_KEY, "1");
    }
  }

  if (open) {
    return <AiGuideChat onClose={() => setOpen(false)} />;
  }

  return (
    <>
      {showTooltip && (
        <div
          className="fixed z-50 max-w-[160px] rounded-2xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg"
          style={{ right: "80px", bottom: "calc(84px + env(safe-area-inset-bottom))" }}
        >
          問問 AI 導覽員
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label="AI 導覽員"
        className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg transition-transform active:scale-95"
        style={{ right: "16px", bottom: "calc(76px + env(safe-area-inset-bottom))" }}
      >
        🧭
      </button>
    </>
  );
}
