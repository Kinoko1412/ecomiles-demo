"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/redeem", label: "直接兌換" },
  { href: "/redeem/lottery", label: "抽獎" },
  { href: "/redeem/shops", label: "特約商家" },
];

export default function RedeemTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-5 flex gap-2 rounded-full bg-white/70 p-1 ring-1 ring-black/5">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors ${
              active ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:bg-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
