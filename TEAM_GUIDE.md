# Ecomiles 專案導覽

給協作隊友看的完整說明：這是什麼、怎麼跑起來、程式碼怎麼分佈、目前流程走到哪、還有哪些坑。

**這份文件是 2026-07-07 這次交接時整理的**，如果你（接手的人）改了什麼跟這裡寫的對不上，麻煩順手更新這份檔案，不要讓它跟 TEAM_GUIDE 之前一樣放到過期。

## 這是什麼

花蓮縣自行車道共享服務的減碳兌換網站 demo。使用者從 14 個站點之一出發、騎乘後在任一站點還車，系統記錄里程、計算減碳量，用點數兌換獎品，還有等級曲線、每日簽到、AI 導覽員、即時天氣。詳細背景與資料庫欄位設計理念看根目錄的 `CLAUDE.md`。

## 技術棧

- **Next.js 16（App Router）+ TypeScript**（不是純 JS，全部檔案是 `.tsx`/`.ts`）
- **Tailwind CSS v4**
- **Supabase**：Postgres 資料庫、Auth、RLS、SECURITY DEFINER RPC
- **Mapbox GL JS**：騎乘導航地圖（含 3D 建物、pitch/bearing 跟隨鏡頭）
- **DeepSeek API**（OpenAI SDK 相容介面）：AI 導覽員
- **中央氣象署開放資料平台**：天氣卡片
- 部署在 **Vercel**（push 到 GitHub 會自動觸發部署）

## 怎麼跑起來

```bash
npm install
npm run dev      # http://localhost:3000
```

需要根目錄有 `.env.local`（沒有 commit 到 git，跟負責這些帳號的人要）：

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...
DEEPSEEK_API_KEY=...          # AI 導覽員用
CWA_API_KEY=...               # 天氣卡片用，中央氣象署開放資料平台
```

**Vercel 上要記得手動加這 5 個環境變數**（Vercel 專案設定 → Environment Variables）；本機 `.env.local` 不會自動同步過去。截至這次交接，我不確定 `DEEPSEEK_API_KEY` 跟 `CWA_API_KEY` 有沒有加到 Vercel，麻煩確認一下正式站的 AI 導覽員／天氣卡片是不是正常運作。

其他常用指令：

```bash
npm run build     # production build，push 前建議先跑一次確認過
npm run lint       # eslint
npx tsc --noEmit   # 型別檢查
```

還有一個可選的環境變數，demo 前 3D 導航如果出狀況可以救急用：

```
NEXT_PUBLIC_DISABLE_3D_NAV=1   # 強制整個 3D 導航退回平面俯視版本
```

## 資料層架構：`lib/context/AppContext.tsx`

整個 app 的資料都不是頁面自己直接呼叫 Supabase，而是透過 `useApp()` 這個 hook 拿：

```tsx
const { nickname, totalDistanceKm, points, currentStreakDays, completeRide, ... } = useApp();
```

`AppContext.tsx` 內部負責：
- 管理登入狀態（`onAuthStateChange` 監聽 session）
- 掛載時一次查完 profile / rides / redemptions / achievements / rewards
- 把所有寫入操作（完成騎乘、兌換、抽獎、每日簽到）包成呼叫 Supabase RPC，RPC 回傳結果後**樂觀更新本地 state**（不整頁重新查詢，維持「馬上看到結果」的體感）
- 登入成功／App 開啟時自動呼叫 `claim_daily_checkin()` RPC，不需要使用者手動觸發簽到

改資料相關邏輯幾乎都只需要動這一個檔案，頁面本身不太需要碰 Supabase client。

## 頁面路由

| 路徑 | 說明 |
|---|---|
| `/` | 首頁：天氣卡片、簽到徽章、選出發/目的站 → GO → 全螢幕 3D 沉浸式導航（Mapbox 地圖、3D 建物、鏡頭跟隨方向、即時時速、里程、加分站點） → 結算彈窗 |
| `/route` | 路線分頁：海線/山線切換的縱向時間軸，展開每站可看附近加分店家（含照片輪播）跟人氣徽章 |
| `/login` | 登入／註冊（tab 切換） |
| `/onboarding` | 舊流程的補暱稱頁面，目前只當 fallback（正常註冊流程不會走到這裡） |
| `/profile` | 個人頁面：等級（20 級曲線）、下一級進度條、簽到徽章、成就、集點站徽章、兌換紀錄 |
| `/profile/history` | 減碳存摺：累積數據 count-up 動畫、模擬全站排名、recharts 圖表 |
| `/redeem` | 兌換頁：用點數換獎品 |
| `/redeem/lottery` | 抽獎頁 |
| `/gov-dashboard` | 政府端全站統計儀表板，**沒有底部導覽列**，只能直接打網址進去，無登入門檻，含年度人氣趨勢圖 |
| `/auth/callback` | Route Handler，處理信箱驗證連結（備援用，主要流程走輸入驗證碼，見下） |
| `/api/assistant` | Route Handler，AI 導覽員後端（呼叫 DeepSeek） |
| `/api/weather` | Route Handler，天氣卡片後端（呼叫 CWA，含本地快取 fallback） |

底部導覽列固定四個分頁：首頁／路線／兌換／個人（`components/BottomNav.tsx`）。`(shell)` 這個資料夾群組共用 `app/(shell)/layout.tsx`，會先確認登入、確認 profile 有 display_name，否則導去 `/login` 或 `/onboarding`；同一個 layout 也掛了全站浮動的 AI 導覽員按鈕（`AiGuideFab`）跟每日簽到獎勵 toast（`DailyCheckinToast`）。

## 登入／註冊流程

**這個專案沒有用 Supabase 內建的 email 連結點擊確認流程**，因為那個流程在「連結跟送出請求不同瀏覽器/裝置打開」時會失敗（PKCE code_verifier 對不起來）。改成全程用「輸入驗證碼」：

1. **輸入 email**，按「取得驗證碼」→ 呼叫 `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
2. **輸入信件裡的驗證碼**（Supabase 目前寄的是 8 碼，不是官方文件常說的 6 碼）→ 呼叫 `supabase.auth.verifyOtp({ email, token, type: "email" })`，驗證成功就直接建立 session（此時已經算登入，但還沒有密碼、沒有使用者名稱）
3. **設定使用者名稱＋密碼** → 呼叫 `supabase.auth.updateUser({ password, data: { username } })` 設密碼，再 `update` `profiles.display_name`

