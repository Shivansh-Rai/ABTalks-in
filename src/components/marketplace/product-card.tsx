import Image from "next/image";
import type { CatalogItem } from "@/features/marketplace/get-catalog";
import { ProductImage } from "@/components/marketplace/product-image";
import { RedeemButton } from "@/components/marketplace/redeem-button";

type Props = {
  item: CatalogItem;
  balance: number;
  defaultPhone: string;
  defaultName: string;
};

export function ProductCard({
  item,
  balance,
  defaultPhone,
  defaultName,
}: Props) {
  // Items priced at 0 SP aren't priced yet — show as "Revealing Soon".
  const revealSoon = item.costSP <= 0;

  return (
    <article className="flex min-h-[396px] w-full max-w-[312px] flex-col overflow-hidden rounded-[12px] border border-[#E0E0E0] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="overflow-hidden bg-[#F4F4F4]">
        <ProductImage src={item.imagePath} alt={item.title} />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3 className="text-xl font-semibold leading-[26px] text-black">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-4 text-[#626262]">
          {item.description}
        </p>

        {revealSoon ? (
          <>
            <div className="mt-auto flex items-center gap-2 pt-4">
              <span className="font-heading text-lg font-semibold text-black">
                Revealing Soon
              </span>
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#03535F]" />
            </div>
            <div className="mt-3">
              <div className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#E0E0E0] bg-[#F4F4F4] text-sm font-semibold text-[#8F8F8F]">
                Revealing Soon
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-auto flex items-center gap-2 pt-4">
              <Image
                src="/marketplace/synergy-coin.png"
                alt=""
                width={21}
                height={21}
                className="size-[21px] shrink-0 rounded-full"
                aria-hidden
              />
              <span className="font-heading text-xl font-semibold text-black">
                {item.costSP}
              </span>
              <span className="text-xs text-[#03535F]">Synergy Points</span>
            </div>
            <div className="mt-3">
              <RedeemButton
                itemId={item.id}
                costSP={item.costSP}
                itemTitle={item.title}
                balance={balance}
                imagePath={item.imagePath}
                defaultPhone={defaultPhone}
                defaultName={defaultName}
                sizeOptions={item.sizeOptions}
              />
            </div>
          </>
        )}
      </div>
    </article>
  );
}
