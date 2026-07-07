-- Ecomiles 初始 schema：貼到 Supabase Dashboard 的 SQL Editor 執行一次即可。
-- 這份 migration 開頭會先 drop 掉同名物件，所以改壞了、想重跑一次也是安全的
-- （只要你這個專案裡沒有別的東西剛好用一樣的名字）。

create extension if not exists pgcrypto;

-- ============================================================
-- 0. 清除舊物件（方便重跑）
-- ============================================================
drop view if exists public.rewards_with_stock;
drop function if exists public.get_global_stats();
drop function if exists public.draw_lottery();
drop function if exists public.redeem_reward(text);
drop function if exists public.complete_ride(text, text, numeric);
drop function if exists public.generate_redemption_code();
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.redemptions;
drop table if exists public.redemption_codes;
drop table if exists public.user_achievements;
drop table if exists public.rides;
drop table if exists public.rewards;
drop table if exists public.achievements;
drop table if exists public.levels;
drop table if exists public.stations;
drop table if exists public.profiles;

-- ============================================================
-- 1. 資料表
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  total_distance_km numeric not null default 0,
  carbon_saved_kg numeric not null default 0,      -- 只增不減：只有 complete_ride() 會寫這欄
  points_balance integer not null default 0,       -- 可增可減：completeRide 加、redeem/lottery 扣
  ride_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create table public.stations (
  id serial primary key,
  name text not null unique,
  route_segment text not null check (route_segment in ('coastal', 'jian')),
  is_active boolean not null default true
);
alter table public.stations enable row level security;
create policy "stations_select_all" on public.stations for select using (true);

create table public.levels (
  id text primary key,
  name text not null,
  min_distance_km numeric not null,
  badge_icon text not null,
  color text not null,
  sort_order int not null
);
alter table public.levels enable row level security;
create policy "levels_select_all" on public.levels for select using (true);

create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null
);
alter table public.achievements enable row level security;
create policy "achievements_select_all" on public.achievements for select using (true);

create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_code text not null references public.achievements(code),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);
alter table public.user_achievements enable row level security;
create policy "user_achievements_select_own" on public.user_achievements for select using (auth.uid() = user_id);
-- 刻意不給 insert policy：一般 client 不能直接寫，只能透過下面的 SECURITY DEFINER RPC。

create table public.rewards (
  id text primary key,
  name text not null,
  icon text not null,
  cost_points int not null,
  initial_stock int not null,      -- 只在這份 migration 產生序號池時用一次，之後不是庫存的權威來源
  blurb text not null,
  lottery_only boolean not null default false
);
alter table public.rewards enable row level security;
create policy "rewards_select_all" on public.rewards for select using (true);

create table public.redemption_codes (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards(id),
  code text not null unique,
  is_used boolean not null default false,
  used_by uuid references public.profiles(id),
  used_at timestamptz
);
alter table public.redemption_codes enable row level security;
-- 刻意不給任何 policy：使用者完全看不到、也改不了任何一列，只能透過 RPC 間接操作。
-- 「目前庫存」一律用「未使用的序號數量」現場算，不再另外存一個容易跟這裡對不上的計數欄位。

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id text not null references public.rewards(id),
  redemption_code_id uuid not null references public.redemption_codes(id),
  -- 序號文字在這裡存一份副本：redemption_codes 完全不開放給一般使用者讀（見上方），
  -- 使用者只能在兌換當下從 RPC 的回傳值拿到序號，之後要在個人頁面重新顯示歷史序號，
  -- 只能靠這裡的副本，不能再回頭查 redemption_codes。
  code text not null,
  points_spent int not null,
  source text not null check (source in ('direct', 'lottery')),
  redeemed_at timestamptz not null default now()
);
alter table public.redemptions enable row level security;
create policy "redemptions_select_own" on public.redemptions for select using (auth.uid() = user_id);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_station text not null references public.stations(name),
  end_station text not null references public.stations(name),
  distance_km numeric not null,
  carbon_saved_kg numeric not null,
  earned_points int not null,
  created_at timestamptz not null default now()
);
alter table public.rides enable row level security;
create policy "rides_select_own" on public.rides for select using (auth.uid() = user_id);

-- ============================================================
-- 2. Seed 資料（照 lib/constants.ts 現有的站名/等級/成就/獎品，不是 CLAUDE.md 草案措辭）
-- ============================================================

