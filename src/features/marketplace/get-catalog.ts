import { prisma } from "@/lib/db";

export type CatalogItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  costSP: number;
  imagePath: string | null;
};

export async function getCatalog(): Promise<CatalogItem[]> {
  const items = await prisma.marketplaceItem.findMany({
    where: { active: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      costSP: true,
      imagePath: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return items;
}
