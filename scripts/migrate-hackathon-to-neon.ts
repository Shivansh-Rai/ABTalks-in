/**
 * One-off: copy hackathon_* rows from Supabase into Neon/Prisma.
 * Idempotent — exits 0 without writing if Neon already has teams.
 * Abort-on-unmatched — never writes partial data.
 *
 * Usage:
 *   npm run hackathon:migrate
 *   npm run hackathon:verify
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, type HackathonEntryType } from "@prisma/client";

function loadEnvFile(name: string) {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

type SbTeam = {
  id: string;
  created_at: string;
  entry_type: string;
  team_name: string | null;
  team_code: string;
};

type SbParticipant = {
  id: string;
  created_at: string;
  team_id: string;
  slot_index: number;
  is_leader: boolean;
  full_name: string;
  email: string;
  phone: string;
  college: string;
  graduation_year: number;
};

type SbEvent = {
  id: number;
  problem_statement: string | null;
  updated_at: string;
};

const verifyOnly = process.argv.includes("--verify");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      range: (
        from: number,
        to: number,
      ) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

async function fetchAllRows<T>(
  supabase: SupabaseLike,
  table: string,
  opts?: { optional?: boolean },
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) {
      const missing =
        error.message.includes("Could not find the table") ||
        error.message.includes("schema cache");
      if (opts?.optional && missing) {
        console.log(
          `${table}: not present in Supabase — treating as empty (optional)`,
        );
        return [];
      }
      console.error(`Failed to fetch ${table}:`, error.message);
      process.exit(1);
    }
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function verify(
  supabase: SupabaseLike,
  prisma: PrismaClient,
): Promise<void> {
  const [sbTeams, sbParticipants, sbEvents, neonTeams, neonParticipants, neonEvent] =
    await Promise.all([
      fetchAllRows<SbTeam>(supabase, "hackathon_teams"),
      fetchAllRows<SbParticipant>(supabase, "hackathon_participants"),
      fetchAllRows<SbEvent>(supabase, "hackathon_event", { optional: true }),
      prisma.hackathonTeam.findMany({ select: { teamCode: true } }),
      prisma.hackathonParticipant.findMany({ select: { email: true } }),
      prisma.hackathonEvent.findUnique({
        where: { id: 1 },
        select: { problemStatement: true },
      }),
    ]);

  let failed = false;

  if (sbTeams.length !== neonTeams.length) {
    console.error(
      `Team count mismatch: Supabase=${sbTeams.length} Neon=${neonTeams.length}`,
    );
    failed = true;
  } else {
    console.log(`Teams: ${sbTeams.length} (match)`);
  }

  if (sbParticipants.length !== neonParticipants.length) {
    console.error(
      `Participant count mismatch: Supabase=${sbParticipants.length} Neon=${neonParticipants.length}`,
    );
    failed = true;
  } else {
    console.log(`Participants: ${sbParticipants.length} (match)`);
  }

  const sbCodes = new Set(sbTeams.map((t) => t.team_code.toUpperCase()));
  const neonCodes = new Set(neonTeams.map((t) => t.teamCode.toUpperCase()));
  const missingInNeon = [...sbCodes].filter((c) => !neonCodes.has(c));
  const extraInNeon = [...neonCodes].filter((c) => !sbCodes.has(c));
  if (missingInNeon.length || extraInNeon.length) {
    console.error("team_code set-diff:");
    if (missingInNeon.length)
      console.error("  missing in Neon:", missingInNeon.join(", "));
    if (extraInNeon.length)
      console.error("  extra in Neon:", extraInNeon.join(", "));
    failed = true;
  } else {
    console.log("team_code set-diff: empty (both directions)");
  }

  const sbEmails = new Set(sbParticipants.map((p) => p.email.toLowerCase()));
  const neonEmails = new Set(neonParticipants.map((p) => p.email.toLowerCase()));
  const missingEmails = [...sbEmails].filter((e) => !neonEmails.has(e));
  const extraEmails = [...neonEmails].filter((e) => !sbEmails.has(e));
  if (missingEmails.length || extraEmails.length) {
    console.error("participant email set-diff:");
    if (missingEmails.length)
      console.error("  missing in Neon:", missingEmails.join(", "));
    if (extraEmails.length)
      console.error("  extra in Neon:", extraEmails.join(", "));
    failed = true;
  } else {
    console.log("participant email set-diff: empty (both directions)");
  }

  const sbProblem = sbEvents[0]?.problem_statement ?? null;
  const neonProblem = neonEvent?.problemStatement ?? null;
  if (sbEvents.length === 0 && neonProblem === null) {
    console.log(
      "HackathonEvent: skipped (no Supabase table; Neon empty — set via /admin/hackathon)",
    );
  } else if (sbProblem !== neonProblem) {
    console.error("HackathonEvent.problemStatement mismatch");
    failed = true;
  } else {
    console.log("HackathonEvent.problemStatement: match");
  }

  if (failed) process.exit(1);
  console.log("verify OK");
}

async function migrate(
  supabase: SupabaseLike,
  prisma: PrismaClient,
): Promise<void> {
  const existingCount = await prisma.hackathonTeam.count();
  if (existingCount > 0) {
    const pCount = await prisma.hackathonParticipant.count();
    const eCount = await prisma.hackathonEvent.count();
    console.log(
      `Neon already has hackathon data (teams=${existingCount}, participants=${pCount}, events=${eCount}). Skipping write (idempotent).`,
    );
    process.exit(0);
  }

  const [sbTeams, sbParticipants, sbEvents] = await Promise.all([
    fetchAllRows<SbTeam>(supabase, "hackathon_teams"),
    fetchAllRows<SbParticipant>(supabase, "hackathon_participants"),
    fetchAllRows<SbEvent>(supabase, "hackathon_event", { optional: true }),
  ]);

  console.log(
    `Read from Supabase: teams=${sbTeams.length}, participants=${sbParticipants.length}, events=${sbEvents.length}`,
  );

  // Pre-flight: resolve every participant email → User.id
  const userIdByParticipantId = new Map<string, string>();
  const unmatched: { email: string; teamCode: string }[] = [];
  const userIdSeen = new Map<string, { email: string; participantId: string }>();
  const duplicateUserIds: {
    userId: string;
    a: { email: string; participantId: string };
    b: { email: string; participantId: string };
  }[] = [];

  const teamCodeById = new Map(sbTeams.map((t) => [t.id, t.team_code]));

  for (const p of sbParticipants) {
    const email = p.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      unmatched.push({
        email: p.email,
        teamCode: teamCodeById.get(p.team_id) ?? "(unknown)",
      });
      continue;
    }
    const prior = userIdSeen.get(user.id);
    if (prior) {
      duplicateUserIds.push({
        userId: user.id,
        a: prior,
        b: { email: p.email, participantId: p.id },
      });
      continue;
    }
    userIdSeen.set(user.id, { email: p.email, participantId: p.id });
    userIdByParticipantId.set(p.id, user.id);
  }

  if (unmatched.length > 0) {
    console.error("ABORT: unmatched participants (no User for email):");
    for (const row of unmatched) {
      console.error(`  email=${row.email} team_code=${row.teamCode}`);
    }
    process.exit(1);
  }

  if (duplicateUserIds.length > 0) {
    console.error("ABORT: two participants resolve to the same userId:");
    for (const d of duplicateUserIds) {
      console.error(
        `  userId=${d.userId}\n    a: ${d.a.email} (${d.a.participantId})\n    b: ${d.b.email} (${d.b.participantId})`,
      );
    }
    process.exit(1);
  }

  const oldToNewTeamId = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    for (const t of sbTeams) {
      const entryType: HackathonEntryType =
        t.entry_type === "SOLO" ? "SOLO" : "TEAM";
      const created = await tx.hackathonTeam.create({
        data: {
          entryType,
          teamName: t.team_name,
          teamCode: t.team_code,
          createdAt: new Date(t.created_at),
        },
        select: { id: true },
      });
      oldToNewTeamId.set(t.id, created.id);
    }

    for (const p of sbParticipants) {
      const newTeamId = oldToNewTeamId.get(p.team_id);
      const userId = userIdByParticipantId.get(p.id);
      if (!newTeamId || !userId) {
        throw new Error(`Internal mapping miss for participant ${p.id}`);
      }
      await tx.hackathonParticipant.create({
        data: {
          teamId: newTeamId,
          userId,
          slotIndex: p.slot_index,
          isLeader: p.is_leader,
          fullName: p.full_name,
          email: p.email,
          phone: p.phone,
          college: p.college,
          graduationYear: p.graduation_year,
          createdAt: new Date(p.created_at),
        },
      });
    }

    const sbEvent = sbEvents[0];
    if (sbEvent) {
      await tx.hackathonEvent.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          problemStatement: sbEvent.problem_statement,
        },
        update: {
          problemStatement: sbEvent.problem_statement,
        },
      });
    }
  });

  console.log(
    `Wrote to Neon: teams=${sbTeams.length}, participants=${sbParticipants.length}, event=${sbEvents.length > 0 ? "y" : "n"}`,
  );
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("DATABASE_URL");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseLike;
  const prisma = new PrismaClient();

  try {
    if (verifyOnly) {
      await verify(supabase, prisma);
    } else {
      await migrate(supabase, prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
