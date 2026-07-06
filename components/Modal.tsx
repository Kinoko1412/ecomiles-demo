"use client";

import type { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl animate-[modal-pop_0.25s_ease-out]">
        {children}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
