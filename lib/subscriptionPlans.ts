export type SubscriptionPlan = {
  id: "standard" | "premium";
  name: string;
  priceNT: number;
  badge?: string;
  perks: string[];
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "standard",
    name: "低碳玩家方案",
    priceNT: 199,
    perks: [
      "訂閱期間解鎖所有主題路線",
      "點數加成、優先兌換資格",
      "低碳挑戰賽專屬排行榜",
    ],
  },
  {
    id: "premium",
    name: "減碳環保超人方案",
    priceNT: 399,
    badge: "減碳環保超人",
    perks: [
      "包含低碳玩家方案所有內容",
      "AI 自訂規劃行程",
      "專屬稱號：減碳環保超人",
    ],
  },
];
