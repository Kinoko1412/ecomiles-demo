import { haversineDistanceMeters, type LatLng } from "@/lib/distance";
import { getStationCoords, getStationSegment } from "@/lib/stationHighlights";
import officialCoastalRouteData from "@/data/official-coastal-route.json";

// 沒有另外裝 @types/geojson，這裡自己定義用得到的最小形狀就好，
// 不依賴可能沒裝的全域 GeoJSON 命名空間。
export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

/**
 * 呼叫 Mapbox Directions API 拿貼著路網的自行車路線。
 * 沒有 token、API 出錯、或找不到路線都回傳 null，呼叫端要自己保留原本畫好的直線 fallback，
 * 不能讓地圖因為這裡失敗就整個掛掉。
 */
export async function fetchCyclingRoute(coords: LatLng[]): Promise<LineStringGeometry | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || coords.length < 2) return null;

  const coordsParam = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordsParam}?geometries=geojson&overview=full&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const geometry = data?.routes?.[0]?.geometry;
    if (!geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
      return null;
    }
    return geometry as LineStringGeometry;
  } catch {
    return null;
  }
}

type OfficialRouteFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: LineStringGeometry;
};

const OFFICIAL_COASTAL_ROUTE = officialCoastalRouteData as unknown as OfficialRouteFeature;
const NEAREST_POINT_MAX_DISTANCE_M = 1000;

function findNearestPointIndex(
  coords: [number, number][],
  target: LatLng
): { index: number; distanceM: number } {
  let bestIndex = 0;
  let bestDistanceM = Infinity;
  coords.forEach(([lng, lat], i) => {
    const d = haversineDistanceMeters(target, { lat, lng });
    if (d < bestDistanceM) {
      bestDistanceM = d;
      bestIndex = i;
    }
  });
  return { index: bestIndex, distanceM: bestDistanceM };
}

/**
 * 海線（朝金定置漁場～太平洋公園）改用 TDX 官方實測軌跡，取代 Directions API 算出來的路線。
 * 起訖站只要有一個不是海線站（含山線站、或不在 14 站名單裡），就回傳 null，讓呼叫端
 * fallback 回 fetchCyclingRoute()。
 */
export function getOfficialCoastalRouteSegment(
  startStation: string,
  endStation: string
): LineStringGeometry | null {
  if (getStationSegment(startStation) !== "coastal" || getStationSegment(endStation) !== "coastal") {
    return null;
  }

  const startCoords = getStationCoords(startStation);
  const endCoords = getStationCoords(endStation);
  if (!startCoords || !endCoords) return null;

  const coords = OFFICIAL_COASTAL_ROUTE.geometry.coordinates;
  const startNearest = findNearestPointIndex(coords, startCoords);
  const endNearest = findNearestPointIndex(coords, endCoords);

  // 任一端離官方軌跡太遠，代表這條軌跡根本不涵蓋這兩站，不能硬套
  if (
    startNearest.distanceM > NEAREST_POINT_MAX_DISTANCE_M ||
    endNearest.distanceM > NEAREST_POINT_MAX_DISTANCE_M
  ) {
    return null;
  }

  // 起訖站同一站，沒有路線可畫，維持原本邏輯處理單點情況（不要硬切出空陣列/單點 LineString）
  if (startNearest.index === endNearest.index) {
    return null;
  }

  const lo = Math.min(startNearest.index, endNearest.index);
  const hi = Math.max(startNearest.index, endNearest.index);
  let segment = coords.slice(lo, hi + 1);

  // 軌跡本身的座標順序未必跟這趟騎乘的方向一致，反方向騎的話要整段 reverse，
  // 讓陣列順序符合「從起站騎到訖站」，之後要做沿路線移動的動畫才不會方向反過來。
  if (startNearest.index > endNearest.index) {
    segment = [...segment].reverse();
  }

  console.log(
    `[getOfficialCoastalRouteSegment] ${startStation} -> ${endStation}: ${segment.length} 點` +
      `, 頭=${JSON.stringify(segment[0])}, 尾=${JSON.stringify(segment[segment.length - 1])}`
  );

  return { type: "LineString", coordinates: segment };
}
