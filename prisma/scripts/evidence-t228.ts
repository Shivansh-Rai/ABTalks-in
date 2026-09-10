/**
 * T-228 acceptance evidence. READ-ONLY.
 *
 * Reports every recruiter workspace: the runtime starting-credit configuration
 * in force, each workspace's cached balance, the GRANT_ONBOARDING ledger row
 * with before/amount/after, and the reconciliation tying the three numbers
 * together.
 *
 * Every query here is a read. This script contains no create, update, upsert or
 * delete, and is safe to run anywhere — including production, where it will
 * simply report what is there.
 *
 * Run:  npx tsx prisma/scripts/evidence-t228.ts
 *       npx tsx prisma/scripts/evidence-t228.ts --email someone@company.com
 *       npx tsx prisma/scripts/evidence-t228.ts --summary
 *
 * --email   narrow to one workspace
 * --summary table only, no per-workspace ledger detail
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STARTING_GRANT_KEY = "credits.starting_grant_minor";

function usd(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  return `${sign}$${(Math.abs(minor) / 100).toFixed(2)}`;
}

function when(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/** The Neon endpoint, so the recording shows which database this is. */
function endpoint(): string {
  return (process.env.DATABASE_URL ?? "").match(/ep-[a-z0-9-]+/)?.[0] ?? "unknown";
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function pad(s: string, w: number): string {
  return s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w);
}

async function main() {
  const email = arg("--email")?.trim().toLowerCase();
  const summaryOnly = process.argv.includes("--summary");

  console.log("\n──────────────────────────────────────────────────────────────────────────────");
  console.log(" T-228 — recruiter starting credits");
  console.log(` database: ${endpoint()}`);
  console.log("──────────────────────────────────────────────────────────────────────────────");

  /* 1. the runtime configuration ------------------------------------------ */

  const config = await prisma.platformConfig.findUnique({
    where: { key: STARTING_GRANT_KEY },
    select: { intValue: true, updatedAt: true },
  });

  console.log("\nSTARTING-CREDIT CONFIGURATION  (runtime, no deployment)");
  if (config?.intValue == null) {
    console.log(`  ${STARTING_GRANT_KEY}  — no row; code default applies`);
  } else {
    console.log(
      `  ${STARTING_GRANT_KEY} = ${config.intValue}   ${usd(config.intValue)}`,
    );
    console.log(`  last changed: ${when(config.updatedAt)}`);
  }

  /* 2. every recruiter workspace ------------------------------------------ */

  const members = await prisma.organizationMember.findMany({
    where: {
      role: "RECRUITER",
      status: "ACTIVE",
      ...(email ? { user: { email } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      organizationId: true,
      createdAt: true,
      user: { select: { email: true } },
      organization: {
        select: {
          slug: true,
          name: true,
          creditAccount: {
            select: { balance: true, lifetimeEarned: true, lifetimeSpent: true },
          },
        },
      },
    },
  });

  if (members.length === 0) {
    console.log(
      email
        ? `\nNo recruiter workspace found for ${email}.`
        : "\nNo recruiter workspaces found.",
    );
    return;
  }

  const ledgers = await prisma.creditTransaction.findMany({
    where: { organizationId: { in: members.map((m) => m.organizationId) } },
    orderBy: { seq: "asc" },
    select: {
      organizationId: true,
      type: true,
      amount: true,
      balanceBefore: true,
      balanceAfter: true,
      reason: true,
      createdAt: true,
      metadata: true,
    },
  });

  const byOrg = new Map<string, typeof ledgers>();
  for (const row of ledgers) {
    byOrg.set(row.organizationId, [...(byOrg.get(row.organizationId) ?? []), row]);
  }

  console.log(`\nRECRUITER WORKSPACES  (${members.length}, newest first)\n`);
  console.log(
    `  ${pad("recruiter", 30)}${pad("workspace", 26)}${pad("balance", 11)}${pad("rows", 6)}recon`,
  );
  console.log(`  ${"─".repeat(76)}`);

  let granted = 0;
  let totalMinor = 0;
  let allReconciled = true;

  for (const m of members) {
    const rows = byOrg.get(m.organizationId) ?? [];
    const sum = rows.reduce((t, r) => t + r.amount, 0);
    const latest = rows.length > 0 ? rows[rows.length - 1].balanceAfter : 0;
    const cached = m.organization.creditAccount?.balance ?? 0;
    const ok = sum === latest && sum === cached;

    if (rows.length > 0) {
      granted++;
      totalMinor += sum;
    }
    if (!ok) allReconciled = false;

    console.log(
      `  ${pad(m.user.email, 30)}${pad(m.organization.slug, 26)}${pad(rows.length > 0 ? usd(cached) : "—", 11)}${pad(String(rows.length), 6)}${ok ? "OK" : "DRIFT"}`,
    );
  }

  console.log(`  ${"─".repeat(76)}`);
  console.log(
    `  ${granted} of ${members.length} funded   ·   ${usd(totalMinor)} issued in total   ·   ${allReconciled ? "all reconciled" : "DRIFT PRESENT"}`,
  );

  const ungranted = members.length - granted;
  if (ungranted > 0) {
    console.log(
      `\n  ${ungranted} workspace(s) show "—": created before T-228 shipped. They are`,
    );
    console.log(
      "  funded by the deploy step `npm run db:backfill:credit-grants -- --apply`,",
    );
    console.log("  never by a credit read.");
  }

  /* 3. the ledger, per funded workspace ------------------------------------ */

  if (summaryOnly) {
    console.log("");
    return;
  }

  for (const m of members) {
    const rows = byOrg.get(m.organizationId) ?? [];
    if (rows.length === 0) continue;

    console.log(`\n${m.user.email}  ·  ${m.organization.name}  ·  ${m.organization.slug}`);
    console.log(`  registered  ${when(m.createdAt)}`);

    const acct = m.organization.creditAccount;
    console.log(
      `  account     ${usd(acct?.balance ?? 0)}   (cached projection — earned ${usd(acct?.lifetimeEarned ?? 0)}, spent ${usd(acct?.lifetimeSpent ?? 0)})`,
    );
    console.log("  ledger      (CreditTransaction — the source of truth)");

    rows.forEach((r, i) => {
      const sign = r.amount >= 0 ? "+" : "";
      console.log(
        `    #${i + 1}  ${pad(r.type, 18)}before ${usd(r.balanceBefore).padStart(9)}   ${sign}${usd(r.amount).padStart(9)}   after ${usd(r.balanceAfter).padStart(9)}`,
      );
      console.log(`        "${r.reason}"   ${when(r.createdAt)}`);
      const meta = r.metadata as { configKey?: string; configValue?: number } | null;
      if (meta?.configKey) {
        console.log(
          `        granted from ${meta.configKey} = ${meta.configValue} — frozen into this row`,
        );
      }
    });

    const sum = rows.reduce((t, r) => t + r.amount, 0);
    console.log(
      `  reconciles  SUM ${usd(sum)}  =  latest balanceAfter ${usd(rows[rows.length - 1].balanceAfter)}  =  cached ${usd(acct?.balance ?? 0)}`,
    );
  }

  console.log("");
}

main()
  .catch((e) => {
    console.error("evidence failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
