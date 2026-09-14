import {
  CLIPBOARD_EVENT_TYPES,
  MAX_EVENTS_PER_ATTEMPT,
  type AttemptEventType,
} from "@/lib/validations/assessment";

export const SESSION_GRACE_MS = 45_000; // heartbeat 20s + slack
export const UPLOAD_LINK_ATTRIBUTION_MS = 5_000;
export const TIMELINE_GROUP_MS = 1_000;

export type ActivityEvent = {
  sessionId: string;
  seq: number;
  type: AttemptEventType;
  occurredAt: Date;
  questionId: string | null;
  count: number;
};
export type ActivitySession = {
  clientSessionId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};
export type IntervalKind = "FULLSCREEN" | "HIDDEN" | "UNFOCUSED" | "PAGE_CLOSED" | "CAMERA_OFF";
export type TimelineEntry = { at: Date; sessionNumber: number | null; lines: string[] };
export type ActivitySummary = {
  window: { start: Date; end: Date; inProgress: boolean };
  sessionCount: number;
  awayMs: number;
  awayAfterUploadLinkMs: number;
  totals: Record<IntervalKind, { times: number; ms: number; withoutReturn: number }>;
  clipboardBlocked: number; // sum of count
  linksPasted: number;
  timeline: TimelineEntry[];
  limitReached: boolean;
};

const CLIPBOARD = new Set<string>(CLIPBOARD_EVENT_TYPES);

export function formatDuration(ms: number): string {
  if (ms < 1000) return "under 1s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type DescribeEventCtx = {
  returnAfterMs?: number;
  questionNumber?: number;
  sessionNumber: number;
  multipleSessions: boolean;
};

function clipboardLine(verb: string, ctx: DescribeEventCtx, count: number): string {
  let line = verb;
  if (ctx.questionNumber != null) line += ` in Q${ctx.questionNumber}`;
  if (count > 1) line += ` (${count} attempts)`;
  return line;
}

export function describeEvent(e: ActivityEvent, ctx: DescribeEventCtx): string {
  const d =
    ctx.returnAfterMs != null ? formatDuration(ctx.returnAfterMs) : undefined;
  switch (e.type) {
    case "SESSION_STARTED":
      return ctx.multipleSessions
        ? `Opened the assessment page (page session ${ctx.sessionNumber})`
        : "Opened the assessment page";
    case "PAGE_LEFT":
      return "Left the assessment page";
    case "FULLSCREEN_EXITED":
      return "Fullscreen exited";
    case "FULLSCREEN_ENTERED":
      return d ? `Returned to fullscreen after ${d}` : "Entered fullscreen";
    case "VISIBILITY_HIDDEN":
      return "Assessment page hidden";
    case "VISIBILITY_VISIBLE":
      return d ? `Assessment page shown again after ${d}` : "Assessment page shown";
    case "WINDOW_BLURRED":
      return "Browser window lost focus";
    case "WINDOW_FOCUSED":
      return d ? `Browser window focused again after ${d}` : "Browser window focused";
    case "COPY_BLOCKED":
      return clipboardLine("Copy blocked", ctx, e.count);
    case "CUT_BLOCKED":
      return clipboardLine("Cut blocked", ctx, e.count);
    case "PASTE_BLOCKED":
      return clipboardLine("Paste blocked", ctx, e.count);
    case "DROP_BLOCKED":
      return clipboardLine("Dropped content blocked", ctx, e.count);
    case "LINK_PASTED":
      return `Pasted a link into Q${ctx.questionNumber}'s file-link field`;
    case "UPLOAD_LINK_OPENED":
      return `Opened the upload link for Q${ctx.questionNumber}`;
    case "CAMERA_OFF":
      return "Camera off";
    case "CAMERA_ON":
      return d ? `Camera back on after ${d}` : "Camera on";
  }
}

