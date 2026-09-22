/**
 * Controlled Phase 8-B production probe: dedicated @abtalks.dev user.
 * ENABLE_DUAL_WRITE stays true. Cleans up after itself.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { Domain, EnrollmentStatus, EnrollmentStatusV2 } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";
import { peIdForEnrollment } from "../../src/repositories/ids";

async function main() {
  process.env.ENABLE_DUAL_WRITE = "true";
  process.env.ENABLE_NEW_LEARNING = "true";
  process.env.ENABLE_NEW_ENROLLMENT_STATE = "true";
  process.env.ENABLE_LEGACY_ENROLLMENT_DENORM_MIRROR = "false";
  process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";

  assertChildBranch();
  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "";
  console.log("HOST=" + host);
  if (!host.includes("ep-nameless-term-ams9a5e3")) {
    throw new Error("production probe requires nameless-term host");
  }
  if (host.includes("young-shadow")) throw new Error("refusing young-shadow");

  const { writeClient } = await import("../../src/lib/db");
  const { applyChallengeProgramEnrollment } = await import(
    "../../src/repositories/enrollment-state"
  );
  const { applyVisibilityChange } = await import("../../src/repositories/visibility");
  const prisma = writeClient();
  const stamp = Date.now().toString(36);
  const email = `p8b-probe-${stamp}@abtalks.dev`;

  const challenge = await prisma.challenge.findFirst({
    where: { domain: Domain.AI },
    select: { id: true },
  });
  if (!challenge) throw new Error("no AI challenge");

  const user = await prisma.user.create({
    data: { email, name: "P8B Probe" },
    select: { id: true },
  });
  let enrollmentId = "";
  try {
    enrollmentId = await prisma.$transaction(
      async (tx) => {
        const enrollment = await tx.enrollment.create({
          data: {
            userId: user.id,
            challengeId: challenge.id,
            domain: Domain.AI,
            status: EnrollmentStatus.ACTIVE,
          },
          select: {
            id: true,
            userId: true,
            domain: true,
            status: true,
            startedAt: true,
            completedAt: true,
          },
        });
        await applyVisibilityChange(tx, {
          userId: user.id,
          kind: "challenge_enroll",
        });
        const pe = await applyChallengeProgramEnrollment(tx, enrollment);
        if (pe.id !== `pe_enr_${enrollment.id}`) {
          throw new Error("canonical id mismatch");
        }
        return enrollment.id;
      },
      { maxWait: 20000, timeout: 20000 },
    );
    const pe = await prisma.programEnrollment.findUnique({
      where: { id: peIdForEnrollment(enrollmentId) },
      select: { id: true, status: true },
    });
    if (!pe || pe.status !== EnrollmentStatusV2.ACTIVE) {
      throw new Error("pe_enr_ missing after canonical writer");
    }
    console.log("PROBE_OK");
    console.log("email=" + email);
    console.log("enrollmentId=" + enrollmentId);
    console.log("peId=" + pe.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    console.log("PROBE_CLEANED");
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
