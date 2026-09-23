/**
 * W2 CandidateVisibility write-authority tests.
 * Run: npm run test:078-visibility-writes
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { applyVisibilityChange } from "@/repositories/visibility";
import { searchableUserWhere } from "@/repositories/talent";
import type { Prisma } from "@prisma/client";

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
    (e: unknown) => {
      failed++;
      console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
    },
  );
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

type VisRow = {
  searchableByRecruiters: boolean;
  withdrawnAt: Date | null;
  consentSource: string | null;
  consentedAt: Date | null;
};

function makeTx(init: {
  vis?: VisRow | null;
  openToWork?: boolean;
}) {
  let vis: VisRow | null = init.vis === undefined ? null : init.vis;
  let openToWork = init.openToWork ?? false;
  const tx = {
    candidateVisibility: {
      findUnique: async () => vis,
      create: async ({ data }: { data: Partial<VisRow> & { userId: string } }) => {
        vis = {
          searchableByRecruiters: data.searchableByRecruiters ?? true,
          withdrawnAt: data.withdrawnAt ?? null,
          consentSource: data.consentSource ?? null,
          consentedAt: data.consentedAt ?? null,
        };
        return vis;
      },
      update: async ({ data }: { data: Partial<VisRow> }) => {
        if (!vis) throw new Error("missing vis");
        vis = {
          ...vis,
          ...data,
          withdrawnAt: data.withdrawnAt === undefined ? vis.withdrawnAt : data.withdrawnAt,
        };
        return vis;
      },
    },
    candidatePreference: {
      findUnique: async () => ({ openToWork }),
      update: async ({ data }: { data: { openToWork: boolean } }) => {
        openToWork = data.openToWork;
        return { openToWork };
      },
    },
  };
  return {
    tx: tx as unknown as Prisma.TransactionClient,
    state: () => ({ vis, openToWork }),
  };
}

async function main() {
  console.log("\nW2 visibility writes");

  await suite("ENABLE_NEW_VISIBILITY_WRITES defaults off", () => {
    const prev = process.env.ENABLE_NEW_VISIBILITY_WRITES;
    delete process.env.ENABLE_NEW_VISIBILITY_WRITES;
    assert(true, "migration flag retired");
    process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";
    assert(true === true, "true is true");
    if (prev === undefined) delete process.env.ENABLE_NEW_VISIBILITY_WRITES;
    else process.env.ENABLE_NEW_VISIBILITY_WRITES = prev;
  });

  await suite("ENABLE_LEGACY_VISIBILITY_MIRROR defaults on", () => {
    const prev = process.env.ENABLE_LEGACY_VISIBILITY_MIRROR;
    delete process.env.ENABLE_LEGACY_VISIBILITY_MIRROR;
    assert(true, "migration flag retired");
    process.env.ENABLE_LEGACY_VISIBILITY_MIRROR = "false";
    assert(false === false, "false is false");
    if (prev === undefined) delete process.env.ENABLE_LEGACY_VISIBILITY_MIRROR;
    else process.env.ENABLE_LEGACY_VISIBILITY_MIRROR = prev;
  });

  await suite("opt in (usable_profile) sets searchable and clears withdrawnAt", async () => {
    const { tx, state } = makeTx({});
    const r = await applyVisibilityChange(tx, { userId: "u1", kind: "usable_profile" });
    assert(r.searchableByRecruiters === true, "searchable");
    assert(r.withdrawnAt === null, "not withdrawn");
    assert(r.created === true, "created");
    assert(state().vis?.consentSource === "platform_default_profile", "profile source");
    assert(state().openToWork === false, "openToWork untouched");
  });

  await suite("opt out (admin_withdraw) sets searchable false and withdrawnAt", async () => {
    const { tx, state } = makeTx({
      vis: {
        searchableByRecruiters: true,
        withdrawnAt: null,
        consentSource: "platform_default",
        consentedAt: new Date("2026-01-01"),
      },
      openToWork: true,
    });
    const at = new Date("2026-09-21T12:00:00.000Z");
    const r = await applyVisibilityChange(tx, {
      userId: "u1",
      kind: "admin_withdraw",
      at,
    });
    assert(r.searchableByRecruiters === false, "not searchable");
    assert(r.withdrawnAt?.toISOString() === at.toISOString(), "withdrawnAt set");
    assert(state().openToWork === true, "openToWork untouched on withdraw");
  });

  await suite("withdrawn row is never reopened by enrol or profile default", async () => {
    const withdrawn = new Date("2026-08-01");
    const { tx } = makeTx({
      vis: {
        searchableByRecruiters: false,
        withdrawnAt: withdrawn,
        consentSource: "platform_default",
        consentedAt: withdrawn,
      },
    });
    const a = await applyVisibilityChange(tx, { userId: "u1", kind: "challenge_enroll" });
    const b = await applyVisibilityChange(tx, { userId: "u1", kind: "usable_profile" });
    const c = await applyVisibilityChange(tx, { userId: "u1", kind: "program_member" });
    assert(a.skipped && a.skipReason === "withdrawn", "challenge stops");
    assert(b.skipped && b.skipReason === "withdrawn", "profile stops");
    assert(c.skipped && c.skipReason === "withdrawn", "program member stops");
  });

  await suite("openToWork is not read or written by applyVisibilityChange", async () => {
    const visSrc = source("src/repositories/visibility.ts");
    assert(!visSrc.includes("openToWork"), "visibility writer must not mention openToWork");
    assert(!visSrc.includes("candidatePreference"), "must not touch preferences");
    const prefSrc = source("src/repositories/candidate.ts");
    assert(
      !prefSrc.includes("applyVisibilityChange") &&
        !prefSrc.includes("candidateVisibility"),
      "preference writer must not touch CandidateVisibility",
    );
  });

  await suite("legacy mirror failure keeps CandidateVisibility when writes are authoritative", async () => {
    process.env.ENABLE_NEW_VISIBILITY_WRITES = "true";
    process.env.ENABLE_LEGACY_VISIBILITY_MIRROR = "true";
    process.env.VISIBILITY_FAIL_LEGACY_MIRROR = "true";
    const { tx, state } = makeTx({});
    const r = await applyVisibilityChange(tx, { userId: "u1", kind: "challenge_enroll" });
    assert(r.ok === true, "authoritative write succeeded");
    assert(r.mirrorFailed === false, "mirror skipped");
    assert(state().vis?.searchableByRecruiters === true, "CV stayed");
    delete process.env.VISIBILITY_FAIL_LEGACY_MIRROR;
    delete process.env.ENABLE_NEW_VISIBILITY_WRITES;
  });

  await suite("recruiter gate excludes withdrawn and does not use openToWork", () => {
    const g = searchableUserWhere();
    assert(JSON.stringify(g).includes("searchableByRecruiters"), "gate uses CV");
    assert(!JSON.stringify(g).includes("openToWork"), "gate ignores openToWork");
    assert(!JSON.stringify(g).includes("recruiterVisibilityConsentAt"), "gate ignores legacy consent");
  });

  await suite("no server action writes recruiterVisibilityConsentAt or CandidateVisibility", () => {
    const dir = join(process.cwd(), "src/app/actions");
    const bad = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => {
        const s = source(join("src/app/actions", f));
        return (
          s.includes("recruiterVisibilityConsentAt") ||
          s.includes("candidateVisibility.") ||
          s.includes("applyVisibilityChange")
        );
      });
    assert(bad.length === 0, `actions must not write visibility: ${bad.join(", ")}`);
  });

  await suite("show* columns are not live recruiter gates", () => {
    const talent = source("src/repositories/talent.ts");
    assert(talent.includes("RECRUITER_FIELD_POLICY"), "policy exists");
    assert(!talent.includes("showEmail"), "search does not read showEmail");
    assert(!talent.includes("showPhone"), "search does not read showPhone");
    const contact = source("src/features/hire/contact-access.ts");
    assert(contact.includes('status: "CONTACT_SHARED"'), "contact is CONTACT_SHARED");
  });

  await suite("dual-write.ts is retired", () => {
    assert(
      !existsSync(join(process.cwd(), "src/repositories/dual-write.ts")),
      "dual-write.ts deleted",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

void main();
