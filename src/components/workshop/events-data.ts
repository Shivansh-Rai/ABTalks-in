import { formatInTimeZone } from "date-fns-tz";
import { IST } from "@/lib/date-utils";
import { PROGRAM_AI_COHORT_BASE } from "@/features/program/constants";
import type { WorkshopIconKey } from "@/components/workshop/workshop-icons";

/** A resource link shown in the past-workshop details modal. */
export interface WorkshopResource {
  label: string;
  href: string;
  /** `youtube` renders a ▶ marker, `link` renders ↗. */
  kind: "youtube" | "link";
}

export interface WorkshopEvent {
  /**
   * Stable identifier, written to `WorkshopRegistration.eventId` on every signup
   * and never changed afterwards — it is how a roster stays attached to its
   * workshop even if the title or date is edited later.
   *
   * For NEW events use a dated slug: `workshop-YYYY-MM-DD` (e.g.
   * `workshop-2026-08-14`). At a weekly cadence, topic-based names run out and
   * risk being reused, which would silently merge two workshops' rosters.
   *
   * `ai-workshop-live` and `uiux-ai-workshop` predate this convention. Leave
   * their ids as they are regardless: an id is permanent once published,
   * because a registration can be filed under it at any time.
   *
   * Verified against production on 2026-09-09: `WorkshopRegistration` held 253
   * rows across exactly two ids — `linkedin-ai-interview` (250) and
   * `workshop-2026-09-05` (3). `ai-workshop-live` and `uiux-ai-workshop` had
   * none. (This paragraph previously claimed 526 rows on those two ids, which
   * was never true of this database.)
   */
  id: string;
  date: string; // ISO (YYYY-MM-DD)
  time: string;
  tag: string;
  accent: string;
  /**
   * Which product track this belongs to. Drives the calendar tile colour and,
   * more importantly, what a click does: only `workshop` entries can open the
   * replay modal — everything else navigates to its own track page.
   */
  track: "workshop" | "hackathon" | "cohort" | "challenge";
  /**
   * Key into ICON_MAP, resolved to a component by `resolveIcon` inside the
   * client component that draws it. A `LucideIcon` is a component reference:
   * it cannot be stored in a database column and cannot cross the
   * Server→Client boundary, and workshop events now do both.
   */
  icon: WorkshopIconKey;
  title: string;
  desc: string;
  host: string;
  location: string;
  /** Open for registration now — its card links straight to the form. */
  register?: boolean;
  /**
   * Accepting signups. Set this (alongside `register`) on exactly one upcoming
   * event to open the form; clearing it closes registration immediately.
   *
   * Signups all land in the single `WorkshopRegistration` table keyed by
   * `event.id`, so opening a new workshop needs nothing beyond an entry here.
   */
  registrationOpen?: boolean;
  /**
   * External destination for events that live outside the workshop funnel
   * (e.g. the hackathon). When set, the card links here in a new tab instead
   * of scrolling to the workshop registration form, and `ctaLabel` names the
   * action. Mutually exclusive with `register` in practice.
   */
  href?: string;
  /** Button text for an `href` event. Defaults to "Learn more". */
  ctaLabel?: string;

  // ---------------------------------------------------------------------
  // Weekly-changing content. Everything below is swapped per workshop: a
  // new week means a new poster file, new title/desc, new topics/takeaways.
  // ---------------------------------------------------------------------

  /**
   * YouTube video id of the recording. A past workshop WITHOUT this stays
   * un-clickable on the calendar rather than opening an empty player, so an
   * event can be added before its replay is published.
   */
  youtubeId?: string;
  /**
   * Substrings of `title` to render in the hero's accent colour. Matched
   * literally and in order, so each must appear verbatim in `title`; anything
   * that does not match is simply left unstyled.
   */
  titleAccents?: string[];
  /** Poster image (public/ path). Doubles as the modal's pre-play still. */
  posterSrc?: string;
  /** Runtime of the recording, e.g. "01:02:18". Shown on the player still. */
  duration?: string;
  /** Modal "Key takeaways" — rendered numbered 01, 02, 03… */
  takeaways?: string[];
  /** Modal "Resources" list. */
  resources?: WorkshopResource[];
  /**
   * "What You'll Learn" labels, in display order. Plain strings by design —
   * TopicsSection owns the colours and the scatter positions, so a weekly
   * swap is just new text. Falls back to the section default when absent.
   */
  topics?: string[];
  /** True only for auto-generated Saturday placeholders — never for real events. */
  placeholder?: boolean;
  /**
   * How long the session runs, in minutes. Optional and additive: every
   * existing consumer of `WorkshopEvent` keeps compiling, and anything without
   * it falls back to `DEFAULT_DURATION_MIN`.
   *
   * This is what makes a *live* window expressible. `date` + `time` give a
   * start; without a length there is no honest way to say a workshop is
   * running now rather than simply "today".
   */
  durationMinutes?: number;
}

