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
  REWARDS,
  STATIONS,
  type AchievementCode,
} from "@/lib/constants";
import { calcCarbonSavedKg } from "@/lib/carbon";
import { getLevelByDistance } from "@/lib/levels";

const STORAGE_KEY = "ecomiles-state-v1";

export type RedemptionRecord = {
  id: string;
  rewardId: string;
  rewardName: string;
  code: string;
  pointsSpent: number;
  redeemedAt: string;
};

type PersistedState = {
  nickname: string | null;
  totalDistanceKm: number;
  totalCarbonKg: number;
  points: number;
  rideCount: number;
  unlockedAchievements: AchievementCode[];
  rewardsStock: Record<string, number>;
  redemptions: RedemptionRecord[];
  visitedStations: string[];
};

function defaultState(): PersistedState {
  const rewardsStock: Record<string, number> = {};
  for (const r of REWARDS) rewardsStock[r.id] = r.initialStock;
  return {
    nickname: null,
    totalDistanceKm: 0,
    totalCarbonKg: 0,
    points: 0,
    rideCount: 0,
    unlockedAchievements: [],
    rewardsStock,
    redemptions: [],
    visitedStations: [],
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
        const newTotalCarbon = s.totalCarbonKg + carbonSavedKg;
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
          totalCarbonKg: newTotalCarbon,
          points: s.points + earnedPoints,
          rideCount: newRideCount,
          unlockedAchievements: [...s.unlockedAchievements, ...newlyUnlocked],
          visitedStations: newVisitedStations,
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

  const value: AppContextValue = {
    ...state,
    hydrated,
    login,
    logout,
    completeRide,
    redeemReward,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { ACHIEVEMENTS };
