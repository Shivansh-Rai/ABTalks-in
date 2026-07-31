import { PrismaClient } from "@prisma/client";

const LINKS = [
  {
    slug: "vjit-po",
    label: "VJIT — placement officer",
    note: "Shared with Priya, 24 Jul",
  },
  { slug: "cbit-po", label: "CBIT — placement officer" },
  { slug: "wa-batch2027", label: "WhatsApp — 2027 batch group" },
  { slug: "friend-arjun", label: "Arjun (friend)" },
  { slug: "ca", label: "Campus Ambassador" },
  { slug: "1", label: "Campus Ambassador" },
  { slug: "2", label: "Campus Ambassador" },
  { slug: "3", label: "Campus Ambassador" },
  { slug: "4", label: "Campus Ambassador" },
  { slug: "5", label: "Campus Ambassador" },
  { slug: "6", label: "Campus Ambassador" },
  { slug: "7", label: "Campus Ambassador" },
  { slug: "8", label: "Campus Ambassador" },
  { slug: "9", label: "Campus Ambassador" },
] as const;

async function main() {
  const host = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : "(DATABASE_URL unset)";
  console.log(`Seeding HackathonLink on: ${host}`);

  const prisma = new PrismaClient();
  const result = await prisma.hackathonLink.createMany({
    data: [...LINKS],
    skipDuplicates: true,
  });
  const rows = await prisma.hackathonLink.findMany({
    select: { slug: true, label: true },
    orderBy: { slug: "asc" },
  });
  console.log(`created: ${result.count}; total now: ${rows.length}`);
  for (const r of rows) console.log(`  - ${r.slug}: ${r.label}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