insert into public.stations (name, route_segment) values
  ('朝金定置漁場', 'coastal'),
  ('七星潭風景區', 'coastal'),
  ('農好基地/四八高地', 'coastal'),
  ('花蓮酒廠', 'coastal'),
  ('奇萊鼻燈塔', 'coastal'),
  ('花蓮港觀光遊憩碼頭', 'coastal'),
  ('花蓮港景觀橋', 'coastal'),
  ('太平洋公園', 'coastal'),
  ('吉安火車站', 'jian'),
  ('吉安慶修院', 'jian'),
  ('吉安農會', 'jian'),
  ('干城綠色廊道', 'jian'),
  ('鯉魚潭遊客中心', 'jian'),
  ('白鮑溪沿線', 'jian');

insert into public.levels (id, name, min_distance_km, badge_icon, color, sort_order) values
  ('novice', '新手騎士', 0, '🚲', '#22c55e', 1),
  ('advanced', '進階騎士', 20, '🚵', '#0ea5e9', 2),
  ('senior', '資深騎士', 50, '🏅', '#6366f1', 3),
  ('master', '花蓮騎旅大師', 100, '👑', '#f59e0b', 4);

insert into public.achievements (code, name, description, icon) values
  ('first_ride', '首次騎乘', '完成你的第一趟騎乘', '🎉'),
  ('distance_30', '累積30公里', '累積騎乘里程達 30 公里', '📏'),
  ('carbon_1kg', '累積減碳1公斤', '累積減碳量達 1 公斤', '🌱'),
  ('redeemed_once', '首次兌換', '完成第一次獎品兌換', '🎁'),
  ('all_stations', '山海一線制霸', '造訪全部 14 個站點', '🏆');

insert into public.rewards (id, name, icon, cost_points, initial_stock, blurb, lottery_only) values
  ('r1', '環保帆布袋', '🛍️', 30, 10, '取代一次性塑膠袋，出門購物更環保', false),
  ('r2', '環保餐具組', '🍴', 50, 8, '隨身攜帶，減少免洗餐具與外帶垃圾', false),
  ('r3', '在地店家抵用券', '🎫', 80, 6, '支持花蓮在地店家消費，減少長途運輸的隱藏碳足跡', false),
  ('r4', '合作店家咖啡券', '☕', 100, 5, '以在地咖啡取代連鎖飲料，支持在地小店', false),
  ('r5', '電輔車體驗券', '⚡', 300, 2, '體驗電輔騎乘取代機車代步，親身感受低碳移動', false),
  ('r6', '商店抵用券', '💳', 100, 10, '消費現折 NT$50，全站商品都可折抵', false),
  ('r7', '花蓮騎旅貼紙', '✨', 20, 20, '抽獎限定小禮', true);

-- 每個獎品依 initial_stock 產生對應數量的序號，塞進序號池
create or replace function public.generate_redemption_code()
returns text
language sql
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

do $$
declare
  r record;
  i int;
begin
  for r in select id, initial_stock from public.rewards loop
    for i in 1..r.initial_stock loop
      insert into public.redemption_codes (reward_id, code)
      values (r.id, public.generate_redemption_code());
    end loop;
  end loop;
end $$;

-- ============================================================
-- 3. 新使用者註冊 → 自動建一筆全零的 profile（不 seed 假資料）
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name) values (new.id, null);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4. RPC：complete_ride / redeem_reward / draw_lottery / get_global_stats
--    全部 SECURITY DEFINER，內部只認 auth.uid()，不信任任何前端傳的使用者 id。
-- ============================================================

