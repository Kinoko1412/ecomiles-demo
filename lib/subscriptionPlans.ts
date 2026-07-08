export type SubscriptionPlan = {
  id: "standard";
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
];
