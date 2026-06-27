import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/shared/app-header";
import { EarningPills } from "@/components/marketplace/earning-pills";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { ProductGrid } from "@/components/marketplace/product-grid";
import { SortControl } from "@/components/marketplace/sort-control";
import { getCatalog } from "@/features/marketplace/get-catalog";
import { getMySynergy } from "@/features/synergy/get-my-synergy";
import { prisma } from "@/lib/db";

export default async function MarketplacePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [items, balance, profile] = await Promise.all([
    getCatalog(),
    getMySynergy(userId),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: { phone: true, college: true },
    }),
  ]);

  const headerUser = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
    role: session.user.role ?? "STUDENT",
    isAdmin: session.user.isAdmin ?? false,
  };

  return (
    <div className="flex min-h-svh flex-col bg-zinc-950 text-zinc-100">
      <AppHeader user={headerUser} />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        <MarketplaceHero />
        <EarningPills />
        <SortControl />
        <ProductGrid
          items={items}
          balance={balance}
          defaultPhone={profile?.phone ?? ""}
        />
      </main>
    </div>
  );
}
