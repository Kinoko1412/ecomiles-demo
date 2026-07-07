type Milestone = {
  label: string;
  fraction: number;
  valueKg: number;
};

const CHART_LEFT = 20;
const CHART_RIGHT = 300;
const BASELINE_Y = 120;
const PEAK_Y = 20;
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
const CHART_HEIGHT = BASELINE_Y - PEAK_Y;

/** 用「山」的意象呈現行程進度里程碑：每 1/3 進度一個轉折點，終點是山峰（全程減碳量） */
export default function CarbonMilestoneChart({ totalCarbonKg }: { totalCarbonKg: number }) {
  const milestones: Milestone[] = [
    { label: "第一階段", fraction: 1 / 3, valueKg: totalCarbonKg * (1 / 3) },
    { label: "第二階段", fraction: 2 / 3, valueKg: totalCarbonKg * (2 / 3) },
    { label: "顛峰", fraction: 1, valueKg: totalCarbonKg },
  ];

  const points = [
    { x: CHART_LEFT, y: BASELINE_Y },
    ...milestones.map((m, i) => ({
      x: CHART_LEFT + CHART_WIDTH * ((i + 1) / 3),
      y: BASELINE_Y - CHART_HEIGHT * m.fraction,
    })),
  ];
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${CHART_LEFT},${BASELINE_Y} ${linePoints} ${CHART_RIGHT},${BASELINE_Y}`;
  const peak = points[3];

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
            key={milestones[i].label}
            cx={p.x}
            cy={p.y}
            r={i === milestones.length - 1 ? 5 : 4}
            fill="#f59e0b"
            stroke="#0f172a"
            strokeWidth="2"
          />
        ))}
        <text x={peak.x} y={peak.y - 12} textAnchor="middle" fontSize="16">
          🏔️
        </text>
      </svg>

      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        {milestones.map((m) => (
          <div key={m.label}>
            <p className="text-[10px] text-slate-400">{m.label}</p>
            <p className="text-xs font-semibold text-amber-400">{m.valueKg.toFixed(2)} kg</p>
            <p className="text-[9px] text-emerald-400">🎁 額外獎勵</p>
          </div>
        ))}
      </div>
    </div>
  );
}
