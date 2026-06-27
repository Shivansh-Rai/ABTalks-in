import type { CatalogItem } from "@/features/marketplace/get-catalog";
import { ProductCard } from "@/components/marketplace/product-card";

type Props = {
  items: CatalogItem[];
  balance: number;
  defaultPhone: string;
};

export function ProductGrid({ items, balance, defaultPhone }: Props) {
  return (
    <div
      id="products"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {items.map((item) => (
        <ProductCard
          key={item.id}
          item={item}
          balance={balance}
          defaultPhone={defaultPhone}
        />
      ))}
    </div>
  );
}
