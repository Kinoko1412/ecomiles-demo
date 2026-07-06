"use client";

import Link from "next/link";

export default function BackHeader({ href, title }: { href: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Link
        href={href}
        aria-label="返回"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg text-slate-600 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white"
      >
        ←
      </Link>
      <h1 className="text-xl font-bold text-emerald-700">{title}</h1>
    </div>
  );
}
