"use client";

import { useRef } from "react";

type PlacePhotoCarouselProps = {
  photos: string[];
  alt: string;
};

export default function PlacePhotoCarousel({ photos, alt }: PlacePhotoCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  if (photos.length === 0) return null;

  function scrollByPage(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth"
      >
        {photos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${alt} 照片 ${i + 1}`}
            className="h-32 w-44 shrink-0 snap-center rounded-xl object-cover"
          />
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label="上一張"
            className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-slate-600 shadow ring-1 ring-black/5 sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label="下一張"
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-slate-600 shadow ring-1 ring-black/5 sm:flex"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
