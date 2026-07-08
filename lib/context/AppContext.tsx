"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { LOTTERY_COST_POINTS, LOTTERY_TIERS, type AchievementCode, type LotteryTier } from "@/lib/constants";

export type RideRecord = {
  id: string;
  timestamp: string;
  startStation: string;
  endStation: string;
  distanceKm: number;
  carbonSavedKg: number;
  earnedPoints: number;
};

export type RedemptionRecord = {
  id: string;
  rewardId: string;
  rewardName: string;
  code: string;
  pointsSpent: number;
  redeemedAt: string;
};

export type RewardWithStock = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  blurb: string;
  lotteryOnly: boolean;
  stock: number;
};

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

export type DailyCheckinResult = {
  streakDays: number;
  pointsEarned: number;
  alreadyClaimedToday: boolean;
  newAchievements: AchievementCode[];
};

type ProfileState = {
  displayName: string | null;
  totalDistanceKm: number;
  carbonSavedKg: number;
  pointsBalance: number;
  rideCount: number;
  currentStreakDays: number;
};

function emptyProfile(): ProfileState {
  return {
    displayName: null,
    totalDistanceKm: 0,
    carbonSavedKg: 0,
    pointsBalance: 0,
    rideCount: 0,
    currentStreakDays: 0,
  };
}

// 把 Supabase Auth 回傳的英文錯誤訊息轉成中文提示，未命中的情況原樣顯示英文訊息當備援。
function mapAuthError(message: string, context: "signup" | "signin"): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "此 Email 已經被註冊過，請直接登入";
  }
  if (lower.includes("password") && (lower.includes("short") || lower.includes("6"))) {
    return "密碼至少需要 6 碼";
  }
  if (lower.includes("rate limit")) {
    return "寄送過於頻繁，請稍後再試";
  }
  if (context === "signin" && lower.includes("invalid login credentials")) {
    return "帳號或密碼錯誤";
  }
  if (lower.includes("token has expired") || lower.includes("invalid otp") || lower.includes("invalid token")) {
    return "驗證碼錯誤或已過期，請重新取得";
  }
  if (lower.includes("email not confirmed")) {
    return "此帳號尚未完成信箱驗證";
  }
  return message;
}

// Postgres 的 numeric 欄位透過 PostgREST 回來是字串（避免浮點數失真），
// 一律在這個檔案的邊界統一轉成 number，其他地方就不用再擔心型別。
type RideRow = {
  id: string;
  created_at: string;
  start_station: string;
  end_station: string;
  distance_km: string | number;
  carbon_saved_kg: string | number;
  earned_points: number;
};

type RedemptionRow = {
  id: string;
  reward_id: string;
  code: string;
  points_spent: number;
  redeemed_at: string;
  rewards: { name: string } | null;
};

type RewardWithStockRow = {
  id: string;
  name: string;
  icon: string;
  cost_points: number;
  blurb: string;
  lottery_only: boolean;
  current_stock: number;
};

type ProfileRow = {
  display_name: string | null;
  total_distance_km: string | number;
  carbon_saved_kg: string | number;
  points_balance: number;
  ride_count: number;
  current_streak_days: number;
};

