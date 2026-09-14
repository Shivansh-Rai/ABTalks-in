/**
 * T-219 — activity ingestion for a strict assessment attempt.
 *
 * This is a Route Handler rather than a Server Action because `navigator.sendBeacon`
 * and `fetch(..., { keepalive: true })` cannot set the Next.js `Next-Action` header,
 * and page-leave facts are lost without one of those (§2.4 of plan 140).
 *
 * Safety: the session cookie is SameSite=Lax (a cross-site POST carries no session),
 * an Origin check is defense in depth, the service scopes every write to the session
 * user, and a foreign assignment id is NOT_FOUND. Bodies are accepted as text/plain
 * because sendBeacon sends text. Event bodies are never logged.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { MAX_EVENT_BODY_BYTES } from "@/lib/validations/assessment";
import { recordAttemptEvents } from "@/features/assessment-attempts/service";
import { prismaAttemptStore } from "@/features/assessment-attempts/prisma-store";

function reply(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function statusFor(code: "NOT_FOUND" | "INVALID" | "CONFLICT"): number {
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return 400;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  // 1. Same-origin only (defense in depth; the session cookie is SameSite=Lax).
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
    if (host !== request.nextUrl.host) return reply(403, { ok: false, message: "Forbidden" });
  }
  // 2. The candidate is the session user.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return reply(401, { ok: false, message: "Please sign in to continue." });
  // 3. Path param + body.
  const parsedParams = z.object({ assignmentId: z.string().min(1).max(64) }).safeParse(await params);
  if (!parsedParams.success) return reply(404, { ok: false, message: "Assessment not found" });
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_EVENT_BODY_BYTES) {
    return reply(413, { ok: false, message: "Too large" });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, message: "Invalid activity batch" });
  }
  // 4. Service.
  try {
    const result = await recordAttemptEvents(
      prismaAttemptStore(),
      userId,
      parsedParams.data.assignmentId,
      body,
      new Date(),
    );
    if (!result.ok) return reply(statusFor(result.code), { ok: false, message: result.message });
    return reply(200, { ok: true, data: result.data });
  } catch (error) {
    logger.error("[assessment-events] record", {
      assignmentId: parsedParams.data.assignmentId,
      error: String(error),
    });
    return reply(500, { ok: false, message: "Couldn't record activity." });
  }
}
