import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import BottomNav from "@/components/BottomNav";
import AiGuideFab from "@/components/AiGuideFab";
import DailyCheckinToast from "@/components/DailyCheckinToast";

export default async function ShellLayout({
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
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.display_name) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#ecfdf5,_#f0faf5_60%)]">
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
      <AiGuideFab />
      <DailyCheckinToast />
    </div>
  );
}
