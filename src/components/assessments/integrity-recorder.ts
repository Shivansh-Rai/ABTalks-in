import {
  CLIPBOARD_EVENT_TYPES,
  MAX_EVENTS_PER_BATCH,
  type AttemptEventType,
} from "@/lib/validations/assessment";

export type RecorderDeps = {
  assignmentId: string;
  send: (body: string) => Promise<{ status: number }>; // fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } })
  beacon: (body: string) => boolean; // navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }))
  now: () => number; // Date.now
  uuid: () => string; // crypto.randomUUID
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
  onStopped: (status: 401 | 404 | 409) => void;
};

export type IntegrityRecorder = {
  startSession(): void; // new sessionId, seq = 0, records SESSION_STARTED
  record(type: AttemptEventType, questionId?: string): void;
  flushWithBeacon(): void;
  leave(): void; // PAGE_LEFT (once per session) + flushWithBeacon
  finish(): void; // stop without PAGE_LEFT: submitted, or the app closed the attempt
  isStopped(): boolean;
};

type Queued = {
  sessionId: string;
  seq: number;
  type: AttemptEventType;
  occurredAt: number;
  questionId?: string;
  count: number;
  sentByBeacon: boolean;
  inFlight: boolean;
};

const CLIPBOARD = new Set<string>(CLIPBOARD_EVENT_TYPES);
const FLUSH_MS = 5_000;
const HEARTBEAT_MS = 20_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

export function createIntegrityRecorder(deps: RecorderDeps): IntegrityRecorder {
  let sessionId = "";
  let seq = 0;
  let stopped = false;
  let pageLeft = false;
  const queue: Queued[] = [];
  let flushTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let retryTimer: number | null = null;
  let retryCount = 0;
  let sending = false;

  function clear(id: number | null) {
    if (id != null) deps.clearTimer(id);
  }

  function stopTimers() {
    clear(flushTimer);
    clear(heartbeatTimer);
    clear(retryTimer);
    flushTimer = null;
    heartbeatTimer = null;
    retryTimer = null;
  }

  function stop() {
    stopped = true;
    stopTimers();
  }

  function scheduleFlush() {
    if (stopped || flushTimer != null || retryTimer != null) return;
    flushTimer = deps.setTimer(() => {
      flushTimer = null;
      void fetchFlush();
    }, FLUSH_MS);
  }

  function scheduleHeartbeat() {
    clear(heartbeatTimer);
    if (stopped) return;
    heartbeatTimer = deps.setTimer(() => {
      heartbeatTimer = null;
      void fetchFlush({ heartbeat: true });
    }, HEARTBEAT_MS);
  }

  function scheduleRetry() {
    if (stopped || retryTimer != null) return;
    const delay =
      RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
    retryCount += 1;
    retryTimer = deps.setTimer(() => {
      retryTimer = null;
      void fetchFlush();
    }, delay);
  }

  function payloadOf(items: Queued[], sentAt: number): string {
    const sid = items[0]?.sessionId ?? sessionId;
    return JSON.stringify({
      sessionId: sid,
      sentAt,
      events: items.map((e) => ({
        seq: e.seq,
        type: e.type,
        occurredAt: e.occurredAt,
        ...(e.questionId ? { questionId: e.questionId } : {}),
        ...(e.count > 1 ? { count: e.count } : {}),
      })),
    });
  }

  async function fetchFlush(opts: { heartbeat?: boolean } = {}) {
    if (stopped || sending) {
      if (opts.heartbeat && !stopped) scheduleHeartbeat();
      return;
    }
    const ready = queue.filter((e) => !e.inFlight);
    const batch = ready.slice(0, MAX_EVENTS_PER_BATCH);
    if (batch.length === 0 && !opts.heartbeat) {
      scheduleHeartbeat();
      return;
    }

    sending = true;
    for (const e of batch) e.inFlight = true;
    const sentAt = deps.now();
    const body = payloadOf(batch, sentAt);

    try {
      const res = await deps.send(body);
      if (res.status === 200) {
        for (const e of batch) {
          const i = queue.indexOf(e);
          if (i >= 0) queue.splice(i, 1);
        }
        retryCount = 0;
        sending = false;
        scheduleHeartbeat();
        if (queue.some((e) => !e.inFlight)) scheduleFlush();
        return;
      }
      if (res.status === 401 || res.status === 404 || res.status === 409) {
        sending = false;
        stop();
        deps.onStopped(res.status);
        return;
      }
      if (res.status === 400 || res.status === 413) {
        for (const e of batch) {
          const i = queue.indexOf(e);
          if (i >= 0) queue.splice(i, 1);
        }
        sending = false;
        retryCount = 0;
        scheduleHeartbeat();
        if (queue.some((e) => !e.inFlight)) scheduleFlush();
        return;
      }
      for (const e of batch) e.inFlight = false;
      sending = false;
      scheduleRetry();
    } catch {
      for (const e of batch) e.inFlight = false;
      sending = false;
      scheduleRetry();
    }
  }

  const recorder: IntegrityRecorder = {
    startSession() {
      if (stopped) return;
      sessionId = deps.uuid();
      seq = 0;
      pageLeft = false;
      recorder.record("SESSION_STARTED");
      scheduleHeartbeat();
    },
    record(type, questionId) {
      if (stopped) return;
      if (!sessionId) return;
      const t = deps.now();
      const last = queue[queue.length - 1];
      if (
        CLIPBOARD.has(type) &&
        last &&
        last.type === type &&
        last.questionId === questionId &&
        !last.inFlight &&
        !last.sentByBeacon &&
        t - last.occurredAt <= 1000
      ) {
        last.count += 1;
        return;
      }
      queue.push({
        sessionId,
        seq,
        type,
        occurredAt: t,
        questionId,
        count: 1,
        sentByBeacon: false,
        inFlight: false,
      });
      seq += 1;
      scheduleFlush();
    },
    flushWithBeacon() {
      if (stopped) return;
      const unsent = queue.filter((e) => !e.inFlight).slice(0, MAX_EVENTS_PER_BATCH);
      if (unsent.length === 0) return;
      const body = payloadOf(unsent, deps.now());
      if (deps.beacon(body)) {
        for (const e of unsent) e.sentByBeacon = true;
      }
    },
    leave() {
      if (stopped) return;
      if (!pageLeft) {
        pageLeft = true;
        recorder.record("PAGE_LEFT");
      }
      recorder.flushWithBeacon();
    },
    finish() {
      stop();
    },
    isStopped() {
      return stopped;
    },
  };

  return recorder;
}
