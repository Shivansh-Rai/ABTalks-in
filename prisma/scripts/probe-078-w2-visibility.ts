/**
 * Controlled W2 production probe: withdraw then restore CandidateVisibility
 * on a test account. Does not anonymize. Does not touch Points.
 *
 * Requires PHASE2_ALLOW_PRODUCTION=1, production direct DATABASE_URL,
 * ENABLE_NEW_VISIBILITY_WRITES=true. Target: W2_PROBE_EMAIL or @abtalks.dev.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}

import { assertChildBranch } from "./migrate-078-shared";
import {
  isLegacyVisibilityMirrorEnabled,
  isNewVisibilityWritesEnabled,
} from "../../src/lib/feature-flags";

const TARGET_EMAIL =
  process.env.W2_PROBE_EMAIL?.trim() ||
  "078-dw-probe-mt8klx3t@abtalks.dev";

type Snap = {
  searchable: boolean | null;
  withdrawnAt: Date | null;
  consentSource: string | null;
  openToWork: boolean | null;
};

async function main() {
  process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";
  process.env.ENABLE_DUAL_WRITE = "true";
  if (process.env.ENABLE_LEGACY_VISIBILITY_MIRROR === undefined) {
    process.env.ENABLE_LEGACY_VISIBILITY_MIRROR = "true";
  }

  assertChildBranch();
  if (!isNewVisibilityWritesEnabled()) {
    throw new Error("ENABLE_NEW_VISIBILITY_WRITES must be true for this probe");
  }
  if (!isLegacyVisibilityMirrorEnabled()) {
    console.warn("ENABLE_LEGACY_VISIBILITY_MIRROR is false; consent column stays frozen");
  }

  const { writeClient } = await import("../../src/lib/db");
  const { applyVisibilityChange } = await import("../../src/repositories/visibility");
  const prisma = writeClient();

  async function snapshot(userId: string): Promise<Snap> {
    const [vis, pref] = await Promise.all([
      prisma.candidateVisibility.findUnique({
        where: { userId },
        select: {
          searchableByRecruiters: true,
          withdrawnAt: true,
          consentSource: true,
        },
      }),
      prisma.candidatePreference.findUnique({
        where: { userId },
        select: { openToWork: true },
      }),
    ]);
    return {
      searchable: vis?.searchableByRecruiters ?? null,
      withdrawnAt: vis?.withdrawnAt ?? null,
      consentSource: vis?.consentSource ?? null,
      openToWork: pref?.openToWork ?? null,
    };
  }

  const target = await prisma.user.findFirst({
    where: {
      email: TARGET_EMAIL,
      deletedAt: null,
      visibility: { isNot: null },
    },
    select: { id: true, email: true },
  });
  if (!target) {
    throw new Error(`Probe refused: no live user with CandidateVisibility (${TARGET_EMAIL})`);
  }

  const before = await snapshot(target.id);
  const off = await prisma.$transaction((tx) =>
    applyVisibilityChange(tx, { userId: target.id, kind: "admin_withdraw" }),
  );
  const afterOff = await snapshot(target.id);
  const on = await prisma.$transaction((tx) =>
    applyVisibilityChange(tx, { userId: target.id, kind: "probe_restore" }),
  );
  const afterOn = await snapshot(target.id);

  const report = {
    email: target.email,
    userId: target.id,
    before,
    off,
    afterOff,
    on,
    afterOn,
    openToWorkUnchanged:
      before.openToWork === afterOff.openToWork &&
      afterOff.openToWork === afterOn.openToWork,
  };
  console.log(JSON.stringify(report, null, 2));

  if (afterOff.searchable !== false || afterOff.withdrawnAt == null) {
    throw new Error("OFF did not withdraw CandidateVisibility");
  }
  if (afterOn.searchable !== true || afterOn.withdrawnAt != null) {
    throw new Error("ON/restore did not clear withdrawnAt");
  }
  if (!report.openToWorkUnchanged) {
    throw new Error("openToWork changed during visibility probe");
  }
  console.log("W2 production visibility probe passed (openToWork unchanged).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
