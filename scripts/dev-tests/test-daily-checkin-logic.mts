/**
 * 手動驗證腳本：純 JS 重現 supabase/migrations/0003_streak_and_levels.sql 裡
 * claim_daily_checkin() 的分支邏輯（逐行對照那份 SQL，不是憑印象重寫的簡化版），
 * 用來在沒有真實 Supabase session 的情況下，先確認 streak 遞增/歸零、點數級距、
 * 成就解鎖門檻這幾個核心規則是對的。真正的 SQL 語法本身（會不會噴 syntax error、
 * on conflict 目標對不對）仍然需要你在 Supabase SQL Editor 實際跑一次 migration 才能
 * 100% 確認，這支腳本只驗證「邏輯規則」這個層面。
 *
 * 執行方式：npx tsx scripts/dev-tests/test-daily-checkin-logic.mts
 */

const TIER1_MAX_DAYS = 2;
const TIER2_MAX_DAYS = 6;
const TIER3_MAX_DAYS = 13;
const TIER1_POINTS = 1;
const TIER2_POINTS = 2;
const TIER3_POINTS = 3;
const TIER4_POINTS = 4;
const STREAK7_THRESHOLD = 7;
const STREAK7_BONUS = 10;
const STREAK30_THRESHOLD = 30;
const STREAK30_BONUS = 50;

type ProfileState = {
  currentStreakDays: number;
  lastCheckinDate: string | null; // "YYYY-MM-DD"
  pointsBalance: number;
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function claimDailyCheckin(profile: ProfileState, today: string, unlockedAlready: Set<string>) {
  let streak = profile.currentStreakDays;
  let alreadyClaimed = false;
  let dailyPoints = 0;
  let bonusPoints = 0;
  const newAchievements: string[] = [];

  if (profile.lastCheckinDate === today) {
    alreadyClaimed = true;
  } else {
    if (profile.lastCheckinDate === addDays(today, -1)) {
      streak = streak + 1;
    } else {
      streak = 1;
    }

    dailyPoints =
      streak <= TIER1_MAX_DAYS
        ? TIER1_POINTS
        : streak <= TIER2_MAX_DAYS
          ? TIER2_POINTS
          : streak <= TIER3_MAX_DAYS
            ? TIER3_POINTS
            : TIER4_POINTS;

    if (!unlockedAlready.has("streak_7") && streak >= STREAK7_THRESHOLD) {
      newAchievements.push("streak_7");
      bonusPoints += STREAK7_BONUS;
    }
    if (!unlockedAlready.has("streak_30") && streak >= STREAK30_THRESHOLD) {
      newAchievements.push("streak_30");
      bonusPoints += STREAK30_BONUS;
    }

    profile.currentStreakDays = streak;
    profile.lastCheckinDate = today;
    profile.pointsBalance += dailyPoints + bonusPoints;
    for (const a of newAchievements) unlockedAlready.add(a);
  }

  return {
    streakDays: streak,
    pointsEarned: dailyPoints + bonusPoints,
    alreadyClaimedToday: alreadyClaimed,
    newAchievements,
  };
}

function report(label: string, result: ReturnType<typeof claimDailyCheckin>, profile: ProfileState) {
  console.log(
    `${label}: streak=${result.streakDays}, +${result.pointsEarned}點, alreadyClaimed=${result.alreadyClaimedToday}, ` +
      `newAchievements=[${result.newAchievements.join(",")}], 累積點數=${profile.pointsBalance}`
  );
}

console.log("=== 情境1：連續簽到 7 天（全新使用者，從 day1 開始）===");
const profile1: ProfileState = { currentStreakDays: 0, lastCheckinDate: null, pointsBalance: 0 };
const unlocked1 = new Set<string>();
let day = "2026-01-01";
for (let i = 1; i <= 7; i++) {
  const result = claimDailyCheckin(profile1, day, unlocked1);
  report(`day${i} (${day})`, result, profile1);
  day = addDays(day, 1);
}

console.log("\n=== 情境2：連續13天簽到後，中斷2天（不是前一天），再簽到 ===");
const profile2: ProfileState = { currentStreakDays: 0, lastCheckinDate: null, pointsBalance: 0 };
const unlocked2 = new Set<string>();
day = "2026-02-01";
for (let i = 1; i <= 13; i++) {
  claimDailyCheckin(profile2, day, unlocked2);
  day = addDays(day, 1);
}
console.log(`跑完 13 天後：streak=${profile2.currentStreakDays}（預期 13）`);
const dayAfterGap = addDays(day, 2); // 中斷兩天再簽到（day 本身還沒簽，再 +2 天代表跳過 2 天沒簽到）
const resultAfterGap = claimDailyCheckin(profile2, dayAfterGap, unlocked2);
report(`中斷後重新簽到 (${dayAfterGap})`, resultAfterGap, profile2);
console.log(resultAfterGap.streakDays === 1 ? "✅ streak 正確歸零重算為 1" : "❌ streak 沒有正確歸零");

console.log("\n=== 情境3：同一天重複呼叫（不該重複發放）===");
const profile3: ProfileState = { currentStreakDays: 5, lastCheckinDate: "2026-03-10", pointsBalance: 100 };
const unlocked3 = new Set<string>();
const resultSameDay = claimDailyCheckin(profile3, "2026-03-10", unlocked3);
report("同一天再簽一次", resultSameDay, profile3);
console.log(
  resultSameDay.alreadyClaimedToday && resultSameDay.pointsEarned === 0 && profile3.pointsBalance === 100
    ? "✅ 正確不重複發放"
    : "❌ 不應該重複發放"
);

console.log("\n=== 情境4：達成 7 天成就（驗證只解鎖一次）===");
const profile4: ProfileState = { currentStreakDays: 6, lastCheckinDate: "2026-04-06", pointsBalance: 50 };
const unlocked4 = new Set<string>();
const result7 = claimDailyCheckin(profile4, "2026-04-07", unlocked4);
report("第7天簽到", result7, profile4);
console.log(
  result7.newAchievements.includes("streak_7") && result7.pointsEarned === TIER3_POINTS + STREAK7_BONUS
    ? "✅ 正確解鎖 streak_7 成就並發放 3(當日)+10(成就)=13 點"
    : "❌ 成就解鎖或點數不對"
);
// 隔天繼續簽到，不應該重複解鎖 streak_7
const result8 = claimDailyCheckin(profile4, "2026-04-08", unlocked4);
report("第8天簽到", result8, profile4);
console.log(
  !result8.newAchievements.includes("streak_7") ? "✅ 第8天沒有重複解鎖 streak_7" : "❌ 不應該重複解鎖"
);
