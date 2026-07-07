export type ThemeRouteStop = {
  name: string;
  time: string;
  /** 從上一站累計到這一站的距離，起點為 0 */
  deltaKm: number;
};

export type ThemeRoute = {
  id: string;
  name: string;
  icon: string;
  mode: "bike" | "walk";
  totalDistanceKm: number;
  blurb: string;
  stops: ThemeRouteStop[];
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
  },
];

/** Google Maps 多站導航連結：用站名組成 /dir/ 路徑，瀏覽器端自動 geocode，不需要 Maps API key */
export function buildGoogleMapsDirUrl(route: ThemeRoute): string {
  const segments = route.stops.map((s) => encodeURIComponent(s.name));
  return `https://www.google.com/maps/dir/${segments.join("/")}`;
}
