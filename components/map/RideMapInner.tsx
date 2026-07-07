"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getRideHighlights, getStationCoords } from "@/lib/stationHighlights";
import { fetchCyclingRoute } from "@/lib/directions";
import type { LatLng } from "@/lib/distance";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export type RideMapProps = {
  startStation: string;
  endStation: string;
  userCoords: LatLng | null;
};

function escapeHtml(str: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

export default function RideMapInner({ startStation, endStation, userCoords }: RideMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // 起訖站確定後建立一次地圖：白色俯視樣式、直線路線（還沒接 Directions API 前的 fallback）、
  // 起訖站標記、加分站點標記。起訖站沒變就不重建地圖，避免每次 render 都重新產生地圖。
  useEffect(() => {
    const container = containerRef.current;
    const startCoords = getStationCoords(startStation);
    const endCoords = getStationCoords(endStation);
    if (!container || !startCoords || !endCoords) return;

    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      center: [startCoords.lng, startCoords.lat],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });
    mapRef.current = map;
    userMarkerRef.current = null;
    let routeFetchCancelled = false;

    const highlightMarkers: mapboxgl.Marker[] = [];

    map.on("load", () => {
      map.addSource("ride-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [startCoords.lng, startCoords.lat],
              [endCoords.lng, endCoords.lat],
            ],
          },
        },
      });
      map.addLayer({
        id: "ride-route-line",
        type: "line",
        source: "ride-route",
        layout: { "line-join": "round", "line-cap": "round" },
        // 先用直線當立即可見的 fallback，line-opacity 調淡表示「路線還在抓」，
        // 貼路網的真實路線抓到後會恢復成完整不透明。
        paint: { "line-color": "#10b981", "line-width": 4, "line-dasharray": [0.2, 1.5], "line-opacity": 0.5 },
      });

      const startEl = document.createElement("div");
      startEl.textContent = "🚩";
      startEl.style.fontSize = "24px";
      new mapboxgl.Marker({ element: startEl }).setLngLat([startCoords.lng, startCoords.lat]).addTo(map);

      const endEl = document.createElement("div");
      endEl.textContent = "🏁";
      endEl.style.fontSize = "24px";
      new mapboxgl.Marker({ element: endEl }).setLngLat([endCoords.lng, endCoords.lat]).addTo(map);

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([startCoords.lng, startCoords.lat]);
      bounds.extend([endCoords.lng, endCoords.lat]);

      for (const h of getRideHighlights(startStation, endStation)) {
        const el = document.createElement("div");
        el.textContent = "⭐";
        el.style.fontSize = "18px";
        el.style.cursor = "pointer";
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(`
          <div style="font-size:13px;line-height:1.6;">
            <strong>${escapeHtml(h.name)}</strong><br/>
            ${h.rating ? `⭐ ${h.rating.toFixed(1)}（${h.userRatingCount} 則評論）<br/>` : ""}
            <a href="${h.mapsUri}" target="_blank" rel="noopener noreferrer" style="color:#0ea5e9;">在 Google Maps 開啟</a>
          </div>
        `);
        highlightMarkers.push(
          new mapboxgl.Marker({ element: el }).setLngLat([h.lng, h.lat]).setPopup(popup).addTo(map)
        );
        bounds.extend([h.lng, h.lat]);
      }

      map.fitBounds(bounds, { padding: 56, duration: 0 });

      // 背景抓真正貼路網的路線，抓到就把直線換掉、bounds 重新涵蓋整條路線的每個轉折點；
      // 抓不到就保留現有的直線，只是把 opacity 復原，不當作還在載入中。
      fetchCyclingRoute([startCoords, endCoords]).then((geometry) => {
        if (routeFetchCancelled) return;
        const source = map.getSource("ride-route") as mapboxgl.GeoJSONSource | undefined;
        if (source && geometry) {
          source.setData({ type: "Feature", properties: {}, geometry });
          for (const [lng, lat] of geometry.coordinates) {
            bounds.extend([lng, lat]);
          }
          map.fitBounds(bounds, { padding: 56, duration: 500 });
        }
        if (map.getLayer("ride-route-line")) {
          map.setPaintProperty("ride-route-line", "line-opacity", 1);
        }
      });
    });

    return () => {
      routeFetchCancelled = true;
      highlightMarkers.forEach((m) => m.remove());
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [startStation, endStation]);

  // 使用者目前位置（真實 GPS watchPosition 或快速模擬的內插座標）：跟著座標更新標記，不重建地圖
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoords) return;

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.textContent = "🚴";
      el.style.fontSize = "26px";
      el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([userCoords.lng, userCoords.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userCoords.lng, userCoords.lat]);
    }
  }, [userCoords]);

  return <div ref={containerRef} className="h-full w-full" />;
}
