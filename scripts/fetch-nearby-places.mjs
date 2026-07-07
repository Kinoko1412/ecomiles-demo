import { writeFile, mkdir } from "fs/promises";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("請先設定環境變數 GOOGLE_PLACES_API_KEY 再執行這支腳本");
  process.exit(1);
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";

const STATIONS = [
  { id: 1, name: "朝金定置漁場", lat: 24.041295, lng: 121.621929, segment: "coastal" },
  { id: 2, name: "七星潭風景區", lat: 24.031427, lng: 121.627176, segment: "coastal" },
  { id: 3, name: "農好基地／四八高地", lat: 24.023822, lng: 121.630680, segment: "coastal" },
  { id: 4, name: "花蓮酒廠", lat: 24.018058, lng: 121.635513, segment: "coastal" },
  { id: 5, name: "奇萊鼻燈塔", lat: 24.015934, lng: 121.643866, segment: "coastal" },
  { id: 6, name: "花蓮港觀光遊憩碼頭", lat: 24.001620, lng: 121.640393, segment: "coastal" },
  { id: 7, name: "花蓮港東景觀橋", lat: 23.992683, lng: 121.635917, segment: "coastal" },
  { id: 8, name: "太平洋公園", lat: 23.977367, lng: 121.617851, segment: "coastal" },
  { id: 9, name: "吉安火車站", lat: 23.968154, lng: 121.582670, segment: "jian" },
  { id: 10, name: "吉安慶修院", lat: 23.973688, lng: 121.564715, segment: "jian" },
  { id: 11, name: "吉安農會", lat: 23.972086, lng: 121.562577, segment: "jian" },
  { id: 12, name: "干城綠色隧道", lat: 23.949530, lng: 121.541488, segment: "jian" },
  { id: 13, name: "鯉魚潭風景區", lat: 23.935000, lng: 121.507778, segment: "jian" },
  { id: 14, name: "白鮑溪沿線", lat: 23.879313, lng: 121.490063, segment: "jian" },
];

const EXCLUDE_TYPES = new Set([
  "gas_station", "atm", "bank", "convenience_store", "parking",
  "car_repair", "laundry", "car_wash", "electric_vehicle_charging_station",
  "storage", "moving_company", "insurance_agency", "real_estate_agency",
]);

const FIELD_MASK = [
  "places.id", "places.displayName", "places.types", "places.rating",
  "places.userRatingCount", "places.formattedAddress", "places.location",
  "places.googleMapsUri", "places.photos",
].join(",");

const MAX_PHOTOS_PER_PLACE = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadPhoto(photoName, destPath) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${API_KEY}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`photo fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

async function fetchStation(station) {
  const body = {
    maxResultCount: 10,
    locationRestriction: {
      circle: {
        center: { latitude: station.lat, longitude: station.lng },
        radius: 500.0,
      },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return { error: data };
  }

  const places = data.places || [];
  const filtered = places
    .filter((p) => {
      const types = new Set(p.types || []);
      for (const t of types) {
        if (EXCLUDE_TYPES.has(t)) return false;
      }
      return true;
    })
    .map((p) => ({
      name: p.displayName?.text || "未命名",
      types: p.types || [],
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      mapsUri: p.googleMapsUri ?? null,
      photoRefs: (p.photos || []).slice(0, MAX_PHOTOS_PER_PLACE).map((ph) => ph.name),
    }))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  return { places: filtered, rawCount: places.length };
}

async function main() {
  const results = {};
  const summary = [];

  await mkdir("public/photos", { recursive: true });

  for (const station of STATIONS) {
    try {
      const r = await fetchStation(station);
      if (r.error) {
        results[station.id] = { station: station.name, segment: station.segment, places: [], error: r.error };
        summary.push(`${station.id} ${station.name} -> 失敗: ${JSON.stringify(r.error).slice(0, 200)}`);
      } else {
        for (let pi = 0; pi < r.places.length; pi++) {
          const place = r.places[pi];
          place.photos = [];
          for (let phi = 0; phi < (place.photoRefs || []).length; phi++) {
            const fileName = `s${station.id}-p${pi}-${phi}.jpg`;
            try {
              await downloadPhoto(place.photoRefs[phi], `public/photos/${fileName}`);
              place.photos.push(`/photos/${fileName}`);
            } catch (photoErr) {
              console.log(`  照片下載失敗 (${station.name} / ${place.name} #${phi}): ${photoErr}`);
            }
            await sleep(150);
          }
          delete place.photoRefs;
        }
        results[station.id] = {
          station: station.name,
          segment: station.segment,
          lat: station.lat,
          lng: station.lng,
          places: r.places,
        };
        summary.push(`${station.id} ${station.name} -> ${r.places.length} 筆（原始 ${r.rawCount} 筆）`);
      }
    } catch (err) {
      results[station.id] = { station: station.name, segment: station.segment, places: [], error: String(err) };
      summary.push(`${station.id} ${station.name} -> 例外: ${err}`);
    }
    await sleep(300);
  }

  await mkdir("data", { recursive: true });
  await writeFile("data/station-highlights.json", JSON.stringify(results, null, 2), "utf-8");

  const mdLines = ["# 14站附近特色商家／景點（500公尺內，Google Places API）", ""];
  for (const station of STATIONS) {
    const entry = results[station.id];
    mdLines.push(`## ${station.id}. ${station.name}`, "");
    if (entry.error) {
      mdLines.push(`抓取失敗：${JSON.stringify(entry.error)}`, "");
      continue;
    }
    if (!entry.places.length) {
      mdLines.push("（500公尺內沒有符合條件的商家，可能需要人工補充或放寬篩選條件）", "");
      continue;
    }
    for (const p of entry.places) {
      const ratingTxt = p.rating ? `評分 ${p.rating}（${p.userRatingCount ?? 0}則評論）` : "尚無評分";
      mdLines.push(`- [${p.name}](${p.mapsUri || "#"}) — ${ratingTxt}`);
      if (p.address) mdLines.push(`  ${p.address}`);
    }
    mdLines.push("");
  }
  await writeFile("data/station-highlights.md", mdLines.join("\n"), "utf-8");

  console.log("=== 抓取結果摘要 ===");
  summary.forEach((line) => console.log(line));
  console.log("\n已寫入 data/station-highlights.json 和 data/station-highlights.md");
}

main();
