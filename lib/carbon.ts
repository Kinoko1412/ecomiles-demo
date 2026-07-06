/**
 * 減碳量係數：假設騎乘取代四行程機車 0.0508 kgCO2e/km。
 * 出處：財團法人台灣碳環境永續基金會（引用張宇琦、柏雲昌 2021《綠色經濟電子期刊》第7卷），查證日期 2026-07-06。
 * 詳見 CLAUDE.md「碳減量係數」章節；正式版本禁止在其他檔案重複寫死此數字。
 */
export const CARBON_FACTOR_KG_PER_KM = 0.0508;

export function calcCarbonSavedKg(distanceKm: number): number {
  return distanceKm * CARBON_FACTOR_KG_PER_KM;
}
