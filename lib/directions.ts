import type { LatLng } from "@/lib/distance";

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
