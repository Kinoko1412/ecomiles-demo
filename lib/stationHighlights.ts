import rawHighlights from "@/data/station-highlights.json";
import rawPhotoPopularity from "@/data/photo-popularity.json";
import rawPhotoMonthlyPattern from "@/data/photo-monthly-pattern.json";
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
  photos: string[];
};

type RawPlace = Omit<HighlightPlace, "id" | "photos"> & { photos?: string[] };

type StationHighlightEntry = {
  station: string;
  segment: "coastal" | "jian";
  lat: number;
  lng: number;
  places: RawPlace[];
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
    photos: p.photos ?? [],
  }));
}

const MAX_PLACES_FOR_DIRECTORY = 5;

/** 「路線」分頁用：該站篩選後、最多 5 筆，純粹依評分排序（不像加分站點那樣優先景點類） */
export function getStationDirectoryPlaces(stationName: string): HighlightPlace[] {
  const key = keyForStation(stationName);
  const entry = key ? RAW[key] : undefined;
  if (!entry) return [];

  const filtered = entry.places.filter((p) => !p.types.some((t) => EXCLUDED_TYPES.has(t)));
  const sorted = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return sorted.slice(0, MAX_PLACES_FOR_DIRECTORY).map((p, i) => ({
    ...p,
    id: `${key}-dir-${i}`,
    photos: p.photos ?? [],
  }));
}

export function getStationSegment(stationName: string): "coastal" | "jian" | null {
  const key = keyForStation(stationName);
  const entry = key ? RAW[key] : undefined;
  return entry?.segment ?? null;
}

export type StationListItem = { index: number; name: string; segment: "coastal" | "jian" };

/** 該線（海線/山線）站點清單，index 是 1~14 的實際站點編號，不是該線內重新編號 */
export function getStationsBySegment(segment: "coastal" | "jian"): StationListItem[] {
  const result: StationListItem[] = [];
  STATIONS.forEach((name, i) => {
    const s = getStationSegment(name);
    if (s === segment) result.push({ index: i + 1, name, segment: s });
  });
  return result;
}

// 依類型挑一個代表 icon，由上而下第一個命中的類別勝出，其餘落到預設的 📍。
const ICON_RULES: [string[], string][] = [
  [["bicycle_store"], "🚲"],
  [["museum"], "🏛️"],
  [["place_of_worship", "buddhist_temple"], "⛩️"],
  [["cafe", "dessert_shop", "ice_cream_shop", "confectionery"], "🍰"],
  [
    [
      "restaurant",
      "chinese_restaurant",
      "american_restaurant",
      "family_restaurant",
      "hot_pot_restaurant",
      "tex_mex_restaurant",
      "deli",
      "food",
      "food_store",
    ],
    "🍽️",
  ],
  [["park"], "🌳"],
  [["scenic_spot", "tourist_attraction", "observation_deck"], "🏞️"],
  [["hiking_area", "campground", "camping_cabin"], "⛺"],
  [["swimming_pool"], "🏊"],
  [["sporting_goods_store", "sports_activity_location"], "🏸"],
  [["train_station", "transit_station", "transportation_service"], "🚉"],
  [["tour_agency", "travel_agency"], "🧳"],
  [["store", "market", "liquor_store", "book_store", "winery", "farm", "manufacturer", "supplier"], "🛍️"],
  [["educational_institution", "university"], "🎓"],
  [["government_office", "association_or_organization", "convention_center", "event_venue", "service"], "🏢"],
];

export function getPlaceIcon(types: string[]): string {
  for (const [candidates, icon] of ICON_RULES) {
    if (types.some((t) => candidates.includes(t))) return icon;
  }
  return "📍";
}

type PhotoPopularityEntry = { station: string; segment: "coastal" | "jian"; photoCount500m: number };
type PhotoMonthlyPatternEntry = {
  station: string;
  segment: "coastal" | "jian";
  monthlyCounts: number[];
  peakMonth: number;
};

const PHOTO_POPULARITY = rawPhotoPopularity as Record<string, PhotoPopularityEntry>;
const PHOTO_MONTHLY_PATTERN = rawPhotoMonthlyPattern as Record<string, PhotoMonthlyPatternEntry>;

export type PhotoPopularity = {
  photoCount500m: number;
  thisMonthCount: number;
  isPeakMonth: boolean;
};

/** 該站附近 500 公尺內的歷史打卡照片人氣資訊，資料缺漏或站點找不到就回傳 null（呼叫端不顯示徽章）*/
export function getPhotoPopularity(stationName: string): PhotoPopularity | null {
  const key = keyForStation(stationName);
  if (!key) return null;

  const popularity = PHOTO_POPULARITY[key];
  const monthly = PHOTO_MONTHLY_PATTERN[key];
  if (!popularity || !monthly || !popularity.photoCount500m) return null;

  const currentMonth = new Date().getMonth() + 1;
  const thisMonthCount = monthly.monthlyCounts[currentMonth - 1] ?? 0;

  return {
    photoCount500m: popularity.photoCount500m,
    thisMonthCount,
    isPeakMonth: currentMonth === monthly.peakMonth,
  };
}

export type RideHighlight = HighlightPlace & { stationLabel: string };

/** 這趟騎乘起訖站相關的加分站點清單，起訖站相同時只回傳一份 */
export function getRideHighlights(startStation: string, endStation: string): RideHighlight[] {
  const start = getHighlightPlaces(startStation).map((p) => ({ ...p, stationLabel: startStation }));
  if (startStation === endStation) return start;
  const end = getHighlightPlaces(endStation).map((p) => ({ ...p, stationLabel: endStation }));
  return [...start, ...end];
}
