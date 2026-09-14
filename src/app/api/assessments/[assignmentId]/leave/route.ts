/**
 * T-219 / plan 141 — force-finalize a strict attempt on page leave.
 *
 * Route Handler (not a Server Action) so `navigator.sendBeacon` /
 * `fetch(..., { keepalive: true })` can reach it on tab close.
 *
 * Safety: SameSite=Lax session cookie + Origin check; service scopes to the
 * session user; foreign assignment id is NOT_FOUND. Bodies are text/plain
 * because sendBeacon sends text.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { finalizeStrictAttemptOnLeave } from "@/features/assessment-attempts/service";
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

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return reply(401, { ok: false, message: "Please sign in to continue." });

  const parsedParams = z.object({ assignmentId: z.string().min(1).max(64) }).safeParse(await params);
  if (!parsedParams.success) return reply(404, { ok: false, message: "Assessment not found" });

  const text = await request.text();
  if (Buffer.byteLength(text) > 4096) {
    return reply(413, { ok: false, message: "Too large" });
  }
  let body: unknown = {};
  if (text.trim() !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { ok: false, message: "Invalid leave payload" });
    }
  }
  const parsedBody = z
    .object({ reason: z.literal("leave").optional() })
    .safeParse(body);
  if (!parsedBody.success) {
    return reply(400, { ok: false, message: "Invalid leave payload" });
  }

  const mobile = request.headers.get("sec-ch-ua-mobile") === "?1";

  try {
    const result = await finalizeStrictAttemptOnLeave(
      prismaAttemptStore(),
      userId,
      parsedParams.data.assignmentId,
      { mobile },
    );
    if (!result.ok) return reply(statusFor(result.code), { ok: false, message: result.message });
    return reply(200, { ok: true, data: result.data });
  } catch (error) {
    logger.error("[assessment-leave] finalize", {
      assignmentId: parsedParams.data.assignmentId,
      error: String(error),
    });
    return reply(500, { ok: false, message: "Couldn't close this assessment." });
  }
}
