const EARTH_RADIUS_M = 6371000;

export type LatLng = { lat: number; lng: number };

/** 兩點間的距離（公尺），Haversine 公式 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 沿直線從 a 走到 b 的第 t 個點（t 從 0 到 1），給快速模擬用來假造移動軌跡 */
export function interpolateLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** 一條多點路徑（例如 Directions API 或官方路廊回傳的幾何）的總長度，公里。 */
export function totalPathDistanceKm(path: LatLng[]): number {
  let totalM = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalM += haversineDistanceMeters(path[i], path[i + 1]);
  }
  return totalM / 1000;
}

/**
 * 沿著多點路徑（例如 Directions API 回傳的路網幾何）走到整條路徑的第 t 個比例位置（0~1），
 * 依每段的實際距離加權，不是單純依索引位置切，這樣長短不一的路段才不會走起來忽快忽慢。
 */
export function interpolateAlongPath(path: LatLng[], t: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1) return path[0];

  const clampedT = Math.min(1, Math.max(0, t));

  const segmentLengths = path.slice(0, -1).map((p, i) => haversineDistanceMeters(p, path[i + 1]));
  const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);
  if (totalLength === 0) return path[0];

  const targetDistance = clampedT * totalLength;
  let accumulated = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDistance || i === segmentLengths.length - 1) {
      const segT = segLen === 0 ? 0 : (targetDistance - accumulated) / segLen;
      return interpolateLatLng(path[i], path[i + 1], Math.min(1, Math.max(0, segT)));
    }
    accumulated += segLen;
  }
  return path[path.length - 1];
}
