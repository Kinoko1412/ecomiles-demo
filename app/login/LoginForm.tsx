"use client";

import { useState } from "react";
import { useApp } from "@/lib/context/AppContext";

export default function LoginForm() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    const result = await login(trimmed);
    if (result.success) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "寄送失敗，請稍後再試");
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-500 via-emerald-400 to-sky-400 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🚲</div>
          <h1 className="text-2xl font-bold text-emerald-700">Ecomiles</h1>
          <p className="mt-1 text-sm text-slate-500">花蓮單車減碳兌換</p>
        </div>

        {status === "sent" ? (
          <div className="text-center">
            <div className="mb-2 text-4xl">📬</div>
            <p className="text-sm text-slate-600">
              登入連結已寄到 <span className="font-semibold">{email}</span>
              ，請到信箱點擊連結完成登入。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            {status === "error" && <p className="text-xs text-red-500">{errorMsg}</p>}
            <button
              type="submit"
              disabled={!email.trim() || status === "sending"}
              className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status === "sending" ? "寄送中…" : "寄送登入連結"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
