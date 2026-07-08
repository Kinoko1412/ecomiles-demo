"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/AppContext";
import { createClient } from "@/utils/supabase/client";

type Tab = "login" | "signup";
type SignupStep = "email" | "code" | "profile";
type Portal = "public" | "admin";

const RIDE_DISCLAIMER = [
  "遵守道路交通安全規則，配戴安全帽等防護裝備，禁止酒後或疲勞騎乘；",
  "依自身體能、健康狀況與騎乘經驗評估路線難度，量力而為；未滿 18 歲者請於監護人同意及陪同下使用本服務；",
  "騎乘前請確認車輛煞車、輪胎及智慧車鎖狀態正常，如發現異常應立即停止使用並回報站點或客服；",
  "騎乘期間如發生交通事故或人身損害，應依相關法規自行處理並負擔相應責任；本平台不提供保險，亦不對騎乘過程中之意外事故負賠償責任，但因平台系統錯誤（如里程計算錯誤）致使用者權益受損者不在此限；",
  "本平台將透過 GPS 記錄您的騎乘軌跡，用於計算里程與減碳量等服務功能，相關資料僅作站內用途使用，不會另作商業利用。",
];

export default function LoginForm() {
  const { signIn, sendSignupCode, verifySignupCode, completeSignupProfile } = useApp();
  const router = useRouter();

  const [portal, setPortal] = useState<Portal>("public");
  const [tab, setTab] = useState<Tab>("login");

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [signupStep, setSignupStep] = useState<SignupStep>("email");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [agreedToRisk, setAgreedToRisk] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const identifier = loginIdentifier.trim();
    if (!identifier || !loginPassword) return;
    setLoginSubmitting(true);
    setLoginError("");
    const result = await signIn(identifier, loginPassword);
    if (!result.success) {
      setLoginSubmitting(false);
      setLoginError(result.error ?? "登入失敗，請稍後再試");
      return;
    }

    if (portal === "public") {
      setLoginSubmitting(false);
      router.push("/");
      router.refresh();
      return;
    }

    // portal === "admin"：登入成功不代表有管理權限，還要另外查 profiles.role，
    // 沒有 admin 角色的話要把剛剛建立的 session 登出，不能讓使用者卡在
    // 「已登入但角色不對」的中間狀態。
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    setLoginSubmitting(false);

    if (profile?.role === "admin") {
      router.push("/gov-dashboard");
      router.refresh();
    } else {
      await supabase.auth.signOut();
      setLoginError("此帳號未開通管理員權限，請切換至民眾登入");
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const email = signupEmail.trim();
    if (!email) return;
    setSignupSubmitting(true);
    setSignupError("");
    const result = await sendSignupCode(email);
    setSignupSubmitting(false);
    if (result.success) {
      setSignupStep("code");
      setResendCooldown(60);
    } else {
      setSignupError(result.error ?? "寄送失敗，請稍後再試");
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setSignupSubmitting(true);
    setSignupError("");
    const result = await sendSignupCode(signupEmail.trim());
    setSignupSubmitting(false);
    if (result.success) {
      setResendCooldown(60);
    } else {
      setSignupError(result.error ?? "重寄失敗，請稍後再試");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const code = signupCode.trim();
    if (!code) return;
    setSignupSubmitting(true);
    setSignupError("");
    const result = await verifySignupCode(signupEmail.trim(), code);
    setSignupSubmitting(false);
    if (result.success) {
      setSignupStep("profile");
    } else {
      setSignupError(result.error ?? "驗證碼錯誤或已過期，請重新取得");
    }
  }

  async function handleCompleteProfile(e: React.FormEvent) {
    e.preventDefault();
    const username = signupUsername.trim();
    if (!username) return;
    if (signupPassword.length < 6) {
      setSignupError("密碼至少需要 6 碼");
      return;
    }
    if (!agreedToRisk) {
      setSignupError("請先閱讀並勾選同意騎乘風險與安全須知");
      return;
    }
    setSignupSubmitting(true);
    setSignupError("");
    const result = await completeSignupProfile(username, signupPassword);
    setSignupSubmitting(false);
    if (result.success) {
      router.push("/");
      router.refresh();
    } else {
      setSignupError(result.error ?? "設定失敗，請稍後再試");
    }
  }

  function resetSignup() {
    setSignupStep("email");
    setSignupEmail("");
    setSignupCode("");
    setSignupUsername("");
    setSignupPassword("");
    setSignupError("");
    setAgreedToRisk(false);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-500 via-emerald-400 to-sky-400 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🚲</div>
          <h1 className="text-2xl font-bold text-emerald-700">Ecomiles</h1>
          <p className="mt-1 text-sm text-slate-500">花蓮單車減碳兌換</p>
        </div>

        <div className="mb-3 flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setPortal("public");
              setLoginError("");
            }}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              portal === "public" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400"
            }`}
          >
            民眾登入
          </button>
          <button
            type="button"
            onClick={() => {
              setPortal("admin");
              setTab("login");
              setLoginError("");
            }}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              portal === "admin" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400"
            }`}
          >
            內部管理登入
          </button>
        </div>

        {portal === "public" && (
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
              onClick={() => {
                setTab("signup");
                resetSignup();
              }}
              className={`flex-1 rounded-full py-2 transition-colors ${
                tab === "signup" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400"
              }`}
            >
              註冊
            </button>
          </div>
        )}

        {portal === "admin" && (
          <p className="mb-4 text-center text-sm font-semibold text-slate-600">內部管理後台登入</p>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-medium text-slate-600">
                使用者名稱 / Email
              </label>
              <input
                id="login-identifier"
                autoFocus
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="使用者名稱或 you@example.com"
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
              disabled={!loginIdentifier.trim() || !loginPassword || loginSubmitting}
              className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loginSubmitting ? "登入中…" : "登入"}
            </button>
          </form>
        ) : (
          <>
            {signupStep === "email" && (
              <form onSubmit={handleSendCode} className="flex flex-col gap-4">
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
                {signupError && <p className="text-xs text-red-500">{signupError}</p>}
                <button
                  type="submit"
                  disabled={!signupEmail.trim() || signupSubmitting}
                  className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {signupSubmitting ? "寄送中…" : "取得驗證碼"}
                </button>
              </form>
            )}

            {signupStep === "code" && (
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">
                  驗證碼已寄到 <span className="font-semibold">{signupEmail}</span>，請輸入信件裡的驗證碼。
                </p>
                <div>
                  <label htmlFor="signup-code" className="mb-1.5 block text-sm font-medium text-slate-600">
                    驗證碼
                  </label>
                  <input
                    id="signup-code"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={signupCode}
                    onChange={(e) => setSignupCode(e.target.value)}
                    placeholder="12345678"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg tracking-[0.2em] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                {signupError && <p className="text-xs text-red-500">{signupError}</p>}
                <button
                  type="submit"
                  disabled={!signupCode.trim() || signupSubmitting}
                  className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {signupSubmitting ? "驗證中…" : "驗證"}
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || signupSubmitting}
                  className="text-xs text-slate-400 underline disabled:no-underline disabled:text-slate-300"
                >
                  {resendCooldown > 0 ? `重新發送驗證碼（${resendCooldown}s）` : "重新發送驗證碼"}
                </button>
              </form>
            )}

            {signupStep === "profile" && (
              <form onSubmit={handleCompleteProfile} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="signup-username" className="mb-1.5 block text-sm font-medium text-slate-600">
                    使用者名稱
                  </label>
                  <input
                    id="signup-username"
                    autoFocus
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
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-600">騎乘風險與安全須知</p>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                    <p className="mb-1">
                      本平台提供之路線僅供參考，實際騎乘涉及道路交通、天候、地形等不可控因素。使用者應：
                    </p>
                    <ul className="list-disc space-y-1 pl-4">
                      {RIDE_DISCLAIMER.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={agreedToRisk}
                      onChange={(e) => setAgreedToRisk(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                    />
                    <span>我已閱讀並同意上述風險說明</span>
                  </label>
                </div>
                {signupError && <p className="text-xs text-red-500">{signupError}</p>}
                <button
                  type="submit"
                  disabled={
                    !signupUsername.trim() || !signupPassword || !agreedToRisk || signupSubmitting
                  }
                  className="w-full rounded-full bg-emerald-500 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {signupSubmitting ? "完成註冊中…" : "完成註冊"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
