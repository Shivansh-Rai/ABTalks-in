import { Coins } from "lucide-react";
import type { CatalogItem } from "@/features/marketplace/get-catalog";
import { ProductImage } from "@/components/marketplace/product-image";
import { RedeemButton } from "@/components/marketplace/redeem-button";

type Props = {
  item: CatalogItem;
  balance: number;
  defaultPhone: string;
};

export function ProductCard({ item, balance, defaultPhone }: Props) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <ProductImage src={item.imagePath} alt={item.title} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display font-semibold text-zinc-100">
          {item.title}
        </h3>
        <p className="line-clamp-2 text-sm text-zinc-400">{item.description}</p>
        <div className="mt-auto flex items-center gap-1.5 text-sm text-violet-400">
          <Coins className="size-4" aria-hidden />
          <span className="font-medium">{item.costSP} Synergy Points</span>
        </div>
        <RedeemButton
          itemId={item.id}
          costSP={item.costSP}
          itemTitle={item.title}
          balance={balance}
          imagePath={item.imagePath}
          defaultPhone={defaultPhone}
        />
      </div>
    </article>
  );
}
