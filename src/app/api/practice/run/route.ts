/**
 * Plan 186: the Run proxy for coding practice.
 *
 * The browser calls this route; this route calls Judge0. The browser never
 * sees the Judge0 URL, a key or a submission token, and user code is never
 * executed on this server: it is a string relayed to Judge0.
 *
 * A Run is temporary. This file reads and writes nothing in the database (the
 * session is a JWT, the tests come from the content module), and repeated
 * clicks are held back by an in-memory cooldown rather than the shared
 * database-backed limiter, which would insert a row per Run.
 *
 * Day locks are not checked here, on purpose: that would cost a database read
 * per Run. The question page and Submit enforce them.
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { judge } from "@/features/code-runner/judge0";
import { allowHit } from "@/features/code-runner/throttle";
import { PRACTICE_RUN_COOLDOWN_MS } from "@/features/coding-practice/constants";
import {
  buildPracticeSource,
  getPracticeTests,
} from "@/features/coding-practice/content";
import { isCodingPracticeEnabled } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import { practiceRunSchema } from "@/lib/validations/coding-practice";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 100_000;

function reply(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  if (!isCodingPracticeEnabled()) {
    return reply(404, { ok: false, message: "Not found" });
  }

  // Same-origin only (defense in depth; the session cookie is SameSite=Lax).
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
    if (host !== request.nextUrl.host) {
      return reply(403, { ok: false, message: "Forbidden" });
    }
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return reply(401, { ok: false, message: "Please sign in to continue." });
  }

  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
      return reply(413, { ok: false, message: "Your code is too long to run." });
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { ok: false, message: "Invalid request." });
    }
    const parsed = practiceRunSchema.safeParse(body);
    if (!parsed.success) {
      return reply(400, { ok: false, message: "Invalid request." });
    }
    const { challenge, day, slot, language, code, customInput } = parsed.data;

    if (!allowHit(`run:${userId}`, PRACTICE_RUN_COOLDOWN_MS)) {
      return reply(429, {
        ok: false,
        message: "Please wait a moment before running again.",
      });
    }

    const run = getPracticeTests(challenge, day, slot);
    const source = buildPracticeSource(challenge, day, slot, language, code);
    if (!run || !source) {
      return reply(404, { ok: false, message: "Question not found." });
    }

    // Custom input: one run against what the learner typed, output only.
    const result = await judge({
      language,
      code: source,
      tests:
        customInput === undefined
          ? run.tests.filter((t) => !t.hidden)
          : [
              {
                input: customInput.endsWith("\n") ? customInput : `${customInput}\n`,
                expectedOutput: "",
                hidden: false,
              },
            ],
      timeLimitSec: run.timeLimitSec,
      skipCompare: customInput !== undefined,
    });
    if (result.verdict === "unavailable") {
      return reply(503, {
        ok: false,
        message:
          "Code execution is unavailable right now. Please try again in a minute.",
      });
    }
    return reply(200, { ok: true, data: result });
  } catch (error) {
    logger.error("[practice-run]", { error: String(error) });
    return reply(500, { ok: false, message: "Could not run your code." });
  }
}
