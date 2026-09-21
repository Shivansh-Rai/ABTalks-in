/**
 * W5-A Campus Ambassador write-authority tests.
 * Run: npm run test:078-ambassador-writes
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Domain } from "@prisma/client";
import {
  isLegacyAmbassadorMirrorEnabled,
  isNewAmbassadorWritesEnabled,
} from "@/lib/feature-flags";
import { applyAmbassadorChange } from "@/repositories/ambassador";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void | Promise<void>) {
  const run = Promise.resolve().then(fn);
  return run.then(
    () => {
      passed++;
      console.log(`  ✓ ${name}`);
    },
    (err: unknown) => {
      failed++;
      console.log(`  ✗ ${name}`);
      console.error(err instanceof Error ? err.stack ?? err.message : err);
    },
  );
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, acc);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

type SpRow = {
  userId: string;
  fullName: string;
  phone: string | null;
  referralCode: string;
  skills: string[];
  college: string | null;
  organization: string | null;
  synergyPoints: number;
  domain: Domain | null;
  isCampusAmbassadorCandidate: boolean;
  ambassadorAppliedAt: Date | null;
  ambassadorDismissedAt: Date | null;
};

type CaaRow = {
  id: string;
  userId: string;
  isCandidate: boolean;
  appliedAt: Date | null;
  dismissedAt: Date | null;
};

function makeTx(init?: { sp?: SpRow | null }) {
  let sp: SpRow | null =
    init && "sp" in init
      ? init.sp
      : {
          userId: "u1",
          fullName: "Ada",
          phone: "+91000",
          referralCode: "REF1",
          skills: ["sql"],
          college: "IIT",
          organization: null,
          synergyPoints: 42,
          domain: Domain.SE,
          isCampusAmbassadorCandidate: false,
          ambassadorAppliedAt: null,
          ambassadorDismissedAt: null,
        };
  const caa = new Map<string, CaaRow>();
  const writes: string[] = [];
  const savepoints: string[] = [];

  const tx = {
    writes,
    getSp: () => sp,
    getCaa: (userId: string) => caa.get(userId) ?? null,
    campusAmbassadorApplication: {
      findUnique: async ({ where: { userId } }: { where: { userId: string } }) =>
        caa.get(userId) ?? null,
      upsert: async ({
        where: { userId },
        create,
        update,
      }: {
        where: { userId: string };
        create: CaaRow;
        update: Omit<CaaRow, "id" | "userId">;
      }) => {
        const existing = caa.get(userId);
        if (!existing) {
          caa.set(userId, { ...create });
          writes.push("caa.create");
          return create;
        }
        const next = { ...existing, ...update };
        caa.set(userId, next);
        writes.push("caa.update");
        return next;
      },
    },
    studentProfile: {
      findUnique: async ({ where: { userId } }: { where: { userId: string } }) =>
        sp?.userId === userId ? sp : null,
      update: async ({
        where: { userId },
        data,
      }: {
        where: { userId: string };
        data: Partial<SpRow>;
      }) => {
        if (!sp || sp.userId !== userId) throw new Error("Record to update not found.");
        const keys = Object.keys(data);
        writes.push(`sp.update:${keys.sort().join(",")}`);
        sp = { ...sp, ...data };
        return sp;
      },
      updateMany: async ({
        where: { userId },
        data,
      }: {
        where: { userId: string };
        data: Partial<SpRow>;
      }) => {
        if (!sp || sp.userId !== userId) return { count: 0 };
        const keys = Object.keys(data);
        writes.push(`sp.updateMany:${keys.sort().join(",")}`);
        sp = { ...sp, ...data };
        return { count: 1 };
      },
    },
    $executeRawUnsafe: async (sql: string) => {
      savepoints.push(sql);
      writes.push(`sql:${sql.split(" ")[0]}`);
    },
  };
  return tx;
}

async function withFlags<T>(
  flags: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(flags)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function main() {
  await suite("ENABLE_NEW_AMBASSADOR_WRITES defaults off", async () => {
    await withFlags({ ENABLE_NEW_AMBASSADOR_WRITES: undefined }, () => {
      assert(isNewAmbassadorWritesEnabled() === false, "unset is false");
    });
    await withFlags({ ENABLE_NEW_AMBASSADOR_WRITES: "false" }, () => {
      assert(isNewAmbassadorWritesEnabled() === false, "false is false");
    });
    await withFlags({ ENABLE_NEW_AMBASSADOR_WRITES: "true" }, () => {
      assert(isNewAmbassadorWritesEnabled() === true, "true is true");
    });
  });

  await suite("ENABLE_LEGACY_AMBASSADOR_MIRROR defaults on", async () => {
    await withFlags({ ENABLE_LEGACY_AMBASSADOR_MIRROR: undefined }, () => {
      assert(isLegacyAmbassadorMirrorEnabled() === true, "unset is true");
    });
    await withFlags({ ENABLE_LEGACY_AMBASSADOR_MIRROR: "true" }, () => {
      assert(isLegacyAmbassadorMirrorEnabled() === true, "true is true");
    });
    await withFlags({ ENABLE_LEGACY_AMBASSADOR_MIRROR: "false" }, () => {
      assert(isLegacyAmbassadorMirrorEnabled() === false, "false is false");
    });
  });

  await suite("flag helpers are explicit", () => {
    const src = source("src/lib/feature-flags.ts");
    assert(src.includes('process.env.ENABLE_NEW_AMBASSADOR_WRITES === "true"'), "writes === true");
    assert(
      src.includes('process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR !== "false"'),
      "mirror !== false",
    );
  });

  await suite("actions and anonymize route through applyAmbassadorChange", () => {
    const actions = source("src/app/actions/campus-ambassador-actions.ts");
    assert(actions.includes("applyAmbassadorChange"), "actions");
    assert(actions.includes('{ kind: "apply" }'), "apply kind");
    assert(actions.includes('{ kind: "dismiss" }'), "dismiss kind");
    assert(!actions.includes("studentProfile"), "no SP in actions");
    const anon = source("src/features/admin/anonymize-user.ts");
    assert(anon.includes("applyAmbassadorChange"), "anonymize wipe");
    assert(anon.includes('{ kind: "wipe"'), "wipe kind");
    const studentWipe = anon.slice(
      anon.indexOf("const studentWipe"),
      anon.indexOf("await applyAmbassadorChange"),
    );
    assert(!studentWipe.includes("isCampusAmbassadorCandidate"), "studentWipe no ambassador");
    assert(anon.includes("isCampusAmbassadorCandidate: false"), "CP leftover PII still wiped");
  });

  await suite("admin list and product reads use canonical ambassador", () => {
    const admin = source("src/app/admin/campus-ambassadors/page.tsx");
    assert(admin.includes("listAmbassadorCandidates"), "admin list");
    assert(!admin.includes("studentProfile.findMany"), "not SP list");
    const dash = source("src/features/dashboard/get-dashboard-data.ts");
    assert(dash.includes("getAmbassadorState"), "dashboard");
    const detail = source("src/features/admin/get-student-detail.ts");
    assert(detail.includes("getAmbassadorState"), "student detail");
    const overlay = source("src/features/user/get-user-with-profile.ts");
    assert(overlay.includes("getAmbassadorState"), "user overlay");
  });

  await suite("identity dual-write no longer copies ambassador onto CandidateProfile", () => {
    const src = source("src/repositories/dual-write.ts");
    assert(!src.includes("isCampusAmbassadorCandidate"), "no SP→CP ambassador copy");
    assert(!src.includes("ambassadorAppliedAt"), "no appliedAt copy");
    assert(!src.includes("ambassador: true"), "not in submittedAll");
  });

  await suite("no live StudentProfile ambassador mutation outside the W5 boundary", () => {
    const root = join(process.cwd(), "src");
    const allowed = new Set([
      join(root, "repositories/ambassador.ts"),
    ]);
    const writeRe =
      /studentProfile\.(updateMany|update)\(\s*\{[\s\S]*?data:\s*\{[\s\S]*?(isCampusAmbassadorCandidate|ambassadorAppliedAt|ambassadorDismissedAt)/;
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (allowed.has(file)) continue;
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const text = readFileSync(file, "utf8");
      if (writeRe.test(text)) {
        offenders.push(file.replace(process.cwd() + "/", ""));
      }
    }
    assert(offenders.length === 0, `direct SP ambassador writes: ${offenders.join(", ")}`);
  });

  await suite("backfill is idempotent insert-only from StudentProfile", () => {
    const src = source("prisma/scripts/backfill-078-w5a-ambassador.ts");
    assert(src.includes("ON CONFLICT"), "conflict");
    assert(src.includes("DO NOTHING"), "no overwrite");
    assert(src.includes('"StudentProfile"'), "SP source");
    assert(!src.includes("APPROVED"), "no invented approved");
    assert(!src.includes("ACTIVE"), "no invented active");
  });

  await suite("schema is additive CampusAmbassadorApplication", () => {
    const schema = source("prisma/schema.prisma");
    assert(schema.includes("model CampusAmbassadorApplication"), "model");
    assert(schema.includes("isCandidate"), "isCandidate");
    assert(schema.includes("campusAmbassadorApplication"), "User relation");
    const migration = source(
      "prisma/migrations/20260921190000_campus_ambassador_application/migration.sql",
    );
    assert(migration.includes("CREATE TABLE"), "create");
    assert(!migration.includes("DROP "), "no drop");
    assert(!migration.includes('ALTER TABLE "StudentProfile"'), "does not alter SP");
  });

  await suite("new apply writes canonical first then SP ambassador mirror", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
        AMBASSADOR_FAIL_LEGACY_MIRROR: undefined,
      },
      async () => {
        const tx = makeTx();
        const at = new Date("2026-09-21T10:00:00.000Z");
        const result = await applyAmbassadorChange(tx as never, "u1", {
          kind: "apply",
          at,
        });
        assert(result.state.isCandidate === true, "candidate");
        assert(result.state.appliedAt?.toISOString() === at.toISOString(), "appliedAt");
        assert(result.created === true, "created");
        assert(result.mirrorFailed === false, "mirror ok");
        const caa = tx.getCaa("u1");
        assert(caa?.isCandidate === true, "canonical candidate");
        assert(tx.getSp()?.isCampusAmbassadorCandidate === true, "SP mirrored");
        assert(tx.writes[0] === "caa.create", `canonical first, got ${tx.writes[0]}`);
        assert(
          tx.writes.some((w) => w.startsWith("sp.updateMany:")),
          "SP mirror",
        );
        const mirrorWrite = tx.writes.find((w) => w.startsWith("sp.updateMany:"));
        assert(
          mirrorWrite ===
            "sp.updateMany:ambassadorAppliedAt,ambassadorDismissedAt,isCampusAmbassadorCandidate",
          `ambassador-only SP keys: ${mirrorWrite}`,
        );
      },
    );
  });

  await suite("retry apply does not duplicate or change appliedAt", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        const first = new Date("2026-09-21T10:00:00.000Z");
        await applyAmbassadorChange(tx as never, "u1", { kind: "apply", at: first });
        const second = new Date("2026-09-21T11:00:00.000Z");
        const retry = await applyAmbassadorChange(tx as never, "u1", {
          kind: "apply",
          at: second,
        });
        assert(retry.created === false, "no duplicate create");
        assert(retry.state.appliedAt?.toISOString() === first.toISOString(), "timestamp kept");
        assert(tx.getCaa("u1")?.appliedAt?.toISOString() === first.toISOString(), "canonical kept");
        assert(
          tx.getSp()?.ambassadorAppliedAt?.toISOString() === first.toISOString(),
          "SP kept",
        );
      },
    );
  });

  await suite("dismiss sets dismissedAt without clearing candidate", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        const applied = new Date("2026-09-21T10:00:00.000Z");
        await applyAmbassadorChange(tx as never, "u1", { kind: "apply", at: applied });
        const dismissed = new Date("2026-09-21T12:00:00.000Z");
        const result = await applyAmbassadorChange(tx as never, "u1", {
          kind: "dismiss",
          at: dismissed,
        });
        assert(result.state.isCandidate === true, "still candidate");
        assert(result.state.dismissedAt?.toISOString() === dismissed.toISOString(), "dismissed");
        const retryAt = new Date("2026-09-21T13:00:00.000Z");
        const retry = await applyAmbassadorChange(tx as never, "u1", {
          kind: "dismiss",
          at: retryAt,
        });
        assert(retry.state.dismissedAt?.toISOString() === dismissed.toISOString(), "retry kept");
      },
    );
  });

  await suite("dismiss without apply is banner-dismiss only", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        const at = new Date("2026-09-21T12:00:00.000Z");
        const result = await applyAmbassadorChange(tx as never, "u1", {
          kind: "dismiss",
          at,
        });
        assert(result.state.isCandidate === false, "not a candidate");
        assert(result.state.appliedAt === null, "no invented appliedAt");
        assert(result.state.dismissedAt?.toISOString() === at.toISOString(), "dismissed");
      },
    );
  });

  await suite("wipe clears canonical and SP ambassador fields", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        await applyAmbassadorChange(tx as never, "u1", {
          kind: "apply",
          at: new Date("2026-09-21T10:00:00.000Z"),
        });
        const wiped = await applyAmbassadorChange(tx as never, "u1", { kind: "wipe" });
        assert(wiped.state.isCandidate === false, "cleared");
        assert(wiped.state.appliedAt === null, "applied cleared");
        assert(tx.getCaa("u1")?.isCandidate === false, "canonical cleared");
        assert(tx.getSp()?.isCampusAmbassadorCandidate === false, "SP cleared");
      },
    );
  });

  await suite("mirror failure keeps canonical and logs", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
        AMBASSADOR_FAIL_LEGACY_MIRROR: "1",
      },
      async () => {
        const tx = makeTx();
        const at = new Date("2026-09-21T10:00:00.000Z");
        const result = await applyAmbassadorChange(tx as never, "u1", {
          kind: "apply",
          at,
        });
        assert(result.mirrorFailed === true, "flagged");
        assert(result.state.isCandidate === true, "canonical committed");
        assert(tx.getCaa("u1")?.isCandidate === true, "row kept");
        assert(tx.getSp()?.isCampusAmbassadorCandidate === false, "SP unchanged");
      },
    );
  });

  await suite("W5 writes do not modify W4 identity, points, or domain", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: "true",
        ENABLE_LEGACY_AMBASSADOR_MIRROR: "true",
      },
      async () => {
        const tx = makeTx();
        const before = tx.getSp()!;
        await applyAmbassadorChange(tx as never, "u1", {
          kind: "apply",
          at: new Date("2026-09-21T10:00:00.000Z"),
        });
        const after = tx.getSp()!;
        assert(after.fullName === before.fullName, "fullName");
        assert(after.phone === before.phone, "phone");
        assert(after.referralCode === before.referralCode, "referral");
        assert(after.college === before.college, "college");
        assert(after.organization === before.organization, "organization");
        assert(JSON.stringify(after.skills) === JSON.stringify(before.skills), "skills");
        assert(after.synergyPoints === 42, "points");
        assert(after.domain === Domain.SE, "domain");
        const amb = source("src/repositories/ambassador.ts");
        const dataFn = amb.slice(
          amb.indexOf("function ambassadorStudentProfileData"),
          amb.indexOf("function nextState"),
        );
        assert(dataFn.includes("isCampusAmbassadorCandidate"), "flag");
        assert(dataFn.includes("ambassadorAppliedAt"), "applied");
        assert(dataFn.includes("ambassadorDismissedAt"), "dismissed");
        assert(!dataFn.includes("fullName"), "no identity");
        assert(!dataFn.includes("synergyPoints"), "no points");
        assert(!dataFn.includes("domain"), "no domain");
      },
    );
  });

  await suite("W5 flag does not suppress domain writers", () => {
    const enroll = source("src/features/enrollment/create-core-enrollment.ts");
    assert(enroll.includes("studentProfile.updateMany"), "domain denorm still writes SP");
    assert(!enroll.includes("isNewAmbassadorWritesEnabled"), "domain not gated by W5");
    const points = source("src/repositories/points.ts");
    assert(points.includes("studentProfile.updateMany"), "points path unchanged");
    assert(!points.includes("isNewAmbassadorWritesEnabled"), "points not gated by W5");
  });

  await suite("access control is not granted from candidacy", () => {
    const amb = source("src/repositories/ambassador.ts");
    assert(!amb.includes("UserRoleAssignment"), "no role assignment");
    assert(!amb.includes("PlatformRole"), "no platform role");
    const actions = source("src/app/actions/campus-ambassador-actions.ts");
    assert(!actions.includes("requireAdmin"), "apply is the signed-in user");
    const admin = source("src/app/admin/campus-ambassadors/page.tsx");
    assert(admin.includes("requireAdmin"), "admin list is admin-gated");
    const banner = source("src/components/dashboard/campus-ambassador-banner.tsx");
    assert(banner.includes("abtalksca.netlify.app"), "onboarding is off-site");
  });

  await suite("no approval/rejection states invented", () => {
    const amb = source("src/repositories/ambassador.ts");
    assert(!amb.includes("APPROVED"), "no approved");
    assert(!amb.includes("REJECTED"), "no rejected");
    assert(!amb.includes("withdrawnAt"), "no withdrawn");
    assert(amb.includes('"apply" | "dismiss" | "wipe"'), "real kinds only");
  });

  await suite("dark-deploy flag-off still writes SP first", async () => {
    await withFlags(
      {
        ENABLE_NEW_AMBASSADOR_WRITES: undefined,
        ENABLE_LEGACY_AMBASSADOR_MIRROR: undefined,
      },
      async () => {
        const tx = makeTx();
        const at = new Date("2026-09-21T10:00:00.000Z");
        await applyAmbassadorChange(tx as never, "u1", { kind: "apply", at });
        assert(tx.writes[0]?.startsWith("sp.update:"), `SP first, got ${tx.writes[0]}`);
        assert(tx.writes.includes("caa.create"), "then canonical");
        assert(tx.getSp()?.isCampusAmbassadorCandidate === true, "SP written");
        assert(tx.getCaa("u1")?.isCandidate === true, "canonical dual-written");
      },
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
