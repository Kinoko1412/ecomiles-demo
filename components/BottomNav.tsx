"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "首頁", icon: "🏠" },
  { href: "/route", label: "路線", icon: "🗺️" },
  { href: "/redeem", label: "兌換", icon: "🎁" },
  { href: "/profile", label: "個人", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/5 bg-white/90 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              <span className={`text-xl transition-transform ${active ? "scale-110" : ""}`}>
                {tab.icon}
              </span>
              {tab.label}
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${
                  active ? "bg-emerald-500" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
