"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ACHIEVEMENTS,
  LOTTERY_COST_POINTS,
  LOTTERY_TIERS,
  REWARDS,
  STATIONS,
  type AchievementCode,
  type LotteryTier,
} from "@/lib/constants";
import { calcCarbonSavedKg } from "@/lib/carbon";
import { getLevelByDistance } from "@/lib/levels";
import { generateSeedRedemption, generateSeedRides, SEED_POINTS } from "@/lib/seedData";

const STORAGE_KEY = "ecomiles-state-v1";

export type RedemptionRecord = {
  id: string;
  rewardId: string;
  rewardName: string;
  code: string;
  pointsSpent: number;
  redeemedAt: string;
};

export type RideRecord = {
  id: string;
  timestamp: string;
  startStation: string;
  endStation: string;
  distanceKm: number;
  carbonSavedKg: number;
  earnedPoints: number;
};

type PersistedState = {
  nickname: string | null;
  totalDistanceKm: number;
  /** 累積減碳量（公斤）：只能在 completeRide 累加，任何兌換/抽獎/消費行為都不能修改這個欄位 */
  carbonSavedKg: number;
  points: number;
  rideCount: number;
  unlockedAchievements: AchievementCode[];
  rewardsStock: Record<string, number>;
  redemptions: RedemptionRecord[];
  visitedStations: string[];
  rides: RideRecord[];
};

function defaultState(): PersistedState {
  const rewardsStock: Record<string, number> = {};
  for (const r of REWARDS) rewardsStock[r.id] = r.initialStock;

  // Demo 用假歷史資料：只在第一次沒有 localStorage 資料時當作初始狀態，
  // 之後的真實操作一律走 completeRide/redeemReward/drawLottery 正常累加，
  // 這幾個 function 完全沒有引用這裡的任何東西。細節說明見 lib/seedData.ts。
  const seedRides = generateSeedRides();
  const seedRedemption = generateSeedRedemption();
  const seedDistanceKm = seedRides.reduce((sum, r) => sum + r.distanceKm, 0);
  const seedCarbonKg = seedRides.reduce((sum, r) => sum + r.carbonSavedKg, 0);
  const seedVisitedStations = Array.from(
    new Set(seedRides.flatMap((r) => [r.startStation, r.endStation]))
  );

  rewardsStock[seedRedemption.rewardId] = Math.max(
    0,
    (rewardsStock[seedRedemption.rewardId] ?? 0) - 1
  );

  return {
    nickname: null,
    totalDistanceKm: seedDistanceKm,
    carbonSavedKg: seedCarbonKg,
    points: SEED_POINTS,
    rideCount: seedRides.length,
    unlockedAchievements: ["first_ride", "carbon_1kg", "redeemed_once"],
    rewardsStock,
    redemptions: [seedRedemption],
    visitedStations: seedVisitedStations,
    rides: seedRides,
  };
}

export type CompleteRideResult = {
  distanceKm: number;
  carbonSavedKg: number;
  earnedPoints: number;
  leveledUp: boolean;
  newLevelName: string | null;
  newAchievements: AchievementCode[];
};

export type RedeemResult =
  | { success: true; code: string; newAchievements: AchievementCode[] }
  | { success: false; reason: "insufficient_points" | "out_of_stock" };

export type DrawLotteryResult =
  | {
      success: true;
      tier: LotteryTier;
      stockOut: boolean;
      prizeName: string | null;
      code: string | null;
      newAchievements: AchievementCode[];
    }
  | { success: false; reason: "insufficient_points" };

type AppContextValue = PersistedState & {
  hydrated: boolean;
  login: (nickname: string) => void;
  logout: () => void;
  completeRide: (
    distanceKm: number,
    startStation: string,
    endStation: string
  ) => CompleteRideResult;
  redeemReward: (rewardId: string) => RedeemResult;
  drawLottery: () => DrawLotteryResult;
};

