import Image from "next/image";
import { ShoppingBag } from "lucide-react";

import { EarningPills } from "@/components/marketplace/earning-pills";

export function MarketplaceHero() {
  return (
    <section className="relative w-full overflow-hidden border-b border-[#E0E0E0] bg-gradient-to-b from-[#EEF6F6] to-[#F4F4F4]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 130% at 15% 25%, rgba(3, 83, 95, 0.08) 0%, rgba(3, 83, 95, 0) 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden xl:block"
        style={{
          // The merch occupies the right 55.6% of the artwork, so the fade must
          // finish before 44.4%. Because the wrapper is sized by the image
          // itself (below), these percentages track the artwork rather than the
          // viewport — the product can never be caught by the fade at any width.
          maskImage:
            "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.5) 14%, #000 30%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.5) 14%, #000 30%)",
        }}
      >
        <Image
          src="/marketplace/hero-merch.png"
          alt=""
          width={1836}
          height={857}
          priority
          sizes="70vw"
          className="h-full w-auto max-w-none"
        />
      </div>

      <div className="relative mx-auto flex max-w-[1897px] flex-col gap-6 px-5 py-10 sm:px-10 sm:py-12 lg:min-h-[360px] lg:justify-center lg:py-16">
        <div className="flex max-w-xl flex-col gap-4">
          <span className="inline-flex items-center gap-2 font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.18em] text-[#03535F]">
            <ShoppingBag className="size-4" aria-hidden />
            Marketplace
          </span>
          <h1 className="text-[40px] leading-[44px] font-bold text-black lg:text-[64px] lg:leading-[70px]">
            Redeem your <span className="text-[#03535F]">Synergy</span> Points
          </h1>
          <p className="max-w-md text-base leading-[25px] text-[#626262] sm:text-[17px] sm:leading-7">
            Turn the points you earn from daily tasks, referrals, and proof of
            work into exclusive ABTalks merchandise.
          </p>
        </div>
        <EarningPills />
      </div>
    </section>
  );
}
