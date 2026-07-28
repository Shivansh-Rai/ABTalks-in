import { formatInTimeZone } from "date-fns-tz";
import type { LucideIcon } from "lucide-react";
import { IST } from "@/lib/date-utils";
import { BriefcaseBusiness, GraduationCap, Palette } from "lucide-react";

export interface WorkshopEvent {
  id: string;
  date: string; // ISO (YYYY-MM-DD)
  time: string;
  tag: string;
  accent: string;
  /** Import this module only from Client Components — a component reference
   *  cannot be serialized across the Server→Client boundary. */
  Icon: LucideIcon;
  title: string;
  desc: string;
  host: string;
  location: string;
  /** Open for registration now — its card links straight to the form. */
  register?: boolean;
}

export const EVENTS: WorkshopEvent[] = [
  {
    id: "ai-workshop-live",
    date: "2026-07-18",
    time: "4:00 PM IST",
    tag: "Live",
    accent: "#8b5cf6",
    Icon: GraduationCap,
    title: "FREE AI Bootcamp — Live Workshop",
    desc: "Master ChatGPT, Claude & Gemini in one hands-on live hour — prompt engineering, real workflows, and the tools that 10x your output.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
  {
    id: "uiux-ai-workshop",
    date: "2026-08-01",
    time: "6:00 PM IST",
    tag: "Design",
    accent: "#6366f1",
    Icon: Palette,
    title: "Figma × Cursor — AI-Powered UI/UX Workshop",
    desc: "Design in Figma, ship with Cursor — MCP servers, AI plugins, and a live run from blank canvas to polished screens to working front-end code.",
    host: "ABTalks",
    location: "Live · Google Meet",
    register: true,
  },
  {
    id: "linkedin-ai-interview",
    date: "2026-08-22",
    time: "6:00 PM IST",
    tag: "Career",
    accent: "#a855f7",
    Icon: BriefcaseBusiness,
    title: "Enhance LinkedIn & AI Mock Interview",
    desc: "Rebuild your LinkedIn profile so recruiters actually find you, then run live AI mock interviews that grill you and score your answers.",
    host: "ABTalks",
    location: "Live · Google Meet",
  },
];

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const monthAbbr = (iso: string) =>
  utc(iso).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();

export const dayNum = (iso: string) =>
  utc(iso).toLocaleString("en-US", { day: "2-digit", timeZone: "UTC" });

export const weekday = (iso: string) =>
  utc(iso).toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });

/** Today's IST calendar day as `yyyy-MM-dd`. */
export const istTodayKey = () => formatInTimeZone(new Date(), IST, "yyyy-MM-dd");

/**
 * An event counts as past once its IST calendar day has fully ended, so it
 * stays under Upcoming for the whole of its own day. Both values are
 * `yyyy-MM-dd`, which sorts chronologically as plain strings.
 */
export const isPastEvent = (ev: WorkshopEvent, todayKey: string) =>
  ev.date < todayKey;

/** Upcoming events, soonest first. */
export const upcomingEvents = (todayKey: string) =>
  EVENTS.filter((e) => !isPastEvent(e, todayKey)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

/** Past events, most recent first. */
export const pastEvents = (todayKey: string) =>
  EVENTS.filter((e) => isPastEvent(e, todayKey)).sort((a, b) =>
    b.date.localeCompare(a.date),
  );

/**
 * The one event currently accepting signups: the soonest upcoming event
 * flagged `register`. A finished event can therefore never show a live
 * Register button, even if its flag was left set.
 */
export const getRegistrableEvent = (
  todayKey: string,
): WorkshopEvent | undefined =>
  upcomingEvents(todayKey).find((e) => e.register);

export const fullDate = (iso: string) =>
  utc(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
