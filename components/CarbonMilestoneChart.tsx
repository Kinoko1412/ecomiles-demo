import { calcCarbonSavedKg } from "@/lib/carbon";
import type { ThemeRoute } from "@/lib/themeRoutes";

const CHART_LEFT = 20;
const CHART_RIGHT = 300;
const BASELINE_Y = 120;
const PEAK_Y = 20;
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
const CHART_HEIGHT = BASELINE_Y - PEAK_Y;

/** 用「山」的意象呈現行程獎勵站點：每個真實站點一個轉折點，終點是山峰（全程減碳量） */
export default function CarbonMilestoneChart({ route }: { route: ThemeRoute }) {
  let cumulativeKm = 0;
  const cumulativeKmByStop = new Map<string, number>();
  for (const stop of route.stops) {
    cumulativeKm += stop.deltaKm;
    cumulativeKmByStop.set(stop.name, cumulativeKm);
  }

  const checkpoints = route.rewardCheckpoints.map((c) => {
    const distanceKm = cumulativeKmByStop.get(c.stopName) ?? route.totalDistanceKm;
    return {
      ...c,
      distanceKm,
      valueKg: calcCarbonSavedKg(distanceKm),
      fraction: distanceKm / route.totalDistanceKm,
    };
  });

  const points = [
    { x: CHART_LEFT, y: BASELINE_Y },
    ...checkpoints.map((c, i) => ({
      x: CHART_LEFT + CHART_WIDTH * ((i + 1) / checkpoints.length),
      y: BASELINE_Y - CHART_HEIGHT * c.fraction,
    })),
  ];
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${CHART_LEFT},${BASELINE_Y} ${linePoints} ${CHART_RIGHT},${BASELINE_Y}`;
  const peak = points[points.length - 1];

  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">減碳里程碑</p>
        <span className="text-[10px] text-slate-400">(僅供參考)</span>
      </div>

      <svg viewBox="0 0 320 150" className="w-full">
        <defs>
          <linearGradient id="milestoneFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#milestoneFill)" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.slice(1).map((p, i) => (
          <circle
            key={checkpoints[i].stopName}
            cx={p.x}
            cy={p.y}
            r={i === checkpoints.length - 1 ? 5 : 4}
            fill="#f59e0b"
            stroke="#0f172a"
            strokeWidth="2"
          />
        ))}
        <text x={peak.x} y={peak.y - 12} textAnchor="middle" fontSize="16">
          🏔️
        </text>
      </svg>

      <div
        className="mt-1 grid gap-2 text-center"
        style={{ gridTemplateColumns: `repeat(${checkpoints.length}, minmax(0, 1fr))` }}
      >
        {checkpoints.map((c) => (
          <div key={c.stopName}>
            <p className="text-[10px] text-slate-400">{c.stopName}</p>
            <p className="text-xs font-semibold text-amber-400">{c.valueKg.toFixed(2)} kg</p>
            <p className="text-[9px] text-emerald-400">
              {c.icon} {c.options ? c.options.join(" 或 ") : c.reward}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
