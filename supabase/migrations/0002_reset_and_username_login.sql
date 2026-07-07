-- 貼到 Supabase Dashboard 的 SQL Editor 執行一次即可。
-- 這份 migration 做兩件事：
--   1. 清空所有使用者資料（含 auth.users 帳號本身），14 站/等級/成就/獎品的種子資料不動。
--   2. 加上「使用者名稱可以拿來登入」需要的 unique 限制 + 查 email 用的 RPC。

-- ============================================================
-- 1. 清空使用者資料
-- ============================================================

-- 先把序號池的使用狀態重置，不然刪 profiles 時會因為 redemption_codes.used_by
-- 這個外鍵（沒有 on delete cascade）擋下來。
update public.redemption_codes set is_used = false, used_by = null, used_at = null;

-- 刪 auth.users 會透過 on delete cascade 一路刪光 profiles / rides / redemptions /
-- user_achievements，等於帳號從裡到外全部歸零，之後註冊的帳號都是全新的。
delete from auth.users;

-- ============================================================
-- 2. 使用者名稱唯一化 + 用使用者名稱查 email 的 RPC（給「使用者名稱/Email + 密碼」登入用）
-- ============================================================

-- 只限制「已經設定過名稱」的情況唯一，還沒設定名稱（null）的過渡狀態不受影響。
create unique index if not exists profiles_display_name_unique_idx
  on public.profiles (display_name)
  where display_name is not null;

-- 前端登入表單只收「使用者名稱或 Email」一個欄位：如果輸入的不是 email，就靠這個 RPC
-- 查出對應的 email 再呼叫 signInWithPassword。刻意只回傳 email 字串本身，不回傳其他任何欄位。
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.display_name = p_username
  limit 1;
$$;
grant execute on function public.get_email_by_username(text) to anon, authenticated;
