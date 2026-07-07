-- 每日簽到 streak 機制 + 20 級曲線重新設計。貼到 Supabase Dashboard 的 SQL Editor 執行一次即可，
-- 假設 0001_init.sql（跟視需要的 0002）已經跑過，這裡不重新 drop/建立整個 schema。

-- ============================================================
-- 1. profiles 新增簽到相關欄位
-- ============================================================

alter table public.profiles
  add column if not exists current_streak_days int not null default 0,
  add column if not exists last_checkin_date date;

-- ============================================================
-- 2. 20 級曲線：整批換掉 levels 表的內容
--    前段（新手 Lv1~5）門檻平緩、級距 3~10km；中段（進階 Lv6~14）級距拉開到 20~55km；
--    後段（精通 Lv15~20）級距拉大到 100~300km，變成長期目標。跟 lib/constants.ts 的
--    LEVELS 陣列必須保持一致（那邊是前端優化預覽用，這裡才是 complete_ride() 權威判斷依據）。
-- ============================================================

truncate table public.levels;

insert into public.levels (id, name, min_distance_km, badge_icon, color, sort_order) values
  ('novice-1', '新手騎士 Lv.1', 0, '🚲', '#22c55e', 1),
  ('novice-2', '新手騎士 Lv.2', 3, '🚲', '#22c55e', 2),
  ('novice-3', '新手騎士 Lv.3', 8, '🚲', '#22c55e', 3),
  ('novice-4', '新手騎士 Lv.4', 15, '🚲', '#22c55e', 4),
  ('novice-5', '新手騎士 Lv.5', 25, '🚲', '#22c55e', 5),
  ('intermediate-6', '進階騎士 Lv.6', 40, '🚵', '#6366f1', 6),
  ('intermediate-7', '進階騎士 Lv.7', 60, '🚵', '#6366f1', 7),
  ('intermediate-8', '進階騎士 Lv.8', 85, '🚵', '#6366f1', 8),
  ('intermediate-9', '進階騎士 Lv.9', 115, '🚵', '#6366f1', 9),
  ('intermediate-10', '進階騎士 Lv.10', 150, '🚵', '#6366f1', 10),
  ('intermediate-11', '進階騎士 Lv.11', 190, '🚵', '#6366f1', 11),
  ('intermediate-12', '進階騎士 Lv.12', 235, '🚵', '#6366f1', 12),
  ('intermediate-13', '進階騎士 Lv.13', 285, '🚵', '#6366f1', 13),
  ('intermediate-14', '進階騎士 Lv.14', 340, '🚵', '#6366f1', 14),
  ('master-15', '花蓮騎旅大師 Lv.15', 420, '👑', '#f59e0b', 15),
  ('master-16', '花蓮騎旅大師 Lv.16', 520, '👑', '#f59e0b', 16),
  ('master-17', '花蓮騎旅大師 Lv.17', 650, '👑', '#f59e0b', 17),
  ('master-18', '花蓮騎旅大師 Lv.18', 800, '👑', '#f59e0b', 18),
  ('master-19', '花蓮騎旅大師 Lv.19', 1000, '👑', '#f59e0b', 19),
  ('master-20', '花蓮騎旅大師 Lv.20', 1300, '👑', '#f59e0b', 20);

-- ============================================================
-- 3. 兩個新成就：連續簽到 7 天 / 30 天
-- ============================================================

insert into public.achievements (code, name, description, icon) values
  ('streak_7', '連續簽到 7 天', '連續每日簽到達成 7 天', '🔥'),
  ('streak_30', '連續簽到 30 天', '連續每日簽到達成 30 天', '💎')
on conflict (code) do nothing;

-- ============================================================
-- 4. RPC：claim_daily_checkin()
--    每日簽到獎勵級距（連續天數→當天發放點數）故意用具名常數寫在 declare 區，
--    之後要調整數字只改這幾行，不用重寫整段 case。
-- ============================================================

create or replace function public.claim_daily_checkin()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  -- 「今天」用台北時區判斷，不是資料庫伺服器的時區，避免使用者在深夜簽到時因為
  -- UTC/伺服器時區誤判成隔天或前一天。
  v_today date := (now() at time zone 'Asia/Taipei')::date;

  -- 連續簽到天數 → 當天發放點數的級距，之後要調整只改這幾個常數。
  v_tier1_max_days constant int := 2;   -- 1~2 天
  v_tier2_max_days constant int := 6;   -- 3~6 天
  v_tier3_max_days constant int := 13;  -- 7~13 天
  v_tier1_points constant int := 1;
  v_tier2_points constant int := 2;
  v_tier3_points constant int := 3;
  v_tier4_points constant int := 4;     -- 14 天以上

  -- 里程碑成就的一次性獎勵點數
  v_streak7_threshold constant int := 7;
  v_streak7_bonus constant int := 10;
  v_streak30_threshold constant int := 30;
  v_streak30_bonus constant int := 50;

  v_last_checkin date;
  v_streak int;
  v_already_claimed boolean := false;
  v_daily_points int := 0;
  v_bonus_points int := 0;
  v_new_achievements text[] := '{}';
  v_unlocked_already text[];
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(current_streak_days, 0), last_checkin_date
    into v_streak, v_last_checkin
    from public.profiles where id = v_user_id
    for update;

  if v_last_checkin = v_today then
    -- 今天已經簽到過，不重複發放，原樣回傳目前的 streak 天數。
    v_already_claimed := true;
  else
    if v_last_checkin = v_today - 1 then
      v_streak := v_streak + 1;
    else
      -- 中斷超過一天（或從來沒簽到過，v_last_checkin 是 null）都視為重新開始。
      v_streak := 1;
    end if;

    v_daily_points := case
      when v_streak <= v_tier1_max_days then v_tier1_points
      when v_streak <= v_tier2_max_days then v_tier2_points
      when v_streak <= v_tier3_max_days then v_tier3_points
      else v_tier4_points
    end;

    select coalesce(array_agg(achievement_code), '{}') into v_unlocked_already
      from public.user_achievements where user_id = v_user_id;

    if not ('streak_7' = any(v_unlocked_already)) and v_streak >= v_streak7_threshold then
      v_new_achievements := array_append(v_new_achievements, 'streak_7');
      v_bonus_points := v_bonus_points + v_streak7_bonus;
    end if;
    if not ('streak_30' = any(v_unlocked_already)) and v_streak >= v_streak30_threshold then
      v_new_achievements := array_append(v_new_achievements, 'streak_30');
      v_bonus_points := v_bonus_points + v_streak30_bonus;
    end if;

    update public.profiles
      set current_streak_days = v_streak,
          last_checkin_date = v_today,
          points_balance = points_balance + v_daily_points + v_bonus_points
      where id = v_user_id;

    if array_length(v_new_achievements, 1) > 0 then
      insert into public.user_achievements (user_id, achievement_code)
      select v_user_id, unnest(v_new_achievements)
      on conflict do nothing;
    end if;
  end if;

  return json_build_object(
    'streakDays', v_streak,
    'pointsEarned', v_daily_points + v_bonus_points,
    'alreadyClaimedToday', v_already_claimed,
    'newAchievements', to_json(v_new_achievements)
  );
end;
$$;
grant execute on function public.claim_daily_checkin() to authenticated;
