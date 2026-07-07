-- 貼到 Supabase Dashboard 的 SQL Editor 執行一次即可。
-- 這份 migration 新增「政府管理端」需要的角色欄位，讓 /gov-dashboard 可以只
-- 對 role = 'admin' 的帳號開放。

-- ============================================================
-- 1. profiles.role 欄位
-- ============================================================

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

-- ============================================================
-- 2. 防止一般使用者透過前端 update 自己把 role 改成 admin（權限提升漏洞）
-- ============================================================

-- auth.role() = 'authenticated' 代表這個 update 是從一般前端（帶使用者 JWT）
-- 送出的，這種情況下把 role 硬拉回舊值。直接在 SQL Editor 下指令是用連線角色
-- （service/postgres），不會帶 authenticated JWT，不會被這個 trigger 擋下。
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.role is distinct from OLD.role and auth.role() = 'authenticated' then
    NEW.role := OLD.role;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
before update on public.profiles
for each row execute function public.prevent_role_change();

-- ============================================================
-- 3. 手動步驟（貼完上面之後，在 SQL Editor 另外跑一次，把自己的測試帳號設成 admin）
-- ============================================================
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<你的測試帳號 email>');
