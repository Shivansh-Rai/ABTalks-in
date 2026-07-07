import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const workshopSupabase = createClient(supabaseUrl, supabaseAnonKey);

export interface WorkshopConfig {
  zoomLink: string;
  whatsappLink: string;
  webinarDate: string;
  webinarTime: string;
  webinarTargetUtc: string;
}

const FALLBACK_CONFIG: WorkshopConfig = {
  zoomLink: "#",
  whatsappLink: "https://chat.whatsapp.com/LDUvHRIlb5dGHpDJLueR9i?s=cl&p=a&mlu=0&amv=0",
  webinarDate: "July 11, 2026",
  webinarTime: "4:00 PM IST",
  webinarTargetUtc: "2026-07-11T10:30:00Z",
};

export async function getWorkshopConfig(): Promise<WorkshopConfig> {
  const { data, error } = await workshopSupabase
    .from("workshop_config")
    .select("zoom_link, whatsapp_link, webinar_date, webinar_time, webinar_target_utc")
    .single();
  if (error || !data) return FALLBACK_CONFIG;
  return {
    zoomLink: data.zoom_link,
    whatsappLink: data.whatsapp_link,
    webinarDate: data.webinar_date,
    webinarTime: data.webinar_time,
    webinarTargetUtc: data.webinar_target_utc,
  };
}

export interface RecentRegistrant {
  name: string;
  org: string | null;
}

/**
 * Recent workshop registrations for the "just joined" social-proof ticker.
 * First name + organization only (no email/phone). Returns [] on any error so
 * the ticker can fall back to sample data.
 */
export async function getRecentRegistrations(): Promise<RecentRegistrant[]> {
  const { data, error } = await workshopSupabase
    .from("registrations")
    .select("name, organization, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data
    .filter((r) => r.name)
    .map((r) => ({
      name: String(r.name).trim().split(/\s+/)[0],
      org: r.organization ? String(r.organization).trim() : null,
    }));
}