登入則是「使用者名稱或 Email + 密碼」二選一輸入：如果輸入的字串不含 `@`，會先呼叫 `get_email_by_username` 這個 RPC 查出對應 email，再用 `signInWithPassword`。

**重要**：Supabase 寄信用的範本會依「這個 email 是不是全新帳號」而不同——全新帳號寄的是 **Confirm signup** 範本，同一個 email 之後再收會用 **Magic Link** 範本。兩個範本都要在 Supabase Dashboard → Authentication → Email Templates 裡確認內容含有 `{{ .Token }}`，不然信裡只有連結、沒有驗證碼可以打。

## 騎乘／地圖流程（3D 沉浸式導航）

- `app/(shell)/page.tsx` 是唯一有騎乘邏輯的頁面。選好出發站+目的站按 GO 後，畫面整個變成 `fixed inset-0` 的全螢幕 3D 導航（蓋掉底部導覽列跟 AI 導覽員按鈕，z-index 分層見檔案內註解），結束騎乘才恢復正常版面。
- 地圖元件是 `components/map/RideMapInner.tsx`：`pitch:60`、Mapbox Streets 內建 3D 建物圖層（只在花蓮/吉安市區才有量體，海岸/鄉間沒有是預期內的）、鏡頭跟著使用者方向即時旋轉（`lib/heading.ts` 的 `computeBearing`/`smoothBearing`）、使用者標記固定在畫面偏下方（`padding.top`，**方向已經用無頭瀏覽器實測驗證過**，別直覺以為要用 `padding.bottom`）、路線是雙層 line（寬+模糊的光暈 + 窄的核心線）。透過 `next/dynamic(..., { ssr:false })` 載入（mapbox-gl 會摸 `window`，SSR 環境會壞掉，這條規則對任何瀏覽器限定套件都適用，recharts 圖表也是同樣處理）。
  - **重要 gotcha**：`map.easeTo()` 的動畫時長是動態算出來的（量測實際座標更新間隔 × 0.85，夾在 150~900ms），不是固定值——固定值在快速模擬那種高頻更新下會被連續打斷，鏡頭永遠追不上實際方向。如果之後要改動畫時長，記得這個機制存在。
  - 效能保底：連續兩次 easeTo 轉場延遲過久會自動降級回平面俯視、關掉 3D 建物圖層。`NEXT_PUBLIC_DISABLE_3D_NAV=1` 可以整個強制關閉。
