"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context/AppContext";
import BottomNav from "@/components/BottomNav";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { nickname, hydrated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !nickname) router.replace("/login");
  }, [hydrated, nickname, router]);

  if (!hydrated || !nickname) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">載入中…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#ecfdf5,_#f0faf5_60%)]">
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
