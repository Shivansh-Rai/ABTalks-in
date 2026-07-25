import "server-only";
import { createClient } from "@supabase/supabase-js";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export const hackathonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export type HackathonTeamLookup = {
  id: string;
  teamName: string | null;
  entryType: "SOLO" | "TEAM";
  spotsLeft: number;
};

export async function getTeamByCode(
  code: string,
): Promise<HackathonTeamLookup | null> {
  const { data: team, error } = await hackathonSupabase
    .from("hackathon_teams")
    .select("id, team_name, entry_type")
    .eq("team_code", code.toUpperCase())
    .maybeSingle();

  if (error || !team) return null;

  const { count, error: countError } = await hackathonSupabase
    .from("hackathon_participants")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if (countError) return null;

  const entryType = team.entry_type === "SOLO" ? "SOLO" : "TEAM";

  return {
    id: team.id,
    teamName: team.team_name,
    entryType,
    spotsLeft: HACKATHON.maxTeamSize - (count ?? 0),
  };
}

export async function getTeamLeader(
  teamId: string,
): Promise<{ fullName: string; email: string } | null> {
  const { data, error } = await hackathonSupabase
    .from("hackathon_participants")
    .select("full_name, email")
    .eq("team_id", teamId)
    .eq("is_leader", true)
    .maybeSingle();

  if (error || !data) return null;
  return { fullName: data.full_name, email: data.email };
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const { data, error } = await hackathonSupabase
    .from("hackathon_participants")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

/**
 * For a logged-in user WITHOUT a 60-day profile: return "/hackathon/dashboard" if they
 * registered for the hackathon, else null (caller proceeds to the normal /register
 * funnel). Fails open to null on any error so legitimate new 60-day users are never
 * blocked from registering.
 */
export async function hackathonRedirectForProfilelessUser(
  email: string | null | undefined,
): Promise<"/hackathon/dashboard" | null> {
  if (!email) return null;
  try {
    const registered = await isEmailRegistered(email.trim().toLowerCase());
    return registered ? "/hackathon/dashboard" : null;
  } catch {
    return null;
  }
}

export async function isTeamNameTaken(teamName: string): Promise<boolean> {
  const { data, error } = await hackathonSupabase
    .from("hackathon_teams")
    .select("id")
    .ilike("team_name", teamName)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

export type HackathonMember = {
  fullName: string;
  college: string;
  isLeader: boolean;
  slotIndex: number;
};

export type MyRegistration = {
  team: {
    id: string;
    code: string;
    name: string | null;
    entryType: "SOLO" | "TEAM";
  };
  me: { fullName: string; isLeader: boolean };
  members: HackathonMember[];
  spotsLeft: number;
};

export async function getMyRegistration(
  email: string,
): Promise<MyRegistration | null> {
  const { data: participant, error: participantError } = await hackathonSupabase
    .from("hackathon_participants")
    .select("id, team_id, full_name, is_leader")
    .ilike("email", email)
    .maybeSingle();

  if (participantError || !participant) return null;

  const { data: team, error: teamError } = await hackathonSupabase
    .from("hackathon_teams")
    .select("id, team_code, team_name, entry_type")
    .eq("id", participant.team_id)
    .maybeSingle();

  if (teamError || !team) return null;

  const { data: memberRows, error: membersError } = await hackathonSupabase
    .from("hackathon_participants")
    .select("full_name, college, is_leader, slot_index")
    .eq("team_id", participant.team_id)
    .order("slot_index");

  if (membersError || !memberRows) return null;

  const entryType = team.entry_type === "SOLO" ? "SOLO" : "TEAM";
  const members: HackathonMember[] = memberRows.map((row) => ({
    fullName: row.full_name,
    college: row.college,
    isLeader: row.is_leader,
    slotIndex: row.slot_index,
  }));

  return {
    team: {
      id: team.id,
      code: team.team_code,
      name: team.team_name,
      entryType,
    },
    me: {
      fullName: participant.full_name,
      isLeader: participant.is_leader,
    },
    members,
    spotsLeft:
      entryType === "SOLO" ? 0 : HACKATHON.maxTeamSize - members.length,
  };
}

export async function getHackathonEvent(): Promise<{
  problemStatement: string | null;
}> {
  const { data, error } = await hackathonSupabase
    .from("hackathon_event")
    .select("problem_statement")
    .maybeSingle();

  if (error) return { problemStatement: null };
  return { problemStatement: data?.problem_statement ?? null };
}
