import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { EarningPills } from "@/components/marketplace/earning-pills";
import { dsButtonVariants } from "@/components/design/ds-button";
import { cn } from "@/lib/utils";

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
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] max-w-[820px] lg:block"
      >
        <Image
          src="/marketplace/hero-merch.png"
          alt=""
          fill
          priority
          sizes="46vw"
          className="object-contain object-right"
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
          <Link href="#products" className={cn(dsButtonVariants(), "w-fit gap-2")}>
            Browse Rewards
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <EarningPills />
      </div>
    </section>
  );
}
