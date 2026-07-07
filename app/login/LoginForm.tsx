"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/AppContext";

type Tab = "login" | "signup";

export default function LoginForm() {
  const { signIn, signUp, resendSignupEmail } = useApp();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("login");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState("");

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const email = loginEmail.trim();
    if (!email || !loginPassword) return;
    setLoginSubmitting(true);
    setLoginError("");
    const result = await signIn(email, loginPassword);
    setLoginSubmitting(false);
    if (result.success) {
      router.push("/");
      router.refresh();
    } else {
      setLoginError(result.error ?? "登入失敗，請稍後再試");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const email = signupEmail.trim();
    const username = signupUsername.trim();
    if (!email || !username) return;
    if (signupPassword.length < 6) {
      setSignupError("密碼至少需要 6 碼");
      return;
    }
    setSignupSubmitting(true);
    setSignupError("");
    const result = await signUp(email, signupPassword, username);
    setSignupSubmitting(false);
    if (result.success) {
      setAwaitingConfirmation(email);
      setResendCooldown(60);
    } else {
      setSignupError(result.error ?? "註冊失敗，請稍後再試");
    }
  }

  async function handleResend() {
    if (!awaitingConfirmation || resendCooldown > 0) return;
    setResendSubmitting(true);
    setResendMsg("");
    const result = await resendSignupEmail(awaitingConfirmation);
    setResendSubmitting(false);
    if (result.success) {
      setResendMsg("已重新寄送驗證信");
      setResendCooldown(60);
    } else {
      setResendMsg(result.error ?? "重寄失敗，請稍後再試");
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

        {awaitingConfirmation ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-4xl">📬</span>
            <p className="text-sm text-slate-600">
              我們已寄出驗證信到{" "}
              <span className="font-semibold">{awaitingConfirmation}</span>
              ，請點擊信中連結完成註冊。
            </p>
            {resendMsg && <p className="text-xs text-slate-500">{resendMsg}</p>}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendSubmitting}
              className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {resendSubmitting
                ? "寄送中…"
                : resendCooldown > 0
                ? `重新發送驗證信（${resendCooldown}s）`
                : "重新發送驗證信"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAwaitingConfirmation(null);
                setTab("login");
              }}
              className="text-xs text-slate-400 underline"
            >
              返回登入
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex rounded-full bg-slate-100 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`flex-1 rounded-full py-2 transition-colors ${
                  tab === "login" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400"
                }`}
              >
                登入
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`flex-1 rounded-full py-2 transition-colors ${
                  tab === "signup" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400"
                }`}
              >
                註冊
              </button>
            </div>

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoFocus
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-600">
                    密碼
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                <button
                  type="submit"
                  disabled={!loginEmail.trim() || !loginPassword || loginSubmitting}
                  className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loginSubmitting ? "登入中…" : "登入"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoFocus
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label htmlFor="signup-username" className="mb-1.5 block text-sm font-medium text-slate-600">
                    使用者名稱
                  </label>
                  <input
                    id="signup-username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    placeholder="輸入你的暱稱"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-slate-600">
                    密碼
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="至少 6 碼"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                {signupError && <p className="text-xs text-red-500">{signupError}</p>}
                <button
                  type="submit"
                  disabled={!signupEmail.trim() || !signupUsername.trim() || !signupPassword || signupSubmitting}
                  className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {signupSubmitting ? "註冊中…" : "註冊"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
