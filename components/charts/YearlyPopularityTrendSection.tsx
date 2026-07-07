"use client";

import dynamic from "next/dynamic";
import photoYearlyTrend from "@/data/photo-yearly-trend.json";

// recharts 依賴瀏覽器的 ResizeObserver 等 API，build/SSR 階段的 Node 環境沒有這些東西，
// 一定要用 next/dynamic + ssr:false 讓它只在瀏覽器端載入，避免拖慢或卡住靜態預渲染。
// gov-dashboard/page.tsx 是 Server Component，不能直接在那裡用 ssr:false 的 dynamic()，
// 所以包在這個獨立的 "use client" 檔案裡，母頁面只需要單純 import 這個元件。
const YearlyPopularityTrendChart = dynamic(
  () => import("@/components/charts/YearlyPopularityTrendChart"),
  {
    ssr: false,
    loading: () => <div className="h-56 w-full animate-pulse rounded-xl bg-slate-100" />,
  }
);

export default function YearlyPopularityTrendSection() {
  return <YearlyPopularityTrendChart data={photoYearlyTrend} />;
}
