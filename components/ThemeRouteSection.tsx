"use client";

import { useState } from "react";
import { calcCarbonSavedKg } from "@/lib/carbon";
import { buildGoogleMapsDirUrl, THEME_ROUTES } from "@/lib/themeRoutes";

export default function ThemeRouteSection() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRoute(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-600">精選主題路線</h2>
      {THEME_ROUTES.map((route) => {
        const isOpen = expanded.has(route.id);
        const carbonSavedKg = calcCarbonSavedKg(route.totalDistanceKm);
        return (
          <div
            key={route.id}
            className="rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-black/5"
          >
            <button
              type="button"
              onClick={() => toggleRoute(route.id)}
              className="flex w-full items-start justify-between gap-2 text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="text-lg leading-none">{route.icon}</span>
                  <span className="text-sm font-semibold text-slate-800">{route.name}</span>
                </span>
                <span className="text-xs text-slate-400">{route.blurb}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    全程 {route.totalDistanceKm} km
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    此趟預估減碳 {carbonSavedKg.toFixed(2)} kg
                  </span>
                </span>
              </span>
              <span
                className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              >
                ⌄
              </span>
            </button>

            {isOpen && (
              <div className="relative mt-4 pb-1 pl-1">
                <div className="absolute left-6 top-2 bottom-6 w-0.5 -translate-x-1/2 bg-sky-300" />
                <div className="flex flex-col gap-3">
                  {route.stops.map((stop, i) => (
                    <div key={stop.name} className="flex items-center gap-3">
                      <div className="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white shadow-md ring-4 ring-white">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl bg-white/60 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {stop.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {stop.time}
                          {stop.deltaKm > 0 && <> ・ +{stop.deltaKm} km</>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  href={buildGoogleMapsDirUrl(route)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-100"
                >
                  在 Google Maps 開啟 ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
