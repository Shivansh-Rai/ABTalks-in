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

export async function isEmailRegistered(email: string): Promise<boolean> {
  const { data, error } = await hackathonSupabase
    .from("hackathon_participants")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}
