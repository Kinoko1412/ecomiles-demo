export type ThemeRouteStop = {
  name: string;
  time: string;
  /** 從上一站累計到這一站的距離，起點為 0 */
  deltaKm: number;
};

export type RouteRewardCheckpoint = {
  /** 對應 stops 裡的站名，用來算這個獎勵點的累積里程/減碳量 */
  stopName: string;
  icon: string;
  reward: string;
  /** 有多選項的獎勵（例如終點可以選徽章或商家兌換券），有值就不用 reward 那個單一文字 */
  options?: string[];
};

export type ThemeRoute = {
  id: string;
  name: string;
  icon: string;
  mode: "bike" | "walk";
  totalDistanceKm: number;
  blurb: string;
  stops: ThemeRouteStop[];
  rewardCheckpoints: RouteRewardCheckpoint[];
  /** public/ 底下的示範行程靜態頁路徑，沒有的路線就不顯示示範行程按鈕 */
  demoHtmlPath?: string;
};

export const THEME_ROUTES: ThemeRoute[] = [
  {
    id: "theme-heritage-bike",
    name: "人文小旅行・自行車路線",
    icon: "🚲",
    mode: "bike",
    totalDistanceKm: 16.8,
    blurb: "從花蓮車站出發，串聯吉安人文與在地選物，適合半天悠閒騎乘",
    stops: [
      { name: "花蓮火車站", time: "09:00", deltaKm: 0 },
      { name: "吉安慶修院", time: "09:40", deltaKm: 5.6 },
      { name: "農業部花蓮區農業改良場", time: "10:20", deltaKm: 0.3 },
      { name: "淺草堂（花蓮門市）", time: "11:30", deltaKm: 5.0 },
      { name: "花蓮好物分享館", time: "12:30", deltaKm: 5.9 },
    ],
    rewardCheckpoints: [
      { stopName: "吉安慶修院", icon: "🎫", reward: "慶修院門票" },
      {
        stopName: "花蓮好物分享館",
        icon: "🎁",
        reward: "完賽獎勵",
        options: ["專屬徽章", "商家金額兌換券"],
      },
    ],
    demoHtmlPath: "/routes/低碳騎行demo.html",
  },
];

/** 單一遊程解鎖價（每條路線都適用同一個嚐鮮價） */
export const SINGLE_ROUTE_UNLOCK_PRICE_NT = 99;

/** Google Maps 多站導航連結：用站名組成 /dir/ 路徑，瀏覽器端自動 geocode，不需要 Maps API key */
export function buildGoogleMapsDirUrl(route: ThemeRoute): string {
  const segments = route.stops.map((s) => encodeURIComponent(s.name));
  return `https://www.google.com/maps/dir/${segments.join("/")}`;
}
