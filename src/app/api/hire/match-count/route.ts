/**
 * Matching-candidate count for the /hire review card.
 *
 * A POST Route Handler, not a Server Action, for the same reason as
 * `/api/hire/brief`: Server Action calls are serialized by the Next.js client
 * router, and a count must never queue in front of the recruiter's Search.
 *
 * Public like the Scout hero (guests search here too), so it is rate limited
 * per user when signed in and per IP otherwise, in the SEARCH bucket under its
 * own `count:` subject. It returns one number, never a candidate.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import {
  assertRateLimit,
  rateLimitSubjectFromHeaders,
} from "@/lib/rate-limit";
import { jobSpecSchema } from "@/lib/validations/hire";
import { countMatchingCandidates } from "@/features/hire/count-candidates";

const NO_STORE = { "Cache-Control": "private, no-store" };

const matchCountInputSchema = z.object({ spec: jobSpecSchema });

function fail(message: string, status: number) {
  return NextResponse.json(
    { ok: false as const, message },
    { status, headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request.", 400);
  }
  const parsed = matchCountInputSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid request.", 400);

  const session = await auth();
  const subject = session?.user?.id
    ? `user:${session.user.id}`
    : await rateLimitSubjectFromHeaders(await headers());
  const limited = await assertRateLimit({
    bucket: "SEARCH",
    subjectId: `count:${subject}`,
  });
  if (!limited.ok) return fail(limited.message, 429);

  const result = await countMatchingCandidates(parsed.data.spec);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false as const, message: result.message },
      { headers: NO_STORE },
    );
  }
  return NextResponse.json(
    { ok: true as const, data: result.data },
    { headers: NO_STORE },
  );
}
