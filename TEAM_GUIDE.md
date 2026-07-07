# Ecomiles 專案導覽

給協作隊友看的完整說明：這是什麼、怎麼跑起來、程式碼怎麼分佈、目前流程走到哪。

## 這是什麼

花蓮縣自行車道共享服務的減碳兌換網站 demo。使用者從 14 個站點之一出發、騎乘後在任一站點還車，系統記錄里程、計算減碳量，用點數兌換獎品。詳細背景與資料庫欄位設計理念看根目錄的 `CLAUDE.md`。

## 技術棧

- **Next.js 16（App Router）+ TypeScript**（不是純 JS，全部檔案是 `.tsx`/`.ts`）
- **Tailwind CSS v4**
- **Supabase**：Postgres 資料庫、Auth、RLS、SECURITY DEFINER RPC
- **Mapbox GL JS**：騎乘導航地圖
- 部署在 **Vercel**（push 到 GitHub 會自動觸發部署）

## 怎麼跑起來

```bash
npm install
npm run dev      # http://localhost:3000
```

需要根目錄有 `.env.local`（沒有 commit 到 git，跟負責 Supabase 專案的人要）：

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...
```

其他常用指令：

```bash
npm run build     # production build，push 前建議先跑一次確認過
npm run lint       # eslint
npx tsc --noEmit   # 型別檢查
```

## 資料層架構：`lib/context/AppContext.tsx`

整個 app 的資料都不是頁面自己直接呼叫 Supabase，而是透過 `useApp()` 這個 hook 拿：

```tsx
const { nickname, totalDistanceKm, points, completeRide, ... } = useApp();
```

`AppContext.tsx` 內部負責：
- 管理登入狀態（`onAuthStateChange` 監聽 session）
- 掛載時一次查完 profile / rides / redemptions / achievements / rewards
- 把所有寫入操作（完成騎乘、兌換、抽獎）包成呼叫 Supabase RPC，RPC 回傳結果後**樂觀更新本地 state**（不整頁重新查詢，維持「馬上看到結果」的體感）

改資料相關邏輯幾乎都只需要動這一個檔案，頁面本身不太需要碰 Supabase client。

## 頁面路由

| 路徑 | 說明 |
|---|---|
| `/` | 首頁：選出發/目的站 → GO → 全螢幕導航騎乘畫面（Mapbox 地圖、即時時速、里程、加分站點） → 結算彈窗 |
| `/login` | 登入／註冊（tab 切換） |
| `/onboarding` | 舊流程的補暱稱頁面，目前只當 fallback（正常註冊流程不會走到這裡） |
| `/profile` | 個人頁面：等級、成就、集點站徽章、兌換紀錄 |
| `/profile/history` | 減碳存摺：累積數據 count-up 動畫、模擬全站排名、recharts 圖表 |
| `/redeem` | 兌換頁：用點數換獎品 |
| `/redeem/lottery` | 抽獎頁 |
| `/gov-dashboard` | 政府端全站統計儀表板，**沒有底部導覽列**，只能直接打網址進去，無登入門檻 |
| `/auth/callback` | Route Handler，處理信箱驗證連結（備援用，主要流程走輸入驗證碼，見下） |

底部導覽列固定三個分頁：首頁／兌換／個人（`components/BottomNav.tsx`）。`(shell)` 這個資料夾群組共用 `app/(shell)/layout.tsx`，會先確認登入、確認 profile 有 display_name，否則導去 `/login` 或 `/onboarding`。

## 登入／註冊流程

**這個專案沒有用 Supabase 內建的 email 連結點擊確認流程**，因為那個流程在「連結跟送出請求不同瀏覽器/裝置打開」時會失敗（PKCE code_verifier 對不起來）。改成全程用「輸入驗證碼」：

1. **輸入 email**，按「取得驗證碼」→ 呼叫 `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
2. **輸入信件裡的驗證碼**（Supabase 目前寄的是 8 碼，不是官方文件常說的 6 碼）→ 呼叫 `supabase.auth.verifyOtp({ email, token, type: "email" })`，驗證成功就直接建立 session（此時已經算登入，但還沒有密碼、沒有使用者名稱）
3. **設定使用者名稱＋密碼** → 呼叫 `supabase.auth.updateUser({ password, data: { username } })` 設密碼，再 `update` `profiles.display_name`

登入則是「使用者名稱或 Email + 密碼」二選一輸入：如果輸入的字串不含 `@`，會先呼叫 `get_email_by_username` 這個 RPC 查出對應 email，再用 `signInWithPassword`。

