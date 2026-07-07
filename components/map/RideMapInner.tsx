"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getRideHighlights, getStationCoords } from "@/lib/stationHighlights";
import hiddenHotspotsData from "@/data/hidden-hotspots.json";
import { haversineDistanceMeters, type LatLng } from "@/lib/distance";
import { computeBearing, smoothBearing } from "@/lib/heading";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// demo 前如果 3D 沉浸式導航出問題（效能不穩、Mapbox building 資料異常等），設這個環境變數
// 為 "1" 可以快速整個關掉、退回原本的平面俯視版本，不用改程式碼臨時 revert。
const FORCE_2D_MODE = process.env.NEXT_PUBLIC_DISABLE_3D_NAV === "1";

const NAV_PITCH_DEG = 60;
const NAV_ZOOM = 17;
const CAMERA_EASE_DURATION_MS = 800;
// 兩次 GPS/模擬定位點距離小於這個門檻視為雜訊（GPS 飄移或還沒真的移動），沿用上一個方向，
// 不重新計算方位角，避免鏡頭在原地抖動亂轉。
const BEARING_MIN_DISTANCE_M = 3;
const BEARING_SMOOTHING_ALPHA = 0.3;
// 使用者標記固定顯示在畫面偏下方，讓鏡頭朝向的前方（畫面上半部）能看到更多路況，
// 用 easeTo 的 padding.top 把「center 對齊的視覺中心」往下推，數字是容器高度的比例。
const CAMERA_TOP_PADDING_RATIO = 0.55;
// easeTo 呼叫到 moveend 事件實際觸發的間隔，如果比設定的動畫時長還多出這麼多 ms，
// 代表主執行緒卡頓、渲染跟不上，連續發生這麼多次就直接降級回 2D，不要讓體驗變成連續卡頓。
const JANK_THRESHOLD_MS = CAMERA_EASE_DURATION_MS + 700;
const JANK_STREAK_TRIGGER = 2;

type HiddenHotspot = {
  lat: number;
  lng: number;
  photoCount: number;
  nearestStation: string;
  distanceToNearestStationM: number;
  sampleTitle: string;
};

// 靜態資料，不用像加分站點那樣依起訖站篩選：這 8 個熱點固定顯示在每一趟騎乘的地圖上，
// 純粹是「這裡歷史上很多人打卡拍照」的輔助展示，跟計分完全無關。
const HIDDEN_HOTSPOTS = hiddenHotspotsData as HiddenHotspot[];

export type RideMapProps = {
  startStation: string;
  endStation: string;
  userCoords: LatLng | null;
  /**
   * 貼路網的真實路線座標，由上層元件（要同步拿來算快速模擬移動路徑）呼叫 Mapbox Directions
   * API 取得，這個元件本身不重複發那個請求。undefined = 還在抓、null = 抓失敗（維持直線）、
   * 陣列 = 拿到真實路線了。
   */
  routeCoords: LatLng[] | null | undefined;
  /**
   * 這條 routeCoords 是不是套用了精度較低的山線官方路廊資料（見 lib/directions.ts 的
   * getOfficialJianRouteSegment）。只影響線條視覺樣式跟要不要顯示提醒小標籤，不影響邏輯。
   */
  isLowConfidenceRoute?: boolean;
};

