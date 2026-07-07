import { STATIONS } from "@/lib/constants";
import { calcCarbonSavedKg } from "@/lib/carbon";
import type { RideRecord, RedemptionRecord } from "@/lib/context/AppContext";

/**
 * Demo 用的假歷史資料：只在使用者第一次打開 app（localStorage 還沒有任何資料）時
 * 當作初始狀態灌進去，之後的騎乘/兌換/抽獎都走正常流程累加，不會被這裡的資料覆蓋或影響。
 *
 * 刻意的設計：
 * - 只覆蓋 8 個「海線」站點，保留 6 個「山線」站點沒去過，讓「山海一線制霸」成就維持鎖定。
 * - 總里程刻意壓在 30 公里以下、且離 30 只差 1.5 公里左右（落在「進階騎士」20~40km 區間），
 *   讓「累積30公里」成就維持鎖定，同時保證「快速模擬」最小的隨機里程（2km）也一定會跨過
 *   30 公里門檻，demo 時按一次就能穩定觸發解鎖動畫給評審看，不用看運氣重按。
 * - 減碳量隨里程自然超過 1 公斤，所以「累積減碳1公斤」成就會直接解鎖。
 */

type SeedRideInput = {
  /**
   * 這個月批次裡的「新舊排名」，0 = 這個月最舊的一筆，CURRENT_MONTH_RIDE_COUNT - 1 = 最接近今天。
   * 實際日期會依「今天是這個月第幾天」等比例回推，不用固定天數，避免月初 demo 時
   * 好幾筆日期被「不能跨到上個月」的保護機制夾到同一天。
   */
  recencyRank?: number;
  /** 或者直接指定「上個月」的第幾天，用來製造跨月比較的資料 */
  previousMonthDay?: number;
  startStation: string;
  endStation: string;
  distanceKm: number;
};

const CURRENT_MONTH_RIDE_COUNT = 7;

const SEED_RIDES_INPUT: SeedRideInput[] = [
  { previousMonthDay: 15, startStation: STATIONS[0], endStation: STATIONS[1], distanceKm: 3.2 },
  { previousMonthDay: 20, startStation: STATIONS[1], endStation: STATIONS[2], distanceKm: 2.6 },
  { recencyRank: 0, startStation: STATIONS[2], endStation: STATIONS[3], distanceKm: 5.5 },
  { recencyRank: 1, startStation: STATIONS[3], endStation: STATIONS[4], distanceKm: 2.3 },
  { recencyRank: 2, startStation: STATIONS[4], endStation: STATIONS[5], distanceKm: 3.8 },
  { recencyRank: 3, startStation: STATIONS[5], endStation: STATIONS[6], distanceKm: 2.1 },
  { recencyRank: 4, startStation: STATIONS[6], endStation: STATIONS[7], distanceKm: 3.4 },
  { recencyRank: 5, startStation: STATIONS[7], endStation: STATIONS[0], distanceKm: 2.7 },
  { recencyRank: 6, startStation: STATIONS[0], endStation: STATIONS[2], distanceKm: 2.9 },
];

/** 已經預先兌換過的一筆紀錄，讓個人頁面的兌換紀錄一開始不是空的 */
const SEED_REDEMPTION_DAYS_AGO = 10;
const SEED_REDEMPTION_REWARD_ID = "r1";
const SEED_REDEMPTION_REWARD_NAME = "環保帆布袋";
const SEED_REDEMPTION_COST = 30;

/**
 * 這裡的 points 是獨立設定的示範值，不是嚴格從 SEED_RIDES_INPUT 加總後再扣掉
 * SEED_REDEMPTION_COST 算出來的——因為只要總里程維持在 30 公里以下（刻意保留
 * 「累積30公里」成就鎖定），逐趟騎乘用 Math.floor(distanceKm) 算出來的點數總和
 * 數學上不可能達到 30 點（sum(floor(xi)) <= floor(sum(xi)) < 30），
 * 不足以負擔任何一項最低 30 點的獎品。點數欄位本來就是獨立維護的計數器，
 * 不會有任何畫面把「歷史騎乘點數總和」跟「目前點數餘額」放在一起比對，
 * 所以這裡直接給一個示範用的餘額，讓 demo 當下還能繼續兌換/抽獎。
 */
const SEED_POINTS_BALANCE = 40;

function resolveTimestamp(now: Date, input: SeedRideInput): Date {
  if (input.previousMonthDay !== undefined) {
    return new Date(now.getFullYear(), now.getMonth() - 1, input.previousMonthDay, 9, 30);
  }

  const rank = input.recencyRank ?? 0;
  // 這個月「今天以前」實際可用的天數（至少留 1 天，避免今天是 1 號時整批擠在同一天）
  const availableDays = Math.max(1, now.getDate() - 1);
  const daysAgo = Math.max(
    1,
    Math.round(availableDays * (1 - rank / (CURRENT_MONTH_RIDE_COUNT - 1)))
  );
  const day = Math.max(1, now.getDate() - daysAgo);
  return new Date(now.getFullYear(), now.getMonth(), day, 8, 15);
}

export function generateSeedRides(now: Date = new Date()): RideRecord[] {
  const rides = SEED_RIDES_INPUT.map((input, i) => ({
    id: `seed-ride-${i}`,
    timestamp: resolveTimestamp(now, input).toISOString(),
    startStation: input.startStation,
    endStation: input.endStation,
    distanceKm: input.distanceKm,
    carbonSavedKg: calcCarbonSavedKg(input.distanceKm),
    earnedPoints: Math.floor(input.distanceKm),
  }));

  // 跟 completeRide 寫入時「新的塞在最前面」的慣例一致
  return rides.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateSeedRedemption(now: Date = new Date()): RedemptionRecord {
  const redeemedAt = new Date(now);
  redeemedAt.setDate(redeemedAt.getDate() - SEED_REDEMPTION_DAYS_AGO);
  return {
    id: "seed-redemption-0",
    rewardId: SEED_REDEMPTION_REWARD_ID,
    rewardName: SEED_REDEMPTION_REWARD_NAME,
    code: "DEMOBAG1",
    pointsSpent: SEED_REDEMPTION_COST,
    redeemedAt: redeemedAt.toISOString(),
  };
}

export const SEED_POINTS = SEED_POINTS_BALANCE;
