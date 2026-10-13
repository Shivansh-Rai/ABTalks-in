import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { resolveInterviewLLM } from "@/features/interview/agent/llm/registry";
import {
  audioFilenameFor,
  rejectAudioUpload,
  synthesizeLine,
  transcribeAnswer,
} from "@/features/interview/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Latency probe for the voice interview pipeline.
 *
 * WHY THIS EXISTS. The three hops that make up the gap between a candidate
 * finishing their answer and hearing the next question — transcription, the
 * analyze call, synthesis — can only be timed honestly against the real vendors
 * through the real modules. Timing them from a script measures the script;
 * timing them through `/mock-interviews` means first getting an enrolled user,
 * an open attempt, consent and a mic check, none of which has anything to do
 * with latency. This hits `transcribeAnswer`, `resolveInterviewLLM` and
 * `synthesizeLine` directly: the same functions a real turn uses, with no UI in
 * front of them.
 *
 * IT RUNS IN PRODUCTION ON PURPOSE. Latency is a property of the deployment,
 * not of the code: Vercel's region, the cold-start penalty and the real network
 * path to each vendor are exactly what a developer machine cannot reproduce, so
 * a probe that only works locally measures the wrong computer. What it must not
 * be is open.
 *
 * WHY IT IS SAFE THERE, and why no guard is optional:
 *
 *  1. `ENABLE_INTERVIEW_LATENCY_PROBE` must be `true`. An env flag rather than
 *     a build-time constant, so it is a kill switch that takes effect without a
 *     deploy.
 *  2. Caller must be a PLATFORM ADMIN, or present a secret in
 *     `x-interview-probe-token`. Two doors because they serve different jobs: a
 *     browser session for the bench UI, a token for curl and CI. Replacing the
 *     old `NODE_ENV !== "production"` check — an environment is not an
 *     authorisation, and treating it as one is how a diagnostic endpoint ends up
 *     public the first time someone runs a preview deploy.
 *  3. It reads NO session beyond that check, NO candidate data and NO interview
 *     row. There is nothing here to leak and no attempt it could corrupt.
 *  4. The synthesized words are a FIXED authored line. It never speaks text
 *     from the request. That is the same rule the real speech routes enforce,
 *     and it is what stops this becoming an open text-to-speech service.
 *  5. Every priced call is metered (see `spend`), so a tab left open on the
 *     bench cannot run up a vendor bill.
 *
 * THE ABUSE CASE THAT DROVE 2. The POST hop transcribes WHATEVER AUDIO IT IS
 * GIVEN. Unauthenticated in production that is a free transcription service
 * billed to this project, which is a worse hole than the latency number is
 * worth. Admin-or-token is the whole reason it can be exposed at all.
 */

/** Spoken by the probe. Authored here, never taken from the request. */
const PROBE_LINE =
  "Walk me through how you decided what actually made it into the retrieved context, and what you tried before that worked.";

/** A realistic analyze payload, so the LLM timing reflects a real turn. */
const PROBE_ANSWER =
  "Initially I split the documents on a thousand characters with no overlap, and answers were coming back cut off mid sentence. I moved to five hundred with about fifty characters of overlap and that fixed most of it. For retrieval I was pulling the top five chunks, I tried ten and it started dragging in unrelated material.";

/**
 * Crude in-process meter.
 *
 * Not a security control — it is a cost control. One developer holding down a
 * button should not be able to spend a hundred synthesis calls, and a probe is
 * exactly the kind of tool that gets left open in a tab.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const calls: number[] = [];

function spend(): boolean {
  const now = Date.now();
  while (calls.length > 0 && now - calls[0] > WINDOW_MS) calls.shift();
  if (calls.length >= MAX_PER_WINDOW) return false;
  calls.push(now);
  return true;
}

function flagOn(): boolean {
  return process.env.ENABLE_INTERVIEW_LATENCY_PROBE === "true";
}

/**
 * Constant-time compare of the shared probe secret.
 *
 * `timingSafeEqual` throws on a length mismatch, so the lengths are checked
 * first — and a short or unset `INTERVIEW_PROBE_TOKEN` is treated as NO token
 * rather than as an easy one. 32 characters is the floor: a diagnostic endpoint
 * guarded by a four-letter password is not guarded.
 */
const MIN_TOKEN_CHARS = 32;

