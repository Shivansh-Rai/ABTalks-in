"use server";

import { HACKATHON } from "@/components/hackathon/hackathon-config";
import {
  getTeamByCode,
  hackathonSupabase,
  isEmailRegistered,
} from "@/lib/hackathon-supabase";
import { logger } from "@/lib/logger";
import {
  hackathonRegistrationSchema,
  teamCodeSchema,
  type HackathonRegistrationInput,
} from "@/lib/validations/hackathon";

const TEAM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTeamCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += TEAM_CODE_ALPHABET[Math.floor(Math.random() * TEAM_CODE_ALPHABET.length)];
  }
  return code;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function lookupHackathonTeamAction(code: string) {
  const parsed = teamCodeSchema.safeParse(code);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid team code",
    };
  }

  const team = await getTeamByCode(parsed.data);
  if (!team) {
    return {
      ok: false as const,
      message: "No team found with that code. Check with your team leader.",
    };
  }

  if (team.entryType === "SOLO" || team.spotsLeft <= 0) {
    return { ok: false as const, message: "That team is already full." };
  }

  return {
    ok: true as const,
    data: { teamName: team.teamName, spotsLeft: team.spotsLeft },
  };
}

export async function submitHackathonRegistrationAction(
  input: HackathonRegistrationInput,
) {
  if (!HACKATHON.registrationOpen) {
    return { ok: false as const, message: "Registration is closed." };
  }

  const parsed = hackathonRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;

  if (await isEmailRegistered(d.email)) {
    return {
      ok: false as const,
      message: "You're already registered with this email.",
    };
  }

  if (d.entryType === "SOLO" || d.entryType === "TEAM_CREATE") {
    const entryTypeDb = d.entryType === "SOLO" ? "SOLO" : "TEAM";
    const teamName = d.entryType === "TEAM_CREATE" ? d.teamName : null;

    let teamCode: string | null = null;
    let teamId: string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateTeamCode();
      const { data: teamRow, error: teamError } = await hackathonSupabase
        .from("hackathon_teams")
        .insert({
          entry_type: entryTypeDb,
          team_name: teamName,
          team_code: candidate,
        })
        .select("id, team_code")
        .single();

      if (!teamError && teamRow) {
        teamCode = teamRow.team_code;
        teamId = teamRow.id;
        break;
      }

      if (isUniqueViolation(teamError)) {
        continue;
      }

      logger.error("hackathon team insert failed", { error: teamError });
      return {
        ok: false as const,
        message: "Something went wrong. Please try again.",
      };
    }

    if (!teamId || !teamCode) {
      logger.error("hackathon team code generation exhausted");
      return {
        ok: false as const,
        message: "Something went wrong. Please try again.",
      };
    }

    const { error: participantError } = await hackathonSupabase
      .from("hackathon_participants")
      .insert({
        team_id: teamId,
        slot_index: 1,
        is_leader: true,
        full_name: d.fullName,
        email: d.email,
        phone: d.phone,
        college: d.college,
        graduation_year: d.graduationYear,
      });

    if (participantError) {
      logger.error("hackathon leader participant insert failed", {
        error: participantError,
      });
      await hackathonSupabase.from("hackathon_teams").delete().eq("id", teamId);
      return {
        ok: false as const,
        message: "Something went wrong. Please try again.",
      };
    }

    return {
      ok: true as const,
      data: {
        entryType: d.entryType,
        teamCode,
        teamName,
      },
    };
  }

  // TEAM_JOIN
  const team = await getTeamByCode(d.teamCode);
  if (!team) {
    return {
      ok: false as const,
      message: "No team found with that code.",
    };
  }
  if (team.entryType === "SOLO") {
    return {
      ok: false as const,
      message: "That code belongs to a solo entry.",
    };
  }
  if (team.spotsLeft <= 0) {
    return { ok: false as const, message: "That team is already full." };
  }

  async function insertJoin(
    teamId: string,
    spotsLeft: number,
  ): Promise<{ ok: true } | { ok: false; uniqueViolation: boolean }> {
    const slotIndex = HACKATHON.maxTeamSize - spotsLeft + 1;
    const { error } = await hackathonSupabase.from("hackathon_participants").insert({
      team_id: teamId,
      slot_index: slotIndex,
      is_leader: false,
      full_name: d.fullName,
      email: d.email,
      phone: d.phone,
      college: d.college,
      graduation_year: d.graduationYear,
    });

    if (!error) return { ok: true };
    if (isUniqueViolation(error)) return { ok: false, uniqueViolation: true };

    logger.error("hackathon join participant insert failed", { error });
    return { ok: false, uniqueViolation: false };
  }

  const first = await insertJoin(team.id, team.spotsLeft);
  if (first.ok) {
    return {
      ok: true as const,
      data: {
        entryType: "TEAM_JOIN" as const,
        teamCode: d.teamCode,
        teamName: team.teamName,
      },
    };
  }

  if (!first.uniqueViolation) {
    return {
      ok: false as const,
      message: "Something went wrong. Please try again.",
    };
  }

  // Race handler: re-fetch once and retry with recomputed slot.
  const refreshed = await getTeamByCode(d.teamCode);
  if (!refreshed || refreshed.entryType === "SOLO" || refreshed.spotsLeft <= 0) {
    return {
      ok: false as const,
      message: "That team just filled up. Ask your leader for another team.",
    };
  }

  const second = await insertJoin(refreshed.id, refreshed.spotsLeft);
  if (second.ok) {
    return {
      ok: true as const,
      data: {
        entryType: "TEAM_JOIN" as const,
        teamCode: d.teamCode,
        teamName: refreshed.teamName,
      },
    };
  }

  return {
    ok: false as const,
    message: "That team just filled up. Ask your leader for another team.",
  };
}
