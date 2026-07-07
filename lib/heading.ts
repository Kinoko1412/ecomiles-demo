import type { LatLng } from "@/lib/distance";

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 兩點間的標準方位角（0~360 度，正北為 0，順時針遞增），用來決定 3D 導航鏡頭該朝哪個方向轉。 */
export function computeBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const deltaLng = toRad(to.lng - from.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const bearing = toDeg(Math.atan2(y, x));

  return (bearing + 360) % 360;
}

/**
 * 把新算出的方位角往舊方位角平滑靠攏，alpha 是新值的權重（0~1，越大跟得越緊）。
 * 方位角是環繞的（0 度跟 360 度是同一個方向），不能直接線性內插，否則從 359 度轉到 1 度
 * 會被誤判成要轉一大圈 -358 度，而不是最短的 +2 度，所以先算出 (-180, 180] 範圍內的
 * 最短角度差，再套平滑，最後把結果收斂回 [0, 360)。
 */
export function smoothBearing(prev: number | null, next: number, alpha: number = 0.3): number {
  if (prev === null) return (next + 360) % 360;

  const shortestDiff = (((next - prev) % 360) + 540) % 360 - 180;
  const result = prev + alpha * shortestDiff;
  return ((result % 360) + 360) % 360;
}
