import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: "resume-tester@abtalks.dev" }, select: { id: true, createdAt: true } });
  if (!u) return console.log("no user");
  const [sp, cp] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: u.id }, select: { id: true, createdAt: true } }),
    prisma.candidateProfile.findUnique({ where: { userId: u.id }, select: { id: true, createdAt: true, phone: true } }),
  ]);
  console.log({ user: u, studentProfile: sp, candidateProfile: cp ? { ...cp, phone: cp.phone ? "set" : null } : null });
}
main().finally(() => prisma.$disconnect());
