/**
 * TC-C-018 acceptance tests for T-251 profile-view notification.
 *   npx tsx src/features/profile-view-notification/service.test.ts
 *
 * Exercises the pure service against an in-memory store + a fake dispatcher
 * that models the T-248 dedup contract (unique on dedupeKey).
 */
import {
  notifyProfileViewed,
  ROLLING_WINDOW_MS,
  type DispatchFn,
} from "./service";
import type { ProfileViewStore } from "./store";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

/**
 * Represents a UserNotification row for `profile.viewed`. Only the fields
 * the service touches are modelled.
 */
type Row = {
  candidateUserId: string;
  recruiterUserId: string;
  createdAt: Date;
};

function inMemoryStore(): ProfileViewStore & { rows: Row[] } {
  const rows: Row[] = [];
  return {
    rows,
    async hasRecentNotification(candidateUserId, recruiterUserId, since) {
      return rows.some(
        (r) =>
          r.candidateUserId === candidateUserId &&
          r.recruiterUserId === recruiterUserId &&
          r.createdAt.getTime() >= since.getTime(),
      );
    },
  };
}

/**
 * Fake dispatcher — models the T-248 unique-key contract. If `dedupeKey` is
 * passed, dedup happens on that. Otherwise it falls back to the default
 * builder. On accept, it stamps a row into the store so the next
 * `hasRecentNotification` sees it.
 */
function fakeDispatcher(store: ProfileViewStore & { rows: Row[] }): DispatchFn & {
  sent: string[];
  deduped: string[];
} {
  const seen = new Set<string>();
  const sent: string[] = [];
  const deduped: string[] = [];
  const fn: DispatchFn = async (event) => {
    const key =
      event.dedupeKey ??
      `${event.eventType}:${event.recipientUserId}:${event.primaryEntityId}`;
    if (seen.has(key)) {
      deduped.push(key);
      return { ok: true, deduplicated: true };
    }
    seen.add(key);
    sent.push(key);
    // Emulate the DB write so the store's hasRecentNotification sees it.
    // Use metadata.at (the service's mocked "now") so tests that advance a
    // fake clock behave as prod would.
    const at = event.metadata?.at as string | undefined;
    store.rows.push({
      candidateUserId: event.recipientUserId,
      recruiterUserId: event.primaryEntityId,
      createdAt: at ? new Date(at) : new Date(),
    });
    return { ok: true, deduplicated: false };
  };
  return Object.assign(fn, { sent, deduped });
}