export const SUMMARY_COPY = {
  away: {
    label: "Time away from the assessment page",
    help: "Time between start and submission when no assessment page was visible, focused and in fullscreen — including while the page was closed.",
  },
  awayAfterUploadLink: {
    help: (d: string) =>
      `of which ${d} began within 5 seconds of opening an upload link`,
  },
  FULLSCREEN: {
    label: "Fullscreen exited",
    help: (times: number, d: string) => `${times} times · ${d} outside fullscreen`,
  },
  HIDDEN: {
    label: "Page hidden",
    help: "Browsers report this when the tab is switched, the window is minimised or the screen is locked. They don't say which.",
  },
  UNFOCUSED: {
    label: "Window not focused",
    help: "Reported when another window, app or system dialog takes focus.",
  },
  PAGE_CLOSED: {
    label: "Page closed",
    help: "Time from leaving the page until it was opened again.",
  },
  CAMERA_OFF: {
    label: "Camera off",
    help: "Time the camera was off after being on.",
  },
  clipboard: {
    label: "Copy, cut and paste blocked",
    help: "Attempts, including repeats.",
  },
  links: {
    label: "Links pasted",
    help: "Pasted into file-link fields, where pasting is allowed.",
  },
  sessions: {
    label: "Page sessions",
    help: "Each page load or reopening is a new session.",
  },
  withoutReturn: {
    help: (n: number) =>
      `${n} with no recorded return — the page stopped reporting, for example it was closed without a leave event or lost its connection.`,
  },
  limit: {
    help: "Recording stopped at 1,000 events for this attempt; later events weren't stored.",
  },
};

export const ACTIVITY_DISCLAIMER =
  "These events are what the candidate's browser reported while the assessment page was open: what happened on the page and when, not why. ABTalks does not detect other screens or devices, eye movement, which websites or apps were used, or whether anyone helped, and it does not judge whether a candidate cheated. A browser can be modified to stop reporting, so a missing event is not proof that something didn't happen.";

export const CAMERA_DISCLAIMER =
  "“Camera on” means the camera on the candidate's device was running. ABTalks doesn't record or see the video and can't tell who, or whether anyone, was in front of it.";

/** Words no activity label, summary label or activity page may use. The two disclaimers are exempt (they negate these). */
export const BANNED_CLAIM_PATTERN =
  /cheat|suspicious|violation|flagged|red flag|risk score|integrity score|trust score|proctor|eye[- ]?(movement|tracking)|gaze|second (monitor|screen)|multiple monitors|another person|someone else|impersonat|detected/i;

type Interval = [number, number];

function emptyTotals(): ActivitySummary["totals"] {
  return {
    FULLSCREEN: { times: 0, ms: 0, withoutReturn: 0 },
    HIDDEN: { times: 0, ms: 0, withoutReturn: 0 },
    UNFOCUSED: { times: 0, ms: 0, withoutReturn: 0 },
    PAGE_CLOSED: { times: 0, ms: 0, withoutReturn: 0 },
    CAMERA_OFF: { times: 0, ms: 0, withoutReturn: 0 },
  };
}

function clampTime(t: number, start: number, end: number): number {
  return Math.min(Math.max(t, start), end);
}

function unionIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = out[out.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function clipIntervals(intervals: Interval[], winStart: number, winEnd: number): Interval[] {
  return intervals
    .map(([s, e]) => [Math.max(s, winStart), Math.min(e, winEnd)] as Interval)
    .filter(([s, e]) => e > s);
}

function complement(merged: Interval[], winStart: number, winEnd: number): Interval[] {
  const away: Interval[] = [];
  let cursor = winStart;
  for (const [s, e] of merged) {
    if (s > cursor) away.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < winEnd) away.push([cursor, winEnd]);
  return away;
}

function eventKey(sessionId: string, seq: number): string {
  return `${sessionId}:${seq}`;
}

export function summarizeAttemptActivity(input: {
  startedAt: Date;
  submittedAt: Date | null;
  now: Date;
  cameraRequired: boolean;
  sessions: ActivitySession[];
  events: ActivityEvent[];
  questionNumbers: Record<string, number>;
  eventCount: number;
}): ActivitySummary {
  const winStart = input.startedAt.getTime();
  const winEnd = (input.submittedAt ?? input.now).getTime();
  const inProgress = input.submittedAt === null;
  const totals = emptyTotals();
  const returnAfter = new Map<string, number>();
  const uploadLinkTimes: number[] = [];
  let clipboardBlocked = 0;
  let linksPasted = 0;
  const allInView: Interval[] = [];

  const bySession = new Map<string, ActivityEvent[]>();
  const known = new Set(input.sessions.map((s) => s.clientSessionId));
  for (const e of input.events) {
    if (!known.has(e.sessionId)) continue;
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
  }
  for (const list of bySession.values()) {
    list.sort((a, b) => a.seq - b.seq);
  }

  function sessionStartOf(s: ActivitySession): number {
    const started = (bySession.get(s.clientSessionId) ?? []).find(
      (e) => e.type === "SESSION_STARTED",
    );
    return (started?.occurredAt.getTime() ?? s.firstSeenAt.getTime());
  }

  const ordered = [...input.sessions].sort(
    (a, b) => sessionStartOf(a) - sessionStartOf(b),
  );
  const sessionNumberById = new Map<string, number>();
  ordered.forEach((s, i) => sessionNumberById.set(s.clientSessionId, i + 1));
  const sessionStarts = ordered.map((s) => sessionStartOf(s));

  type OpenMap = Record<"FULLSCREEN" | "HIDDEN" | "UNFOCUSED" | "CAMERA_OFF", number | null>;

  function close(
    kind: "FULLSCREEN" | "HIDDEN" | "UNFOCUSED" | "CAMERA_OFF",
    at: number,
    open: OpenMap,
    returnEvent?: ActivityEvent,
  ) {
    const opened = open[kind];
    if (opened === null) return;
    totals[kind].times += 1;
    totals[kind].ms += at - opened;
    if (returnEvent) {
      returnAfter.set(eventKey(returnEvent.sessionId, returnEvent.seq), at - opened);
    }
    open[kind] = null;
  }

  for (let si = 0; si < ordered.length; si++) {
    const s = ordered[si];
    const events = bySession.get(s.clientSessionId) ?? [];
    const left = events.find((e) => e.type === "PAGE_LEFT");
    const leftAt = left?.occurredAt.getTime();
    const sessionStart = sessionStartOf(s);
    const sessionEnd = Math.min(
      leftAt ?? s.lastSeenAt.getTime() + SESSION_GRACE_MS,
      winEnd,
    );

    const state = {
      visible: true,
      focused: true,
      fullscreen: false,
      camera: !input.cameraRequired,
    };
    const open: OpenMap = {
      FULLSCREEN: null,
      HIDDEN: null,
      UNFOCUSED: null,
      CAMERA_OFF: null,
    };
    let inViewSince: number | null = null;
    const sessionInView: Interval[] = [];

    for (const e of events) {
      if (e.type === "PAGE_LEFT") break;
      const at = clampTime(e.occurredAt.getTime(), sessionStart, sessionEnd);
      const wasInView = state.visible && state.focused && state.fullscreen;

      if (e.type === "FULLSCREEN_EXITED") {
        if (state.fullscreen) {
          state.fullscreen = false;
          open.FULLSCREEN = at;
        }
      } else if (e.type === "FULLSCREEN_ENTERED") {
        if (!state.fullscreen) {
          state.fullscreen = true;
          close("FULLSCREEN", at, open, e);
        }
      } else if (e.type === "VISIBILITY_HIDDEN") {
        if (state.visible) {
          state.visible = false;
          open.HIDDEN = at;
        }
      } else if (e.type === "VISIBILITY_VISIBLE") {
        if (!state.visible) {
          state.visible = true;
          close("HIDDEN", at, open, e);
        }
      } else if (e.type === "WINDOW_BLURRED") {
        if (state.focused) {
          state.focused = false;
          open.UNFOCUSED = at;
        }
      } else if (e.type === "WINDOW_FOCUSED") {
        if (!state.focused) {
          state.focused = true;
          close("UNFOCUSED", at, open, e);
        }
      } else if (e.type === "CAMERA_OFF") {
        if (state.camera) {
          state.camera = false;
          open.CAMERA_OFF = at;
        }
      } else if (e.type === "CAMERA_ON") {
        if (!state.camera) {
          state.camera = true;
          close("CAMERA_OFF", at, open, e);
        }
      } else if (e.type === "UPLOAD_LINK_OPENED") {
        uploadLinkTimes.push(at);
      } else if (CLIPBOARD.has(e.type)) {
        clipboardBlocked += e.count;
      } else if (e.type === "LINK_PASTED") {
        linksPasted += 1;
      }

      const isInView = state.visible && state.focused && state.fullscreen;
      if (!wasInView && isInView) inViewSince = at;
      if (wasInView && !isInView && inViewSince != null) {
        sessionInView.push([inViewSince, at]);
        inViewSince = null;
      }
    }

    const inViewAtEnd = state.visible && state.focused && state.fullscreen;
    if (inViewAtEnd && inViewSince != null) {
      sessionInView.push([inViewSince, sessionEnd]);
    }

    for (const kind of ["FULLSCREEN", "HIDDEN", "UNFOCUSED", "CAMERA_OFF"] as const) {
      if (open[kind] !== null) {
        totals[kind].times += 1;
        totals[kind].ms += sessionEnd - (open[kind] as number);
        totals[kind].withoutReturn += 1;
        open[kind] = null;
      }
    }

    if (leftAt != null) {
      const nextStart = sessionStarts.find((t) => t > leftAt);
      const closedUntil = nextStart ?? winEnd;
      const start = clampTime(leftAt, winStart, winEnd);
      const end = clampTime(closedUntil, winStart, winEnd);
      if (end > start) {
        totals.PAGE_CLOSED.times += 1;
        totals.PAGE_CLOSED.ms += end - start;
        if (nextStart == null) totals.PAGE_CLOSED.withoutReturn += 1;
      }
    }

    allInView.push(...sessionInView);
  }

  const merged = clipIntervals(unionIntervals(allInView), winStart, winEnd);
  const inViewMs = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  const awayMs = Math.max(0, winEnd - winStart - inViewMs);
  const awaySegments = complement(merged, winStart, winEnd);
  let awayAfterUploadLinkMs = 0;
  for (const [s, e] of awaySegments) {
    const attributed = uploadLinkTimes.some(
      (t) => s - UPLOAD_LINK_ATTRIBUTION_MS <= t && t <= s,
    );
    if (attributed) awayAfterUploadLinkMs += e - s;
  }

  const multipleSessions = ordered.length > 1;
  type TimelineRow = {
    at: Date;
    sessionNumber: number | null;
    seq: number;
    line: string;
  };
  const rows: TimelineRow[] = [
    {
      at: input.startedAt,
      sessionNumber: null,
      seq: -1,
      line: "Started the assessment",
    },
  ];
  for (const e of input.events) {
    const sessionNumber = sessionNumberById.get(e.sessionId);
    if (sessionNumber == null) continue;
    const qn = e.questionId ? input.questionNumbers[e.questionId] : undefined;
    rows.push({
      at: e.occurredAt,
      sessionNumber,
      seq: e.seq,
      line: describeEvent(e, {
        returnAfterMs: returnAfter.get(eventKey(e.sessionId, e.seq)),
        questionNumber: qn,
        sessionNumber,
        multipleSessions,
      }),
    });
  }
  if (input.submittedAt) {
    rows.push({
      at: input.submittedAt,
      sessionNumber: null,
      seq: Number.MAX_SAFE_INTEGER,
      line: "Submitted the assessment",
    });
  }
  rows.sort((a, b) => {
    const t = a.at.getTime() - b.at.getTime();
    if (t !== 0) return t;
    const snA = a.sessionNumber ?? 0;
    const snB = b.sessionNumber ?? 0;
    if (snA !== snB) return snA - snB;
    return a.seq - b.seq;
  });

  const timeline: TimelineEntry[] = [];
  for (const row of rows) {
    const last = timeline[timeline.length - 1];
    if (
      last &&
      row.sessionNumber !== null &&
      last.sessionNumber === row.sessionNumber &&
      row.at.getTime() - last.at.getTime() <= TIMELINE_GROUP_MS
    ) {
      last.lines.push(row.line);
    } else {
      timeline.push({
        at: row.at,
        sessionNumber: row.sessionNumber,
        lines: [row.line],
      });
    }
  }

  return {
    window: { start: input.startedAt, end: new Date(winEnd), inProgress },
    sessionCount: ordered.length,
    awayMs,
    awayAfterUploadLinkMs,
    totals,
    clipboardBlocked,
    linksPasted,
    timeline,
    limitReached: input.eventCount >= MAX_EVENTS_PER_ATTEMPT,
  };
}