**重要**：Supabase 寄信用的範本會依「這個 email 是不是全新帳號」而不同——全新帳號寄的是 **Confirm signup** 範本，同一個 email 之後再收會用 **Magic Link** 範本。兩個範本都要在 Supabase Dashboard → Authentication → Email Templates 裡確認內容含有 `{{ .Token }}`，不然信裡只有連結、沒有驗證碼可以打。

## 騎乘／地圖流程

- `app/(shell)/page.tsx` 是唯一有騎乘邏輯的頁面。選好出發站+目的站按 GO 後，畫面整個變成 `fixed inset-0` 的全螢幕導航（蓋掉底部導覽列），結束騎乘才恢復正常版面。
- 地圖元件是 `components/map/RideMapInner.tsx`，用 `mapbox://styles/mapbox/light-v11`、`pitch:0 bearing:0`（白色俯視），透過 `next/dynamic(..., { ssr:false })` 載入（mapbox-gl 會摸 `window`，SSR 環境會壞掉，這條規則對任何瀏覽器限定套件都適用，recharts 圖表也是同樣處理）。
- **加分站點**資料來自 `data/station-highlights.json`（14 站、每站最多 5 筆附近店家/景點），由 `lib/stationHighlights.ts` 篩選（排除住宿類、每站最多留 3 筆、優先景點餐飲類）。**這個 JSON 的站名文字跟 `lib/constants.ts` 的 `STATIONS` 陣列不完全一樣**（例如「花蓮港景觀橋」vs「花蓮港東景觀橋」），所以兩邊是用**陣列順序位置**對應，不是用字串比對站名，改動任一邊的順序要小心。
- 即時時速：優先用 GPS 回傳的 `coords.speed`，沒有的話（或「快速模擬」模式）用最近兩次座標的距離／時間換算，並做指數移動平均降低跳動感。
- 抵達加分站點（Haversine 距離 80 公尺內）會觸發一次性的「🌟 抵達 XXX！+10 分」提示——**這個 +10 分目前只是畫面效果，沒有真的寫回資料庫**，帳號的 `points` 欄位仍然只由 `complete_ride` RPC 依里程算。

## Supabase 資料庫

Migration 檔案都在 `supabase/migrations/`，**需要手動貼到 Supabase Dashboard 的 SQL Editor 執行**（沒有接 CLI，只有 anon key）：

- `0001_init.sql`：完整 schema（`profiles`/`stations`/`levels`/`achievements`/`rewards`/`redemption_codes`/`redemptions`/`rides`）、RLS 規則、種子資料（14 站/4 等級/5 成就/7 獎品）、`complete_ride`/`redeem_reward`/`draw_lottery`/`get_global_stats` 這四個 SECURITY DEFINER RPC。
- `0002_reset_and_username_login.sql`：清空所有使用者資料（含 `auth.users` 本身）、`profiles.display_name` 加唯一限制、新增 `get_email_by_username` RPC。

**這兩份都寫成可以重複執行不會壞**（drop-then-create / `create or replace` / `if not exists`），要重置測試環境可以直接重貼 `0002` 那份執行。

碳排係數 `0.0508`（kgCO2e/km）刻意在 `lib/carbon.ts`（前端預覽用）跟 `complete_ride` RPC（後端權威計算）各寫一份、互相註解對照——這是唯一允許重複寫死數字的例外，因為這個係數需要同時存在前後端。

## 目前已知的權宜/待辦

- `/gov-dashboard` 才可以用「碳權」這個詞，其他所有使用者頁面只能說「里程」「環保點數」「減碳量」。
- 減碳存摺頁的「全站排名」是**假公式**（demo 效果考量），不是真的查詢排名。
- 加分站點的「+10 分」只是動畫效果，沒有真的加點數（前面提過）。
- `app/onboarding/` 整組頁面現在正常流程不會走到，只是舊版殘留的 fallback，可以留著但不用花時間維護。
- `data/station-highlights.json` 是用 `scripts/fetch-nearby-places.mjs`（吃 Google Places API）產生的，要重新抓資料要自己設 `GOOGLE_PLACES_API_KEY` 環境變數。

## Git 協作

- `master`：主線
- `teammate`：給隊友開發用的分支，目前跟 `master` 同步。改完記得開 PR 回 `master`：https://github.com/Kinoko1412/ecomiles-demo/pull/new/teammate
