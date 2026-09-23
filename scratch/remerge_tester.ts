import { PrismaClient } from "@prisma/client";
import { applyStoredResumeToProfile } from "@/features/resume/service";
const prisma = new PrismaClient();
// Test account only: drop the résumé-made certifications/awards, then re-run the merge.
async function main() {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: "resume-tester@abtalks.dev" }, select: { id: true } });
  const certs = await prisma.candidateCertification.deleteMany({ where: { userId: u.id } });
  await prisma.candidateProfile.update({ where: { userId: u.id }, data: { awards: null } });
  const applied = await applyStoredResumeToProfile(u.id);
  const after = await prisma.candidateProfile.findUniqueOrThrow({
    where: { userId: u.id },
    select: { awards: true, certifications: { select: { name: true, issuer: true } } },
  });
  console.log({ removedCerts: certs.count, applied, after });
}
main().finally(() => prisma.$disconnect());
