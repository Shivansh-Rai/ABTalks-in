import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// Back to "signed in, not registered". The READY CandidateResume row is kept.
async function main() {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: "resume-tester@abtalks.dev" }, select: { id: true } });
  const [cp, sp] = await prisma.$transaction([
    prisma.candidateProfile.deleteMany({ where: { userId: u.id } }),
    prisma.studentProfile.deleteMany({ where: { userId: u.id } }),
  ]);
  const resume = await prisma.candidateResume.findMany({ where: { userId: u.id }, select: { status: true } });
  console.log({ removedCandidateProfiles: cp.count, removedStudentProfiles: sp.count, resume });
}
main().finally(() => prisma.$disconnect());
