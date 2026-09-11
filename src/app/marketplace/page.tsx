import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/shared/app-header";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { ProductGrid } from "@/components/marketplace/product-grid";
import { getCatalog } from "@/features/marketplace/get-catalog";
import { getMySynergy } from "@/features/synergy/get-my-synergy";
import { getCandidateProfile } from "@/repositories/candidate";
import { prisma } from "@/lib/db";

export default async function MarketplacePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [items, balance, candidate, contact] = await Promise.all([
    getCatalog(),
    getMySynergy(userId),
    getCandidateProfile(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        hackathonParticipants: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { phone: true },
        },
      },
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
    <div className="flex min-h-full flex-1 flex-col bg-[#F4F4F4] text-black">
      <AppHeader user={headerUser} />
      <MarketplaceHero />
      <main
        id="products"
        className="mx-auto w-full max-w-[1897px] flex-1 scroll-mt-20 px-5 py-8 sm:px-10 sm:py-10"
      >
        <ProductGrid
          items={items}
          balance={balance}
          defaultPhone={
            candidate?.phone ??
            contact?.hackathonParticipants[0]?.phone ??
            ""
          }
          defaultName={candidate?.fullName?.trim() || session.user.name || ""}
        />
      </main>
    </div>
  );
}
