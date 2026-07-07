"use client";

import { useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const QUICK_QUESTIONS = ["現在適合去哪裡？", "幫我推薦路線", "附近有什麼景點？"];

function getCurrentPositionSafe(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });
}

export default function AiGuideChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // 使用者拒絕定位權限或抓不到位置都會安靜拿到 null，後端會 fallback 成只看本月人氣排序
      const position = await getCurrentPositionSafe();
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          lat: position?.lat,
          lng: position?.lng,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer as string }]);
    } catch {
      setError("暫時連不上導覽員，等一下再試試看");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  return (
    <div className="flex flex-col gap-3 text-left">
      <div>
        <h2 className="text-lg font-bold text-emerald-700">🧭 AI 導覽員</h2>
        <p className="text-xs text-slate-400">根據真實歷史打卡資料回答，問問看吧</p>
      </div>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400">還沒有對話紀錄，試著問問下面的快速提問吧</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-slate-700 shadow-sm ring-1 ring-black/5"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-400 shadow-sm ring-1 ring-black/5">
              導覽員思考中…
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSend(q)}
            disabled={loading}
            className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="問問導覽員…"
          disabled={loading}
          className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          送出
        </button>
      </form>
    </div>
  );
}
