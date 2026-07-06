"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/AppContext";

export default function LoginPage() {
  const { nickname, login, hydrated } = useApp();
  const router = useRouter();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (hydrated && nickname) router.replace("/");
  }, [hydrated, nickname, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    login(trimmed);
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-500 via-emerald-400 to-sky-400 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🚲</div>
          <h1 className="text-2xl font-bold text-emerald-700">Ecomiles</h1>
          <p className="mt-1 text-sm text-slate-500">花蓮單車減碳兌換</p>
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
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            開始使用
          </button>
        </form>
      </div>
    </div>
  );
}