- **路線幾何來源**依優先序：海線（朝金定置漁場~太平洋公園）先試 `data/official-coastal-route.json`（TDX 官方實測軌跡）、山線（吉安火車站~白鮑溪沿線）先試 `data/official-jian-route.json`（TDX 官方路廊，精度較低，UI 會用淡橘色虛線+小提示標示），兩者都涵蓋不到才 fallback 呼叫 Mapbox Directions API（`lib/directions.ts`）。
- **快速模擬（demo 用）現在是真實 25km/h 均速**，不是壓縮過的節奏——距離長的路線就是要跑比較久（海線全段約 23 分鐘、山線全段約 43 分鐘）。按鈕在模擬進行中會變成「跳過，直接完成」，點下去直接用路線真實總距離結算。
- **加分站點**資料來自 `data/station-highlights.json`（14 站、每站最多 5 筆附近店家/景點），由 `lib/stationHighlights.ts` 篩選（排除住宿類、每站最多留 3 筆、優先景點餐飲類）。**這個 JSON 的站名文字跟 `lib/constants.ts` 的 `STATIONS` 陣列不完全一樣**（例如「花蓮港景觀橋」vs「花蓮港東景觀橋」，且部分商家名稱是英文，例如 "Qixingtan Scenic Area"），所以兩邊是用**陣列順序位置**對應，不是用字串比對站名，改動任一邊的順序要小心。首頁「下一站」橫幅要顯示中文站名時，記得用 `RideHighlight.stationLabel`（起訖站的正確中文站名），不要用 `.name`（那是商家名稱，語系不保證是中文）。
- 即時時速：優先用 GPS 回傳的 `coords.speed`，沒有的話（或「快速模擬」模式）用最近兩次座標的距離／時間換算，並做指數移動平均降低跳動感。
- 抵達加分站點（Haversine 距離 80 公尺內）會觸發一次性的「🌟 抵達 XXX！」提示——**這只是畫面效果，沒有真的加點數**，帳號的 `points` 欄位只由 `complete_ride` RPC 依里程算（`floor(distance_km)`）。騎乘中底部卡片顯示的「本趟點數」是即時里程的 `floor()`，跟這個公式一致，方便使用者對得起來。

## AI 導覽員

全站浮動按鈕（`components/AiGuideFab.tsx`），點開是滿版 Messenger/IG 風格聊天視窗（`components/AiGuideChat.tsx`）。後端 `app/api/assistant/route.ts` 呼叫 DeepSeek（`baseURL: "https://api.deepseek.com"`，model 是 `"deepseek-v4-flash"`，**不是** `"deepseek-chat"`），背景資料由 `lib/assistantData.ts` 組裝（本月人氣排行、使用者最近的站、隱藏熱點、推薦商家、`lib/routeScoring.ts` 算出的路線推薦），system prompt 嚴格要求「只能根據提供的資料回答，禁止捏造」。

## 天氣卡片

`components/WeatherCard.tsx` 顯示在首頁，打 `/api/weather` 這支 Route Handler（`lib/weather.ts` 需要讀寫本地檔案快取，只能在伺服器端跑，這是為什麼要包一層 API route 而不是 client 直接呼叫）。資料來源中央氣象署開放資料 `F-D0047-041`，用「花蓮市」當代表點。**CWA 回傳的風速單位是公尺/秒，已經在 `lib/weather.ts` 轉成 km/h**，UI 的 30km/h 風勢警示門檻才比得對。

快取寫在 `data/.cache/weather.json`（已 gitignore），API 失敗就退回讀這個檔案，都沒有才顯示「天氣資訊暫時無法取得」。**這個快取機制是為本機 demo 設計的**——Vercel 的 serverless function 檔案系統唯讀（`/tmp` 除外），部署上去之後快取寫入會靜默失敗，不會讓功能掛掉，但「API 掛掉時還有備援資料」這件事在 Vercel 正式環境不會真的生效，之後要做到位需要換成 Vercel KV 之類的外部儲存。

## 每日簽到 + 20 級曲線

- `claim_daily_checkin()` RPC（見下方 migration `0003`）：連續簽到天數 1~2/3~6/7~13/14+ 天分別發 1/2/3/4 點，連續 7 天/30 天達成一次性成就獎勵（+10/+50 點）。用台北時區判斷「今天」，同一天呼叫不會重複發放。
- 前端 `AppContext` 在登入/App 開啟時自動呼叫這支 RPC，不需要使用者手動點按鈕。真的有新發放點數才會跳 toast（`components/DailyCheckinToast.tsx`）。
- `lib/constants.ts` 的 `LEVELS` 是 20 級（新手 Lv1~5：0~25km，級距 3~10；進階 Lv6~14：40~340km，級距 20~55；大師 Lv15~20：420~1300km，級距 100~300），`lib/levels.ts` 的查找邏輯本身是迴圈跑陣列，改級數不用動這支檔案。

