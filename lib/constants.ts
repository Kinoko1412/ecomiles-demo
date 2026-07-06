export const STATIONS = [
  "朝金定置漁場",
  "七星潭風景區",
  "農好基地/四八高地",
  "花蓮酒廠",
  "奇萊鼻燈塔",
  "花蓮港觀光遊憩碼頭",
  "花蓮港景觀橋",
  "太平洋公園",
  "吉安火車站",
  "吉安慶修院",
  "吉安農會",
  "干城綠色廊道",
  "鯉魚潭遊客中心",
  "白鮑溪沿線",
] as const;

export type Level = {
  id: string;
  name: string;
  minKm: number;
  icon: string;
  color: string;
};

export const LEVELS: Level[] = [
  { id: "novice", name: "新手騎士", minKm: 0, icon: "🚲", color: "#22c55e" },
  { id: "advanced", name: "進階騎士", minKm: 20, icon: "🚵", color: "#0ea5e9" },
  { id: "senior", name: "資深騎士", minKm: 50, icon: "🏅", color: "#6366f1" },
  { id: "master", name: "花蓮騎旅大師", minKm: 100, icon: "👑", color: "#f59e0b" },
];

export type AchievementCode =
  | "first_ride"
  | "distance_30"
  | "carbon_1kg"
  | "redeemed_once";

export type AchievementDef = {
  code: AchievementCode;
  name: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_ride", name: "首次騎乘", description: "完成你的第一趟騎乘", icon: "🎉" },
  { code: "distance_30", name: "累積30公里", description: "累積騎乘里程達 30 公里", icon: "📏" },
  { code: "carbon_1kg", name: "累積減碳1公斤", description: "累積減碳量達 1 公斤", icon: "🌱" },
  { code: "redeemed_once", name: "首次兌換", description: "完成第一次獎品兌換", icon: "🎁" },
];

export type RewardDef = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  initialStock: number;
};

export const REWARDS: RewardDef[] = [
  { id: "r1", name: "花蓮特色悠遊卡貼", icon: "🎫", cost: 50, initialStock: 10 },
  { id: "r2", name: "環保購物袋", icon: "🛍️", cost: 80, initialStock: 8 },
  { id: "r3", name: "單車維修兌換券", icon: "🔧", cost: 150, initialStock: 5 },
  { id: "r4", name: "花蓮特產禮盒", icon: "🎁", cost: 300, initialStock: 3 },
];
