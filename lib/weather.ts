import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export type HualienWeather = {
  temp: number;
  /** km/h。CWA 原始資料是公尺/秒，這裡已經轉換過，呼叫端不用再自己換算。 */
  windSpeed: number;
  /** 百分比（0~100） */
  rainChance: number;
  description: string;
  /** ISO 時間字串。API 成功時是實際抓取時間；讀快取 fallback 時是「上次成功抓取」的時間，
   *  讓 UI 可以誠實顯示資料有多舊。 */
  updatedAt: string;
};

// F-D0047-041：中央氣象署開放資料平台「臺灣各縣市鄉鎮未來3天天氣預報」花蓮縣資料集。
// 查詢方式：https://opendata.cwa.gov.tw 搜尋「花蓮縣鄉鎮天氣預報」，或直接呼叫
// /api/v1/rest/datastore/F-D0047-041 帶 locationName=花蓮市 驗證（已於開發時手動查證過）。
const CWA_DATASET_ID = "F-D0047-041";
// 花蓮市當作整個花蓮縣（山線＋海線）的代表觀測點，這是一張單一天氣卡片、不是逐站氣象，
// 不需要 14 站各自查一次。
const CWA_LOCATION_NAME = "花蓮市";
const CWA_FETCH_TIMEOUT_MS = 8000;

const CACHE_DIR = path.join(process.cwd(), "data", ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "weather.json");

type CwaElementValue = Record<string, string>;
type CwaElement = {
  ElementName: string;
  Time: { DataTime?: string; StartTime?: string; EndTime?: string; ElementValue: CwaElementValue[] }[];
};

function extractElementValue(elements: CwaElement[], elementName: string, valueKey: string): string | null {
  const element = elements.find((e) => e.ElementName === elementName);
  const value = element?.Time?.[0]?.ElementValue?.[0]?.[valueKey];
  return typeof value === "string" ? value : null;
}

/**
 * 呼叫 CWA 開放資料平台拿花蓮市的即時天氣預報，失敗（逾時、非 200、資料格式異常）一律
 * throw，交給呼叫端統一 fallback。CWA 的網站過去發生過 SSL 憑證問題，那種情況 fetch 通常
 * 會直接丟出訊息裡帶 "certificate" / "SSL" 字樣的錯誤，這裡不特別分流處理，一律當成
 * fetch 失敗、退回快取即可，錯誤訊息會印在 log 裡方便事後判斷是不是這個已知問題。
 */
async function fetchFromCwa(): Promise<HualienWeather | null> {
  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) return null;

  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${CWA_DATASET_ID}?Authorization=${apiKey}&locationName=${encodeURIComponent(CWA_LOCATION_NAME)}&format=JSON`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CWA_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`CWA API 回傳非 200：${res.status}`);

    const data = await res.json();
    const location = data?.records?.Locations?.[0]?.Location?.[0];
    const elements: CwaElement[] = location?.WeatherElement ?? [];
    if (!location || elements.length === 0) {
      throw new Error("CWA 回傳資料格式異常，找不到 WeatherElement");
    }

    const tempStr = extractElementValue(elements, "溫度", "Temperature");
    const windStr = extractElementValue(elements, "風速", "WindSpeed"); // 公尺/秒
    const rainStr = extractElementValue(elements, "3小時降雨機率", "ProbabilityOfPrecipitation");
    const weatherStr = extractElementValue(elements, "天氣現象", "Weather");

    const temp = tempStr !== null ? Number(tempStr) : NaN;
    const windSpeedMs = windStr !== null ? Number(windStr) : NaN;
    const rainChance = rainStr !== null ? Number(rainStr) : NaN;

    if (Number.isNaN(temp) || Number.isNaN(windSpeedMs) || Number.isNaN(rainChance) || !weatherStr) {
      throw new Error("CWA 回傳的數值欄位無法解析");
    }

    return {
      temp,
      windSpeed: Math.round(windSpeedMs * 3.6 * 10) / 10,
      rainChance,
      description: weatherStr,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readCache(): Promise<HualienWeather | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as HualienWeather;
  } catch {
    return null;
  }
}

async function writeCache(weather: HualienWeather): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(weather, null, 2), "utf-8");
  } catch (err) {
    // Vercel 之類的 serverless 環境檔案系統多半唯讀（/tmp 除外），寫入快取會失敗；
    // 這裡吞掉錯誤只印警告，不能讓「寫快取失敗」擋掉這次已經成功拿到、要回傳給使用者的天氣資料。
    console.warn("[weather] 寫入快取失敗，忽略：", err instanceof Error ? err.message : err);
  }
}

/**
 * 花蓮當地（以花蓮市為代表點）天氣資訊，資料來源中央氣象署開放資料平台 F-D0047-041。
 *
 * 快取 fallback 策略：API 成功就順便寫入 data/.cache/weather.json 當下次的備援；
 * API 失敗（逾時、非 200、資料格式異常、憑證錯誤等）就改讀上一次成功寫入的快取；
 * 連快取都沒有（例如全新環境、從沒成功抓過一次）才回傳 null，呼叫端要自己處理
 * 「天氣資訊暫時無法取得」的顯示，不能讓整頁報錯。
 */
export async function getHualienWeather(): Promise<HualienWeather | null> {
  try {
    const fresh = await fetchFromCwa();
    if (fresh) {
      await writeCache(fresh);
      return fresh;
    }
  } catch (err) {
    console.warn("[weather] 抓取即時天氣失敗，改用快取：", err instanceof Error ? err.message : err);
  }
  return readCache();
}