## Supabase 資料庫

Migration 檔案都在 `supabase/migrations/`，**需要手動貼到 Supabase Dashboard 的 SQL Editor 執行**（沒有接 CLI，只有 anon key）：

- `0001_init.sql`：完整 schema（`profiles`/`stations`/`levels`/`achievements`/`rewards`/`redemption_codes`/`redemptions`/`rides`）、RLS 規則、種子資料、`complete_ride`/`redeem_reward`/`draw_lottery`/`get_global_stats` 這四個 SECURITY DEFINER RPC。
- `0002_reset_and_username_login.sql`：清空所有使用者資料（含 `auth.users` 本身）、`profiles.display_name` 加唯一限制、新增 `get_email_by_username` RPC。
- `0003_streak_and_levels.sql`：**這份目前還沒確認有沒有貼上去執行過**，麻煩交接時確認一下。新增 `profiles.current_streak_days`/`last_checkin_date`、把 `levels` 表整批換成 20 筆、新增 `streak_7`/`streak_30` 成就、新增 `claim_daily_checkin()` RPC。

**這三份都寫成可以重複執行不會壞**（drop-then-create / `create or replace` / `if not exists`），要重置測試環境可以直接重貼執行，但 `0002` 會清空所有使用者資料，`0003` 會清空重灌 `levels` 表，動手前想清楚。

碳排係數 `0.0508`（kgCO2e/km）刻意在 `lib/carbon.ts`（前端預覽用）跟 `complete_ride` RPC（後端權威計算）各寫一份、互相註解對照——這是唯一允許重複寫死數字的例外，因為這個係數需要同時存在前後端。

## 開發用驗證腳本

`scripts/dev-tests/` 底下是一批用 `npx tsx` 直接跑的手動驗證腳本（不是 Jest/Vitest 那種自動化測試），涵蓋官方路線裁切、路線推薦演算法、天氣快取 fallback、每日簽到的分支邏輯。改到對應的 `lib/` 檔案時可以先跑這些腳本確認邏輯沒壞：

```bash
npx tsx scripts/dev-tests/test-official-routes.mts
npx tsx scripts/dev-tests/test-route-scoring.mts
npx tsx scripts/dev-tests/test-weather.mts
npx tsx scripts/dev-tests/test-weather-fallback.mts
npx tsx scripts/dev-tests/test-daily-checkin-logic.mts
```

## 目前已知的權宜/待辦

- **`0003_streak_and_levels.sql` 可能還沒貼到 Supabase 執行**——見上方 Supabase 資料庫章節，這是目前最優先要確認的事。
- **Vercel 環境變數要確認 `DEEPSEEK_API_KEY`、`CWA_API_KEY` 有沒有補上**，不然正式站的 AI 導覽員跟天氣卡片會失效（但不會讓整站掛掉，只是那兩個功能顯示不出來）。
- `/gov-dashboard` 才可以用「碳權」這個詞，其他所有使用者頁面只能說「里程」「環保點數」「減碳量」。
- 減碳存摺頁的「全站排名」是**假公式**（demo 效果考量），不是真的查詢排名。
- `app/onboarding/` 整組頁面現在正常流程不會走到，只是舊版殘留的 fallback，可以留著但不用花時間維護。
- `data/station-highlights.json` 是用 `scripts/fetch-nearby-places.mjs`（吃 Google Places API）產生的，要重新抓資料要自己設 `GOOGLE_PLACES_API_KEY` 環境變數。
- 根目錄 `tdx_gpx/` 資料夾（一批原始 TDX GPX 檔案，應該是 `official-coastal-route.json`/`official-jian-route.json` 的來源資料）已經進版本控制，但沒人確認過它之後還有沒有用途，先留著。
- 天氣快取 fallback 機制在 Vercel 上不會真的生效（見上方天氣卡片章節），只在本機 demo 有意義。

## Git 協作

- `master`：主線
- `teammate`：給隊友開發用的分支，目前跟 `master` 同步（每次 push master 後都會 `git push origin master:teammate`）。改完記得開 PR 回 `master`：https://github.com/Kinoko1412/ecomiles-demo/pull/new/teammate
