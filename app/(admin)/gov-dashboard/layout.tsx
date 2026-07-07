import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

export default async function GovDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // 一般使用者誤觸這個路徑一律導回登入頁，不要讓他們卡在一個顯示不出東西的空頁。
  if (profile?.role !== "admin") redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between bg-slate-800 px-6 py-3">
        <h1 className="text-sm font-semibold text-white">花蓮縣政府管理後台</h1>
        <AdminLogoutButton />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
