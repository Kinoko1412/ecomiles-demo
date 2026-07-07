export default function ComingSoonBanner() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/80 px-4 py-3 shadow-sm">
      <span className="text-xl">🏆</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-700">2026 花蓮低碳挑戰賽</p>
        <p className="text-[11px] text-amber-600">建置中，敬請期待</p>
      </div>
      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
        Coming Soon
      </span>
    </div>
  );
}