const AppContext = createContext<AppContextValue | null>(null);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(defaultState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // 故意在首次掛載後才讀取 localStorage 並覆蓋 state：SSR 與初次 client render
    // 都必須輸出跟 defaultState() 一致的畫面，才不會有 hydration mismatch。
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({ ...defaultState(), ...parsed });
      }
    } catch {
      // localStorage 不可用或資料損毀，安靜使用預設狀態
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 忽略寫入失敗（例如無痕模式配額限制）
    }
  }, [state, hydrated]);

  const login = useCallback((nickname: string) => {
    setState((s) => ({ ...s, nickname }));
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...defaultState(), rewardsStock: s.rewardsStock }));
  }, []);

  const completeRide = useCallback(
    (distanceKm: number, startStation: string, endStation: string) => {
      let result: CompleteRideResult = {
        distanceKm,
        carbonSavedKg: 0,
        earnedPoints: 0,
        leveledUp: false,
        newLevelName: null,
        newAchievements: [],
      };

      setState((s) => {
        const carbonSavedKg = calcCarbonSavedKg(distanceKm);
        const earnedPoints = Math.floor(distanceKm); // 1 公里 = 1 環保點數
        const newTotalDistance = s.totalDistanceKm + distanceKm;
        const newTotalCarbon = s.carbonSavedKg + carbonSavedKg; // 只增不減：唯一寫入點
        const newRideCount = s.rideCount + 1;
        const newVisitedStations = Array.from(
          new Set([...s.visitedStations, startStation, endStation])
        );

        const oldLevel = getLevelByDistance(s.totalDistanceKm);
        const newLevel = getLevelByDistance(newTotalDistance);
        const leveledUp = newLevel.id !== oldLevel.id;

        const newlyUnlocked: AchievementCode[] = [];
        const has = (code: AchievementCode) =>
          s.unlockedAchievements.includes(code);

        if (!has("first_ride") && newRideCount >= 1) newlyUnlocked.push("first_ride");
        if (!has("distance_30") && newTotalDistance >= 30) newlyUnlocked.push("distance_30");
        if (!has("carbon_1kg") && newTotalCarbon >= 1) newlyUnlocked.push("carbon_1kg");
        if (!has("all_stations") && newVisitedStations.length >= STATIONS.length) {
          newlyUnlocked.push("all_stations");
        }

        const rideRecord: RideRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          startStation,
          endStation,
          distanceKm,
          carbonSavedKg,
          earnedPoints,
        };

        result = {
          distanceKm,
          carbonSavedKg,
          earnedPoints,
          leveledUp,
          newLevelName: leveledUp ? newLevel.name : null,
          newAchievements: newlyUnlocked,
        };

        return {
          ...s,
          totalDistanceKm: newTotalDistance,
          carbonSavedKg: newTotalCarbon,
          points: s.points + earnedPoints,
          rideCount: newRideCount,
          unlockedAchievements: [...s.unlockedAchievements, ...newlyUnlocked],
          visitedStations: newVisitedStations,
          rides: [rideRecord, ...s.rides],
        };
      });

      return result;
    },
    []
  );

  const redeemReward = useCallback((rewardId: string): RedeemResult => {
    const reward = REWARDS.find((r) => r.id === rewardId);
    if (!reward) return { success: false, reason: "out_of_stock" };

    let result: RedeemResult = { success: false, reason: "out_of_stock" };

    setState((s) => {
      const stock = s.rewardsStock[rewardId] ?? 0;
      if (stock <= 0) {
        result = { success: false, reason: "out_of_stock" };
        return s;
      }
      if (s.points < reward.cost) {
        result = { success: false, reason: "insufficient_points" };
        return s;
      }

      const code = generateCode();
      const record: RedemptionRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rewardId,
        rewardName: reward.name,
        code,
        pointsSpent: reward.cost,
        redeemedAt: new Date().toISOString(),
      };

      const newlyUnlocked: AchievementCode[] = [];
      if (!s.unlockedAchievements.includes("redeemed_once")) {
        newlyUnlocked.push("redeemed_once");
      }

      result = { success: true, code, newAchievements: newlyUnlocked };

      return {
        ...s,
        points: s.points - reward.cost,
        rewardsStock: { ...s.rewardsStock, [rewardId]: stock - 1 },
        redemptions: [record, ...s.redemptions],
        unlockedAchievements: [...s.unlockedAchievements, ...newlyUnlocked],
      };
    });

    return result;
  }, []);

  const drawLottery = useCallback((): DrawLotteryResult => {
    let result: DrawLotteryResult = { success: false, reason: "insufficient_points" };

    setState((s) => {
      if (s.points < LOTTERY_COST_POINTS) {
        result = { success: false, reason: "insufficient_points" };
        return s;
      }

      const roll = Math.random();
      let cumulative = 0;
      let tier: LotteryTier = "none";
      for (const t of LOTTERY_TIERS) {
        cumulative += t.probability;
        if (roll < cumulative) {
          tier = t.tier;
          break;
        }
      }

      const tierDef = LOTTERY_TIERS.find((t) => t.tier === tier)!;
      let stockOut = false;
      let prizeName: string | null = null;
      let code: string | null = null;
      let newRewardsStock = s.rewardsStock;
      let newRedemptions = s.redemptions;
      const newlyUnlocked: AchievementCode[] = [];

      if (tierDef.rewardId) {
        const reward = REWARDS.find((r) => r.id === tierDef.rewardId)!;
        const stock = s.rewardsStock[reward.id] ?? 0;
        if (stock <= 0) {
          stockOut = true;
        } else {
          prizeName = reward.name;
          code = generateCode();
          const record: RedemptionRecord = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            rewardId: reward.id,
            rewardName: reward.name,
            code,
            pointsSpent: LOTTERY_COST_POINTS,
            redeemedAt: new Date().toISOString(),
          };
          newRewardsStock = { ...s.rewardsStock, [reward.id]: stock - 1 };
          newRedemptions = [record, ...s.redemptions];
          if (!s.unlockedAchievements.includes("redeemed_once")) {
            newlyUnlocked.push("redeemed_once");
          }
        }
      }

      result = {
        success: true,
        tier: stockOut ? "none" : tier,
        stockOut,
        prizeName,
        code,
        newAchievements: newlyUnlocked,
      };

      return {
        ...s,
        points: s.points - LOTTERY_COST_POINTS,
        rewardsStock: newRewardsStock,
        redemptions: newRedemptions,
        unlockedAchievements: [...s.unlockedAchievements, ...newlyUnlocked],
      };
    });

    return result;
  }, []);

  const value: AppContextValue = {
    ...state,
    hydrated,
    login,
    logout,
    completeRide,
    redeemReward,
    drawLottery,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { ACHIEVEMENTS };