/**
 * The events that are NOT workshops.
 *
 * Workshop-track events used to live here too; they are rows in the
 * `WorkshopEvent` table now, edited at /admin/workshop and merged onto this
 * list by `getWorkshopEvents()` (src/features/workshop/get-events.ts). Nothing
 * about a workshop is stated in code any more — that split is what previously
 * let the hero title advance while the countdown stayed behind.
 *
 * These three stayed because they are not weekly content: each is a permanent
 * pointer to another track, changing perhaps once a year, and giving an admin
 * a form to edit the hackathon's calendar entry would add risk for no benefit.
 */
export const STATIC_EVENTS: WorkshopEvent[] = [
  {
    id: "claude-challenge-60day",
    date: "2026-06-01",
    time: "Day 1",
    tag: "Challenge",
    accent: "#c9411c",
    track: "challenge",
    icon: "rocket",
    title: "60-Day Claude AI Challenge begins",
    desc: "Daily AI tasks across four domains with GitHub and LinkedIn proof of work, streaks, and recruiter discoverability at the finish.",
    host: "ABTalks",
    location: "Online · 60 days",
    href: "/",
    ctaLabel: "View challenge",
  },
  {
    id: "ai-cohort-2026-07",
    date: "2026-07-15",
    time: "Cohort start",
    tag: "Cohort",
    accent: "#c9411c",
    track: "cohort",
    icon: "users",
    title: "AI Cohort Program — Cohort begins",
    desc: "31 days of guided missions, concept checks and graded projects for working professionals, ending in a recruiter-facing profile.",
    host: "ABTalks",
    location: "Online · 31 days",
    href: PROGRAM_AI_COHORT_BASE,
    ctaLabel: "View program",
  },
  {
    id: "ai-hackathon-48h",
    date: "2026-08-07",
    time: "Starts 8:00 PM IST",
    tag: "Hackathon",
    accent: "#111111",
    track: "hackathon",
    icon: "trophy",
    title: "48-Hour AI Hackathon",
    desc: "Build a working AI product in a weekend. Form a team, ship something real, and pitch it to judges for prizes and recruiter visibility.",
    host: "ABTalks",
    location: "Online · Team event",
    href: "https://www.abtalks.in/hackathon?s=shr",
    ctaLabel: "View hackathon",
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
export const upcomingEvents = (events: WorkshopEvent[], todayKey: string) =>
  events
    .filter((e) => !isPastEvent(e, todayKey))
    .sort((a, b) => a.date.localeCompare(b.date));

/** Past events, most recent first. */
export const pastEvents = (events: WorkshopEvent[], todayKey: string) =>
  events
    .filter((e) => isPastEvent(e, todayKey))
    .sort((a, b) => b.date.localeCompare(a.date));

export const fullDate = (iso: string) =>
  utc(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

// -------------------------------------------------------------------------
// Calendar helpers. `month` is 0-indexed everywhere below, matching Date.
// -------------------------------------------------------------------------

/** The weekly Saturday workshop cadence begins here. */
const SATURDAY_SERIES_START = "2026-09-01";

const isoKey = (d: Date) => d.toISOString().slice(0, 10);

/** Full month name + year, e.g. "August 2026". */
export const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Synthetic "TBA" workshops for every Saturday of the given month that falls
 * on or after SATURDAY_SERIES_START and has no real entry that day.
 *
 * Generated per visible month rather than held as a module-level array: the
 * cadence has no end date, so a static list would grow without bound as the
 * user pages forward.
 */
export const placeholderSaturdays = (
  events: WorkshopEvent[],
  year: number,
  month: number,
): WorkshopEvent[] => {
  const out: WorkshopEvent[] = [];
  const taken = new Set(events.map((e) => e.date));
  const cursor = new Date(Date.UTC(year, month, 1));

  while (cursor.getUTCMonth() === month) {
    if (cursor.getUTCDay() === 6) {
      const key = isoKey(cursor);
      if (key >= SATURDAY_SERIES_START && !taken.has(key)) {
        out.push({
          id: `workshop-${key}`,
          date: key,
          time: "6:00 PM IST",
          tag: "Workshop",
          accent: "#8f8f8f",
          track: "workshop",
          icon: "calendar",
          title: "Workshop — TBA",
          desc: "Topic announced soon. Register to be notified when this session opens.",
          host: "ABTalks",
          location: "Live · YouTube",
          placeholder: true,
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

/**
 * Every event falling in the given month — real entries plus generated
 * Saturday placeholders — keyed by ISO date so the grid can look up a day in
 * constant time.
 */
export const eventsForMonth = (
  events: WorkshopEvent[],
  year: number,
  month: number,
): Map<string, WorkshopEvent[]> => {
  const map = new Map<string, WorkshopEvent[]>();

  const push = (ev: WorkshopEvent) => {
    const list = map.get(ev.date);
    if (list) list.push(ev);
    else map.set(ev.date, [ev]);
  };

  for (const ev of events) {
    const d = utc(ev.date);
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month) push(ev);
  }
  for (const ev of placeholderSaturdays(events, year, month)) push(ev);

  return map;
};

/**
 * Any finished real workshop opens the details modal. It deliberately does
 * NOT require `youtubeId`: the modal renders a "recording coming soon" state,
 * so takeaways and resources stay reachable while the replay is still being
 * uploaded. Placeholders and non-workshop tracks never qualify.
 */
/**
 * Pre-play still for a recording, straight from the video id — no per-event
 * image to upload, so a workshop gets its thumbnail the moment `youtubeId`
 * is set.
 *
 * `maxres` is 1280×720 but only exists for videos published in HD; `hq` is
 * always present and is the error fallback.
 */
export const youtubeThumb = (id: string, quality: "maxres" | "hq" = "maxres") =>
  `https://i.ytimg.com/vi/${id}/${quality}default.jpg`;

export const hasReplay = (ev: WorkshopEvent, todayKey: string) =>
  ev.track === "workshop" && !ev.placeholder && isPastEvent(ev, todayKey);

// -------------------------------------------------------------------------
// Live / upcoming status, to the minute.
//
// `isPastEvent` compares calendar DAYS, which is the right rule for the
// calendar grid — a workshop should sit under its own date all day. The
// sidebar needs a finer one: a 7pm workshop is still upcoming at 6pm, live at
// 7:30, and gone by 9. So these helpers work in absolute time and leave
// `isPastEvent` untouched, because the grid still depends on it.
// -------------------------------------------------------------------------

/** Assumed length of a session that does not state its own. */
export const DEFAULT_DURATION_MIN = 90;

/**
 * IST is UTC+05:30 year-round — India observes no daylight saving — so the
 * offset can be written into the timestamp directly. That is exact, and it
 * avoids depending on the runtime's zone database for a fixed number.
 */
const IST_OFFSET = "+05:30";

/**
 * Clock time out of a human `time` string, or null when there is none.
 *
 * `time` is free text across the dataset: "7:00 PM IST", "Starts 8:00 PM IST",
 * but also "Day 1" and "Cohort start". Anything without a clock returns null
 * and is treated as an all-day entry rather than being guessed at.
 */
const parseClock = (time: string): { h: number; m: number } | null => {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(time);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const mer = m[3]?.toLowerCase();
  if (h > 23 || min > 59) return null;
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return { h, m: min };
};

/** Start of the event as an epoch millisecond, read in IST. */
export const eventStartMs = (ev: WorkshopEvent): number => {
  const c = parseClock(ev.time);
  const hh = String(c?.h ?? 0).padStart(2, "0");
  const mm = String(c?.m ?? 0).padStart(2, "0");
  return Date.parse(`${ev.date}T${hh}:${mm}:00${IST_OFFSET}`);
};

/**
 * End of the event. An entry with no clock time (a cohort start day, say) runs
 * to the end of its IST day, which matches how `isPastEvent` treats it.
 */
export const eventEndMs = (ev: WorkshopEvent): number => {
  const start = eventStartMs(ev);
  if (!parseClock(ev.time)) return start + 24 * 60 * 60 * 1000;
  return start + (ev.durationMinutes ?? DEFAULT_DURATION_MIN) * 60 * 1000;
};

export type EventStatus = "LIVE" | "UPCOMING" | "PAST";

/** Derived from the clock, never stored — nothing can be stuck reading LIVE. */
export const eventStatus = (ev: WorkshopEvent, nowMs: number): EventStatus => {
  if (nowMs >= eventEndMs(ev)) return "PAST";
  if (nowMs >= eventStartMs(ev)) return "LIVE";
  return "UPCOMING";
};

/**
 * What the Upcoming Workshops sidebar shows: real sessions that have not
 * finished yet, soonest first.
 *
 * Placeholders are excluded deliberately — "Workshop — TBA" is a promise that
 * the cadence continues, which reads correctly as a calendar tile and would
 * read as vapourware as a card with a Register button. They stay on the grid.
 *
 * Because the cut-off is `eventEndMs`, a workshop drops out of this list by
 * itself once it finishes; nothing has to be edited when the week turns over.
 */
/**
 * Every workshop that has not finished yet, soonest first.
 *
 * THE single source of truth for "what is coming up". The sidebar, the
 * registrable event, the hero title and the poster all read this list, so they
 * cannot drift apart — which they previously did, because the sidebar filtered
 * on absolute time while registration filtered on two hand-set booleans.
 *
 * Non-workshop tracks are excluded: the column is headed "Upcoming Workshops",
 * and the hackathon, the cohort start day and the challenge kickoff each have
 * their own destination. Placeholders are excluded too — "Workshop — TBA" is a
 * promise that the cadence continues, which reads correctly as a calendar tile
 * and would read as vapourware as a card with a Register button.
 *
 * The cut-off is `eventEndMs`, so a session leaves this list the minute it
 * finishes and the next one becomes current with no edit anywhere.
 */
const openWorkshops = (
  events: WorkshopEvent[],
  nowMs: number,
): WorkshopEvent[] =>
  events
    .filter(
      (e) =>
        e.track === "workshop" &&
        !e.placeholder &&
        eventStatus(e, nowMs) !== "PAST",
    )
    .sort((a, b) => eventStartMs(a) - eventStartMs(b));

export const sidebarEvents = (
  events: WorkshopEvent[],
  nowMs: number,
  limit = 3,
): WorkshopEvent[] => openWorkshops(events, nowMs).slice(0, limit);

/**
 * The one event currently accepting signups.
 *
 * Derived from the clock, not from a flag somebody has to remember to move.
 * It used to be `upcomingEvents(todayKey).find(e => e.register &&
 * e.registrationOpen)`, which had two failure modes a week apart:
 *
 *   - only ONE event ever carried both flags, so the Saturday after that
 *     workshop ran, this returned `undefined` and the server answered every
 *     signup with "Registration is closed right now" until a developer edited
 *     the data file;
 *   - `upcomingEvents` compares calendar DAYS, while the sidebar compares
 *     absolute time, so between a workshop's end and IST midnight the two
 *     disagreed about which event was current.
 *
 * Both now read the same list. See `openWorkshops`.
 *
 * `registrationOpen: false` stays meaningful as an explicit kill switch —
 * setting it closes signups for that session without deleting it. Absent or
 * true means open, so the common case needs no edit at all.
 *
 * The instant defaults to now, read here rather than in the caller: a Server
 * Component body that calls `Date.now()` during render trips React's purity
 * rule, and every caller that simply means "right now" should not have to
 * thread a clock. Tests and the frozen-clock checks pass one explicitly.
 */
export const getRegistrableEvent = (
  events: WorkshopEvent[],
  nowMs: number = Date.now(),
): WorkshopEvent | undefined =>
  openWorkshops(events, nowMs).find((e) => e.registrationOpen !== false);
