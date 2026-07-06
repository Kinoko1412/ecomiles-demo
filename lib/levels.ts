import { LEVELS, type Level } from "./constants";

export function getLevelByDistance(totalDistanceKm: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (totalDistanceKm >= level.minKm) current = level;
  }
  return current;
}

export function getNextLevel(totalDistanceKm: number): Level | null {
  const current = getLevelByDistance(totalDistanceKm);
  const idx = LEVELS.findIndex((l) => l.id === current.id);
  return LEVELS[idx + 1] ?? null;
}
