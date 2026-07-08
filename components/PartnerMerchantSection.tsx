import Image from "next/image";
import { PARTNER_MERCHANTS } from "@/lib/partnerMerchants";

export default function PartnerMerchantSection() {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-600">🤝 合作店家</h2>
      <div className="flex flex-col gap-3">
        {PARTNER_MERCHANTS.map((m) => (
          <div
            key={m.id}
            className="flex overflow-hidden rounded-2xl bg-white/85 shadow-sm ring-1 ring-black/5"
          >
            <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
              <Image src={m.photo} alt={m.name} fill className="object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
              <div>
                <span className="text-[10px] font-medium text-emerald-600">{m.category}</span>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{m.name}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                  {m.description}
                </p>
              </div>
              <div className="mt-2 flex justify-end">
                <a
                  href={m.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-sky-600"
                >
                  前往商家 ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