type AppContextValue = {
  hydrated: boolean;
  loggedIn: boolean;
  nickname: string | null;
  totalDistanceKm: number;
  carbonSavedKg: number;
  points: number;
  rideCount: number;
  currentStreakDays: number;
  /** 這次登入/開啟 App 剛拿到的簽到獎勵，只在真的有新發放點數時才會有值，
   *  給 UI 跳一次性的 toast 用；顯示完呼叫 clearCheckinToast() 清掉，不然會一直顯示。 */
  checkinToast: DailyCheckinResult | null;
  clearCheckinToast: () => void;
  unlockedAchievements: AchievementCode[];
  rewards: RewardWithStock[];
  rewardsStock: Record<string, number>;
  redemptions: RedemptionRecord[];
  visitedStations: string[];
  rides: RideRecord[];
  sendSignupCode: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifySignupCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  completeSignupProfile: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  completeOnboarding: (displayName: string) => Promise<void>;
  completeRide: (
    distanceKm: number,
    startStation: string,
    endStation: string
  ) => Promise<CompleteRideResult>;
  redeemReward: (rewardId: string) => Promise<RedeemResult>;
  drawLottery: () => Promise<DrawLotteryResult>;
  recordPurchase: (
    kind: "single_route_unlock" | "subscription_standard",
    routeId: string | null,
    amountNT: number
  ) => Promise<{ success: boolean }>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState>(emptyProfile());
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<AchievementCode[]>([]);
  const [rewards, setRewards] = useState<RewardWithStock[]>([]);
  const [checkinToast, setCheckinToast] = useState<DailyCheckinResult | null>(null);

  const resetToLoggedOut = useCallback(() => {
    setUserId(null);
    setProfile(emptyProfile());
    setRides([]);
    setRedemptions([]);
    setUnlockedAchievements([]);
    setCheckinToast(null);
  }, []);

  const clearCheckinToast = useCallback(() => setCheckinToast(null), []);

  const loadAll = useCallback(
    async (uid: string) => {
      const [profileRes, ridesRes, redemptionsRes, achievementsRes, rewardsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle<ProfileRow>(),
        supabase
          .from("rides")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .returns<RideRow[]>(),
        supabase
          .from("redemptions")
          .select("id, reward_id, code, points_spent, redeemed_at, rewards(name)")
          .eq("user_id", uid)
          .order("redeemed_at", { ascending: false })
          .returns<RedemptionRow[]>(),
        supabase.from("user_achievements").select("achievement_code").eq("user_id", uid),
        supabase.from("rewards_with_stock").select("*").returns<RewardWithStockRow[]>(),
      ]);

      if (profileRes.data) {
        setProfile({
          displayName: profileRes.data.display_name,
          totalDistanceKm: Number(profileRes.data.total_distance_km),
          carbonSavedKg: Number(profileRes.data.carbon_saved_kg),
          pointsBalance: profileRes.data.points_balance,
          rideCount: profileRes.data.ride_count,
          currentStreakDays: profileRes.data.current_streak_days,
        });
      }

      if (ridesRes.data) {
        setRides(
          ridesRes.data.map((r) => ({
            id: r.id,
            timestamp: r.created_at,
            startStation: r.start_station,
            endStation: r.end_station,
            distanceKm: Number(r.distance_km),
            carbonSavedKg: Number(r.carbon_saved_kg),
            earnedPoints: r.earned_points,
          }))
        );
      }

      if (redemptionsRes.data) {
        setRedemptions(
          redemptionsRes.data.map((r) => ({
            id: r.id,
            rewardId: r.reward_id,
            rewardName: r.rewards?.name ?? r.reward_id,
            code: r.code,
            pointsSpent: r.points_spent,
            redeemedAt: r.redeemed_at,
          }))
        );
      }

      if (achievementsRes.data) {
        setUnlockedAchievements(
          achievementsRes.data.map((a) => a.achievement_code as AchievementCode)
        );
      }

      if (rewardsRes.data) {
        setRewards(
          rewardsRes.data.map((r) => ({
            id: r.id,
            name: r.name,
            icon: r.icon,
            cost: r.cost_points,
            blurb: r.blurb,
            lotteryOnly: r.lottery_only,
            stock: r.current_stock,
          }))
        );
      }
    },
    [supabase]
  );

  // 每次開啟 App／登入都呼叫一次；RPC 自己會判斷今天簽到過沒有，這裡不用先查
  // last_checkin_date 再決定要不要呼叫。只有真的發到新點數（沒有重複簽到）才跳 toast。
  const claimDailyCheckin = useCallback(async () => {
    const { data, error } = await supabase.rpc("claim_daily_checkin");
    if (error || !data) {
      console.warn("每日簽到失敗：", error?.message);
      return;
    }
    const result = data as unknown as DailyCheckinResult;

    setProfile((p) => ({
      ...p,
      currentStreakDays: result.streakDays,
      pointsBalance: p.pointsBalance + result.pointsEarned,
    }));
    if (result.newAchievements.length > 0) {
      setUnlockedAchievements((prev) => [...prev, ...result.newAchievements]);
    }
    if (!result.alreadyClaimedToday && result.pointsEarned > 0) {
      setCheckinToast(result);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;

      if (user) {
        setUserId(user.id);
        await loadAll(user.id);
        claimDailyCheckin();
      }
      setHydrated(true);
    }

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadAll(session.user.id).then(() => claimDailyCheckin());
      } else {
        resetToLoggedOut();
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, loadAll, resetToLoggedOut, claimDailyCheckin]);

  // 註冊第一步：寄出 6 位數驗證碼（沿用 Magic Link 樣板的 {{ .Token }}，不是點連結）。
  // 同一支函式也用來做「重新發送」。
  const sendSignupCode = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) return { success: false, error: mapAuthError(error.message, "signup") };
      return { success: true };
    },
    [supabase]
  );

  // 註冊第二步：驗證碼比對成功後直接建立 session（email 也一併視為已驗證），
  // 但這時候使用者還沒有設密碼、也還沒有使用者名稱。
  const verifySignupCode = useCallback(
    async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) return { success: false, error: mapAuthError(error.message, "signup") };
      return { success: true };
    },
    [supabase]
  );

  // 註冊第三步：驗證碼通過、已經有 session 之後，補上使用者名稱跟密碼。
  // display_name 用 update 不用 upsert：profiles 這筆列在 auth.users 建立時就由
  // trigger 自動產生了，upsert 的 insert 分支會撞到 RLS（沒有開放 insert policy）。
  const completeSignupProfile = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "尚未完成驗證，請重新操作" };

      const { error: authError } = await supabase.auth.updateUser({
        password,
        data: { username },
      });
      if (authError) return { success: false, error: mapAuthError(authError.message, "signup") };

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: username })
        .eq("id", userId);
      if (profileError) {
        if (profileError.code === "23505") {
          return { success: false, error: "此使用者名稱已經被使用，請換一個試試" };
        }
        return { success: false, error: profileError.message };
      }

      setProfile((p) => ({ ...p, displayName: username }));
      return { success: true };
    },
    [supabase, userId]
  );

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
      let email = identifier;
      if (!identifier.includes("@")) {
        const { data, error: rpcError } = await supabase.rpc("get_email_by_username", {
          p_username: identifier,
        });
        // RPC 本身失敗（例如資料庫還沒跑 0002 migration、function 不存在）跟「單純查無此使用者名稱」
        // 是兩種不同狀況，前者要讓開發者看得出來是設定沒做完，不能兩種都吃成同一句「帳號或密碼錯誤」。
        if (rpcError) {
          return { success: false, error: `登入功能異常，請確認資料庫已執行最新 migration（${rpcError.message}）` };
        }
        if (!data) return { success: false, error: "帳號或密碼錯誤" };
        email = data as string;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: mapAuthError(error.message, "signin") };
      return { success: true };
    },
    [supabase]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    resetToLoggedOut();
  }, [supabase, resetToLoggedOut]);

  const completeOnboarding = useCallback(
    async (displayName: string) => {
      if (!userId) throw new Error("not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      setProfile((p) => ({ ...p, displayName }));
    },
    [supabase, userId]
  );

  const completeRide = useCallback(
    async (distanceKm: number, startStation: string, endStation: string): Promise<CompleteRideResult> => {
      const { data, error } = await supabase.rpc("complete_ride", {
        p_start_station: startStation,
        p_end_station: endStation,
        p_distance_km: distanceKm,
      });
      if (error || !data) {
        throw new Error(error?.message ?? "complete_ride 失敗");
      }
      const result = data as unknown as CompleteRideResult;

      setProfile((p) => ({
        ...p,
        totalDistanceKm: p.totalDistanceKm + result.distanceKm,
        carbonSavedKg: p.carbonSavedKg + result.carbonSavedKg,
        pointsBalance: p.pointsBalance + result.earnedPoints,
        rideCount: p.rideCount + 1,
      }));
      setRides((prev) => [
        {
          id: `optimistic-${Date.now()}`,
          timestamp: new Date().toISOString(),
          startStation,
          endStation,
          distanceKm: result.distanceKm,
          carbonSavedKg: result.carbonSavedKg,
          earnedPoints: result.earnedPoints,
        },
        ...prev,
      ]);
      if (result.newAchievements.length > 0) {
        setUnlockedAchievements((prev) => [...prev, ...result.newAchievements]);
      }

      return result;
    },
    [supabase]
  );

  const redeemReward = useCallback(
    async (rewardId: string): Promise<RedeemResult> => {
      const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId });
      if (error || !data) {
        throw new Error(error?.message ?? "redeem_reward 失敗");
      }
      const result = data as unknown as RedeemResult;

      if (result.success) {
        const reward = rewards.find((r) => r.id === rewardId);
        setProfile((p) => ({ ...p, pointsBalance: p.pointsBalance - (reward?.cost ?? 0) }));
        setRewards((prev) =>
          prev.map((r) => (r.id === rewardId ? { ...r, stock: Math.max(0, r.stock - 1) } : r))
        );
        setRedemptions((prev) => [
          {
            id: `optimistic-${Date.now()}`,
            rewardId,
            rewardName: reward?.name ?? rewardId,
            code: result.code,
            pointsSpent: reward?.cost ?? 0,
            redeemedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        if (result.newAchievements.length > 0) {
          setUnlockedAchievements((prev) => [...prev, ...result.newAchievements]);
        }
      }

      return result;
    },
    [supabase, rewards]
  );

  const drawLottery = useCallback(async (): Promise<DrawLotteryResult> => {
    const { data, error } = await supabase.rpc("draw_lottery");
    if (error || !data) {
      throw new Error(error?.message ?? "draw_lottery 失敗");
    }
    const result = data as unknown as DrawLotteryResult;

    if (result.success) {
      setProfile((p) => ({ ...p, pointsBalance: p.pointsBalance - LOTTERY_COST_POINTS }));

      if (!result.stockOut && result.code) {
        const tierRewardId = LOTTERY_TIERS.find((t) => t.tier === result.tier)?.rewardId ?? null;
        if (tierRewardId) {
          setRewards((prev) =>
            prev.map((r) => (r.id === tierRewardId ? { ...r, stock: Math.max(0, r.stock - 1) } : r))
          );
          setRedemptions((prev) => [
            {
              id: `optimistic-${Date.now()}`,
              rewardId: tierRewardId,
              rewardName: result.prizeName ?? tierRewardId,
              code: result.code as string,
              pointsSpent: LOTTERY_COST_POINTS,
              redeemedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }

      if (result.newAchievements.length > 0) {
        setUnlockedAchievements((prev) => [...prev, ...result.newAchievements]);
      }
    }

    return result;
  }, [supabase]);

  const recordPurchase = useCallback(
    async (
      kind: "single_route_unlock" | "subscription_standard",
      routeId: string | null,
      amountNT: number
    ): Promise<{ success: boolean }> => {
      const { data, error } = await supabase.rpc("record_purchase", {
        p_kind: kind,
        p_route_id: routeId,
        p_amount_nt: amountNT,
      });
      if (error || !data) {
        throw new Error(error?.message ?? "record_purchase 失敗");
      }
      return data as unknown as { success: boolean };
    },
    [supabase]
  );

  const visitedStations = useMemo(
    () => Array.from(new Set(rides.flatMap((r) => [r.startStation, r.endStation]))),
    [rides]
  );

  const rewardsStock = useMemo(
    () => Object.fromEntries(rewards.map((r) => [r.id, r.stock])),
    [rewards]
  );

  const value: AppContextValue = {
    hydrated,
    loggedIn: userId !== null,
    nickname: profile.displayName,
    totalDistanceKm: profile.totalDistanceKm,
    carbonSavedKg: profile.carbonSavedKg,
    points: profile.pointsBalance,
    rideCount: profile.rideCount,
    currentStreakDays: profile.currentStreakDays,
    checkinToast,
    clearCheckinToast,
    unlockedAchievements,
    rewards,
    rewardsStock,
    redemptions,
    visitedStations,
    rides,
    sendSignupCode,
    verifySignupCode,
    completeSignupProfile,
    signIn,
    logout,
    completeOnboarding,
    completeRide,
    redeemReward,
    drawLottery,
    recordPurchase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
