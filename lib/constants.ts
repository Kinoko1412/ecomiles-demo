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
  | "redeemed_once"
  | "all_stations";

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
  { code: "all_stations", name: "山海一線制霸", description: "造訪全部 14 個站點", icon: "🏆" },
];

export type RewardDef = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  initialStock: number;
  /** 一句簡短描述；永續好禮用來說明低碳/環保屬性，一般商店品項則是單純的兌換說明 */
  blurb: string;
  /** 只透過抽獎取得，不會出現在「直接兌換」的獎品格子裡 */
  lotteryOnly?: boolean;
};

/** 永續好禮：兌換頁主要獎品分類，皆為低碳/環保屬性商品 */
export const REWARDS: RewardDef[] = [
  {
    id: "r1",
    name: "環保帆布袋",
    icon: "🛍️",
    cost: 30,
    initialStock: 10,
    blurb: "取代一次性塑膠袋，出門購物更環保",
  },
  {
    id: "r2",
    name: "環保餐具組",
    icon: "🍴",
    cost: 50,
    initialStock: 8,
    blurb: "隨身攜帶，減少免洗餐具與外帶垃圾",
  },
  {
    id: "r3",
    name: "在地店家抵用券",
    icon: "🎫",
    cost: 80,
    initialStock: 6,
    blurb: "支持花蓮在地店家消費，減少長途運輸的隱藏碳足跡",
  },
  {
    id: "r4",
    name: "合作店家咖啡券",
    icon: "☕",
    cost: 100,
    initialStock: 5,
    blurb: "以在地咖啡取代連鎖飲料，支持在地小店",
  },
  {
    id: "r5",
    name: "電輔車體驗券",
    icon: "⚡",
    cost: 300,
    initialStock: 2,
    blurb: "體驗電輔騎乘取代機車代步，親身感受低碳移動",
  },
  {
    id: "r6",
    name: "商店抵用券",
    icon: "💳",
    cost: 100,
    initialStock: 10,
    blurb: "消費現折 NT$50，全站商品都可折抵",
  },
  {
    id: "r7",
    name: "花蓮騎旅貼紙",
    icon: "✨",
    cost: 20,
    initialStock: 20,
    blurb: "抽獎限定小禮",
    lotteryOnly: true,
  },
];

export const LOTTERY_COST_POINTS = 15;

export type LotteryTier = "none" | "small" | "medium" | "grand";

export const LOTTERY_TIERS: {
  tier: LotteryTier;
  label: string;
  probability: number;
  rewardId: string | null;
}[] = [
  { tier: "none", label: "銘謝惠顧", probability: 0.5, rewardId: null },
  { tier: "small", label: "小獎", probability: 0.3, rewardId: "r7" },
  { tier: "medium", label: "中獎", probability: 0.15, rewardId: "r1" },
  { tier: "grand", label: "大獎", probability: 0.05, rewardId: "r5" },
];