function tokenMatches(request: Request): boolean {
  const expected = process.env.INTERVIEW_PROBE_TOKEN ?? "";
  if (expected.length < MIN_TOKEN_CHARS) return false;

  const presented = request.headers.get("x-interview-probe-token") ?? "";
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

type Caller = { how: "admin"; adminId: string } | { how: "token" };

/**
 * Who is allowed in. Returns null to mean "answer 404".
 *
 * 404 rather than 403 for the flag being off, because a disabled probe should
 * not confirm its own existence. A 403 is used only once the probe is ON and
 * the caller simply is not authorised — at that point its existence is already
 * established and a clear status is more useful than a riddle.
 */
async function authorise(
  request: Request,
): Promise<{ caller: Caller } | { status: 404 | 403; message: string }> {
  if (!flagOn()) return { status: 404, message: "Not found." };

  if (tokenMatches(request)) return { caller: { how: "token" } };

  // `getAdminContext` rather than `requireAdmin`: the latter redirects, which
  // would answer a fetch with an HTML login page under a 200 instead of a
  // status the caller can act on.
  const admin = await getAdminContext();
  if (admin) return { caller: { how: "admin", adminId: admin.userId } };

  return { status: 403, message: "Not authorised." };
}

const querySchema = z.object({
  hop: z.enum(["audio", "llm"]).default("audio"),
  /**
   * `stream` is what the room does now; `buffer` reproduces what it did before
   * (hold the whole MP3, then respond). Having both behind one flag is the only
   * way to A/B the change without checking the old code back out.
   */
  mode: z.enum(["stream", "buffer"]).default("stream"),
});

export async function GET(request: Request) {
  const gate = await authorise(request);
  if ("status" in gate) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: gate.status },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    hop: url.searchParams.get("hop") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid probe request." }, { status: 400 });
  }
  if (!spend()) {
    return NextResponse.json(
      { ok: false, message: `Probe is metered at ${MAX_PER_WINDOW} calls/minute.` },
      { status: 429 },
    );
  }

  const { hop, mode } = parsed.data;

  if (hop === "llm") {
    const llm = resolveInterviewLLM();
    const startedMs = Date.now();
    const decision = await llm.analyzeAnswer({
      question: {
        id: "probe-q1",
        order: 1,
        competency: "TECHNICAL_DEPTH",
        sourceRef: { source: "PLATFORM_PACK", sourceDays: [], label: "probe" },
        text: PROBE_LINE,
        tier: "CORE",
        mode: "IMPLEMENTATION",
        difficulty: "medium",
        llmPhrased: false,
        expectedEvidence: [
          "names a chunking strategy",
          "says why that size or overlap",
          "mentions a retrieval parameter they tuned",
        ],
        minEvidence: 2,
      },
      answerText: PROBE_ANSWER,
      priorEvidence: null,
      followUpsRemaining: 2,
      recentTranscript: [],
    });
    const elapsedMs = Date.now() - startedMs;

    logger.info("[mock-interview/latency-probe] llm", {
      provider: llm.name,
      elapsedMs,
      via: gate.caller.how,
    });
    return NextResponse.json(
      {
        ok: true,
        data: {
          hop: "llm",
          provider: llm.name,
          elapsedMs,
          // Proof the call was real rather than the deterministic fallback.
          degraded: decision.degraded,
          action: decision.action,
          answerChars: PROBE_ANSWER.length,
        },
      },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  }

  const startedMs = Date.now();
  const audio = await synthesizeLine(PROBE_LINE, "probe:latency");
  const headersMs = Date.now() - startedMs;

  if (!audio.ok) {
    return NextResponse.json({ ok: false, message: audio.message }, { status: audio.status });
  }

  if (mode === "buffer") {
    // Deliberately reproduces the old behaviour: drain the whole stream before
    // responding, so the client's first byte cannot arrive until synthesis has
    // completely finished.
    const buffered = await new Response(audio.data.audio).arrayBuffer();
    const completeMs = Date.now() - startedMs;
    logger.info("[mock-interview/latency-probe] audio buffered", {
      headersMs,
      completeMs,
      bytes: buffered.byteLength,
    });
    return new NextResponse(buffered, {
      status: 200,
      headers: {
        "Content-Type": audio.data.contentType,
        "Content-Length": String(buffered.byteLength),
        "Server-Timing": `synth;dur=${headersMs}, drain;dur=${completeMs}`,
        "X-Probe-Chars": String(PROBE_LINE.length),
        "Access-Control-Expose-Headers": "Server-Timing, X-Probe-Chars",
        "Cache-Control": "no-store, private",
      },
    });
  }

  logger.info("[mock-interview/latency-probe] audio streaming", {
    headersMs,
    via: gate.caller.how,
  });
  return new NextResponse(audio.data.audio, {
    status: 200,
    headers: {
      "Content-Type": audio.data.contentType,
      // No Content-Length: a passthrough stream's size is not known up front.
      "Server-Timing": `synth;dur=${headersMs}`,
      "X-Probe-Chars": String(PROBE_LINE.length),
      "Access-Control-Expose-Headers": "Server-Timing, X-Probe-Chars",
      "Cache-Control": "no-store, private",
    },
  });
}

/**
 * Times transcription on a recording the developer just made.
 *
 * Goes through the same upload gate and the same `transcribeAnswer` the real
 * route uses, so the reported vendor, model and detected language are the ones
 * a candidate would get.
 */
export async function POST(request: Request) {
  const gate = await authorise(request);
  if ("status" in gate) {
    return NextResponse.json(
      { ok: false, message: gate.message },
      { status: gate.status },
    );
  }
  if (!spend()) {
    return NextResponse.json(
      { ok: false, message: `Probe is metered at ${MAX_PER_WINDOW} calls/minute.` },
      { status: 429 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "No audio." }, { status: 400 });
  }

  const rejection = rejectAudioUpload(file.size, file.type);
  if (rejection) {
    return NextResponse.json({ ok: false, message: `Upload rejected: ${rejection}` }, { status: 415 });
  }

  const filename = audioFilenameFor(file.type);
  const startedMs = Date.now();
  const result = await transcribeAnswer(file, filename, "probe:latency");
  const elapsedMs = Date.now() - startedMs;

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  logger.info("[mock-interview/latency-probe] stt", {
    via: gate.caller.how,
    elapsedMs,
    bytes: file.size,
    chars: result.data.text.length,
  });

  return NextResponse.json(
    {
      ok: true,
      data: {
        hop: "stt",
        elapsedMs,
        bytes: file.size,
        filename,
        // Which path actually served it — the whole point of the change under
        // test is that this now says groq rather than openai.
        vendor: process.env.GROQ_API_KEY ? "groq (preferred)" : "openai",
        detectedLanguage: result.data.language,
        chars: result.data.text.length,
        text: result.data.text,
      },
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
