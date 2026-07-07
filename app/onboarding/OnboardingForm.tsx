"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/AppContext";

export default function OnboardingForm() {
  const { completeOnboarding } = useApp();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await completeOnboarding(trimmed);
      router.push("/");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "設定失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-500 via-emerald-400 to-sky-400 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🚲</div>
          <h1 className="text-2xl font-bold text-emerald-700">歡迎加入 Ecomiles</h1>
          <p className="mt-1 text-sm text-slate-500">先取個暱稱，開始騎乘減碳吧</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="nickname" className="mb-1.5 block text-sm font-medium text-slate-600">
              暱稱
            </label>
            <input
              id="nickname"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="輸入你的暱稱"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          <button
            type="submit"
            disabled={!value.trim() || submitting}
            className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "設定中…" : "開始使用"}
          </button>
        </form>
      </div>
    </div>
  );
}
