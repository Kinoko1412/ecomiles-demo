-- 貼到 Supabase Dashboard 的 SQL Editor 執行一次即可。
-- 這份 migration 把「訂閱方案」「單次解鎖路線」從純前端 demo（只切換 UI state，
-- 沒有寫進資料庫）改成真的會寫進 purchases 表，讓 /gov-dashboard 能顯示真實營收數字，
-- 不再只是碳權市值示意。

-- ============================================================
-- 1. purchases 表
-- ============================================================

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('single_route_unlock', 'subscription_standard', 'subscription_premium')),
  route_id text,                 -- 只有 single_route_unlock 才會有值，對應 lib/themeRoutes.ts 的 route.id
  amount_nt integer not null check (amount_nt >= 0),
  purchased_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

-- 使用者只能看自己的購買紀錄；insert 一律走下面的 record_purchase() RPC
-- （security definer，不受 RLS 限制），不開放前端直接 insert。
create policy "purchases_select_own" on public.purchases for select using (auth.uid() = user_id);

-- ============================================================
-- 2. RPC：record_purchase / get_revenue_stats
--    跟其他 RPC 一樣是 SECURITY DEFINER，內部只認 auth.uid()，不信任前端傳的使用者 id。
-- ============================================================

create or replace function public.record_purchase(
  p_kind text,
  p_route_id text,
  p_amount_nt int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_kind not in ('single_route_unlock', 'subscription_standard', 'subscription_premium') then
    raise exception 'invalid purchase kind';
  end if;
  if p_amount_nt is null or p_amount_nt < 0 then
    raise exception 'invalid amount';
  end if;

  insert into public.purchases (user_id, kind, route_id, amount_nt)
    values (v_user_id, p_kind, p_route_id, p_amount_nt)
    returning id into v_id;

  return json_build_object('success', true, 'id', v_id);
end;
$$;
grant execute on function public.record_purchase(text, text, int) to authenticated;

-- get_revenue_stats() 只給 profiles.role = 'admin' 呼叫，非 admin 呼叫直接丟例外，
-- 跟 /gov-dashboard 的路由層 gate 是兩層獨立防護（路由層擋不代表 RPC 層可以信任）。
create or replace function public.get_revenue_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_total_revenue numeric;
  v_kind_breakdown json;
  v_route_breakdown json;
  v_recent json;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  select coalesce(sum(amount_nt), 0) into v_total_revenue from public.purchases;

  select json_agg(row_to_json(t)) into v_kind_breakdown
  from (
    select kind, count(*) as count, coalesce(sum(amount_nt), 0) as revenue_nt
    from public.purchases
    group by kind
  ) t;

  select json_agg(row_to_json(t)) into v_route_breakdown
  from (
    select route_id, count(*) as count, coalesce(sum(amount_nt), 0) as revenue_nt
    from public.purchases
    where kind = 'single_route_unlock' and route_id is not null
    group by route_id
    order by count desc
  ) t;

  select json_agg(row_to_json(t)) into v_recent
  from (
    select p.kind, p.route_id, p.amount_nt, p.purchased_at, pr.display_name
    from public.purchases p
    left join public.profiles pr on pr.id = p.user_id
    order by p.purchased_at desc
    limit 20
  ) t;

  return json_build_object(
    'totalRevenueNt', v_total_revenue,
    'kindBreakdown', coalesce(v_kind_breakdown, '[]'::json),
    'routeBreakdown', coalesce(v_route_breakdown, '[]'::json),
    'recentPurchases', coalesce(v_recent, '[]'::json)
  );
end;
$$;
grant execute on function public.get_revenue_stats() to authenticated;
