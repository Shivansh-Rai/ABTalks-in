import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: "resume-tester@abtalks.dev" }, select: { id: true } });
  const r = await prisma.candidateResume.findMany({ where: { userId: u!.id }, select: { status: true, createdAt: true } });
  console.log("resume rows:", r);
}
main().finally(() => prisma.$disconnect());