create or replace function public.complete_ride(
  p_start_station text,
  p_end_station text,
  p_distance_km numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  -- 對照 lib/carbon.ts 的 CARBON_FACTOR_KG_PER_KM：兩處都寫死同一個數字是唯一容許的例外，
  -- 因為這個係數需要同時存在 client（樂觀預覽用）與 server（權威計算用）兩側。
  v_carbon_factor constant numeric := 0.0508;
  v_carbon_saved numeric;
  v_earned_points int;
  v_old_distance numeric;
  v_old_carbon numeric;
  v_new_distance numeric;
  v_new_carbon numeric;
  v_new_ride_count int;
  v_old_level_name text;
  v_new_level_name text;
  v_leveled_up boolean := false;
  v_distinct_stations int;
  v_new_achievements text[] := '{}';
  v_unlocked_already text[];
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_distance_km is null or p_distance_km <= 0 then
    raise exception 'invalid distance';
  end if;

  v_carbon_saved := p_distance_km * v_carbon_factor;
  v_earned_points := floor(p_distance_km)::int;

  select total_distance_km, carbon_saved_kg, ride_count
    into v_old_distance, v_old_carbon, v_new_ride_count
    from public.profiles where id = v_user_id
    for update;

  select coalesce(array_agg(achievement_code), '{}') into v_unlocked_already
    from public.user_achievements where user_id = v_user_id;

  select name into v_old_level_name from public.levels
    where min_distance_km <= v_old_distance order by min_distance_km desc limit 1;

  v_new_distance := v_old_distance + p_distance_km;
  v_new_carbon := v_old_carbon + v_carbon_saved;
  v_new_ride_count := v_new_ride_count + 1;

  select name into v_new_level_name from public.levels
    where min_distance_km <= v_new_distance order by min_distance_km desc limit 1;
  v_leveled_up := v_new_level_name is distinct from v_old_level_name;

  insert into public.rides (user_id, start_station, end_station, distance_km, carbon_saved_kg, earned_points)
  values (v_user_id, p_start_station, p_end_station, p_distance_km, v_carbon_saved, v_earned_points);

  update public.profiles
    set total_distance_km = v_new_distance,
        carbon_saved_kg = v_new_carbon,
        points_balance = points_balance + v_earned_points,
        ride_count = v_new_ride_count
    where id = v_user_id;

  select count(distinct station) into v_distinct_stations
  from (
    select start_station as station from public.rides where user_id = v_user_id
    union
    select end_station from public.rides where user_id = v_user_id
  ) t;

  if not ('first_ride' = any(v_unlocked_already)) and v_new_ride_count >= 1 then
    v_new_achievements := array_append(v_new_achievements, 'first_ride');
  end if;
  if not ('distance_30' = any(v_unlocked_already)) and v_new_distance >= 30 then
    v_new_achievements := array_append(v_new_achievements, 'distance_30');
  end if;
  if not ('carbon_1kg' = any(v_unlocked_already)) and v_new_carbon >= 1 then
    v_new_achievements := array_append(v_new_achievements, 'carbon_1kg');
  end if;
  if not ('all_stations' = any(v_unlocked_already)) and v_distinct_stations >= 14 then
    v_new_achievements := array_append(v_new_achievements, 'all_stations');
  end if;

  if array_length(v_new_achievements, 1) > 0 then
    insert into public.user_achievements (user_id, achievement_code)
    select v_user_id, unnest(v_new_achievements)
    on conflict do nothing;
  end if;

  return json_build_object(
    'distanceKm', p_distance_km,
    'carbonSavedKg', v_carbon_saved,
    'earnedPoints', v_earned_points,
    'leveledUp', v_leveled_up,
    'newLevelName', case when v_leveled_up then v_new_level_name else null end,
    'newAchievements', to_json(v_new_achievements)
  );
end;
$$;
grant execute on function public.complete_ride(text, text, numeric) to authenticated;

create or replace function public.redeem_reward(p_reward_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost int;
  v_points int;
  v_code_id uuid;
  v_code text;
  v_already_redeemed boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select cost_points into v_cost from public.rewards where id = p_reward_id;
  if v_cost is null then
    return json_build_object('success', false, 'reason', 'out_of_stock');
  end if;

  select points_balance into v_points from public.profiles where id = v_user_id for update;
  if v_points < v_cost then
    return json_build_object('success', false, 'reason', 'insufficient_points');
  end if;

  select id, code into v_code_id, v_code
    from public.redemption_codes
    where reward_id = p_reward_id and not is_used
    for update skip locked
    limit 1;

  if v_code_id is null then
    return json_build_object('success', false, 'reason', 'out_of_stock');
  end if;

  update public.redemption_codes set is_used = true, used_by = v_user_id, used_at = now()
    where id = v_code_id;
  update public.profiles set points_balance = points_balance - v_cost where id = v_user_id;
  insert into public.redemptions (user_id, reward_id, redemption_code_id, code, points_spent, source)
    values (v_user_id, p_reward_id, v_code_id, v_code, v_cost, 'direct');

  select exists(
    select 1 from public.user_achievements
    where user_id = v_user_id and achievement_code = 'redeemed_once'
  ) into v_already_redeemed;

  if not v_already_redeemed then
    insert into public.user_achievements (user_id, achievement_code) values (v_user_id, 'redeemed_once')
      on conflict do nothing;
  end if;

  return json_build_object(
    'success', true,
    'code', v_code,
    'newAchievements', case when v_already_redeemed then '[]'::json else '["redeemed_once"]'::json end
  );
end;
$$;
grant execute on function public.redeem_reward(text) to authenticated;

create or replace function public.draw_lottery()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost constant int := 15;
  v_points int;
  v_roll numeric := random();
  v_tier text;
  v_reward_id text;
  v_code_id uuid;
  v_code text;
  v_reward_name text;
  v_stock_out boolean := false;
  v_already_redeemed boolean;
  v_new_achievements json := '[]'::json;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select points_balance into v_points from public.profiles where id = v_user_id for update;
  if v_points < v_cost then
    return json_build_object('success', false, 'reason', 'insufficient_points');
  end if;

  -- 機率對照 lib/constants.ts 的 LOTTERY_TIERS：50% none / 30% small(r7) / 15% medium(r1) / 5% grand(r5)
  if v_roll < 0.5 then
    v_tier := 'none'; v_reward_id := null;
  elsif v_roll < 0.8 then
    v_tier := 'small'; v_reward_id := 'r7';
  elsif v_roll < 0.95 then
    v_tier := 'medium'; v_reward_id := 'r1';
  else
    v_tier := 'grand'; v_reward_id := 'r5';
  end if;

  update public.profiles set points_balance = points_balance - v_cost where id = v_user_id;

  if v_reward_id is not null then
    select id, code into v_code_id, v_code
      from public.redemption_codes
      where reward_id = v_reward_id and not is_used
      for update skip locked
      limit 1;

    if v_code_id is null then
      v_stock_out := true;
      v_tier := 'none';
    else
      select name into v_reward_name from public.rewards where id = v_reward_id;

      update public.redemption_codes set is_used = true, used_by = v_user_id, used_at = now()
        where id = v_code_id;
      insert into public.redemptions (user_id, reward_id, redemption_code_id, code, points_spent, source)
        values (v_user_id, v_reward_id, v_code_id, v_code, v_cost, 'lottery');

      select exists(
        select 1 from public.user_achievements
        where user_id = v_user_id and achievement_code = 'redeemed_once'
      ) into v_already_redeemed;

      if not v_already_redeemed then
        insert into public.user_achievements (user_id, achievement_code) values (v_user_id, 'redeemed_once')
          on conflict do nothing;
        v_new_achievements := '["redeemed_once"]'::json;
      end if;
    end if;
  end if;

  return json_build_object(
    'success', true,
    'tier', v_tier,
    'stockOut', v_stock_out,
    'prizeName', v_reward_name,
    'code', v_code,
    'newAchievements', v_new_achievements
  );
end;
$$;
grant execute on function public.draw_lottery() to authenticated;

-- 給 /gov-dashboard 用：沒有登入門檻，所以也開放給 anon。只回傳聚合數字，
-- 不會透過這個 function 洩漏任何一筆原始 rides 列或個別使用者身分。
create or replace function public.get_global_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride_count int;
  v_total_distance numeric;
  v_total_carbon numeric;
  v_station_counts json;
begin
  select count(*), coalesce(sum(distance_km), 0), coalesce(sum(carbon_saved_kg), 0)
    into v_ride_count, v_total_distance, v_total_carbon
    from public.rides;

  select json_agg(row_to_json(t)) into v_station_counts
  from (
    select s.name as station, coalesce(c.count, 0) as count
    from public.stations s
    left join (
      select station, count(*) as count from (
        select start_station as station from public.rides
        union all
        select end_station from public.rides
      ) u
      group by station
    ) c on c.station = s.name
    order by count desc, s.name
  ) t;

  return json_build_object(
    'rideCount', v_ride_count,
    'totalDistanceKm', v_total_distance,
    'totalCarbonKg', v_total_carbon,
    'stationCounts', coalesce(v_station_counts, '[]'::json)
  );
end;
$$;
grant execute on function public.get_global_stats() to anon, authenticated;

-- ============================================================
-- 5. 給前端方便查詢的 view：獎品 + 現場算出來的剩餘庫存
--    （非 security_invoker 的 view 預設用建立者權限跑，所以能正確算出
--    redemption_codes 的未使用數量，即使一般使用者對那張表完全沒有 select 權限）
-- ============================================================

create view public.rewards_with_stock as
select
  r.id, r.name, r.icon, r.cost_points, r.blurb, r.lottery_only,
  (select count(*) from public.redemption_codes rc where rc.reward_id = r.id and not rc.is_used) as current_stock
from public.rewards r;

grant select on public.rewards_with_stock to anon, authenticated;
