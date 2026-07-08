import RedeemTabs from "@/components/RedeemTabs";
import PartnerMerchantSection from "@/components/PartnerMerchantSection";

export default function RedeemShopsPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-6 pt-10">
      <RedeemTabs />

      <h1 className="text-xl font-bold text-emerald-700">特約商家</h1>

      <PartnerMerchantSection />
    </div>
  );
}
