import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildAssistantContext } from "@/lib/assistantData";

const SYSTEM_PROMPT =
  "你是花蓮「山海一線」單車路線的在地導覽員。你只能根據下面提供的真實歷史打卡資料、站點資訊、商家清單回答問題。禁止捏造資料中沒有提到的地點、數字或商家。如果使用者問的問題資料裡沒有答案，就誠實說「目前資料庫沒有這方面的資訊」，不要亂猜。回答語氣親切、像在地朋友報路，控制在150字以內，不要用條列符號，用口語化的一段話回答。路線推薦已經由後端演算法算好，你只需要用友善語氣把這個結果講出來，不要自己編路線。";

// DEEPSEEK_API_KEY 沒有 NEXT_PUBLIC_ 前綴，只會存在於伺服器端環境，這個檔案是 Route Handler
// （永遠只在伺服器執行，不會被打包進 client bundle），是唯一允許讀這個環境變數的地方。
//
// client 要在 request handler 裡面才建立，不能放在模組頂層：openai SDK 的建構子在沒有
// apiKey 時會直接 throw，如果放在模組頂層，Next.js build 階段收集 route 資訊時就會匯入、
// 執行到這行直接讓整個 build 失敗（在 DEEPSEEK_API_KEY 還沒填的期間發生過一次）。
function getClient() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

export async function POST(request: Request) {
  try {
    const client = getClient();
    const body = await request.json();
    const question: string = typeof body?.question === "string" ? body.question : "";
    const lat: number | undefined = typeof body?.lat === "number" ? body.lat : undefined;
    const lng: number | undefined = typeof body?.lng === "number" ? body.lng : undefined;

    if (!question.trim()) {
      return NextResponse.json({ error: "請輸入問題" }, { status: 400 });
    }

    const context = buildAssistantContext({ lat, lng });

    const completion = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `【背景資料】\n${context}\n\n【使用者問題】\n${question}` },
      ],
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("assistant route error:", err);
    return NextResponse.json({ error: "導覽員暫時連不上，請稍後再試" }, { status: 500 });
  }
}
