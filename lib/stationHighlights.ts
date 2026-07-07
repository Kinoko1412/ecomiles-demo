import rawHighlights from "@/data/station-highlights.json";
import { STATIONS } from "@/lib/constants";

export type HighlightPlace = {
  id: string;
  name: string;
  types: string[];
  rating: number;
  userRatingCount: number;
  address: string;
  lat: number;
  lng: number;
  mapsUri: string;
};

type StationHighlightEntry = {
  station: string;
  segment: string;
  lat: number;
  lng: number;
  places: Omit<HighlightPlace, "id">[];
};

const RAW = rawHighlights as Record<string, StationHighlightEntry>;

// 住宿類：加分站點不收這些，避免變成「推薦飯店」
const EXCLUDED_TYPES = new Set([
  "lodging",
  "hotel",
  "bed_and_breakfast",
  "guest_house",
  "private_guest_room",
  "resort_hotel",
]);

// 優先保留的類型：景點/餐飲/公園類，同分數時再比評分高低
const PRIORITY_TYPES = new Set([
  "tourist_attraction",
  "restaurant",
  "cafe",
  "park",
  "scenic_spot",
  "museum",
  "food",
]);

const MAX_PLACES_PER_STATION = 3;

// station-highlights.json 用 "1".."14" 當 key，順序跟 lib/constants.ts 的 STATIONS 陣列一致
// （都是海線→吉安山線的站點順序），但站名用字偶有出入（例如「花蓮港景觀橋」vs 資料裡的
// 「花蓮港東景觀橋」），所以用陣列位置對應，不能直接用站名字串比對。
function keyForStation(stationName: string): string | null {
  const index = STATIONS.findIndex((s) => s === stationName);
  return index === -1 ? null : String(index + 1);
}

export function getStationCoords(stationName: string): { lat: number; lng: number } | null {
  const key = keyForStation(stationName);
  const entry = key ? RAW[key] : undefined;
  return entry ? { lat: entry.lat, lng: entry.lng } : null;
}

/** 該站篩選後、最多 3 筆的加分站點清單（已排除住宿類型，優先景點/餐飲類） */
export function getHighlightPlaces(stationName: string): HighlightPlace[] {
  const key = keyForStation(stationName);
  const entry = key ? RAW[key] : undefined;
  if (!entry) return [];

  const filtered = entry.places.filter((p) => !p.types.some((t) => EXCLUDED_TYPES.has(t)));

  const sorted = [...filtered].sort((a, b) => {
    const aPriority = a.types.some((t) => PRIORITY_TYPES.has(t)) ? 1 : 0;
    const bPriority = b.types.some((t) => PRIORITY_TYPES.has(t)) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  return sorted.slice(0, MAX_PLACES_PER_STATION).map((p, i) => ({
    ...p,
    id: `${key}-${i}`,
  }));
}

export type RideHighlight = HighlightPlace & { stationLabel: string };

/** 這趟騎乘起訖站相關的加分站點清單，起訖站相同時只回傳一份 */
export function getRideHighlights(startStation: string, endStation: string): RideHighlight[] {
  const start = getHighlightPlaces(startStation).map((p) => ({ ...p, stationLabel: startStation }));
  if (startStation === endStation) return start;
  const end = getHighlightPlaces(endStation).map((p) => ({ ...p, stationLabel: endStation }));
  return [...start, ...end];
}
