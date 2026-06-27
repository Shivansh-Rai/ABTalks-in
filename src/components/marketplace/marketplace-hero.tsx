import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketplaceHero() {
  return (
    <section className="space-y-4 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Marketplace
      </h1>
      <p className="mx-auto max-w-xl text-sm text-zinc-400 sm:text-base">
        Redeem your synergy points for exclusive ABTalks merchandise. Complete
        tasks, refer friends, and share your work to earn more SP.
      </p>
      <Link
        href="#products"
        className={cn(
          buttonVariants({ variant: "default" }),
          "bg-violet-600 hover:bg-violet-500",
        )}
      >
        Browse Rewards
      </Link>
    </section>
  );
}