function escapeHtml(str: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

export default function RideMapInner({
  startStation,
  endStation,
  userCoords,
  routeCoords,
  isLowConfidenceRoute,
}: RideMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastBearingSampleRef = useRef<LatLng | null>(null);
  const currentBearingRef = useRef<number | null>(null);
  const jankStreakRef = useRef(0);

  // 是不是啟用 3D 沉浸式導航（pitch + 鏡頭跟隨方向）。每趟新騎乘都重新給一次機會
  // （見下方建地圖的 effect），同一趟騎乘中途卡頓太多次才會被自動降級關掉。
  const [is3DEnabled, setIs3DEnabled] = useState(!FORCE_2D_MODE);

  // 起訖站確定後建立一次地圖：白色俯視樣式、直線路線（還沒接 Directions API 前的 fallback）、
  // 起訖站標記、加分站點標記。起訖站沒變就不重建地圖，避免每次 render 都重新產生地圖。
  useEffect(() => {
    const container = containerRef.current;
    const startCoords = getStationCoords(startStation);
    const endCoords = getStationCoords(endStation);
    if (!container || !startCoords || !endCoords) return;

    // 新的一趟騎乘，3D 狀態跟方位角追蹤都重置，不沿用上一趟騎乘可能已經降級的結果。
    const initial3D = !FORCE_2D_MODE;
    setIs3DEnabled(initial3D);
    jankStreakRef.current = 0;
    lastBearingSampleRef.current = null;
    currentBearingRef.current = null;

    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      center: [startCoords.lng, startCoords.lat],
      zoom: 13,
      pitch: initial3D ? NAV_PITCH_DEG : 0,
      bearing: 0,
      attributionControl: false,
    });
    mapRef.current = map;
    userMarkerRef.current = null;

    const highlightMarkers: mapboxgl.Marker[] = [];

    map.on("load", () => {
      // Mapbox Streets 內建的建築物資料（source-layer "building"），只在有實際建物資料的
      // 地方（花蓮/吉安市區）才會冒出量體，海岸/鄉間路段沒有建物資料是預期內的，不是 bug。
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        layout: { visibility: initial3D ? "visible" : "none" },
        paint: {
          "fill-extrusion-color": "#9ca3af",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.6,
        },
      });

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

      for (const spot of HIDDEN_HOTSPOTS) {
        const el = document.createElement("div");
        el.textContent = "📷";
        el.style.fontSize = "18px";
        el.style.cursor = "pointer";
        el.style.opacity = "0.7";
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(`
          <div style="font-size:13px;line-height:1.6;">
            📷 歷史打卡點｜${spot.photoCount}張照片<br/>
            範例：${escapeHtml(spot.sampleTitle)}
          </div>
        `);
        highlightMarkers.push(
          new mapboxgl.Marker({ element: el }).setLngLat([spot.lng, spot.lat]).setPopup(popup).addTo(map)
        );
        bounds.extend([spot.lng, spot.lat]);
      }

      map.fitBounds(bounds, { padding: 56, duration: 0 });
    });

    return () => {
      highlightMarkers.forEach((m) => m.remove());
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [startStation, endStation]);

  // is3DEnabled 變化時（通常是效能降級自動關閉），把已經建好的地圖切回/切成平面俯視，
  // 不用整個重建地圖。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      map.easeTo({ pitch: is3DEnabled ? NAV_PITCH_DEG : 0, duration: 300 });
      if (map.getLayer("3d-buildings")) {
        map.setLayoutProperty("3d-buildings", "visibility", is3DEnabled ? "visible" : "none");
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [is3DEnabled]);

  // 上層元件抓到真正貼路網的路線後把直線換掉；bounds 重新涵蓋路線上每個點，opacity 復原成正常。
  // routeCoords 是 null（抓失敗，維持直線但不再當作「還在載入」）也要把 opacity 復原。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || routeCoords === undefined) return;

    const apply = () => {
      if (routeCoords && routeCoords.length >= 2) {
        const source = map.getSource("ride-route") as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeCoords.map((c) => [c.lng, c.lat]),
            },
          });

          const bounds = new mapboxgl.LngLatBounds();
          for (const c of routeCoords) bounds.extend([c.lng, c.lat]);
          for (const h of getRideHighlights(startStation, endStation)) bounds.extend([h.lng, h.lat]);
          for (const spot of HIDDEN_HOTSPOTS) bounds.extend([spot.lng, spot.lat]);
          map.fitBounds(bounds, { padding: 56, duration: 500 });
        }
      }
      if (map.getLayer("ride-route-line")) {
        // 山線官方路廊資料精度較低（見 getOfficialJianRouteSegment 的說明），線條故意畫得
        // 比海線/Directions API 那組淡一點、帶淺淺虛線，避免給使用者跟海線一樣的信心水準。
        if (routeCoords && routeCoords.length >= 2 && isLowConfidenceRoute) {
          map.setPaintProperty("ride-route-line", "line-color", "#f59e0b");
          map.setPaintProperty("ride-route-line", "line-dasharray", [1.5, 1]);
          map.setPaintProperty("ride-route-line", "line-opacity", 0.85);
        } else {
          map.setPaintProperty("ride-route-line", "line-color", "#10b981");
          map.setPaintProperty("ride-route-line", "line-dasharray", [1, 0]);
          map.setPaintProperty("ride-route-line", "line-opacity", 1);
        }
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [routeCoords, startStation, endStation, isLowConfidenceRoute]);

  // 使用者目前位置（真實 GPS watchPosition 或快速模擬的內插座標）：跟著座標更新標記，
  // 3D 模式下鏡頭也跟著轉向、平移過去；不重建地圖。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoords) return;

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.textContent = "🚴";
      el.style.fontSize = "26px";
      el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
      // 不設 rotationAlignment，標記本身固定朝上不旋轉：3D 模式下是鏡頭 bearing 在轉，
      // 不是這個 emoji 圖示本身在轉。
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([userCoords.lng, userCoords.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userCoords.lng, userCoords.lat]);
    }

    if (!is3DEnabled) return; // 2D fallback：只更新標記位置，鏡頭維持原本俯視、不跟隨

    const last = lastBearingSampleRef.current;
    if (!last || haversineDistanceMeters(last, userCoords) > BEARING_MIN_DISTANCE_M) {
      if (last) {
        const rawBearing = computeBearing(last, userCoords);
        currentBearingRef.current = smoothBearing(currentBearingRef.current, rawBearing, BEARING_SMOOTHING_ALPHA);
      }
      lastBearingSampleRef.current = userCoords;
    }
    // 還沒有第二個取樣點之前沒有方向可算，鏡頭先維持目前的 bearing（預設正北）。
    const bearing = currentBearingRef.current ?? 0;

    const containerHeight = containerRef.current?.clientHeight ?? 0;

    const easeStart = performance.now();
    map.easeTo({
      center: [userCoords.lng, userCoords.lat],
      bearing,
      pitch: NAV_PITCH_DEG,
      zoom: NAV_ZOOM,
      duration: CAMERA_EASE_DURATION_MS,
      padding: { top: containerHeight * CAMERA_TOP_PADDING_RATIO, bottom: 0, left: 0, right: 0 },
    });

    map.once("moveend", () => {
      const elapsed = performance.now() - easeStart;
      if (elapsed > JANK_THRESHOLD_MS) {
        jankStreakRef.current += 1;
        if (jankStreakRef.current >= JANK_STREAK_TRIGGER) {
          console.warn(
            `[RideMapInner] 偵測到連續 ${jankStreakRef.current} 次鏡頭轉場延遲過長（${elapsed.toFixed(
              0
            )}ms），自動降級關閉 3D 導航`
          );
          setIs3DEnabled(false);
        }
      } else {
        jankStreakRef.current = 0;
      }
    });
  }, [userCoords, is3DEnabled]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {routeCoords && routeCoords.length >= 2 && isLowConfidenceRoute && (
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-50/95 px-3 py-1 text-[11px] font-medium text-amber-700 shadow ring-1 ring-amber-200"
          style={{ top: "calc(env(safe-area-inset-top) + 84px)" }}
        >
          🚧 山線路廊為參考路網，精度較低
        </div>
      )}
    </div>
  );
}
