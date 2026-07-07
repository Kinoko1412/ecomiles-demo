"use client";

import { useState } from "react";
import {
  getPhotoPopularity,
  getPlaceIcon,
  getStationDirectoryPlaces,
  getStationsBySegment,
} from "@/lib/stationHighlights";
import PlacePhotoCarousel from "@/components/PlacePhotoCarousel";
import ThemeRouteSection from "@/components/ThemeRouteSection";

type Segment = "coastal" | "jian";

export default function RoutePage() {
  const [segment, setSegment] = useState<Segment>("coastal");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const stations = getStationsBySegment(segment);

  function toggleStation(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10">
      <h1 className="text-xl font-bold text-emerald-700">路線導覽</h1>

      <ThemeRouteSection />

      <div className="flex rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => setSegment("coastal")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
            segment === "coastal" ? "bg-sky-500 text-white shadow" : "text-slate-400"
          }`}
        >
          海線
        </button>
        <button
          type="button"
          onClick={() => setSegment("jian")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
            segment === "jian" ? "bg-sky-500 text-white shadow" : "text-slate-400"
          }`}
        >
          山線
        </button>
      </div>

      <div className="relative pb-4">
        {/* 垂直時間軸主線，跟每個圓點的水平中心（w-14 的一半）對齊 */}
        <div className="absolute left-7 top-2 bottom-6 w-0.5 -translate-x-1/2 bg-sky-300" />

        <div className="flex flex-col gap-4">
          {stations.map((s) => {
            const isOpen = expanded.has(s.name);
            const places = isOpen ? getStationDirectoryPlaces(s.name) : [];
            const popularity = getPhotoPopularity(s.name);
            return (
              <div key={s.name} className="flex gap-3">
                <div className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white shadow-md ring-4 ring-white">
                  {s.index}
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleStation(s.name)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/85 px-4 py-3 text-left shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white"
                  >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                      {popularity && (
                        <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                          📸 {popularity.photoCount500m} 張歷史打卡
                        </span>
                      )}
                      {popularity?.isPeakMonth && (
                        <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          🔥 本月是熱門旺季
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      ⌄
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-2 flex flex-col gap-2">
                      {places.length === 0 ? (
                        <p className="rounded-xl bg-white/60 px-3 py-2 text-xs text-slate-400">
                          附近暫無符合條件的特約商家
                        </p>
                      ) : (
                        places.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-2xl bg-white/85 p-3 shadow-sm ring-1 ring-black/5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <span className="text-lg leading-none">{getPlaceIcon(p.types)}</span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {p.name}
                                  </p>
                                  {p.rating ? (
                                    <p className="text-xs text-amber-500">
                                      ⭐ {p.rating.toFixed(1)}
                                      <span className="text-slate-400"> ({p.userRatingCount})</span>
                                    </p>
                                  ) : (
                                    <p className="text-xs text-slate-400">尚無評分</p>
                                  )}
                                </div>
                              </div>
                              <a
                                href={p.mapsUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="在 Google Maps 開啟"
                                className="shrink-0 rounded-full bg-sky-50 p-1.5 text-sky-500 transition-colors hover:bg-sky-100"
                              >
                                ↗
                              </a>
                            </div>
                            {p.photos.length > 0 && (
                              <div className="mt-2">
                                <PlacePhotoCarousel photos={p.photos} alt={p.name} />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