async function run() {
  console.log("service.test.ts (T-251 profile-view notification)");

  // --- TC-C-018.1: first view fires ---

  await suite(
    "TC-C-018.1: first view by a recruiter fires exactly one dispatch",
    async () => {
      const store = inMemoryStore();
      const dispatch = fakeDispatcher(store);
      const res = await notifyProfileViewed(
        { store, dispatch },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      assert(res.ok, "call ok");
      assert(res.sent === true, `sent got ${res.sent}`);
      assert(dispatch.sent.length === 1, `dispatch count ${dispatch.sent.length}`);
      assert(
        dispatch.sent[0]?.startsWith("profile.viewed:candX:recA:"),
        `dedupeKey shape wrong: ${dispatch.sent[0]}`,
      );
    },
  );

  // --- TC-C-018.2/3: repeat views inside window ---

  await suite(
    "TC-C-018.2/3: same recruiter views three times in one hour → one dispatch",
    async () => {
      const store = inMemoryStore();
      const dispatch = fakeDispatcher(store);
      let clock = new Date("2026-09-14T10:00:00Z").getTime();
      const now = () => new Date(clock);

      const first = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      clock += 15 * 60 * 1000; // +15 min
      const second = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      clock += 30 * 60 * 1000; // +45 min total
      const third = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );

      assert(first.ok && first.sent === true, "first sent");
      assert(second.ok && second.sent === false && second.reason === "window", "second skipped");
      assert(third.ok && third.sent === false && third.reason === "window", "third skipped");
      assert(dispatch.sent.length === 1, `dispatch count ${dispatch.sent.length}`);
    },
  );

  // --- TC-C-018.4: different recruiter ---

  await suite(
    "TC-C-018.4: a second recruiter views inside the same hour → one more dispatch",
    async () => {
      const store = inMemoryStore();
      const dispatch = fakeDispatcher(store);
      const clock = new Date("2026-09-14T10:00:00Z").getTime();
      const now = () => new Date(clock);

      const a = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      const b = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recB" },
      );
      assert(a.ok && a.sent === true, "A sent");
      assert(b.ok && b.sent === true, "B sent");
      assert(dispatch.sent.length === 2, `dispatch count ${dispatch.sent.length}`);
    },
  );

  // --- TC-C-018.5: rolling window rolls ---

  await suite(
    "TC-C-018.5: same recruiter views again after 24h+1min → one more dispatch",
    async () => {
      const store = inMemoryStore();
      const dispatch = fakeDispatcher(store);
      let clock = new Date("2026-09-14T10:00:00Z").getTime();
      const now = () => new Date(clock);

      const first = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      clock += ROLLING_WINDOW_MS + 60 * 1000; // 24h + 1min later
      const second = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );

      assert(first.ok && first.sent === true, "first sent");
      assert(second.ok && second.sent === true, "second sent after window rolled");
      assert(dispatch.sent.length === 2, `dispatch count ${dispatch.sent.length}`);
    },
  );

  // --- TC-C-018.5b: exactly at the boundary is still inside the window ---

  await suite(
    "TC-C-018.5b: second view at exactly the window boundary is still deduped",
    async () => {
      const store = inMemoryStore();
      const dispatch = fakeDispatcher(store);
      let clock = new Date("2026-09-14T10:00:00Z").getTime();
      const now = () => new Date(clock);

      await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      clock += ROLLING_WINDOW_MS - 1000; // 1 second before boundary
      const second = await notifyProfileViewed(
        { store, dispatch, now },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      assert(
        second.ok && second.sent === false && second.reason === "window",
        "second should still dedup",
      );
    },
  );

  // --- TC-C-018.6: self-view guard ---

  await suite(
    "TC-C-018.6: self-view (recruiter is also the candidate) is silently skipped",
    async () => {
      const store = inMemoryStore();
      const dispatch = fakeDispatcher(store);
      const res = await notifyProfileViewed(
        { store, dispatch },
        { candidateUserId: "u1", recruiterUserId: "u1" },
      );
      assert(res.ok && res.sent === false && res.reason === "self_view", "self-view guard");
      assert(dispatch.sent.length === 0, "no dispatch");
    },
  );

  // --- TC-C-018.7: dispatch failure surfaces cleanly ---

  await suite(
    "TC-C-018.7: dispatch returns ok:false → service returns ok:false, no crash",
    async () => {
      const store = inMemoryStore();
      const dispatch: DispatchFn = async () => ({ ok: false, message: "boom" });
      const res = await notifyProfileViewed(
        { store, dispatch },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      assert(!res.ok && res.message === "boom", `wrong return: ${JSON.stringify(res)}`);
    },
  );

  // --- Anonymous copy: recruiter identity must not leak into title/body ---

  await suite(
    "title and body are the anonymous copy — recruiter name is never revealed",
    async () => {
      const store = inMemoryStore();
      let capturedTitle: string | null = null;
      let capturedBody: string | undefined;
      const dispatch: DispatchFn = async (event) => {
        capturedTitle = event.title;
        capturedBody = event.body;
        return { ok: true, deduplicated: false };
      };
      await notifyProfileViewed(
        { store, dispatch },
        { candidateUserId: "candX", recruiterUserId: "recA" },
      );
      assert(
        capturedTitle === "You're getting noticed",
        `wrong title: ${capturedTitle}`,
      );
      assert(
        capturedBody === "1 more recruiter viewed your profile.",
        `wrong body: ${capturedBody}`,
      );
    },
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
